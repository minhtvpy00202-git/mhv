import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Camera, ImagePlus, QrCode, Sparkles, Ticket, TriangleAlert } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'
import { useAuth } from '../context/AuthContext'
import { formatVietnamDateTime } from '../utils/datetime'
import { compressImageToBlob } from '../utils/imageProcessing'
import { getTicketStatusMeta } from '../utils/ticketStatus'

const scannerElementId = 'maintenance-scanner'
const priorityOptions = [
  { value: 'LOW', label: 'Thấp' },
  { value: 'MEDIUM', label: 'Trung bình' },
  { value: 'HIGH', label: 'Cao' },
]

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
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('MEDIUM')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [processingImage, setProcessingImage] = useState(false)
  const [loading, setLoading] = useState(false)
  const [latestTicket, setLatestTicket] = useState(null)
  const [loadingLatestTicket, setLoadingLatestTicket] = useState(false)
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
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', handlePageHide)
      void stopScanner()
    }
  }, [showModal])

  useEffect(() => {
    if (!user?.userId) return
    let mounted = true
    const loadLatestTicket = async () => {
      setLoadingLatestTicket(true)
      try {
        const response = await axiosClient.get('/api/tickets', {
          params: { reporter_id: user.userId },
        })
        if (!mounted) return
        const rows = Array.isArray(response.data) ? response.data : []
        const [latest] = [...rows].sort((left, right) => {
          const leftTime = new Date(left.createdAt || 0).getTime()
          const rightTime = new Date(right.createdAt || 0).getTime()
          if (rightTime !== leftTime) return rightTime - leftTime
          return Number(right.id || 0) - Number(left.id || 0)
        })
        setLatestTicket(latest || null)
      } catch (error) {
        if (!mounted) return
        const message = error?.response?.data?.message || 'Không tải được ticket gần nhất.'
        toast.error(message)
      } finally {
        if (mounted) {
          setLoadingLatestTicket(false)
        }
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

  const resetForm = () => {
    setAssetQaCode('')
    setAssetName('')
    setAssetLocationName('')
    setAssetHomeLocationName('')
    setDescription('')
    setPriority('MEDIUM')
    setImageFile(null)
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl)
    }
    setImagePreviewUrl('')
  }

  const closeModal = () => {
    if (loading) return
    setShowModal(false)
    resetForm()
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
    if (!assetQaCode || !description) {
      toast.error('Vui lòng nhập đầy đủ mã QA và mô tả lỗi.')
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

  const latestTicketStatus = getTicketStatusMeta(latestTicket?.status)

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
              Quét thiết bị, mô tả lỗi, đính kèm ảnh và mở lại ticket gần nhất để theo dõi kỹ thuật viên xử lý.
            </p>
          </div>
          <div className="rounded-2xl bg-white/15 p-3">
            <QrCode size={28} />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {latestTicket?.id && (
            <button
              type="button"
              onClick={() => navigate(`/mobile/tickets/${latestTicket.id}`)}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-fptOrange shadow-sm"
            >
              <Ticket size={16} />
              Mở ticket gần nhất
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              keepScannerAliveRef.current = true
              void startScanner()
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-white/40 px-4 py-2 text-sm font-semibold text-white"
          >
            <QrCode size={16} />
            Quét lại ngay
          </button>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-800">Ticket gần nhất của bạn</h3>
            <p className="mt-1 text-sm text-slate-500">Mở nhanh ticket mới nhất để xem tiến độ xử lý hoặc chat với kỹ thuật viên.</p>
          </div>
          <div className="rounded-xl bg-orange-50 p-2 text-fptOrange">
            <Ticket size={18} />
          </div>
        </div>
        {loadingLatestTicket ? (
          <p className="mt-3 rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-500">Đang tải ticket gần nhất...</p>
        ) : latestTicket ? (
          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">{latestTicket.assetName || 'Thiết bị không xác định'}</p>
                <p className="mt-1 text-xs text-slate-500">Ticket #{latestTicket.id} · {latestTicket.assetQaCode}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${latestTicketStatus.badgeClassName}`}>
                {latestTicketStatus.label}
              </span>
            </div>
            <div className="mt-3 grid gap-2 text-sm text-slate-600">
              <p><span className="font-medium text-slate-700">Tạo lúc:</span> {formatVietnamDateTime(latestTicket.createdAt)}</p>
              <p><span className="font-medium text-slate-700">Kỹ thuật viên:</span> {latestTicket.assigneeName || 'Chưa gán'}</p>
              <p className="line-clamp-2"><span className="font-medium text-slate-700">Mô tả:</span> {latestTicket.description || 'Không có mô tả.'}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => navigate(`/mobile/tickets/${latestTicket.id}`)}
                className="inline-flex items-center gap-2 rounded-xl bg-fptOrange px-4 py-2 text-sm font-semibold text-white"
              >
                <TriangleAlert size={16} />
                Mở ticket gần nhất
              </button>
              <button
                type="button"
                onClick={() => navigate('/mobile/chats')}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
              >
                <Ticket size={16} />
                Xem danh sách chat
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
            Bạn chưa tạo ticket nào. Hãy quét một thiết bị để bắt đầu báo hỏng.
          </p>
        )}
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-800">Quét QR để báo hỏng thiết bị</h3>
            <p className="mt-1 text-sm text-slate-500">Đưa mã QR vào khung quét. Hệ thống sẽ tự nhận diện thiết bị và mở form báo lỗi.</p>
          </div>
          <div className="rounded-xl bg-sky-50 p-2 text-sky-600">
            <QrCode size={18} />
          </div>
        </div>
        <div className="mt-4 rounded-[28px] border border-slate-200 bg-slate-950 p-3 shadow-inner">
          <div className="rounded-[22px] border border-dashed border-white/20 bg-slate-900 p-2">
            <div id={scannerElementId} className="min-h-[280px] overflow-hidden rounded-[18px] bg-black" />
          </div>
        </div>
        <div className="mt-3 grid gap-2 text-xs text-slate-500">
          <p>1. Hướng camera vào mã QR trên thiết bị.</p>
          <p>2. Kiểm tra lại thông tin thiết bị trong form hiện ra.</p>
          <p>3. Viết mô tả lỗi và đính kèm ảnh để kỹ thuật viên xử lý nhanh hơn.</p>
        </div>
      </section>

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
            <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
              <p><span className="font-semibold">Mã QA:</span> {assetQaCode}</p>
              <p className="mt-1"><span className="font-semibold">Tên thiết bị:</span> {assetName || 'Đang tải...'}</p>
              <p className="mt-1"><span className="font-semibold">Phòng hiện tại:</span> {assetLocationName || 'Không xác định'}</p>
              <p className="mt-1"><span className="font-semibold">Phòng gốc:</span> {assetHomeLocationName || 'Không xác định'}</p>
            </div>
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
            {processingImage && <p className="mt-2 text-xs text-slate-500">Đang xử lý ảnh...</p>}
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
