import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../../api/axiosClient'
import { formatVietnamDateTime } from '../../utils/datetime'
import { 
  IconCheck as Check, 
  IconX as X, 
  IconTicket as TicketIcon,
  IconClock as Clock,
  IconAlertCircle as AlertCircle,
  IconReload as Reload,
  IconChevronRight as ChevronRight,
  IconEye as Eye
} from '@tabler/icons-react'
import { useAuth } from '../../context/AuthContext'
import { getTicketStatusMeta } from '../../utils/ticketStatus'

const PAGE_SIZE = 10

function formatMinutesToVietnamese(minutes) {
  if (!minutes || minutes <= 0) return '0 phút'
  const hours = Math.floor(minutes / 60)
  const remainingMins = minutes % 60
  if (hours > 0) {
    return remainingMins > 0 ? `${hours} giờ ${remainingMins} phút` : `${hours} giờ`
  }
  return `${remainingMins} phút`
}

function SlaExtensionManagement() {
  const { user } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('PENDING') // PENDING, ALL
  const [currentPage, setCurrentPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  
  // Selected request (to view details in Modal)
  const [selectedReq, setSelectedReq] = useState(null)
  const [ticket, setTicket] = useState(null)
  const [events, setEvents] = useState([])
  const [loadingTicket, setLoadingTicket] = useState(false)
  
  // Reject Prompt State
  const [showRejectPrompt, setShowRejectPrompt] = useState(false)
  const [reviewRejectReason, setReviewRejectReason] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)

  const fetchTicketAndEvents = async (tId) => {
    try {
      setLoadingTicket(true)
      const [tRes, eRes] = await Promise.all([
        axiosClient.get(`/api/tickets/${tId}`),
        axiosClient.get(`/api/tickets/${tId}/timeline`)
      ])
      setTicket(tRes.data)
      setEvents(eRes.data)
    } catch (err) {
      console.error("Failed to fetch ticket / timeline", err)
      setTicket(null)
      setEvents([])
    } finally {
      setLoadingTicket(false)
    }
  }

  const loadRequests = async () => {
    setLoading(true)
    try {
      const response = await axiosClient.get('/api/tickets/extension-requests')
      const data = response.data || []
      setRequests(data)
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể tải danh sách yêu cầu gia hạn.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRequests()
  }, [])

  const handleOpenDetailModal = (req) => {
    setSelectedReq(req)
    setShowRejectPrompt(false)
    setReviewRejectReason('')
    if (req) {
      fetchTicketAndEvents(req.ticketId)
    } else {
      setTicket(null)
      setEvents([])
    }
  }

  const handleCloseDetailModal = () => {
    setSelectedReq(null)
    setTicket(null)
    setEvents([])
    setShowRejectPrompt(false)
    setReviewRejectReason('')
  }

  const handleReviewExtension = async (decision) => {
    if (!selectedReq) return
    const tId = selectedReq.ticketId
    
    if (decision === 'REJECTED' && !reviewRejectReason.trim()) {
      toast.error('Vui lòng nhập lý do từ chối.')
      return
    }
    
    setSubmittingReview(true)
    try {
      await axiosClient.post(`/api/tickets/${tId}/review-extension`, {
        decision,
        rejectReason: decision === 'REJECTED' ? reviewRejectReason.trim() : null
      })
      toast.success(decision === 'APPROVED' ? 'Đã duyệt yêu cầu gia hạn!' : 'Đã từ chối yêu cầu gia hạn.')
      
      // Reload list and close modal
      await loadRequests()
      handleCloseDetailModal()
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể xử lý yêu cầu gia hạn.'
      toast.error(message)
    } finally {
      setSubmittingReview(false)
    }
  }

  const filteredRequests = useMemo(() => {
    let result = requests

    // Filter by Tab
    if (activeTab === 'PENDING') {
      result = result.filter(r => r.status === 'PENDING')
    }

    // Filter by Keyword (Ticket ID, KTV Name, Asset Name)
    if (keyword.trim()) {
      const kw = keyword.toLowerCase().trim()
      result = result.filter(r => 
        String(r.ticketId).includes(kw) || 
        (r.requesterName || '').toLowerCase().includes(kw) ||
        (r.assetName || '').toLowerCase().includes(kw) ||
        (r.assetQaCode || '').toLowerCase().includes(kw) ||
        (r.reason || '').toLowerCase().includes(kw)
      )
    }

    return result
  }, [requests, activeTab, keyword])

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE))
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredRequests.slice(start, start + PAGE_SIZE)
  }, [filteredRequests, currentPage])

  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab, keyword])

  const pendingExtension = useMemo(() => {
    if (!events || events.length === 0) return null
    const sorted = [...events].sort(
      (a, b) => new Date(b.occurredAt) - new Date(a.occurredAt)
    )
    const lastRequest = sorted.find(e => e.eventType === 'EXTENSION_REQUESTED')
    if (!lastRequest) return null
    const lastReview = sorted.find(
      e => ['EXTENSION_APPROVED', 'EXTENSION_REJECTED', 'EXTENSION_EXPIRED'].includes(e.eventType)
    )
    if (lastReview && new Date(lastReview.occurredAt) > new Date(lastRequest.occurredAt)) {
      return null
    }
    
    let requestedMinutes = 0
    let reason = ''
    if (lastRequest.detail) {
      const detailStr = lastRequest.detail || ''
      const minMatch = detailStr.match(/requestedMinutes:\s*(\d+)/i) || detailStr.match(/Số phút xin thêm:\s*(\d+)/i)
      const reasonMatch = detailStr.match(/reason:\s*(.*)/i) || detailStr.match(/Lý do:\s*(.*)/i)
      if (minMatch) requestedMinutes = parseInt(minMatch[1], 10)
      if (reasonMatch) reason = reasonMatch[1].trim()
    }
    return {
      event: lastRequest,
      requestedMinutes,
      reason,
    }
  }, [events])

  const reviewStatusText = useMemo(() => {
    if (!events || events.length === 0) return null
    const sorted = [...events].sort(
      (a, b) => new Date(b.occurredAt) - new Date(a.occurredAt)
    )
    const lastRequest = sorted.find(e => e.eventType === 'EXTENSION_REQUESTED')
    if (!lastRequest) return null
    const lastReview = sorted.find(
      e => ['EXTENSION_APPROVED', 'EXTENSION_REJECTED', 'EXTENSION_EXPIRED'].includes(e.eventType)
    )
    if (lastReview && new Date(lastReview.occurredAt) > new Date(lastRequest.occurredAt)) {
      if (lastReview.eventType === 'EXTENSION_APPROVED') return 'Yêu cầu gia hạn này đã được duyệt.'
      if (lastReview.eventType === 'EXTENSION_EXPIRED') return 'Yêu cầu gia hạn đã hết hiệu lực vì ticket đã đóng.'
      return `Yêu cầu gia hạn này đã bị từ chối. Lý do từ chối: ${lastReview.message ? lastReview.message.replace(/^\[Từ chối gia hạn\]\s*/, '') : ''}`
    }
    return null
  }, [events])

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xxs font-semibold bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/30">
            <Clock size={10} className="animate-pulse" />
            Chờ duyệt
          </span>
        )
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xxs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/30">
            <Check size={10} />
            Đã duyệt
          </span>
        )
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xxs font-semibold bg-red-50 text-red-700 border border-red-100 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/30">
            <X size={10} />
            Từ chối
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xxs font-semibold bg-slate-50 text-slate-650 border border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800">
            <AlertCircle size={10} />
            Hết hạn
          </span>
        )
    }
  }

  const getTicketStatusBadgeClass = (status) => getTicketStatusMeta(status).badgeClassName

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header and Title */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-100 dark:border-slate-900 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-850 dark:text-slate-50">Duyệt gia hạn thời gian sửa chữa</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Xem và xử lý các yêu cầu kéo dài thời gian xử lý ticket của Kỹ thuật viên (SLA Extension).</p>
        </div>
        <button
          type="button"
          onClick={loadRequests}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-800 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition disabled:opacity-60"
        >
          <Reload size={16} className={loading ? 'animate-spin' : ''} />
          Tải lại dữ liệu
        </button>
      </div>

      {/* Main Full-Width Table */}
      <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-100 dark:border-slate-900 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-900 pb-3">
          {/* Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('PENDING')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition ${
                activeTab === 'PENDING'
                  ? 'bg-orange-50 text-fptOrange border border-orange-100 dark:bg-orange-500/10 dark:border-orange-500/20'
                  : 'text-slate-550 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Yêu cầu chờ duyệt ({requests.filter(r => r.status === 'PENDING').length})
            </button>
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition ${
                activeTab === 'ALL'
                  ? 'bg-orange-50 text-fptOrange border border-orange-100 dark:bg-orange-500/10 dark:border-orange-500/20'
                  : 'text-slate-550 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Tất cả lịch sử ({requests.length})
            </button>
          </div>

          {/* Search Box */}
          <div className="w-full sm:w-64">
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Tìm theo ID, KTV, thiết bị..."
              className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm outline-none ring-fptOrange focus:ring-2 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-max divide-y divide-slate-200 dark:divide-slate-900 text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/40">
              <tr>
                <th className="px-3 py-3 text-left font-bold text-slate-500 dark:text-slate-400">Ticket ID</th>
                <th className="px-3 py-3 text-left font-bold text-slate-500 dark:text-slate-400">Thiết bị</th>
                <th className="px-3 py-3 text-left font-bold text-slate-500 dark:text-slate-400">Mức độ ưu tiên</th>
                <th className="px-3 py-3 text-left font-bold text-slate-500 dark:text-slate-400">Kỹ thuật viên</th>
                <th className="px-3 py-3 text-left font-bold text-slate-500 dark:text-slate-400">Gia hạn thêm</th>
                <th className="px-3 py-3 text-left font-bold text-slate-500 dark:text-slate-400">Lý do</th>
                <th className="px-3 py-3 text-left font-bold text-slate-500 dark:text-slate-400">Gia hạn mới</th>
                <th className="px-3 py-3 text-left font-bold text-slate-500 dark:text-slate-400">Trạng thái</th>
                <th className="px-3 py-3 text-center font-bold text-slate-500 dark:text-slate-400">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
              {loading &&
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={`skeleton-${index}`} className="animate-pulse">
                    <td className="px-3 py-3"><div className="h-4 w-8 rounded bg-slate-200 dark:bg-slate-800" /></td>
                    <td className="px-3 py-3"><div className="h-4 w-28 rounded bg-slate-200 dark:bg-slate-800" /></td>
                    <td className="px-3 py-3"><div className="h-4 w-12 rounded bg-slate-200 dark:bg-slate-800" /></td>
                    <td className="px-3 py-3"><div className="h-4 w-20 rounded bg-slate-200 dark:bg-slate-800" /></td>
                    <td className="px-3 py-3"><div className="h-4 w-12 rounded bg-slate-200 dark:bg-slate-800" /></td>
                    <td className="px-3 py-3"><div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-800" /></td>
                    <td className="px-3 py-3"><div className="h-4 w-20 rounded bg-slate-200 dark:bg-slate-800" /></td>
                    <td className="px-3 py-3"><div className="h-4 w-16 rounded bg-slate-200 dark:bg-slate-800" /></td>
                    <td className="px-3 py-3"><div className="mx-auto h-6 w-16 rounded bg-slate-200 dark:bg-slate-800" /></td>
                  </tr>
                ))}
              
              {!loading && paginatedRequests.map((req) => (
                <tr 
                  key={req.id} 
                  className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors"
                >
                  <td className="px-3 py-4">
                    <span className="flex items-center gap-1 text-fptOrange font-bold">
                      <TicketIcon size={12} />
                      #{req.ticketId}
                    </span>
                  </td>
                  <td className="px-3 py-4">
                    <div className="text-slate-850 dark:text-slate-200 font-semibold truncate max-w-[150px]" title={req.assetName}>
                      {req.assetName}
                    </div>
                    <div className="text-xxs text-slate-450 dark:text-slate-500 font-mono">QA: {req.assetQaCode}</div>
                  </td>
                  <td className="px-3 py-4">
                    <span className={`px-1.5 py-0.5 rounded text-xxs font-bold ${
                      req.priority === 'HIGH' ? 'bg-red-50 text-red-700 border border-red-100 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/30' :
                      req.priority === 'MEDIUM' ? 'bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/30' :
                      'bg-slate-50 text-slate-700 border border-slate-100 dark:bg-slate-950/30 dark:text-slate-400 dark:border-slate-900/30'
                    }`}>
                      {req.priority === 'HIGH' ? 'Cao' : req.priority === 'MEDIUM' ? 'Trung bình' : 'Thấp'}
                    </span>
                  </td>
                  <td className="px-3 py-4 text-slate-850 dark:text-slate-350">{req.assigneeName}</td>
                  <td className="px-3 py-4 font-bold text-fptOrange">{formatMinutesToVietnamese(req.requestedMinutes)}</td>
                  <td className="px-3 py-4">
                    <p className="text-xxs text-slate-650 dark:text-slate-400 max-w-[200px] truncate" title={req.reason}>
                      {req.reason}
                    </p>
                  </td>
                  <td className="px-3 py-4 font-bold text-slate-800 dark:text-slate-200">
                    {formatMinutesToVietnamese(req.proposedMinutes)}
                  </td>
                  <td className="px-3 py-4">
                    {getStatusBadge(req.status)}
                  </td>
                  <td className="px-3 py-4 text-center">
                    <button
                      type="button"
                      onClick={() => handleOpenDetailModal(req)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xxs font-bold bg-orange-50 text-fptOrange hover:bg-orange-100 border border-orange-100 dark:bg-orange-500/10 dark:text-orange-350 dark:border-orange-500/20 dark:hover:bg-orange-500/20 transition shadow-sm"
                    >
                      <Eye size={12} />
                      {req.status === 'PENDING' ? 'Xem & Phê duyệt' : 'Xem chi tiết'}
                    </button>
                  </td>
                </tr>
              ))}

              {!loading && filteredRequests.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
                    Không có yêu cầu gia hạn nào được tìm thấy.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && filteredRequests.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="rounded-xl border border-slate-300 dark:border-slate-800 px-3 py-1.5 text-slate-750 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition disabled:opacity-50"
            >
              Trang trước
            </button>
            <span className="font-semibold text-slate-700 dark:text-slate-300 mx-2">
              Trang {currentPage}/{totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="rounded-xl border border-slate-300 dark:border-slate-800 px-3 py-1.5 text-slate-750 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition disabled:opacity-50"
            >
              Trang tiếp
            </button>
          </div>
        )}
      </div>

      {/* Detail & Approval Modal */}
      {selectedReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-950 rounded-3xl border border-slate-100 dark:border-slate-900 shadow-2xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-900 p-5">
              <div>
                <h3 className="text-base font-bold text-slate-850 dark:text-slate-100 flex items-center gap-2">
                  <TicketIcon className="text-fptOrange" size={18} />
                  Chi tiết yêu cầu gia hạn #{selectedReq.ticketId}
                </h3>
                <p className="text-xxs text-slate-500 dark:text-slate-400 mt-1">
                  Xem chi tiết ticket và thông tin gia hạn do Kỹ thuật viên gửi lên.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseDetailModal}
                className="p-2 text-slate-400 hover:text-slate-655 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-6 max-h-[70vh] overflow-y-auto">
              
              {/* Ticket Details Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-150 dark:border-slate-900 pb-2">
                  <h4 className="text-sm font-bold text-slate-850 dark:text-slate-200">Thông tin Ticket liên quan</h4>
                </div>

                {loadingTicket && (
                  <p className="text-xs text-slate-400 animate-pulse py-4 text-center">Đang tải thông tin ticket...</p>
                )}

                {!loadingTicket && ticket && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-700 dark:text-slate-350 bg-slate-50/50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-900">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-slate-450 whitespace-nowrap">Trạng thái ticket:</span>
                        <span className={`px-2 py-0.5 rounded-full text-xxs font-semibold border ${getTicketStatusBadgeClass(ticket.status)}`}>
                          {getTicketStatusMeta(ticket.status).label}
                        </span>
                      </div>

                      <div className="flex justify-between items-center gap-2">
                        <span className="text-slate-450 whitespace-nowrap">Thiết bị:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[150px]" title={ticket.assetName}>
                          {ticket.assetName}
                        </span>
                      </div>

                      <div className="flex justify-between items-center gap-2">
                        <span className="text-slate-450 whitespace-nowrap">Mã thiết bị (QA):</span>
                        <span className="font-mono text-slate-800 dark:text-slate-200">{ticket.assetQaCode}</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-slate-455 whitespace-nowrap">Độ ưu tiên:</span>
                        <span className={`px-1.5 py-0.5 rounded text-xxs font-bold ${
                          ticket.priority === 'HIGH' ? 'bg-red-50 text-red-700 border border-red-100 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/30' :
                          ticket.priority === 'MEDIUM' ? 'bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/30' :
                          'bg-slate-50 text-slate-700 border border-slate-100 dark:bg-slate-950/30 dark:text-slate-400 dark:border-slate-900/30'
                        }`}>
                          {ticket.priority === 'HIGH' ? 'Cao' : ticket.priority === 'MEDIUM' ? 'Trung bình' : 'Thấp'}
                        </span>
                      </div>

                      <div className="flex justify-between items-center gap-2">
                        <span className="text-slate-450 whitespace-nowrap">Kỹ thuật viên:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {ticket.assigneeName || 'Chưa phân công'}
                        </span>
                      </div>

                      <div className="flex justify-between items-center gap-2">
                        <span className="text-slate-450 whitespace-nowrap">Phòng:</span>
                        <span className="text-slate-800 dark:text-slate-200">{ticket.assetLocationName || '-'}</span>
                      </div>
                    </div>

                    <div className="sm:col-span-2 pt-2 border-t border-slate-200/60 dark:border-slate-800 space-y-1">
                      <span className="text-xxs text-slate-450 block">Mô tả sự cố:</span>
                      <p className="text-xxs text-slate-650 dark:text-slate-400 leading-relaxed bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-150 dark:border-slate-900 whitespace-pre-wrap">
                        {ticket.description}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* SLA Extension Request Details Section */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-850 dark:text-slate-200 border-b border-slate-150 dark:border-slate-900 pb-2">
                  Thông tin yêu cầu gia hạn
                </h4>

                <div className="space-y-4 text-xs">
                  <div className="p-4 rounded-2xl bg-orange-50/60 border border-orange-100 dark:bg-orange-950/20 dark:border-orange-900/30 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-slate-500 block text-xxs mb-0.5">Kỹ thuật viên yêu cầu:</span>
                        <span className="font-bold text-slate-850 dark:text-slate-200">{selectedReq.requesterName || selectedReq.assigneeName}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-xxs mb-0.5">Gia hạn thêm:</span>
                        <span className="font-bold text-fptOrange text-sm">{formatMinutesToVietnamese(selectedReq.requestedMinutes)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-xxs mb-0.5">Gia hạn mới:</span>
                        <span className="text-slate-800 dark:text-slate-300 font-bold">
                          {formatMinutesToVietnamese(selectedReq.proposedMinutes)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-xxs mb-0.5">Trạng thái yêu cầu:</span>
                        <span className="mt-0.5 inline-block">{getStatusBadge(selectedReq.status)}</span>
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-orange-100/50 space-y-1">
                      <span className="text-slate-500 block text-xxs">Lý do xin gia hạn:</span>
                      <p className="text-slate-755 dark:text-slate-350 bg-white dark:bg-slate-900/50 p-2.5 rounded-lg border border-orange-100/20 italic leading-relaxed whitespace-pre-wrap">
                        {selectedReq.reason}
                      </p>
                    </div>

                    {selectedReq.status === 'REJECTED' && selectedReq.rejectReason && (
                      <div className="pt-2.5 border-t border-orange-100/50 space-y-1">
                        <span className="text-red-750 block text-xxs font-semibold">Lý do từ chối:</span>
                        <p className="text-red-700 dark:text-red-400 bg-red-50/40 dark:bg-red-950/10 p-2.5 rounded-lg border border-red-100/20 leading-relaxed">
                          {selectedReq.rejectReason}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions for Pending Requests */}
                  {selectedReq.status === 'PENDING' && (
                    <div className="pt-2">
                      {showRejectPrompt ? (
                        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
                          <div className="space-y-1">
                            <label className="text-xxs font-semibold text-slate-700 dark:text-slate-300">
                              Lý do từ chối gia hạn:
                            </label>
                            <textarea
                              value={reviewRejectReason}
                              onChange={(e) => setReviewRejectReason(e.target.value)}
                              placeholder="Vui lòng nhập lý do từ chối..."
                              className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-1 focus:ring-red-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 h-20 resize-none"
                            />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => handleReviewExtension('REJECTED')}
                              disabled={submittingReview}
                              className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 transition disabled:opacity-50"
                            >
                              Xác nhận Từ chối
                            </button>
                            <button
                              onClick={() => {
                                setShowRejectPrompt(false)
                                setReviewRejectReason('')
                              }}
                              disabled={submittingReview}
                              className="rounded-xl border border-slate-300 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                            >
                              Hủy
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-3 justify-end">
                          <button
                            onClick={() => handleReviewExtension('APPROVED')}
                            disabled={submittingReview}
                            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition disabled:opacity-50 shadow-sm"
                          >
                            <Check size={14} />
                            Duyệt yêu cầu
                          </button>
                          <button
                            onClick={() => setShowRejectPrompt(true)}
                            disabled={submittingReview}
                            className="flex items-center gap-1.5 rounded-xl bg-red-600 px-5 py-2 text-xs font-bold text-white hover:bg-red-700 transition disabled:opacity-50 shadow-sm"
                          >
                            <X size={14} />
                            Từ chối
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 dark:bg-slate-900/60 p-4 border-t border-slate-150 dark:border-slate-900 flex justify-end">
              <button
                type="button"
                onClick={handleCloseDetailModal}
                className="rounded-xl border border-slate-300 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                Đóng
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}

export default SlaExtensionManagement
