import {
  IconAlertTriangle as TriangleAlert,
  IconArrowUpRight as ArrowUpRight,
  IconBolt as Bolt,
  IconCamera as Camera,
  IconDeviceMobile as DeviceMobile,
  IconPhotoPlus as ImagePlus,
  IconQrcode as QrCode,
  IconTicket as Ticket,
  IconX as X,
} from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
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

const getSlaRangeLimits = (p) => {
  if (p === 'HIGH') return { minLimit: 10, maxLimit: 240, step: 10 }
  if (p === 'MEDIUM') return { minLimit: 240, maxLimit: 2880, step: 30 }
  return { minLimit: 2880, maxLimit: 5040, step: 60 }
}

const formatMinutes = (mins) => {
  if (mins < 60) return `${mins} phút`
  const hours = Math.floor(mins / 60)
  const remainingMins = mins % 60
  if (hours < 24) {
    return remainingMins > 0 ? `${hours} giờ ${remainingMins} phút` : `${hours} giờ`
  }
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  let res = `${days} ngày`
  if (remainingHours > 0) res += ` ${remainingHours} giờ`
  if (remainingMins > 0) res += ` ${remainingMins} phút`
  return res
}

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
  const [minSla, setMinSla] = useState(720)
  const [maxSla, setMaxSla] = useState(1440)

  useEffect(() => {
    if (priority === 'HIGH') {
      setMinSla(30)
      setMaxSla(120)
    } else if (priority === 'MEDIUM') {
      setMinSla(720)
      setMaxSla(1440)
    } else {
      setMinSla(3600)
      setMaxSla(4320)
    }
  }, [priority])
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

  const startScanner = async () => {
    if (isScanningRef.current) return
    const scannerElement = document.getElementById(scannerElementId)
    if (!scannerElement) {
      setScannerError('Không tìm thấy khung camera để khởi động máy quét.')
      return
    }
    setScannerError('')
    await stopScanner()
    const scanner = new Html5Qrcode(scannerElementId)
    scannerRef.current = scanner
    try {
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
        () => { },
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
      await stopScanner()
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
    setMinSla(720)
    setMaxSla(1440)
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
    const limits = getSlaRangeLimits(priority)
    if (minSla < limits.minLimit || maxSla > limits.maxLimit || minSla > maxSla) {
      nextErrors.sla = 'Khoảng thời gian xử lý mong muốn không hợp lệ.'
    }
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
      formData.append('minSlaMinutes', minSla)
      formData.append('maxSlaMinutes', maxSla)
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
      <style>{`
        @keyframes ripple {
          0% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.4); opacity: 0.3; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        .animate-ripple {
          animation: ripple 3s infinite cubic-bezier(0.4, 0, 0.6, 1);
        }
        .animate-ripple-delayed {
          animation: ripple 3s infinite cubic-bezier(0.4, 0, 0.6, 1);
          animation-delay: 1.5s;
        }
      `}</style>
      {/* Main card */}
      <section className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top_left,rgba(242,112,36,0.15),transparent_62%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(242,112,36,0.2),transparent_62%)]" />
        
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300">
            <Bolt size={14} />
            Báo hỏng thiết bị
          </span>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-50">
            Quét mã QR để gửi ticket
          </h2>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Chuẩn bị mã QR trên thiết bị, mở camera quét để tự động điền thông tin và tạo yêu cầu hỗ trợ.
          </p>

          {/* Rounded Square Scanner Action with Ripple waves */}
          <div className="mt-5 w-full py-12 px-8 flex flex-col items-center justify-center rounded-[36px] border border-slate-100 bg-slate-50/40 dark:border-slate-800/80 dark:bg-slate-900/30">
            <div className="relative flex h-36 w-36 items-center justify-center">
              {/* Outer soft expanding waves */}
              <div className="absolute inset-4 rounded-[36px] bg-fptOrange/10 animate-ripple" />
              <div className="absolute inset-4 rounded-[36px] bg-fptOrange/10 animate-ripple-delayed" />
              
              <button
                type="button"
                onClick={() => {
                  keepScannerAliveRef.current = true
                  setScannerError('')
                  setShowScannerModal(true)
                }}
                className="relative z-10 flex h-24 w-24 items-center justify-center rounded-[28px] bg-fptOrange text-white shadow-xl shadow-orange-500/25 hover:bg-fptOrangeDark transition hover:scale-105 active:scale-95 focus:outline-none"
              >
                <QrCode size={40} />
              </button>
            </div>
            <span className="mt-6 text-xs font-semibold text-slate-750 dark:text-slate-200 tracking-wide">Nhấn để quét mã QR</span>
          </div>

          {/* Secondary Actions */}
          <div className="w-full mt-3">
            {latestTicket?.id ? (
              <button
                type="button"
                onClick={() => navigate(`/mobile/tickets/${latestTicket.id}`)}
                className="w-full flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-850 transition"
              >
                <Ticket size={16} />
                Xem ticket vừa tạo gần nhất
              </button>
            ) : (
              <p className="text-[11px] text-center text-slate-400 dark:text-slate-500 mt-2">Chưa có ticket nào được gửi gần đây.</p>
            )}
          </div>
        </div>
      </section>

      {/* Sleek Collapsible Accordion Guide */}
      <div className="rounded-[24px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 overflow-hidden">
        <details className="group">
          <summary className="flex cursor-pointer items-center justify-between p-4 text-xs font-semibold text-slate-700 dark:text-slate-350 select-none">
            <span>Hướng dẫn quét QR & báo hỏng</span>
            <span className="transition group-open:rotate-180">
              <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
                <path d="M6 9l6 6 6-6"></path>
              </svg>
            </span>
          </summary>
          <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 p-4 text-xs text-slate-500 dark:text-slate-400 leading-relaxed space-y-2">
            <p><strong>Bước 1:</strong> Đưa mã QR trên thiết bị vào chính giữa khung quét camera.</p>
            <p><strong>Bước 2:</strong> Hệ thống tự nhận diện và hiển thị màn hình điền thông tin lỗi.</p>
            <p><strong>Bước 3:</strong> Chọn mức độ ưu tiên, đính kèm ảnh minh họa và bấm "Gửi báo hỏng".</p>
          </div>
        </details>
      </div>

      {/* Scanner Modal */}
      {showScannerModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl dark:bg-slate-950">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Quét QR để chọn thiết bị</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Đưa mã QR vào khung camera. Hệ thống sẽ tự mở form báo hỏng khi quét thành công.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  void closeScannerModal()
                }}
                className="rounded-xl border border-slate-300 p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-4 rounded-[28px] border border-slate-200 bg-slate-950 p-3 shadow-inner dark:border-slate-800">
              <div className="rounded-[22px] border border-dashed border-white/20 bg-slate-900 p-2">
                <div id={scannerElementId} className="min-h-[320px] overflow-hidden rounded-[18px] bg-black" />
              </div>
            </div>
            {scannerError && (
              <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                {scannerError}
              </div>
            )}
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              Giữ camera ổn định trong 1-2 giây. Nếu không quét được, hãy tăng ánh sáng hoặc đưa mã QR gần hơn.
            </div>
          </div>
        </div>
      )}

      {/* Form Report Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={handleSubmit} className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl dark:bg-slate-950 flex flex-col max-h-[90vh]">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Nhập mô tả lỗi thiết bị</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Kiểm tra lại thông tin thiết bị trước khi gửi ticket.</p>
              </div>
              <div className="rounded-xl bg-orange-50 p-2 text-fptOrange dark:bg-orange-500/15 dark:text-orange-300">
                <TriangleAlert size={18} />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Thiết bị đã quét</p>
                <p><span className="font-semibold">Mã QA:</span> {assetQaCode}</p>
                <p className="mt-1"><span className="font-semibold">Tên thiết bị:</span> {assetName || 'Đang tải...'}</p>
                <p className="mt-1"><span className="font-semibold">Phòng hiện tại:</span> {assetLocationName || 'Không xác định'}</p>
                <p className="mt-1"><span className="font-semibold">Phòng gốc:</span> {assetHomeLocationName || 'Không xác định'}</p>
                {assetSpecs.length > 0 && (
                  <div className="mt-3 rounded-xl bg-white p-3 dark:bg-slate-950">
                    <p className="font-semibold text-slate-700 dark:text-slate-200">Đặc tính kỹ thuật</p>
                    <div className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-400">
                      {assetSpecs.map((entry) => (
                        <p key={`${entry.name}-${entry.value}`}>
                          <span className="font-medium text-slate-700 dark:text-slate-200">{entry.name}:</span> {entry.value}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
                <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Nội dung ticket</p>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Mô tả lỗi</label>
                <textarea
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value)
                    setFormErrors((prev) => ({ ...prev, description: '' }))
                  }}
                  rows={4}
                  className={`w-full rounded-lg border px-3 py-2 outline-none ring-fptOrange focus:ring-2 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 ${formErrors.description ? 'border-red-400 bg-red-50 dark:bg-red-500/10' : 'border-slate-300 dark:border-slate-700'}`}
                  placeholder="Mô tả chi tiết tình trạng hỏng"
                />
                {formErrors.description && <p className="mt-1 text-xs text-red-600">{formErrors.description}</p>}
              </div>
              
              <div className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
                <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Mức ưu tiên và ảnh minh họa</p>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Mức độ ưu tiên</label>
                <div className="grid grid-cols-3 gap-2">
                  {priorityOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setPriority(option.value)
                        setFormErrors((prev) => {
                          const copy = { ...prev }
                          delete copy.sla
                          return copy
                        })
                      }}
                      className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                        priority === option.value
                          ? 'border-fptOrange bg-orange-50 text-fptOrange dark:bg-orange-500/10 dark:text-orange-300'
                          : 'border-slate-300 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {formErrors.priority && <p className="mt-1 text-xs text-red-600">{formErrors.priority}</p>}

                <div className="mt-4">
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Thời gian xử lý mong muốn (SLA)</label>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800/80 dark:bg-slate-900/20">
                    <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                      <span>Tối thiểu: <span className="font-semibold text-fptOrange">{formatMinutes(minSla)}</span></span>
                      <span>Tối đa: <span className="font-semibold text-fptOrange">{formatMinutes(maxSla)}</span></span>
                    </div>
                    <div className="text-center text-xs font-medium text-slate-600 dark:text-slate-350 mb-3 bg-white border border-slate-100 py-1 px-2 rounded-lg inline-block dark:bg-slate-900 dark:border-slate-850">
                      Khoảng SLA chọn: <span className="text-fptOrange font-bold">{formatMinutes(minSla)} - {formatMinutes(maxSla)}</span>
                    </div>
                    <div className="relative w-full h-8 flex items-center px-1">
                      <input
                        type="range"
                        min={getSlaRangeLimits(priority).minLimit}
                        max={getSlaRangeLimits(priority).maxLimit}
                        step={getSlaRangeLimits(priority).step}
                        value={minSla}
                        onChange={(e) => {
                          const val = Math.min(Number(e.target.value), maxSla - getSlaRangeLimits(priority).step)
                          setMinSla(val)
                          setFormErrors((prev) => ({ ...prev, sla: '' }))
                        }}
                        className="absolute pointer-events-none appearance-none z-20 h-1 w-full bg-transparent accent-fptOrange [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-fptOrange [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-fptOrange [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:shadow cursor-pointer"
                      />
                      <input
                        type="range"
                        min={getSlaRangeLimits(priority).minLimit}
                        max={getSlaRangeLimits(priority).maxLimit}
                        step={getSlaRangeLimits(priority).step}
                        value={maxSla}
                        onChange={(e) => {
                          const val = Math.max(Number(e.target.value), minSla + getSlaRangeLimits(priority).step)
                          setMaxSla(val)
                          setFormErrors((prev) => ({ ...prev, sla: '' }))
                        }}
                        className="absolute pointer-events-none appearance-none z-20 h-1 w-full bg-transparent accent-fptOrange [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-fptOrange [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-fptOrange [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:shadow cursor-pointer"
                      />
                      <div className="relative h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-lg">
                        <div
                          className="absolute h-1.5 bg-fptOrange rounded-lg"
                          style={{
                            left: `${((minSla - getSlaRangeLimits(priority).minLimit) / (getSlaRangeLimits(priority).maxLimit - getSlaRangeLimits(priority).minLimit)) * 100}%`,
                            right: `${100 - ((maxSla - getSlaRangeLimits(priority).minLimit) / (getSlaRangeLimits(priority).maxLimit - getSlaRangeLimits(priority).minLimit)) * 100}%`
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                      <span>{formatMinutes(getSlaRangeLimits(priority).minLimit)}</span>
                      <span>{formatMinutes(getSlaRangeLimits(priority).maxLimit)}</span>
                    </div>
                  </div>
                  {formErrors.sla && <p className="mt-1 text-xs text-red-600">{formErrors.sla}</p>}
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
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                  >
                    <ImagePlus size={16} />
                    Chọn ảnh lỗi
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenCamera}
                    disabled={processingImage || loading}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                  >
                    <Camera size={16} />
                    Chụp ảnh lỗi
                  </button>
                </div>
                
                {imagePreviewUrl && (
                  <div className="mt-3">
                    <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">Ảnh lỗi đính kèm</p>
                    <img src={imagePreviewUrl} alt="error-preview" className="h-32 w-32 rounded-xl border border-slate-200 object-cover dark:border-slate-700" />
                  </div>
                )}
                {formErrors.imageFile && <p className="mt-2 text-xs text-red-600">{formErrors.imageFile}</p>}
                {processingImage && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Đang xử lý ảnh...</p>}
              </div>
            </div>
            
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2">
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-fptOrange px-4 py-2.5 font-semibold text-white hover:bg-fptOrangeDark disabled:opacity-60 transition"
              >
                Gửi báo hỏng
              </button>
              <button
                type="button"
                onClick={closeModal}
                disabled={loading}
                className="rounded-xl border border-slate-300 px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900 transition"
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
