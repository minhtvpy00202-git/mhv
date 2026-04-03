import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Camera, ImagePlus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'
import { compressImageForUpload } from '../utils/imageProcessing'

const scannerElementId = 'maintenance-scanner'

function MaintenanceReport() {
  const navigate = useNavigate()
  const scannerRef = useRef(null)
  const isScanningRef = useRef(false)
  const keepScannerAliveRef = useRef(true)
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const [assetQaCode, setAssetQaCode] = useState('')
  const [assetName, setAssetName] = useState('')
  const [assetLocationName, setAssetLocationName] = useState('')
  const [assetHomeLocationName, setAssetHomeLocationName] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('MEDIUM')
  const [imageUrl, setImageUrl] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [processingImage, setProcessingImage] = useState(false)
  const [loading, setLoading] = useState(false)
  const processingFallbackTimerRef = useRef(null)

  useEffect(() => {
    if (!showModal && keepScannerAliveRef.current) {
      void startScanner()
    } else {
      void stopScanner()
    }
    const handleVisibilityChange = () => {
      if (document.hidden) {
        void stopScanner()
        return
      }
      if (!showModal && keepScannerAliveRef.current) {
        void startScanner()
      }
    }
    const handlePageHide = () => {
      void stopScanner()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', handlePageHide)
    return () => {
      keepScannerAliveRef.current = false
      if (processingFallbackTimerRef.current) {
        clearTimeout(processingFallbackTimerRef.current)
        processingFallbackTimerRef.current = null
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', handlePageHide)
      void stopScanner()
    }
  }, [showModal])

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

  const handleSelectImage = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setProcessingImage(true)
    processingFallbackTimerRef.current = setTimeout(() => {
      setProcessingImage(false)
      toast.error('Thiết bị xử lý ảnh quá lâu. Vui lòng thử ảnh khác hoặc chọn ảnh từ thư viện.')
    }, 12000)
    try {
      const compressedDataUrl = await compressImageForUpload(file)
      if (!compressedDataUrl) {
        toast.error('Không xử lý được ảnh.')
        return
      }
      setImageUrl(compressedDataUrl)
    } catch {
      toast.error('Không thể nén ảnh để đính kèm.')
    } finally {
      if (processingFallbackTimerRef.current) {
        clearTimeout(processingFallbackTimerRef.current)
        processingFallbackTimerRef.current = null
      }
      setProcessingImage(false)
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
      keepScannerAliveRef.current = false
      await stopScanner()
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
    }
  }

  const handleOpenCamera = () => {
    cameraInputRef.current?.click()
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
                disabled={processingImage || loading}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <ImagePlus size={16} />
                Chọn ảnh lỗi
              </button>
              <button
                type="button"
                onClick={handleOpenCamera}
                disabled={processingImage || loading}
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
            {processingImage && <p className="mt-2 text-xs text-slate-500">Đang xử lý ảnh...</p>}
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
    </div>
  )
}

export default MaintenanceReport
