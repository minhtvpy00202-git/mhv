import {
  IconArrowRight as ArrowRight,
  IconCopy as Copy,
  IconHistory as History,
  IconMessageCircle as MessageCircle,
  IconPhone as Phone,
  IconStar as Star,
} from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'
import TicketChatBox from '../components/TicketChatBox'
import TicketEventTimelineModal from '../components/TicketEventTimelineModal'
import { useAuth } from '../context/AuthContext'
import { copyText, getZaloUrl, normalizePhone } from '../utils/contact'
import { formatVietnamDateTime } from '../utils/datetime'
import { isTechSupportMobilePath } from '../utils/navigation'
import { getTechnicalStatusMeta, getUsageStatusMeta } from '../utils/assetStatus'
import { getTicketStatusMeta } from '../utils/ticketStatus'

function toVietnameseRole(role) {
  if (role === 'Admin') return 'Quản trị viên'
  if (role === 'TechSupport') return 'Kỹ thuật viên hỗ trợ'
  return 'Nhân viên'
}

function getAssetBadgeClassName(tone) {
  if (tone === 'emerald') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
  if (tone === 'blue') return 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300'
  if (tone === 'red') return 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300'
  if (tone === 'amber') return 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
}

function TicketDetail() {
  const { ticketId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showChat, setShowChat] = useState(true)
  const [showTimelineModal, setShowTimelineModal] = useState(false)
  
  // Extension & Review States
  const [events, setEvents] = useState([])
  const [showExtensionModal, setShowExtensionModal] = useState(false)
  const [extMinutes, setExtMinutes] = useState('60')
  const [customExtMinutes, setCustomExtMinutes] = useState('')
  const [extReason, setExtReason] = useState('')
  const [reviewRejectReason, setReviewRejectReason] = useState('')
  const [showRejectPrompt, setShowRejectPrompt] = useState(false)
  const [submittingExtension, setSubmittingExtension] = useState(false)

  const loadEvents = async () => {
    try {
      const response = await axiosClient.get(`/api/tickets/${ticketId}/timeline`)
      setEvents(response.data || [])
    } catch {
      // silent
    }
  }

  const loadTicket = async () => {
    setLoading(true)
    try {
      const response = await axiosClient.get(`/api/tickets/${ticketId}`)
      const found = response.data || null
      if (!found) {
        toast.error('Không tìm thấy ticket.')
        setTicket(null)
        return
      }
      setTicket(found)
    } catch (error) {
      const message = error?.response?.data?.message || 'Không tải được thông tin ticket.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!ticketId) return
    loadTicket()
    loadEvents()
  }, [ticketId])

  const statusMeta = useMemo(() => getTicketStatusMeta(ticket?.status), [ticket?.status])
  const assetTechnicalStatusMeta = useMemo(() => getTechnicalStatusMeta(ticket?.assetTechnicalStatus), [ticket?.assetTechnicalStatus])
  const assetUsageStatusMeta = useMemo(() => getUsageStatusMeta(ticket?.assetUsageStatus), [ticket?.assetUsageStatus])

  const maxSlaDate = useMemo(() => {
    if (!ticket?.createdAt || !ticket?.maxSlaMinutes) return null
    const date = new Date(ticket.createdAt)
    date.setMinutes(date.getMinutes() + ticket.maxSlaMinutes)
    return date
  }, [ticket?.createdAt, ticket?.maxSlaMinutes])

  const pendingExtension = useMemo(() => {
    const sorted = [...events].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    const lastRequest = sorted.find(e => e.eventType === 'EXTENSION_REQUESTED')
    if (!lastRequest) return null

    const lastRequestIndex = sorted.indexOf(lastRequest)
    const hasResponse = sorted.slice(0, lastRequestIndex).some(e => 
      e.eventType === 'EXTENSION_APPROVED' || e.eventType === 'EXTENSION_REJECTED'
    )

    if (hasResponse) return null

    let requestedMinutes = 0
    let reason = ""
    if (lastRequest.detail) {
      const lines = lastRequest.detail.split('\n')
      lines.forEach(line => {
        if (line.startsWith('requestedMinutes: ')) {
          requestedMinutes = Number(line.substring(18).trim())
        } else if (line.startsWith('reason: ')) {
          reason = line.substring(8).trim()
        }
      })
    }
    if (!requestedMinutes) {
      const match = lastRequest.message.match(/Xin thêm (\d+) phút/)
      if (match) requestedMinutes = Number(match[1])
    }
    return {
      event: lastRequest,
      requestedMinutes,
      reason
    }
  }, [events])

  const lastExtensionReview = useMemo(() => {
    if (!events || events.length === 0) return null
    const sorted = [...events].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    
    const lastResponse = sorted.find(e => 
      e.eventType === 'EXTENSION_APPROVED' || e.eventType === 'EXTENSION_REJECTED'
    )
    if (!lastResponse) return null

    const responseIndex = sorted.indexOf(lastResponse)
    const matchingRequest = sorted.slice(responseIndex + 1).find(e => e.eventType === 'EXTENSION_REQUESTED')
    
    let requestedMinutes = 0
    if (matchingRequest && matchingRequest.detail) {
      const lines = matchingRequest.detail.split('\n')
      lines.forEach(line => {
        if (line.startsWith('requestedMinutes: ') || line.startsWith('Số phút xin thêm: ')) {
          requestedMinutes = Number(line.substring(line.indexOf(':') + 1).trim())
        }
      })
    }
    if (!requestedMinutes && matchingRequest) {
      const match = matchingRequest.message.match(/Xin thêm (\d+) phút/)
      if (match) requestedMinutes = Number(match[1])
    }

    let rejectReason = ""
    if (lastResponse.eventType === 'EXTENSION_REJECTED') {
      if (lastResponse.detail) {
        const lines = lastResponse.detail.split('\n')
        lines.forEach(line => {
          if (line.startsWith('rejectReason: ') || line.startsWith('Lý do: ')) {
            rejectReason = line.substring(line.indexOf(':') + 1).trim()
          }
        })
      }
      if (!rejectReason) {
        const msg = lastResponse.message || ''
        if (msg.includes('Lý do: ')) {
          rejectReason = msg.substring(msg.indexOf('Lý do: ') + 7).trim()
        }
      }
    }

    return {
      eventType: lastResponse.eventType,
      actorName: lastResponse.actorName,
      message: lastResponse.message,
      occurredAt: lastResponse.occurredAt,
      requestedMinutes,
      rejectReason: rejectReason || 'Không có lý do cụ thể.'
    }
  }, [events])


  const isTechMobileRoute = isTechSupportMobilePath(location.pathname)
  const isTechRoute = location.pathname.startsWith('/tech/')
  const isTechSupportRoute = isTechRoute || isTechMobileRoute
  const isStandardMobileRoute = location.pathname.startsWith('/mobile/')
  const backPath = location.pathname.startsWith('/admin/')
    ? '/admin/tickets'
    : isTechMobileRoute
      ? '/tech-mobile/tickets'
      : isTechRoute
      ? '/tech/tickets'
      : '/mobile/home'
  const isMobileRoute = isStandardMobileRoute || isTechMobileRoute
  const canOpenChat = !isTechSupportRoute || Number(ticket?.assigneeId) === Number(user?.userId)
  const canRateSatisfaction = ticket?.status === 'RESOLVED'
    && (Number(ticket?.reporterId) === Number(user?.userId) || user?.role === 'Admin')
    && !isTechSupportRoute
  const reviewPath = location.pathname.startsWith('/admin/')
    ? `/admin/tickets/${ticketId}/review`
    : `/mobile/tickets/${ticketId}/review`
  const reporterPhone = normalizePhone(ticket?.reporterPhone)
  const reporterZaloUrl = getZaloUrl(ticket?.reporterPhone)
  const assigneePhone = normalizePhone(ticket?.assigneePhone)
  const assigneeZaloUrl = getZaloUrl(ticket?.assigneePhone)
  const mobileChatPath = `/mobile/chats/${ticketId}`
  const showSupportContactCard = isStandardMobileRoute
    && ticket?.status !== 'RESOLVED'
    && (assigneePhone || assigneeZaloUrl)

  const handleRequestExtension = async (e) => {
    e.preventDefault()
    if (!extReason || extReason.trim().length < 10) {
      toast.error('Lý do gia hạn phải tối thiểu 10 ký tự.')
      return
    }
    const mins = extMinutes === 'custom' ? Number(customExtMinutes) : Number(extMinutes)
    if (!mins || Number.isNaN(mins) || mins <= 0) {
      toast.error('Số phút xin gia hạn không hợp lệ.')
      return
    }
    setSubmittingExtension(true)
    try {
      await axiosClient.post(`/api/tickets/${ticketId}/request-extension`, {
        requestedMinutes: mins,
        reason: extReason.trim()
      })
      toast.success('Đã gửi yêu cầu gia hạn thời gian thành công!')
      setShowExtensionModal(false)
      setExtReason('')
      setCustomExtMinutes('')
      await Promise.all([loadTicket(), loadEvents()])
    } catch (error) {
      const message = error?.response?.data?.message || 'Không gửi được yêu cầu gia hạn.'
      toast.error(message)
    } finally {
      setSubmittingExtension(false)
    }
  }

  const handleReviewExtension = async (decision) => {
    if (decision === 'REJECTED' && !reviewRejectReason.trim()) {
      toast.error('Vui lòng nhập lý do từ chối.')
      return
    }
    try {
      await axiosClient.post(`/api/tickets/${ticketId}/review-extension`, {
        decision,
        rejectReason: decision === 'REJECTED' ? reviewRejectReason.trim() : null
      })
      toast.success(decision === 'APPROVED' ? 'Đã duyệt yêu cầu gia hạn!' : 'Đã từ chối yêu cầu gia hạn.')
      setShowRejectPrompt(false)
      setReviewRejectReason('')
      await Promise.all([loadTicket(), loadEvents()])
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể xử lý yêu cầu gia hạn.'
      toast.error(message)
    }
  }

  return (
    <div className={`space-y-5 ${isMobileRoute ? 'pb-4' : 'pb-24'}`}>
      <section className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top_left,rgba(242,112,36,0.18),transparent_62%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(242,112,36,0.24),transparent_62%)]" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-3xl">
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusMeta.badgeClassName}`}>
              {statusMeta.label}
            </span>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
              Ticket #{ticketId}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
              Theo dõi tiến độ xử lý, người liên quan và các bước hành động tiếp theo trên cùng một màn chi tiết.
            </p>
          </div>
          <Link
            to={backPath}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Quay lại danh sách
          </Link>
        </div>
      </section>

      {loading && (
        <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <p className="text-sm text-slate-500 dark:text-slate-400">Đang tải dữ liệu ticket...</p>
        </section>
      )}

      {!loading && ticket && (
        <section className="space-y-4">
          {/* SLA Extension Approval Card for Admin */}
          {user?.role === 'Admin' && pendingExtension && (
            <div className="rounded-[28px] border border-orange-200 bg-orange-50/70 p-5 shadow-sm dark:border-orange-500/30 dark:bg-orange-500/10 space-y-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-fptOrange animate-ping" />
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">Yêu cầu xin gia hạn sửa chữa đang chờ duyệt</h4>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Kỹ thuật viên <span className="font-semibold">{pendingExtension.event.actorName}</span> xin gia hạn thêm <span className="font-semibold text-fptOrange">{pendingExtension.requestedMinutes} phút</span>.
              </p>
              <div className="bg-white/80 p-3 rounded-xl border border-orange-100 text-xs text-slate-700 dark:bg-slate-900/50 dark:border-slate-800 dark:text-slate-300">
                <span className="font-semibold">Lý do xin gia hạn:</span> {pendingExtension.reason}
              </div>
              
              {showRejectPrompt ? (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-350">Lý do từ chối gia hạn:</label>
                  <input
                    type="text"
                    value={reviewRejectReason}
                    onChange={(e) => setReviewRejectReason(e.target.value)}
                    placeholder="Nhập lý do từ chối..."
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-1 focus:ring-red-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReviewExtension('REJECTED')}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                    >
                      Xác nhận Từ chối
                    </button>
                    <button
                      onClick={() => {
                        setShowRejectPrompt(false)
                        setReviewRejectReason('')
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleReviewExtension('APPROVED')}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                  >
                    Duyệt yêu cầu
                  </button>
                  <button
                    onClick={() => setShowRejectPrompt(true)}
                    className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 transition"
                  >
                    Từ chối
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SLA Extension Cohesive Row Card for TechSupport */}
          {isTechSupportRoute && Number(ticket.assigneeId) === Number(user?.userId) && ticket.status === 'IN_PROGRESS' && (
            (() => {
              let cardBg = 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800'
              let titleText = 'Yêu cầu gia hạn thời gian sửa chữa'
              let detailText = 'Nếu sự cố phức tạp cần sửa lâu, bạn có thể xin Admin gia hạn thêm thời gian mà không bị trừ điểm KPI.'
              let btnText = 'Yêu cầu gia hạn'
              let showBtn = true
              let isPending = false
              
              if (pendingExtension) {
                cardBg = 'bg-amber-50/70 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20'
                titleText = `Đang chờ Admin duyệt gia hạn (+${pendingExtension.requestedMinutes} phút)`
                detailText = `Lý do gửi: ${pendingExtension.reason}`
                showBtn = false
                isPending = true
              } else if (lastExtensionReview?.eventType === 'EXTENSION_APPROVED') {
                cardBg = 'bg-emerald-50/60 border-emerald-200 dark:bg-emerald-500/5 dark:border-emerald-500/20'
                titleText = `Yêu cầu gia hạn thêm (+${lastExtensionReview.requestedMinutes || 15} phút) đã được duyệt!`
                detailText = 'Hạn xử lý mới đã được cập nhật tự động. Bạn vẫn có thể gửi thêm yêu cầu gia hạn nếu cần thiết.'
                btnText = 'Yêu cầu gia hạn tiếp'
              } else if (lastExtensionReview?.eventType === 'EXTENSION_REJECTED') {
                cardBg = 'bg-red-50/60 border-red-200 dark:bg-red-500/5 dark:border-red-500/20'
                titleText = 'Yêu cầu gia hạn thêm đã bị Admin từ chối'
                detailText = `Lý do từ chối: ${lastExtensionReview.rejectReason}`
                btnText = 'Yêu cầu gia hạn lại'
              }

              return (
                <div className={`rounded-[28px] border p-4 shadow-sm flex flex-wrap items-center justify-between gap-3 ${cardBg}`}>
                  <div className="flex-1 min-w-[280px]">
                    <p className={`text-xs font-bold ${
                      isPending ? 'text-amber-800 dark:text-amber-300' :
                      lastExtensionReview?.eventType === 'EXTENSION_APPROVED' ? 'text-emerald-800 dark:text-emerald-300' :
                      lastExtensionReview?.eventType === 'EXTENSION_REJECTED' ? 'text-red-800 dark:text-red-350' :
                      'text-slate-800 dark:text-slate-100'
                    }`}>
                      {titleText}
                    </p>
                    <p className="text-[11px] text-slate-550 dark:text-slate-400 leading-normal mt-0.5">
                      {detailText}
                    </p>
                  </div>
                  {showBtn && (
                    <button
                      type="button"
                      onClick={() => setShowExtensionModal(true)}
                      className="rounded-xl bg-fptOrange px-4 py-2 text-xs font-semibold text-white hover:bg-fptOrangeDark transition shadow-sm"
                    >
                      {btnText}
                    </button>
                  )}
                  {isPending && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                      Đang chờ duyệt
                    </span>
                  )}
                </div>
              )
            })()
          )}

          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Thiết bị liên quan</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                    {ticket.assetName || 'Thiết bị'}
                  </h3>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    {ticket.assetQaCode} · {ticket.assetLocationName || 'Không rõ vị trí'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getAssetBadgeClassName(assetTechnicalStatusMeta.tone)}`}>
                    {assetTechnicalStatusMeta.label}
                  </span>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getAssetBadgeClassName(assetUsageStatusMeta.tone)}`}>
                    {assetUsageStatusMeta.label}
                  </span>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Mức ưu tiên</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">{ticket.priority}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Mức xử lý của ticket hiện tại.</p>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Tạo lúc</p>
                  <p className="mt-2 text-base font-semibold text-slate-950 dark:text-slate-50">{formatVietnamDateTime(ticket.createdAt)}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Thời điểm ghi nhận sự cố.</p>
                </div>
                <div className="rounded-[24px] border border-orange-200 bg-orange-50/70 p-4 dark:border-orange-500/30 dark:bg-orange-500/10">
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400 font-semibold text-fptOrange">Hạn SLA</p>
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-slate-600 dark:text-slate-350">
                      Hạn xử lý (Min): <span className="font-semibold text-slate-900 dark:text-slate-50">{formatVietnamDateTime(ticket.dueDate)}</span>
                    </p>
                    {maxSlaDate && (
                      <p className="text-xs text-slate-600 dark:text-slate-350">
                        Hạn trễ phạt (Max): <span className="font-semibold text-red-600 dark:text-red-400">{formatVietnamDateTime(maxSlaDate)}</span>
                      </p>
                    )}
                  </div>
                  <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500 leading-tight">Hoàn thành trong khoảng này không bị phạt điểm.</p>
                </div>
              </div>

              <div className="mt-4 rounded-[28px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Mô tả sự cố</p>
                <p className="mt-3 text-sm leading-7 text-slate-700 dark:text-slate-300">{ticket.description}</p>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Thông tin xử lý</p>
                <div className="mt-4 space-y-3 text-sm text-slate-700 dark:text-slate-300">
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Tiếp nhận lúc</p>
                    <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{formatVietnamDateTime(ticket.acceptedAt, 'Chưa tiếp nhận')}</p>
                  </div>
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Hoàn tất lúc</p>
                    <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{formatVietnamDateTime(ticket.resolvedAt, 'Chưa hoàn tất')}</p>
                  </div>
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Người báo</p>
                    <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{ticket.reporterName} | {toVietnameseRole(ticket.reporterRole)}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{ticket.reporterPhone || 'Chưa có số'}</p>
                  </div>
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Kỹ thuật viên</p>
                    <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{ticket.assigneeName || 'Chưa gán'}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{ticket.assigneePhone || 'Chưa có số'}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Phản hồi người dùng</p>
                <div className="mt-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Điểm hiện tại</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                    {ticket.satisfactionScore ? `${ticket.satisfactionScore}/5` : 'Chưa có'}
                  </p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{ticket.satisfactionComment || 'Chưa có nhận xét'}</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {canRateSatisfaction && !ticket.satisfactionScore && (
                    <Link
                      to={reviewPath}
                      className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-100 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300"
                    >
                      <Star size={14} />
                      Gửi đánh giá
                      <ArrowRight size={14} />
                    </Link>
                  )}
                  {canRateSatisfaction && ticket.satisfactionScore && (
                    <Link
                      to={reviewPath}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Xem lại đánh giá
                      <ArrowRight size={14} />
                    </Link>
                  )}
                  {isStandardMobileRoute && (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowTimelineModal(true)}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <History size={15} />
                        Xem timeline
                      </button>
                      <Link
                        to={mobileChatPath}
                        className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-100 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300"
                      >
                        <MessageCircle size={15} />
                        Mở chat
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {isTechMobileRoute && reporterPhone && (
            <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Liên hệ người báo hỏng</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={`tel:${reporterPhone}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-slate-900 dark:text-emerald-300"
                >
                  <Phone size={16} />
                  Gọi điện
                </a>
                {reporterZaloUrl && (
                  <a
                    href={reporterZaloUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm font-semibold text-sky-700 dark:border-sky-500/30 dark:bg-slate-900 dark:text-sky-300"
                  >
                    <MessageCircle size={16} />
                    Nhắn Zalo
                  </a>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await copyText(reporterPhone)
                      toast.success(`Đã copy số ${reporterPhone}.`)
                    } catch {
                      toast.error('Không copy được số điện thoại.')
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <Copy size={16} />
                  Copy số
                </button>
              </div>
            </div>
          )}

          {showSupportContactCard && (
            <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Liên hệ kỹ thuật viên hỗ trợ</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {assigneePhone && (
                  <a
                    href={`tel:${assigneePhone}`}
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-slate-900 dark:text-emerald-300"
                  >
                    <Phone size={16} />
                    Gọi kỹ thuật viên
                  </a>
                )}
                {assigneeZaloUrl && (
                  <a
                    href={assigneeZaloUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm font-semibold text-sky-700 dark:border-sky-500/30 dark:bg-slate-900 dark:text-sky-300"
                  >
                    <MessageCircle size={16} />
                    Chat Zalo
                  </a>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {!canOpenChat && isTechRoute && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          Bạn chỉ có thể mở chat sau khi bấm “Nhận xử lý” ticket này.
        </section>
      )}

      {canOpenChat && (!isStandardMobileRoute ? (
        <>
          {isTechMobileRoute ? (
            <TicketChatBox ticketId={Number(ticketId)} embedded />
          ) : showChat && <TicketChatBox ticketId={Number(ticketId)} onClose={() => setShowChat(false)} />}
          {!showChat && (
            <button
              type="button"
              onClick={() => setShowChat(true)}
              className="fixed bottom-4 right-4 z-40 rounded-full bg-fptOrange px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-fptOrangeDark"
            >
              Mở chat
            </button>
          )}
        </>
      ) : null)}
      <TicketEventTimelineModal
        open={showTimelineModal}
        onClose={() => setShowTimelineModal(false)}
        ticket={ticket}
      />

      {/* SLA Extension Modal */}
      {showExtensionModal && (
        <div className="fixed inset-0 z-45 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Xin gia hạn thời gian sửa chữa</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Yêu cầu sẽ được chuyển đến Admin hệ thống để phê duyệt.
            </p>
            
            <form onSubmit={handleRequestExtension} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-355 mb-1">Số phút gia hạn thêm:</label>
                <select
                  value={extMinutes}
                  onChange={(e) => setExtMinutes(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-fptOrange dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="15">15 phút</option>
                  <option value="30">30 phút</option>
                  <option value="60">1 giờ (60 phút)</option>
                  <option value="120">2 giờ (120 phút)</option>
                  <option value="240">4 giờ (240 phút)</option>
                  <option value="480">8 giờ (480 phút)</option>
                  <option value="1440">24 giờ (1440 phút)</option>
                  <option value="custom">Tùy chọn nhập số phút cụ thể</option>
                </select>
              </div>

              {extMinutes === 'custom' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-355 mb-1">Nhập cụ thể số phút:</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={customExtMinutes}
                    onChange={(e) => setCustomExtMinutes(e.target.value)}
                    required
                    placeholder="Ví dụ: 90, 150..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-fptOrange dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-355 mb-1">Lý do xin gia hạn (tối thiểu 10 ký tự):</label>
                <textarea
                  value={extReason}
                  onChange={(e) => setExtReason(e.target.value)}
                  required
                  rows={3}
                  placeholder="Ví dụ: Lỗi hỏng tụ điện và chập vi mạch nguồn, cần tháo linh kiện mang về phòng kỹ thuật để đo đạc và thay thế linh kiện mới..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-fptOrange dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={submittingExtension}
                  className="flex-1 rounded-xl bg-fptOrange py-2 text-xs font-semibold text-white hover:bg-fptOrangeDark transition disabled:opacity-50"
                >
                  {submittingExtension ? 'Đang gửi...' : 'Gửi yêu cầu'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowExtensionModal(false)
                    setExtReason('')
                  }}
                  className="flex-1 rounded-xl border border-slate-300 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900 transition"
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default TicketDetail
