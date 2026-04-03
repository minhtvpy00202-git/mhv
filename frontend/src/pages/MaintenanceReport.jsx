import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Camera, ImagePlus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'

const scannerElementId = 'maintenance-scanner'
const TARGET_IMAGE_BYTES = 700 * 1024
const MAX_IMAGE_DIMENSION = 1600

function canvasToBlob(canvas, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality)
  })
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('read-failed'))
    reader.readAsDataURL(blob)
  })
}

async function compressImageFile(file) {
  const rawDataUrl = await blobToDataUrl(file)
  const image = await new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image-load-failed'))
    img.src = rawDataUrl
  })

  let width = image.width
  let height = image.height
  const maxDimension = Math.max(width, height)
  if (maxDimension > MAX_IMAGE_DIMENSION) {
    const scale = MAX_IMAGE_DIMENSION / maxDimension
    width = Math.round(width * scale)
    height = Math.round(height * scale)
  }

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) {
    return rawDataUrl
  }

  let bestBlob = null
  let workingWidth = width
  let workingHeight = height

  for (let cycle = 0; cycle < 6; cycle += 1) {
    canvas.width = workingWidth
    canvas.height = workingHeight
    context.clearRect(0, 0, workingWidth, workingHeight)
    context.drawImage(image, 0, 0, workingWidth, workingHeight)

    for (let quality = 0.88; quality >= 0.38; quality -= 0.1) {
      const blob = await canvasToBlob(canvas, quality)
      if (!blob) continue
      bestBlob = blob
      if (blob.size <= TARGET_IMAGE_BYTES) {
        return blobToDataUrl(blob)
      }
    }

    if (workingWidth < 500 || workingHeight < 500) {
      break
    }
    workingWidth = Math.round(workingWidth * 0.82)
    workingHeight = Math.round(workingHeight * 0.82)
  }

  if (!bestBlob) {
    return rawDataUrl
  }
  return blobToDataUrl(bestBlob)
}

