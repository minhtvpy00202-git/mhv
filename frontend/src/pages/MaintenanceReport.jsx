import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Camera, ImagePlus, QrCode, Sparkles, Ticket, TriangleAlert, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'
import { useAuth } from '../context/AuthContext'
import { parseSpecsToEntries } from '../utils/assetSpecs'
import { compressImageToBlob } from '../utils/imageProcessing'
import { validateMaintenanceTicketForm } from '../utils/validation'

const scannerElementId = 'maintenance-scanner'
const priorityOptions = [
  { value: 'LOW', label: 'Thấp' },
  { value: 'MEDIUM', label: 'Trung bình' },
  { value: 'HIGH', label: 'Cao' },
]
const scannerConfig = { fps: 10, qrbox: { width: 240, height: 240 } }

function MaintenanceReport() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const scannerRef = useRef(null)
  const isScanningRef = useRef(false)
  const keepScannerAliveRef = useRef(true)
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const [assetQaCode, setAssetQaCode] = useState('')
  const [assetName, setAssetName] = useState('')
  const [assetLocationName, setAssetLocationName] = useState('')
  const [assetHomeLocationName, setAssetHomeLocationName] = useState('')
  const [assetSpecs, setAssetSpecs] = useState([])
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('MEDIUM')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState('')
  const [showScannerModal, setShowScannerModal] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [processingImage, setProcessingImage] = useState(false)
  const [loading, setLoading] = useState(false)
  const [latestTicket, setLatestTicket] = useState(null)
  const [formErrors, setFormErrors] = useState({})
  const [scannerError, setScannerError] = useState('')
  const processingFallbackTimerRef = useRef(null)

  useEffect(() => {
    let restartTimer = null
    if (showScannerModal && !showModal && keepScannerAliveRef.current) {
      restartTimer = window.setTimeout(() => {
        void startScanner()
      }, 120)
    } else {
      void stopScanner()
    }
    const handleVisibilityChange = () => {
      if (document.hidden) {
        void stopScanner()
        return
      }
      if (showScannerModal && !showModal && keepScannerAliveRef.current) {
        void startScanner()
      }
    }
    const handlePageHide = () => {
      void stopScanner()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', handlePageHide)
    return () => {
      if (restartTimer) {
        window.clearTimeout(restartTimer)
      }
      if (processingFallbackTimerRef.current) {
        clearTimeout(processingFallbackTimerRef.current)
        processingFallbackTimerRef.current = null
      }
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', handlePageHide)
      void stopScanner()
    }
  }, [showModal, showScannerModal])

  useEffect(() => {
    if (!user?.userId) return
    let mounted = true
    const loadLatestTicket = async () => {
      try {
        const response = await axiosClient.get('/api/maintenance/latest-ticket/me')
        if (!mounted) return
        setLatestTicket(response.data || null)
      } catch (error) {
        if (!mounted) return
        const message = error?.response?.data?.message || 'Không tải được ticket gần nhất.'
        toast.error(message)
        setLatestTicket(null)
      }
    }
    loadLatestTicket()
    return () => {
      mounted = false
    }
  }, [user?.userId])

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

  const requestCameraPermission = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Trình duyệt hiện tại không hỗ trợ camera.')
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
      },
      audio: false,
    })
    stream.getTracks().forEach((track) => track.stop())
  }

  const startScanner = async () => {
    if (isScanningRef.current) return
    const scannerElement = document.getElementById(scannerElementId)
    if (!scannerElement) {
      setScannerError('Không tìm thấy khung camera để khởi động máy quét.')
      return
    }
    setScannerError('')
    await stopScanner()
    let permissionGranted = false
    const scanner = new Html5Qrcode(scannerElementId)
    scannerRef.current = scanner
    try {
      await requestCameraPermission()
      permissionGranted = true
      await scanner.start(
        { facingMode: 'environment' },
        scannerConfig,
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
            setAssetSpecs(parseSpecsToEntries(response.data?.specs))
            setFormErrors({})
            setShowScannerModal(false)
            setShowModal(true)
          } catch {
            setAssetQaCode('')
            setAssetName('')
            setAssetLocationName('')
            setAssetHomeLocationName('')
            setAssetSpecs([])
            toast.error('Mã tài sản không tồn tại')
            startScanner()
          }
        },
        () => {},
      )
      isScanningRef.current = true
      setScannerError('')
    } catch (error) {
      const message = error?.message || ''
      const denied = /denied|permission|notallowed|secure/i.test(message)
      const blockedMessage = denied
        ? 'Camera đang bị chặn hoặc chưa được cấp quyền. Hãy bấm vào biểu tượng camera trên thanh địa chỉ rồi cho phép truy cập.'
        : 'Không thể mở camera. Vui lòng kiểm tra quyền camera hoặc thử tải lại trang.'
      setScannerError(blockedMessage)
      toast.error(blockedMessage)
      if (permissionGranted) {
        await stopScanner()
      } else {
        scannerRef.current = null
        isScanningRef.current = false
      }
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

  const resetForm = () => {
    setAssetQaCode('')
    setAssetName('')
    setAssetLocationName('')
    setAssetHomeLocationName('')
    setAssetSpecs([])
    setDescription('')
    setPriority('MEDIUM')
    setImageFile(null)
    setFormErrors({})
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl)
    }
    setImagePreviewUrl('')
  }

  const closeModal = () => {
    if (loading) return
    setShowModal(false)
    resetForm()
  }

  const closeScannerModal = async () => {
    keepScannerAliveRef.current = false
    setShowScannerModal(false)
    await stopScanner()
  }

  const handleSelectImage = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const nextErrors = validateMaintenanceTicketForm({
      assetQaCode,
      description,
      priority,
      imageFile: file,
    })
    if (nextErrors.imageFile) {
      setFormErrors((prev) => ({ ...prev, imageFile: nextErrors.imageFile }))
      toast.error(nextErrors.imageFile)
      return
    }
    setFormErrors((prev) => ({ ...prev, imageFile: '' }))
    setProcessingImage(true)
    processingFallbackTimerRef.current = setTimeout(() => {
      setProcessingImage(false)
      toast.error('Thiết bị xử lý ảnh quá lâu. Vui lòng thử ảnh khác hoặc chọn ảnh từ thư viện.')
    }, 12000)
    try {
      const compressedBlob = await compressImageToBlob(file)
      if (!compressedBlob) {
        toast.error('Không xử lý được ảnh.')
        return
      }
      const normalizedName = file.name?.replace(/\.[^.]+$/, '') || `ticket-image-${Date.now()}`
      const normalizedFile = new File([compressedBlob], `${normalizedName}.jpg`, { type: 'image/jpeg' })
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl)
      }
      setImageFile(normalizedFile)
      setImagePreviewUrl(URL.createObjectURL(normalizedFile))
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể nén ảnh để đính kèm.'
      toast.error(message)
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
    const nextErrors = validateMaintenanceTicketForm({
      assetQaCode,
      description,
      priority,
      imageFile,
    })
    setFormErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      toast.error(Object.values(nextErrors)[0])
      return
    }
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('assetQaCode', assetQaCode)
      formData.append('description', description)
      formData.append('priority', priority)
      if (imageFile) {
        formData.append('image', imageFile)
      }
      const response = await axiosClient.post('/api/tickets', formData)
      const createdTicket = response.data || null
      const ticketId = createdTicket?.id
      toast.success(`Đã tạo ticket báo hỏng thành công${assetName ? `: ${assetName}` : ''}.`)
      setLatestTicket(createdTicket)
      keepScannerAliveRef.current = false
      await stopScanner()
      setShowModal(false)
      resetForm()
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
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-fptOrange to-orange-500 p-5 text-white shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/90">
              <Sparkles size={14} />
              Báo hỏng nhanh
            </p>
            <h2 className="mt-3 text-2xl font-bold">Quét mã QR và gửi ticket như một ứng dụng di động</h2>
            <p className="mt-2 text-sm leading-6 text-white/90">
              Quét thiết bị, mô tả lỗi, đính kèm ảnh và theo dõi quá trình xử lý gọn ngay trên điện thoại.
            </p>
          </div>
          <div className="rounded-2xl bg-white/15 p-3">
            <QrCode size={28} />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {latestTicket?.id && (
            <button
              type="button"
              onClick={() => navigate(`/mobile/tickets/${latestTicket.id}`)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-3 text-sm font-semibold text-fptOrange shadow-sm"
            >
              <Ticket size={16} />
              Mở ticket gần nhất
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              keepScannerAliveRef.current = true
              setScannerError('')
              setShowScannerModal(true)
            }}
            className={`inline-flex items-center justify-center gap-2 rounded-xl border border-white/40 px-3 py-3 text-sm font-semibold text-white ${latestTicket?.id ? '' : 'col-span-2'}`}
          >
            <QrCode size={16} />
            Mở camera quét QR
          </button>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-2xl bg-white/12 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/80">Bước 1</p>
            <p className="mt-1 text-sm font-semibold">Quét thiết bị</p>
            <p className="mt-1 text-xs text-white/80">Mở camera và nhận diện đúng mã QA.</p>
          </div>
          <div className="rounded-2xl bg-white/12 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/80">Bước 2</p>
            <p className="mt-1 text-sm font-semibold">Mô tả sự cố</p>
            <p className="mt-1 text-xs text-white/80">Ghi rõ hiện tượng lỗi và đính kèm ảnh.</p>
          </div>
          <div className="rounded-2xl bg-white/12 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/80">Bước 3</p>
            <p className="mt-1 text-sm font-semibold">Theo dõi và đánh giá</p>
            <p className="mt-1 text-xs text-white/80">Mở ticket để chat và phản hồi sau xử lý.</p>
          </div>
        </div>
      </section>

      {showScannerModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">Quét QR để chọn thiết bị</p>
                <p className="mt-1 text-xs text-slate-500">Đưa mã QR vào khung camera. Hệ thống sẽ tự mở form báo hỏng khi quét thành công.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  void closeScannerModal()
                }}
                className="rounded-xl border border-slate-300 p-2 text-slate-600 hover:bg-slate-50"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-4 rounded-[28px] border border-slate-200 bg-slate-950 p-3 shadow-inner">
              <div className="rounded-[22px] border border-dashed border-white/20 bg-slate-900 p-2">
                <div id={scannerElementId} className="min-h-[320px] overflow-hidden rounded-[18px] bg-black" />
              </div>
            </div>
            {scannerError && (
              <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {scannerError}
              </div>
            )}
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              Giữ camera ổn định trong 1-2 giây. Nếu không quét được, hãy tăng ánh sáng hoặc đưa mã QR gần hơn.
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/50 p-4">
          <form onSubmit={handleSubmit} className="w-full max-w-md rounded-3xl bg-white p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-800">Nhập mô tả lỗi thiết bị</h3>
                <p className="mt-1 text-sm text-slate-500">Kiểm tra lại thông tin thiết bị trước khi gửi ticket.</p>
              </div>
              <div className="rounded-xl bg-orange-50 p-2 text-fptOrange">
                <TriangleAlert size={18} />
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Thiết bị đã quét</p>
              <p><span className="font-semibold">Mã QA:</span> {assetQaCode}</p>
              <p className="mt-1"><span className="font-semibold">Tên thiết bị:</span> {assetName || 'Đang tải...'}</p>
              <p className="mt-1"><span className="font-semibold">Phòng hiện tại:</span> {assetLocationName || 'Không xác định'}</p>
              <p className="mt-1"><span className="font-semibold">Phòng gốc:</span> {assetHomeLocationName || 'Không xác định'}</p>
              {assetSpecs.length > 0 && (
                <div className="mt-3 rounded-xl bg-white p-3">
                  <p className="font-semibold text-slate-700">Đặc tính kỹ thuật</p>
                  <div className="mt-2 space-y-1 text-sm text-slate-600">
                    {assetSpecs.map((entry) => (
                      <p key={`${entry.name}-${entry.value}`}>
                        <span className="font-medium text-slate-700">{entry.name}:</span> {entry.value}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="mt-3 rounded-2xl border border-slate-200 p-3">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Nội dung ticket</p>
              <label className="mb-1 block text-sm font-medium text-slate-700">Mô tả lỗi</label>
              <textarea
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value)
                  setFormErrors((prev) => ({ ...prev, description: '' }))
                }}
                rows={4}
                className={`w-full rounded-lg border px-3 py-2 outline-none ring-fptOrange focus:ring-2 ${formErrors.description ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
                placeholder="Mô tả chi tiết tình trạng hỏng"
              />
              {formErrors.description && <p className="mt-1 text-xs text-red-600">{formErrors.description}</p>}
            </div>
            <div className="mt-3 rounded-2xl border border-slate-200 p-3">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Mức ưu tiên và ảnh minh họa</p>
              <label className="mb-1 block text-sm font-medium text-slate-700">Mức độ ưu tiên</label>
              <div className="grid grid-cols-3 gap-2">
                {priorityOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPriority(option.value)}
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                      priority === option.value
                        ? 'border-fptOrange bg-orange-50 text-fptOrange'
                        : 'border-slate-300 bg-white text-slate-600'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {formErrors.priority && <p className="mt-1 text-xs text-red-600">{formErrors.priority}</p>}
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
                className="inline-flex items-center gap-1 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <ImagePlus size={16} />
                  Chọn ảnh lỗi
                </button>
                <button
                type="button"
                onClick={handleOpenCamera}
                disabled={processingImage || loading}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Camera size={16} />
                  Chụp ảnh lỗi
                </button>
              </div>
              {imagePreviewUrl && (
                <div className="mt-3">
                  <p className="mb-1 text-xs text-slate-500">Ảnh lỗi đính kèm</p>
                  <img src={imagePreviewUrl} alt="error-preview" className="h-32 w-32 rounded-xl border border-slate-200 object-cover" />
                </div>
              )}
              {formErrors.imageFile && <p className="mt-2 text-xs text-red-600">{formErrors.imageFile}</p>}
              {processingImage && <p className="mt-2 text-xs text-slate-500">Đang xử lý ảnh...</p>}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-fptOrange px-4 py-2 font-semibold text-white hover:bg-fptOrangeDark disabled:opacity-60"
              >
                Gửi báo hỏng
              </button>
              <button
                type="button"
                onClick={closeModal}
                disabled={loading}
                className="rounded-xl border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
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
