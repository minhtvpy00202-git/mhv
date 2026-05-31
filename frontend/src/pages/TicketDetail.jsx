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

  useEffect(() => {
    if (!ticketId) return
    let mounted = true
    const loadTicket = async () => {
      setLoading(true)
      try {
        const response = await axiosClient.get(`/api/tickets/${ticketId}`)
        const found = response.data || null
        if (!mounted) return
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
        if (mounted) {
          setLoading(false)
        }
      }
    }
    loadTicket()
    return () => {
      mounted = false
    }
  }, [ticketId])

  const statusMeta = useMemo(() => getTicketStatusMeta(ticket?.status), [ticket?.status])
  const assetTechnicalStatusMeta = useMemo(() => getTechnicalStatusMeta(ticket?.assetTechnicalStatus), [ticket?.assetTechnicalStatus])
  const assetUsageStatusMeta = useMemo(() => getUsageStatusMeta(ticket?.assetUsageStatus), [ticket?.assetUsageStatus])
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
            <p className="mt-2 max-w-[44ch] text-sm leading-6 text-slate-600 dark:text-slate-400">
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
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Hạn SLA</p>
                  <p className="mt-2 text-base font-semibold text-slate-950 dark:text-slate-50">{formatVietnamDateTime(ticket.dueDate)}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Mốc cần hoàn tất theo cam kết.</p>
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
    </div>
  )
}

export default TicketDetail
