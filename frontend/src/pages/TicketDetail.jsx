import {
  IconArrowRight as ArrowRight,
  IconCopy as Copy,
  IconHistory as History,
  IconMessageCircle as MessageCircle,
  IconPhone as Phone,
  IconRefresh as Refresh,
  IconStar as Star,
  IconTrash as Trash,
} from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'
import AuthenticatedImage from '../components/AuthenticatedImage'
import TicketChatBox from '../components/TicketChatBox'
import TicketEventTimelineModal from '../components/TicketEventTimelineModal'
import TicketReasonModal from '../components/TicketReasonModal'
import TicketResolutionModal from '../components/TicketResolutionModal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { useAuth } from '../context/AuthContext'
import { copyText, getZaloUrl, normalizePhone } from '../utils/contact'
import { formatVietnamDateTime, parseServerDateTime } from '../utils/datetime'
import { isTechSupportMobilePath } from '../utils/navigation'
import { getTechnicalStatusMeta, getUsageStatusMeta } from '../utils/assetStatus'
import { getTicketStatusMeta, TICKET_CHAT_OPEN_STATUSES, TICKET_TECH_WORK_STATUSES } from '../utils/ticketStatus'

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

function toVietnameseResolutionOutcome(outcome) {
  if (outcome === 'REPAIRED') return 'Đã sửa chữa thành công'
  if (outcome === 'NO_FAULT_FOUND') return 'Không phát hiện lỗi'
  if (outcome === 'UNREPAIRABLE') return 'Không thể sửa chữa'
  if (outcome === 'REPLACEMENT_REQUIRED') return 'Cần thay thế thiết bị'
  return outcome || 'Chưa ghi nhận'
}

function toVietnamesePriority(priority) {
  if (priority === 'HIGH') return 'Cao'
  if (priority === 'MEDIUM') return 'Trung bình'
  if (priority === 'LOW') return 'Thấp'
  return priority || 'Chưa xác định'
}

