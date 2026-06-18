import { useEffect, useState, useMemo } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../../api/axiosClient'
import { formatVietnamDateTime } from '../../utils/datetime'
import { useAuth } from '../../context/AuthContext'
import { 
  IconCheck as Check, 
  IconX as X, 
  IconTicket as TicketIcon, 
  IconChevronLeft as ChevronLeft,
  IconArrowRight as ArrowRight
} from '@tabler/icons-react'

function formatMinutesToVietnamese(minutes) {
  if (!minutes || minutes <= 0) return '0 phút'
  const hours = Math.floor(minutes / 60)
  const remainingMins = minutes % 60
  if (hours > 0) {
    return remainingMins > 0 ? `${hours} giờ ${remainingMins} phút` : `${hours} giờ`
  }
  return `${remainingMins} phút`
}

function NotificationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  
  const [notification, setNotification] = useState(null)
  const [loading, setLoading] = useState(true)
  
  const [ticket, setTicket] = useState(null)
  const [events, setEvents] = useState([])
  const [loadingTicket, setLoadingTicket] = useState(false)
  
  const [reviewRejectReason, setReviewRejectReason] = useState('')
  const [showRejectPrompt, setShowRejectPrompt] = useState(false)
  const [submittingReview, setSubmittingReview] = useState(false)

  const fetchDetail = async () => {
    try {
      const response = await axiosClient.get(`/api/notifications/${id}`)
      setNotification(response.data)
    } catch (error) {
      const message = error?.response?.data?.message || 'Không tải được chi tiết thông báo.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

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
    } finally {
      setLoadingTicket(false)
    }
  }

  useEffect(() => {
    fetchDetail()
  }, [id])

  const ticketId = useMemo(() => {
    if (!notification) return null
    const sources = [notification.title, notification.message, notification.detail]
    for (const source of sources) {
      if (!source) continue
      const match = source.match(/ticket\s*#(\d+)/i) || source.match(/Ticket\s*ID\s*:\s*#?(\d+)/i) || source.match(/#(\d+)/)
      if (match && match[1]) {
        return parseInt(match[1], 10)
      }
    }
    return null
  }, [notification])

  useEffect(() => {
    if (ticketId) {
      fetchTicketAndEvents(ticketId)
    }
  }, [ticketId])

  const pendingExtension = useMemo(() => {
    if (!events || events.length === 0) return null
    const sorted = [...events].sort(
      (a, b) => new Date(b.occurredAt) - new Date(a.occurredAt)
    )
    const lastRequest = sorted.find(e => e.eventType === 'EXTENSION_REQUESTED')
    if (!lastRequest) return null
    const lastReview = sorted.find(
      e =>
        e.eventType === 'EXTENSION_APPROVED' || e.eventType === 'EXTENSION_REJECTED'
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
      e =>
        e.eventType === 'EXTENSION_APPROVED' || e.eventType === 'EXTENSION_REJECTED'
    )
    if (lastReview && new Date(lastReview.occurredAt) > new Date(lastRequest.occurredAt)) {
      return lastReview.eventType === 'EXTENSION_APPROVED' 
        ? 'Yêu cầu gia hạn này đã được duyệt.' 
        : `Yêu cầu gia hạn này đã bị từ chối. Lý do từ chối: ${lastReview.message ? lastReview.message.replace(/^\[Từ chối gia hạn\]\s*/, '') : ''}`
    }
    return null
  }, [events])

  const handleReviewExtension = async (decision) => {
    if (decision === 'REJECTED' && !reviewRejectReason.trim()) {
      toast.error('Vui lòng nhập lý do từ chối.')
      return
    }
    try {
      setSubmittingReview(true)
      await axiosClient.post(`/api/tickets/${ticketId}/review-extension`, {
        decision,
        rejectReason: decision === 'REJECTED' ? reviewRejectReason.trim() : null
      })
      toast.success(decision === 'APPROVED' ? 'Đã duyệt yêu cầu gia hạn!' : 'Đã từ chối yêu cầu gia hạn.')
      setShowRejectPrompt(false)
      setReviewRejectReason('')
      // Refresh
      if (ticketId) {
        await fetchTicketAndEvents(ticketId)
      }
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể xử lý yêu cầu gia hạn.'
      toast.error(message)
    } finally {
      setSubmittingReview(false)
    }
  }

  const getTicketLink = (tId) => {
    if (!user) return '/'
    if (user.role === 'Admin') return `/admin/tickets`
    if (user.role === 'TechSupport') return `/tech/tickets/${tId}`
    return `/admin/tickets`
  }

  const getTicketStatusBadgeClass = (status) => {
    switch (status) {
      case 'PENDING':
        return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50'
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50'
      case 'RESOLVED':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50'
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-850 dark:text-slate-300 dark:border-slate-800'
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header card */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-900 shadow-sm">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition"
            title="Quay lại"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-850 dark:text-slate-50">Chi tiết nghiệp vụ</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Xem và xử lý các thông báo từ hệ thống</p>
          </div>
        </div>
        {ticketId && user?.role !== 'Admin' && (
          <Link 
            to={getTicketLink(ticketId)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-orange-50 text-fptOrange border border-orange-100 hover:bg-orange-100 transition dark:bg-orange-500/10 dark:border-orange-500/20"
          >
            <TicketIcon size={16} />
            Mở chi tiết Ticket #{ticketId}
            <ArrowRight size={14} />
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left column - Notification Info */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-100 dark:border-slate-900 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-850 dark:text-slate-100 border-b border-slate-100 dark:border-slate-900 pb-3">Nội dung thông báo</h3>
            
            {loading && (
              <div className="flex items-center justify-center py-8">
                <p className="text-sm text-slate-500 animate-pulse">Đang tải dữ liệu...</p>
              </div>
            )}

            {!loading && notification && (
              <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-xs text-slate-400 dark:text-slate-500 block">Thiết bị</span>
                    <span className="font-semibold text-slate-850 dark:text-slate-200">{notification.assetQaCode || '-'}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-slate-400 dark:text-slate-500 block">Nghiệp vụ (Event Type)</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded text-xs">{notification.eventType}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-slate-400 dark:text-slate-500 block">Người thực hiện</span>
                    <span className="font-semibold text-slate-850 dark:text-slate-200">{notification.actorUsername}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-slate-400 dark:text-slate-500 block">Thời gian xảy ra</span>
                    <span className="font-semibold text-slate-850 dark:text-slate-200">{formatVietnamDateTime(notification.occurredAt, '')}</span>
                  </div>
                </div>

                <div className="space-y-1.5 pt-2">
                  <span className="text-xs text-slate-400 dark:text-slate-500 block">Tiêu đề thông báo</span>
                  <span className="text-base font-semibold text-slate-850 dark:text-slate-100">{notification.title}</span>
                </div>

                <div className="space-y-1.5 pt-2">
                  <span className="text-xs text-slate-400 dark:text-slate-500 block">Chi tiết bổ sung</span>
                  <div className="whitespace-pre-line rounded-xl border border-slate-200 bg-slate-50/50 p-4 font-mono text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300 leading-relaxed">
                    {notification.detail || 'Không có chi tiết bổ sung.'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right column - Ticket and Action Box */}
        {ticketId && (
          <div className="space-y-6">
            {/* Ticket detail box */}
            <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-100 dark:border-slate-900 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-850 dark:text-slate-100 border-b border-slate-100 dark:border-slate-900 pb-3">Ticket liên quan #{ticketId}</h3>
              
              {loadingTicket && (
                <p className="text-sm text-slate-400 animate-pulse">Đang tải thông tin Ticket...</p>
              )}

              {!loadingTicket && ticket && (
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400 dark:text-slate-500">Trạng thái</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getTicketStatusBadgeClass(ticket.status)}`}>
                      {ticket.status === 'PENDING' ? 'Chờ tiếp nhận' :
                       ticket.status === 'IN_PROGRESS' ? 'Đang xử lý' :
                       ticket.status === 'RESOLVED' ? 'Đã hoàn thành' : ticket.status}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400 dark:text-slate-500">Thiết bị</span>
                    <span className="font-semibold text-slate-850 dark:text-slate-200 truncate max-w-[150px]" title={ticket.assetName}>
                      {ticket.assetName}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400 dark:text-slate-500">Độ ưu tiên</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      ticket.priority === 'HIGH' ? 'bg-red-50 text-red-700 border border-red-100 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/30' :
                      ticket.priority === 'MEDIUM' ? 'bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/30' :
                      'bg-slate-50 text-slate-700 border border-slate-100 dark:bg-slate-950/30 dark:text-slate-400 dark:border-slate-900/30'
                    }`}>
                      {ticket.priority === 'HIGH' ? 'Cao' : ticket.priority === 'MEDIUM' ? 'Trung bình' : 'Thấp'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400 dark:text-slate-500">Kỹ thuật viên</span>
                    <span className="font-semibold text-slate-850 dark:text-slate-200">
                      {ticket.assigneeName || 'Chưa phân công'}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-900 space-y-1">
                    <span className="text-xs text-slate-400 dark:text-slate-500 block">Mô tả sự cố:</span>
                    <p className="text-xs text-slate-650 dark:text-slate-400 line-clamp-3 bg-slate-50 dark:bg-slate-900/40 p-2 rounded-lg leading-relaxed">
                      {ticket.description}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Approval Action Panel */}
            {user?.role === 'Admin' && (notification?.eventType === 'EXTENSION_REQUESTED' || pendingExtension || reviewStatusText) && (
              <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-100 dark:border-slate-900 shadow-sm space-y-4">
                <h3 className="text-base font-bold text-slate-850 dark:text-slate-100 border-b border-slate-100 dark:border-slate-900 pb-3">Phê duyệt gia hạn</h3>

                {reviewStatusText && (
                  <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 text-xs text-slate-650 dark:border-slate-900 dark:bg-slate-900/50 dark:text-slate-300 text-center font-medium">
                    {reviewStatusText}
                  </div>
                )}

                {!reviewStatusText && pendingExtension && (
                  <div className="space-y-4">
                    <div className="p-3 rounded-xl bg-orange-50 border border-orange-100 dark:bg-orange-950/20 dark:border-orange-900/30 text-xs space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-500">KTV yêu cầu:</span>
                        <span className="font-bold text-slate-850 dark:text-slate-300">{pendingExtension.event.actorName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Thời gian xin thêm:</span>
                        <span className="font-bold text-fptOrange">{formatMinutesToVietnamese(pendingExtension.requestedMinutes)}</span>
                      </div>
                      <div className="pt-1.5 border-t border-orange-100/50 space-y-1">
                        <span className="text-slate-500 block">Lý do xin gia hạn:</span>
                        <p className="text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-2 rounded border border-orange-100/20 italic leading-normal">
                          {pendingExtension.reason}
                        </p>
                      </div>
                    </div>

                    {showRejectPrompt ? (
                      <div className="space-y-3 pt-2">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Lý do từ chối gia hạn:</label>
                          <textarea
                            value={reviewRejectReason}
                            onChange={(e) => setReviewRejectReason(e.target.value)}
                            placeholder="Vui lòng nhập lý do từ chối..."
                            className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-1 focus:ring-red-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 h-16 resize-none"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleReviewExtension('REJECTED')}
                            disabled={submittingReview}
                            className="flex-1 rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 transition disabled:opacity-50"
                          >
                            Xác nhận Từ chối
                          </button>
                          <button
                            onClick={() => {
                              setShowRejectPrompt(false)
                              setReviewRejectReason('')
                            }}
                            disabled={submittingReview}
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-905 dark:text-slate-200 transition"
                          >
                            Hủy
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => handleReviewExtension('APPROVED')}
                          disabled={submittingReview}
                          className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition disabled:opacity-50 shadow-sm"
                        >
                          <Check size={14} />
                          Duyệt
                        </button>
                        <button
                          onClick={() => setShowRejectPrompt(true)}
                          disabled={submittingReview}
                          className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-red-700 transition disabled:opacity-50 shadow-sm"
                        >
                          <X size={14} />
                          Từ chối
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default NotificationDetail
