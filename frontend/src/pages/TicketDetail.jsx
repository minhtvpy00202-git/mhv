import { ArrowRight, Copy, History, MessageCircle, Phone, Star } from 'lucide-react'
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
  if (tone === 'emerald') return 'bg-emerald-100 text-emerald-800'
  if (tone === 'blue') return 'bg-blue-100 text-blue-800'
  if (tone === 'red') return 'bg-red-100 text-red-800'
  if (tone === 'amber') return 'bg-amber-100 text-amber-800'
  return 'bg-slate-100 text-slate-700'
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
    <div className={`space-y-4 ${isMobileRoute ? 'pb-4' : 'pb-24'}`}>
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Chi tiết Ticket #{ticketId}</h2>
            <p className="mt-1 text-sm text-slate-600">Theo dõi tiến độ xử lý sự cố và mở từng chức năng khi cần.</p>
          </div>
          <Link
            to={backPath}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Quay lại
          </Link>
        </div>
      </section>

      {loading && (
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Đang tải dữ liệu ticket...</p>
        </section>
      )}

      {!loading && ticket && (
        <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-800">{ticket.assetName || 'Thiết bị'}</p>
              <p className="mt-1 text-xs text-slate-500">{ticket.assetQaCode} · {ticket.assetLocationName || 'Không rõ vị trí'}</p>
            </div>
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusMeta.badgeClassName}`}>{statusMeta.label}</span>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Thông tin ticket</p>
              <div className="mt-2 space-y-2 text-sm text-slate-700">
                <p><span className="font-semibold">Mức ưu tiên:</span> {ticket.priority}</p>
                <p><span className="font-semibold">Tạo lúc:</span> {formatVietnamDateTime(ticket.createdAt)}</p>
                <p><span className="font-semibold">Tiếp nhận lúc:</span> {formatVietnamDateTime(ticket.acceptedAt, 'Chưa tiếp nhận')}</p>
                <p><span className="font-semibold">Hạn SLA:</span> {formatVietnamDateTime(ticket.dueDate)}</p>
                <p><span className="font-semibold">Hoàn tất lúc:</span> {formatVietnamDateTime(ticket.resolvedAt, 'Chưa hoàn tất')}</p>
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Trạng thái thiết bị</p>
              <div className="mt-2 grid gap-2">
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
                  <span className="font-semibold">Tình trạng kỹ thuật:</span>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getAssetBadgeClassName(assetTechnicalStatusMeta.tone)}`}>
                    {assetTechnicalStatusMeta.label}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
                  <span className="font-semibold">Vị trí sử dụng:</span>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getAssetBadgeClassName(assetUsageStatusMeta.tone)}`}>
                    {assetUsageStatusMeta.label}
                  </span>
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Người liên quan</p>
              <div className="mt-2 space-y-2 text-sm text-slate-700">
                <p><span className="font-semibold">Người báo:</span> {ticket.reporterName} | {toVietnameseRole(ticket.reporterRole)}</p>
                <p><span className="font-semibold">SĐT người báo:</span> {ticket.reporterPhone || 'Chưa có số'}</p>
                <p><span className="font-semibold">Kỹ thuật viên:</span> {ticket.assigneeName || 'Chưa gán'}</p>
                <p><span className="font-semibold">SĐT kỹ thuật viên:</span> {ticket.assigneePhone || 'Chưa có số'}</p>
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hài lòng người dùng</p>
              <div className="mt-2 space-y-2 text-sm text-slate-700">
                <p><span className="font-semibold">Điểm hiện tại:</span> {ticket.satisfactionScore ? `${ticket.satisfactionScore}/5` : 'Chưa có đánh giá'}</p>
                <p><span className="font-semibold">Nhận xét:</span> {ticket.satisfactionComment || 'Chưa có nhận xét'}</p>
                {canRateSatisfaction && !ticket.satisfactionScore && (
                  <Link
                    to={reviewPath}
                    className="inline-flex items-center gap-2 rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-100"
                  >
                    <Star size={14} />
                    Mở trang đánh giá riêng
                    <ArrowRight size={14} />
                  </Link>
                )}
                {canRateSatisfaction && ticket.satisfactionScore && (
                  <Link
                    to={reviewPath}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Xem lại đánh giá
                    <ArrowRight size={14} />
                  </Link>
                )}
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3 md:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mô tả sự cố</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{ticket.description}</p>
            </div>
            {isStandardMobileRoute && (
              <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3 md:col-span-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTimelineModal(true)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <History size={15} />
                    Xem toàn bộ timeline
                  </button>
                  <Link
                    to={mobileChatPath}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-sky-300 bg-sky-100 px-3 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-200"
                  >
                    <MessageCircle size={15} />
                    Mở khu vực chat riêng
                  </Link>
                </div>
              </div>
            )}
          </div>

          {isTechMobileRoute && reporterPhone && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-sm font-semibold text-emerald-800">Liên hệ người báo hỏng</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={`tel:${reporterPhone}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-700"
                >
                  <Phone size={16} />
                  Gọi điện
                </a>
                {reporterZaloUrl && (
                  <a
                    href={reporterZaloUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm font-semibold text-sky-700"
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
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                >
                  <Copy size={16} />
                  Copy số
                </button>
              </div>
            </div>
          )}

          {showSupportContactCard && (
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3">
              <p className="text-sm font-semibold text-sky-800">Liên hệ kỹ thuật viên hỗ trợ</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {assigneePhone && (
                  <a
                    href={`tel:${assigneePhone}`}
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-700"
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
                    className="inline-flex items-center gap-2 rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm font-semibold text-sky-700"
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
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
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