function isWithinReopenWindow(ticket) {
  const completedAt = parseServerDateTime(ticket?.closedAt || ticket?.resolvedAt)
  if (!completedAt) return false
  const elapsed = Date.now() - completedAt.getTime()
  return elapsed >= 0 && elapsed <= 7 * 24 * 60 * 60 * 1000
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
  const [quickReason, setQuickReason] = useState('Chờ linh kiện thay thế')
  const [reviewRejectReason, setReviewRejectReason] = useState('')
  const [showRejectPrompt, setShowRejectPrompt] = useState(false)
  const [submittingExtension, setSubmittingExtension] = useState(false)
  const [reasonAction, setReasonAction] = useState(null)
  const [submittingLifecycle, setSubmittingLifecycle] = useState(false)
  const [showResolutionModal, setShowResolutionModal] = useState(false)
  const [submittingResolution, setSubmittingResolution] = useState(false)
  const [showConfirmResolution, setShowConfirmResolution] = useState(false)

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
      if (error?.response?.status === 403) {
        const fallbackPath = location.pathname.startsWith('/admin/')
          ? '/admin/tickets'
          : isTechSupportMobilePath(location.pathname)
            ? '/tech-mobile/tickets'
            : location.pathname.startsWith('/tech/')
              ? '/tech/tickets'
              : '/mobile/home'
        navigate(fallbackPath, { replace: true })
      }
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

  const minSlaDate = (() => {
    if (!ticket?.createdAt || !ticket?.minSlaMinutes) return null
    const date = parseServerDateTime(ticket.createdAt)
    if (!date) return null
    date.setMinutes(date.getMinutes() + ticket.minSlaMinutes)
    return date
  })()
  const maxSlaDate = (() => {
    if (!ticket?.createdAt || !ticket?.maxSlaMinutes) return null
    const date = parseServerDateTime(ticket.createdAt)
    if (!date) return null
    date.setMinutes(date.getMinutes() + ticket.maxSlaMinutes)
    return date
  })()

  const pendingExtension = useMemo(() => {
    const sorted = [...events].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    const lastRequest = sorted.find(e => e.eventType === 'EXTENSION_REQUESTED')
    if (!lastRequest) return null

    const lastRequestIndex = sorted.indexOf(lastRequest)
    const hasResponse = sorted.slice(0, lastRequestIndex).some(e =>
      ['EXTENSION_APPROVED', 'EXTENSION_REJECTED', 'EXTENSION_EXPIRED'].includes(e.eventType)
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
      ['EXTENSION_APPROVED', 'EXTENSION_REJECTED', 'EXTENSION_EXPIRED'].includes(e.eventType)
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
    && Number(ticket?.reporterId) === Number(user?.userId)
    && !isTechSupportRoute
  const isReporter = Number(ticket?.reporterId) === Number(user?.userId)
  const canCancelTicket = ['PENDING', 'IN_PROGRESS', 'AWAITING_CONFIRMATION', 'WAITING_REPLACEMENT'].includes(ticket?.status)
    && (user?.role === 'Admin' || (isReporter && ticket?.status === 'PENDING'))
  const canReopenTicket = ticket?.status === 'RESOLVED'
    && isReporter
    && isWithinReopenWindow(ticket)
  const canConfirmResolution = ticket?.status === 'AWAITING_CONFIRMATION' && isReporter
  const canResolveTicket = isTechSupportRoute
    && TICKET_TECH_WORK_STATUSES.includes(ticket?.status)
    && Number(ticket?.assigneeId) === Number(user?.userId)
  const reviewPath = location.pathname.startsWith('/admin/')
    ? `/admin/tickets/${ticketId}/review`
    : `/mobile/tickets/${ticketId}/review`
  const reporterPhone = normalizePhone(ticket?.reporterPhone)
  const reporterZaloUrl = getZaloUrl(ticket?.reporterPhone)
  const assigneePhone = normalizePhone(ticket?.assigneePhone)
  const assigneeZaloUrl = getZaloUrl(ticket?.assigneePhone)
  const mobileChatPath = `/mobile/chats/${ticketId}`
  const showSupportContactCard = isStandardMobileRoute
    && TICKET_CHAT_OPEN_STATUSES.includes(ticket?.status)
    && (assigneePhone || assigneeZaloUrl)

  const handleRequestExtension = async (e) => {
    e.preventDefault()
    let finalReason = quickReason
    if (quickReason === 'other') {
      if (!extReason || extReason.trim().length < 10) {
        toast.error('Lý do gia hạn phải tối thiểu 10 ký tự.')
        return
      }
      finalReason = extReason.trim()
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
        reason: finalReason
      })
      toast.success('Đã gửi yêu cầu gia hạn thời gian thành công!')
      setShowExtensionModal(false)
      setExtReason('')
      setQuickReason('Chờ linh kiện thay thế')
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

  const handleLifecycleAction = async (reason) => {
    if (!reasonAction) return
    setSubmittingLifecycle(true)
    try {
      if (reasonAction === 'reopen') {
        const response = await axiosClient.post(`/api/tickets/${ticketId}/reopen`, { reason })
        const newTicketId = response.data?.id
        toast.success(`Đã mở lại bằng ticket #${newTicketId}.`)
        setReasonAction(null)
        if (newTicketId) {
          const prefix = user?.role === 'Admin' ? '/admin/tickets' : '/mobile/tickets'
          navigate(`${prefix}/${newTicketId}`)
        }
      } else if (reasonAction === 'rejectResolution') {
        await axiosClient.put(`/api/tickets/${ticketId}/reject-resolution`, { reason })
        toast.success(`Ticket #${ticketId} đã được trả lại cho kỹ thuật viên xử lý tiếp.`)
        setReasonAction(null)
        await Promise.all([loadTicket(), loadEvents()])
      } else {
        await axiosClient.put(`/api/tickets/${ticketId}/cancel`, { reason })
        toast.success(`Đã hủy ticket #${ticketId}.`)
        setReasonAction(null)
        await Promise.all([loadTicket(), loadEvents()])
      }
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể cập nhật ticket.'
      toast.error(message)
    } finally {
      setSubmittingLifecycle(false)
    }
  }

  const handleConfirmResolution = async () => {
    setSubmittingLifecycle(true)
    try {
      await axiosClient.put(`/api/tickets/${ticketId}/confirm-resolution`)
      toast.success(`Đã xác nhận hoàn tất ticket #${ticketId}.`)
      setShowConfirmResolution(false)
      await Promise.all([loadTicket(), loadEvents()])
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể xác nhận kết quả xử lý.'
      toast.error(message)
    } finally {
      setSubmittingLifecycle(false)
    }
  }

  const handleResolveTicket = async ({ outcome, note, image }) => {
    setSubmittingResolution(true)
    try {
      const formData = new FormData()
      formData.append('outcome', outcome)
      formData.append('note', note)
      if (image) formData.append('image', image)
      await axiosClient.put(`/api/tickets/${ticketId}/resolve`, formData)
      toast.success('Đã cập nhật kết quả xử lý ticket.')
      setShowResolutionModal(false)
      await Promise.all([loadTicket(), loadEvents()])
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể hoàn tất ticket.'
      toast.error(message)
    } finally {
      setSubmittingResolution(false)
    }
  }

  const summaryItems = ticket ? [
    { label: 'Thiết bị', value: ticket.assetName || 'Thiết bị' },
    { label: 'Mã QA / vị trí', value: `${ticket.assetQaCode || 'Chưa rõ'}${ticket.assetLocationName ? ` • ${ticket.assetLocationName}` : ''}` },
    { label: 'Ưu tiên', value: toVietnamesePriority(ticket.priority) },
    { label: 'Tạo lúc', value: formatVietnamDateTime(ticket.createdAt, 'Chưa ghi nhận') },
    { label: 'Tiếp nhận lúc', value: formatVietnamDateTime(ticket.acceptedAt, 'Chưa tiếp nhận') },
    { label: 'SLA xử lý', value: formatVietnamDateTime(minSlaDate, 'Chưa có SLA') },
    { label: 'SLA trễ phạt', value: formatVietnamDateTime(maxSlaDate, 'Không áp dụng') },
    { label: 'Người báo', value: `${ticket.reporterName || 'Chưa rõ'}${ticket.reporterPhone ? ` • ${ticket.reporterPhone}` : ''}` },
    { label: 'Kỹ thuật viên', value: `${ticket.assigneeName || 'Chưa gán'}${ticket.assigneePhone ? ` • ${ticket.assigneePhone}` : ''}` },
  ] : []

  return (
    <div className={`space-y-5 ${isMobileRoute ? 'pb-4' : 'pb-12'}`}>
      <div className={!isMobileRoute ? 'mx-auto max-w-5xl space-y-5' : 'space-y-5'}>
        <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-3">
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusMeta.badgeClassName}`}>
                {statusMeta.label}
              </span>
              <div>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                  Ticket #{ticketId}
                </h2>
                {!loading && ticket && (
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                    {ticket.assetName || 'Thiết bị'}{ticket.assetQaCode ? ` • ${ticket.assetQaCode}` : ''}{ticket.assetLocationName ? ` • ${ticket.assetLocationName}` : ''}
                  </p>
                )}
              </div>
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
            <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Tóm tắt ticket</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Nhìn một lượt để biết tình trạng hiện tại, người liên quan và các mốc thời gian quan trọng.
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

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {summaryItems.map((item) => (
                  <div key={item.label} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{item.label}</p>
                    <p className="mt-1 text-sm font-semibold leading-6 text-slate-900 dark:text-slate-100">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowTimelineModal(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <History size={15} />
                  Xem timeline
                </button>
                {isStandardMobileRoute && (
                  <Link
                    to={mobileChatPath}
                    className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-100 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300"
                  >
                    <MessageCircle size={15} />
                    Mở chat
                  </Link>
                )}
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Nội dung người dùng báo</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Đây là mô tả và hình ảnh người dùng gửi kèm để báo lỗi ban đầu, không phải ảnh QR hay ảnh xác nhận kỹ thuật.
              </p>
              <div className="mt-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-slate-300">
                  {ticket.description || 'Người dùng chưa nhập mô tả.'}
                </p>
                {ticket.imageUrl && (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Ảnh người dùng gửi kèm</p>
                    <AuthenticatedImage
                      src={ticket.imageUrl}
                      alt="Ảnh người dùng gửi kèm"
                      className="max-h-[420px] w-full rounded-2xl object-contain"
                    />
                  </div>
                )}
              </div>
            </div>

            {((canCancelTicket || canReopenTicket || canResolveTicket || canConfirmResolution)
              || (isTechSupportRoute && Number(ticket.assigneeId) === Number(user?.userId) && TICKET_TECH_WORK_STATUSES.includes(ticket.status))
              || (user?.role === 'Admin' && pendingExtension)) && (
              <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Thao tác</p>

                {isTechSupportRoute && Number(ticket.assigneeId) === Number(user?.userId) && TICKET_TECH_WORK_STATUSES.includes(ticket.status) ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setShowResolutionModal(true)}
                      className="inline-flex w-full items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                    >
                      {ticket.status === 'WAITING_REPLACEMENT' ? 'Gửi kết quả xử lý' : 'Gửi kết quả xử lý'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowExtensionModal(true)}
                      disabled={Boolean(pendingExtension)}
                      className="inline-flex w-full items-center justify-center rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-700 hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Yêu cầu gia hạn
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {canConfirmResolution && (
                      <>
                        <button
                          type="button"
                          onClick={() => setShowConfirmResolution(true)}
                          className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                        >
                          Xác nhận thiết bị đã ổn
                        </button>
                        <button
                          type="button"
                          onClick={() => setReasonAction('rejectResolution')}
                          className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100"
                        >
                          Yêu cầu xử lý lại
                        </button>
                      </>
                    )}
                    {canCancelTicket && (
                      <button
                        type="button"
                        onClick={() => setReasonAction('cancel')}
                        className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                      >
                        <Trash size={16} />
                        Hủy ticket
                      </button>
                    )}
                    {canReopenTicket && (
                      <button
                        type="button"
                        onClick={() => setReasonAction('reopen')}
                        className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                      >
                        <Refresh size={16} />
                        Báo tái lỗi / mở lại
                      </button>
                    )}
                  </div>
                )}

                {pendingExtension && (
                  <div className="mt-4 rounded-[20px] border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                    Đang chờ duyệt yêu cầu gia hạn thêm {pendingExtension.requestedMinutes} phút.
                  </div>
                )}

                {user?.role === 'Admin' && pendingExtension && (
                  <div className="mt-4 rounded-[24px] border border-orange-200 bg-orange-50/70 p-4 dark:border-orange-500/30 dark:bg-orange-500/10">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-fptOrange animate-ping" />
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Yêu cầu xin gia hạn đang chờ duyệt</p>
                    </div>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                      Kỹ thuật viên <span className="font-semibold">{pendingExtension.event.actorName}</span> xin thêm <span className="font-semibold text-fptOrange">{pendingExtension.requestedMinutes} phút</span>.
                    </p>
                    <p className="mt-2 rounded-xl border border-orange-100 bg-white/80 px-3 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300">
                      Lý do: {pendingExtension.reason}
                    </p>
                    {showRejectPrompt ? (
                      <div className="mt-3 space-y-2">
                        <input
                          type="text"
                          value={reviewRejectReason}
                          onChange={(e) => setReviewRejectReason(e.target.value)}
                          placeholder="Nhập lý do từ chối..."
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-red-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => handleReviewExtension('REJECTED')} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
                            Xác nhận từ chối
                          </button>
                          <button
                            onClick={() => {
                              setShowRejectPrompt(false)
                              setReviewRejectReason('')
                            }}
                            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                          >
                            Hủy
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button onClick={() => handleReviewExtension('APPROVED')} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                          Duyệt yêu cầu
                        </button>
                        <button onClick={() => setShowRejectPrompt(true)} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
                          Từ chối
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

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

            {!canOpenChat && isTechRoute && (
              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                Bạn chỉ có thể mở chat sau khi bấm “Nhận xử lý” ticket này.
              </section>
            )}

          </section>
        )}
      </div>
      {canOpenChat && (!isStandardMobileRoute ? (
        <>
          {isTechMobileRoute ? (
            <TicketChatBox
              ticketId={Number(ticketId)}
              embedded
              readOnly={user?.role === 'Admin' || !TICKET_CHAT_OPEN_STATUSES.includes(ticket?.status)}
            />
          ) : showChat ? (
            <TicketChatBox
              ticketId={Number(ticketId)}
              onClose={() => setShowChat(false)}
              readOnly={user?.role === 'Admin' || !TICKET_CHAT_OPEN_STATUSES.includes(ticket?.status)}
            />
          ) : (
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
      <TicketReasonModal
        open={Boolean(reasonAction)}
        title={reasonAction === 'reopen'
          ? `Mở lại ticket #${ticketId}`
          : reasonAction === 'rejectResolution'
            ? `Yêu cầu xử lý lại ticket #${ticketId}`
            : `Hủy ticket #${ticketId}`}
        description={reasonAction === 'reopen'
          ? 'Hệ thống sẽ tạo ticket mới, liên kết với ticket này và chuyển thiết bị về trạng thái báo hỏng.'
          : reasonAction === 'rejectResolution'
            ? 'Mô tả rõ lỗi vẫn còn để kỹ thuật viên tiếp tục xử lý trên chính ticket này.'
            : 'Bạn chỉ có thể hủy khi ticket chưa được kỹ thuật viên tiếp nhận.'}
        confirmLabel={reasonAction === 'reopen'
          ? 'Tạo ticket mở lại'
          : reasonAction === 'rejectResolution'
            ? 'Gửi yêu cầu xử lý lại'
            : 'Xác nhận hủy'}
        tone={reasonAction === 'reopen' || reasonAction === 'rejectResolution' ? 'primary' : 'danger'}
        submitting={submittingLifecycle}
        onClose={() => setReasonAction(null)}
        onSubmit={handleLifecycleAction}
      />
      <ConfirmDialog
        open={showConfirmResolution}
        title={`Xác nhận hoàn tất ticket #${ticketId}`}
        message="Chỉ xác nhận khi thiết bị đã hoạt động đúng. Sau khi xác nhận, ticket sẽ được đóng và bạn có thể gửi đánh giá."
        confirmLabel="Xác nhận hoàn tất"
        tone="primary"
        busy={submittingLifecycle}
        onConfirm={handleConfirmResolution}
        onClose={() => setShowConfirmResolution(false)}
      />
      <TicketResolutionModal
        open={showResolutionModal}
        ticketId={Number(ticketId)}
        submitting={submittingResolution}
        onClose={() => setShowResolutionModal(false)}
        onSubmit={handleResolveTicket}
      />

      {/* SLA Extension Modal */}
      {showExtensionModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4">
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
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-355 mb-1">Danh mục lý do gia hạn nhanh:</label>
                <select
                  value={quickReason}
                  onChange={(e) => setQuickReason(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-fptOrange dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="Chờ linh kiện thay thế">Chờ linh kiện thay thế</option>
                  <option value="Thiết bị lỗi phức tạp cần đo đạc thêm">Thiết bị lỗi phức tạp cần đo đạc thêm</option>
                  <option value="Hẹn lại thời gian sửa chữa với người dùng">Hẹn lại thời gian sửa chữa với người dùng</option>
                  <option value="other">Khác (Nhập lý do chi tiết bên dưới...)</option>
                </select>
              </div>

              {quickReason === 'other' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-355 mb-1">Lý do xin gia hạn chi tiết (tối thiểu 10 ký tự):</label>
                  <textarea
                    value={extReason}
                    onChange={(e) => setExtReason(e.target.value)}
                    required
                    rows={3}
                    placeholder="Ví dụ: Lỗi hỏng tụ điện và chập vi mạch nguồn, cần tháo linh kiện mang về phòng kỹ thuật để đo đạc và thay thế linh kiện mới..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-fptOrange dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
              )}

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
                    setQuickReason('Chờ linh kiện thay thế')
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