function MaintenanceReport() {
  const navigate = useNavigate()
  const scannerRef = useRef(null)
  const isScanningRef = useRef(false)
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const cameraVideoRef = useRef(null)
  const cameraStreamRef = useRef(null)
  const [assetQaCode, setAssetQaCode] = useState('')
  const [assetName, setAssetName] = useState('')
  const [assetLocationName, setAssetLocationName] = useState('')
  const [assetHomeLocationName, setAssetHomeLocationName] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('MEDIUM')
  const [imageUrl, setImageUrl] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showCameraModal, setShowCameraModal] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    startScanner()
    return () => {
      stopScanner()
    }
  }, [])

  const extractQaCode = (decodedText) => {
    try {
      const parsed = JSON.parse(decodedText)
      if (parsed?.qa_code) {
        return String(parsed.qa_code).trim()
      }
    } catch {
      return decodedText.trim()
    }
    return decodedText.trim()
  }

  const startScanner = async () => {
    if (isScanningRef.current) return
    const scanner = new Html5Qrcode(scannerElementId)
    scannerRef.current = scanner
    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decodedText) => {
          const qaCode = extractQaCode(decodedText)
          if (!qaCode) return
          await stopScanner()
          try {
            const response = await axiosClient.get(`/api/assets/${qaCode}`)
            setAssetQaCode(qaCode)
            setAssetName(response.data?.name || '')
            setAssetLocationName(response.data?.locationName || '')
            setAssetHomeLocationName(response.data?.homeLocationName || '')
            setShowModal(true)
          } catch {
            setAssetQaCode('')
            setAssetName('')
            setAssetLocationName('')
            setAssetHomeLocationName('')
            toast.error('Mã tài sản không tồn tại')
            startScanner()
          }
        },
        () => {},
      )
      isScanningRef.current = true
    } catch {
      toast.error('Không thể mở camera. Vui lòng cấp quyền truy cập camera.')
    }
  }

  const stopScanner = async () => {
    const scanner = scannerRef.current
    if (!scanner) return
    try {
      if (isScanningRef.current) {
        await scanner.stop()
      }
      await scanner.clear()
    } catch {
      return
    } finally {
      isScanningRef.current = false
      scannerRef.current = null
    }
  }

  const closeModal = () => {
    if (loading) return
    setShowModal(false)
    setAssetQaCode('')
    setAssetName('')
    setAssetLocationName('')
    setAssetHomeLocationName('')
    setDescription('')
    setPriority('MEDIUM')
    setImageUrl('')
    startScanner()
  }

  const stopCameraStream = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop())
      cameraStreamRef.current = null
    }
  }

  const handleSelectImage = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const compressedDataUrl = await compressImageFile(file)
      if (!compressedDataUrl) {
        toast.error('Không xử lý được ảnh.')
        return
      }
      setImageUrl(compressedDataUrl)
    } catch {
      toast.error('Không thể nén ảnh để đính kèm.')
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!assetQaCode || !description) {
      toast.error('Vui lòng nhập đầy đủ mã QA và mô tả lỗi.')
      return
    }
    setLoading(true)
    try {
      const response = await axiosClient.post('/api/tickets', {
        asset_qa_code: assetQaCode,
        description,
        priority,
        image_url: imageUrl || null,
      })
      const ticketId = response.data?.id
      toast.success(`Đã tạo ticket báo hỏng thành công${assetName ? `: ${assetName}` : ''}.`)
      setShowModal(false)
      setAssetQaCode('')
      setAssetName('')
      setAssetLocationName('')
      setAssetHomeLocationName('')
      setDescription('')
      setPriority('MEDIUM')
      setImageUrl('')
      if (ticketId) {
        navigate(`/mobile/tickets/${ticketId}`)
      }
    } catch (error) {
      const message = error?.response?.data?.message || 'Gửi báo hỏng thất bại.'
      toast.error(message)
    } finally {
      setLoading(false)
      startScanner()
    }
  }

  const handleOpenCamera = async () => {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '')
    if (isMobile) {
      cameraInputRef.current?.click()
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      cameraInputRef.current?.click()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      cameraStreamRef.current = stream
      setCameraReady(false)
      setShowCameraModal(true)
      setTimeout(() => {
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream
          cameraVideoRef.current.onloadedmetadata = () => setCameraReady(true)
          void cameraVideoRef.current.play()
        }
      }, 0)
    } catch {
      cameraInputRef.current?.click()
    }
  }

  const handleCaptureFromCamera = async () => {
    const video = cameraVideoRef.current
    if (!video) return
    if (!cameraReady || video.videoWidth === 0 || video.videoHeight === 0) {
      toast.error('Camera chưa sẵn sàng, vui lòng thử lại.')
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    const context = canvas.getContext('2d')
    if (!context) return
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise((resolve) => canvas.toBlob((value) => resolve(value), 'image/jpeg', 0.92))
    if (!blob) return
    const file = new File([blob], `maintenance-${Date.now()}.jpg`, { type: 'image/jpeg' })
    try {
      const compressedDataUrl = await compressImageFile(file)
      if (!compressedDataUrl) {
        toast.error('Không xử lý được ảnh.')
        return
      }
      setImageUrl(compressedDataUrl)
    } catch {
      toast.error('Không thể nén ảnh để đính kèm.')
    } finally {
      stopCameraStream()
      setShowCameraModal(false)
      setCameraReady(false)
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Quét QR để báo hỏng thiết bị</h2>
        <div id={scannerElementId} className="overflow-hidden rounded-xl border border-slate-200" />
      </section>

      {showModal && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/50 p-4">
          <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl bg-white p-4">
            <h3 className="text-base font-semibold text-slate-800">Nhập mô tả lỗi thiết bị</h3>
            <p className="mt-1 text-sm text-slate-600">Mã QA: {assetQaCode}</p>
            <p className="text-sm text-slate-600">Tên thiết bị: {assetName || 'Đang tải...'}</p>
            <p className="text-sm text-slate-600">Phòng hiện tại: {assetLocationName || 'Không xác định'}</p>
            <p className="text-sm text-slate-600">Phòng gốc: {assetHomeLocationName || 'Không xác định'}</p>
            <div className="mt-3">
              <label className="mb-1 block text-sm font-medium text-slate-700">Mô tả lỗi</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-fptOrange focus:ring-2"
                placeholder="Mô tả chi tiết tình trạng hỏng"
              />
            </div>
            <div className="mt-3">
              <label className="mb-1 block text-sm font-medium text-slate-700">Mức độ ưu tiên</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-fptOrange focus:ring-2"
              >
                <option value="LOW">Thấp</option>
                <option value="MEDIUM">Trung bình</option>
                <option value="HIGH">Cao</option>
              </select>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleSelectImage}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleSelectImage}
              className="hidden"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <ImagePlus size={16} />
                Chọn ảnh lỗi
              </button>
              <button
                type="button"
                onClick={handleOpenCamera}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <Camera size={16} />
                Chụp ảnh lỗi
              </button>
            </div>
            {imageUrl && (
              <div className="mt-3">
                <p className="mb-1 text-xs text-slate-500">Ảnh lỗi đính kèm</p>
                <img src={imageUrl} alt="error-preview" className="h-28 w-28 rounded-md border border-slate-200 object-cover" />
              </div>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-fptOrange px-4 py-2 font-semibold text-white hover:bg-fptOrangeDark disabled:opacity-60"
              >
                Gửi báo hỏng
              </button>
              <button
                type="button"
                onClick={closeModal}
                disabled={loading}
                className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Đóng
              </button>
            </div>
          </form>
        </div>
      )}
      {showCameraModal && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-3">
            <video ref={cameraVideoRef} autoPlay playsInline className="h-64 w-full rounded-lg bg-black object-cover" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleCaptureFromCamera}
                disabled={!cameraReady}
                className="rounded-lg bg-fptOrange px-3 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark"
              >
                Chụp và dùng ảnh
              </button>
              <button
                type="button"
                onClick={() => {
                  stopCameraStream()
                  setShowCameraModal(false)
                }}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MaintenanceReport
