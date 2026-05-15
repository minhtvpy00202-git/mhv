import { Copy, MessageCircle, Phone } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'
import TicketChatBox from '../components/TicketChatBox'
import { useAuth } from '../context/AuthContext'
import { copyText, getZaloUrl, normalizePhone } from '../utils/contact'
import { formatVietnamDateTime } from '../utils/datetime'
import { isTechSupportMobilePath } from '../utils/navigation'
import { getTicketStatusMeta } from '../utils/ticketStatus'

function toVietnameseRole(role) {
  if (role === 'Admin') return 'Quản trị viên'
  if (role === 'TechSupport') return 'Kỹ thuật viên hỗ trợ'
  return 'Nhân viên'
}

function TicketDetail() {
  const { ticketId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showChat, setShowChat] = useState(true)
  const [timeline, setTimeline] = useState([])

  useEffect(() => {
    if (!ticketId) return
    let mounted = true
    const loadTicket = async () => {
      setLoading(true)
      try {
        const response = await axiosClient.get('/api/tickets')
        const found = (response.data || []).find((item) => Number(item.id) === Number(ticketId))
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
    const loadTimeline = async () => {
      try {
        const response = await axiosClient.get(`/api/tickets/${ticketId}/timeline`, {
          params: { limit: 100 },
        })
        if (!mounted) return
        setTimeline(response.data || [])
      } catch (error) {
        const message = error?.response?.data?.message || 'Không tải được lịch sử ticket.'
        toast.error(message)
      }
    }
    loadTicket()
    loadTimeline()
    return () => {
      mounted = false
    }
  }, [ticketId])

  const statusMeta = useMemo(() => getTicketStatusMeta(ticket?.status), [ticket?.status])
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
  const reporterPhone = normalizePhone(ticket?.reporterPhone)
  const reporterZaloUrl = getZaloUrl(ticket?.reporterPhone)
  const assigneePhone = normalizePhone(ticket?.assigneePhone)
  const assigneeZaloUrl = getZaloUrl(ticket?.assigneePhone)

  return (
    <div className={`space-y-4 ${isMobileRoute ? 'pb-4' : 'pb-24'}`}>
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Chi tiết Ticket #{ticketId}</h2>
            <p className="mt-1 text-sm text-slate-600">Trao đổi trực tiếp giữa giảng viên và kỹ thuật viên.</p>
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
                <p><span className="font-semibold">Hạn SLA:</span> {formatVietnamDateTime(ticket.dueDate)}</p>
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
            <div className="rounded-2xl bg-slate-50 p-3 md:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mô tả sự cố</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{ticket.description}</p>
            </div>
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

          {isStandardMobileRoute && (
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3">
              <p className="text-sm font-semibold text-sky-800">Liên hệ kỹ thuật viên hỗ trợ</p>
              {!assigneePhone ? (
                <p className="mt-2 text-sm text-sky-700">Ticket này chưa được gán kỹ thuật viên hoặc chưa có số điện thoại liên hệ.</p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={`tel:${assigneePhone}`}
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-700"
                  >
                    <Phone size={16} />
                    Gọi kỹ thuật viên
                  </a>
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
              )}
            </div>
          )}
        </section>
      )}

      {!loading && ticket && (
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-slate-800">Lịch sử ticket</h3>
          {timeline.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Chưa có dữ liệu lịch sử.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {timeline.map((event) => (
                <div key={event.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800">{event.message}</p>
                    <p className="text-xs text-slate-500">{formatVietnamDateTime(event.occurredAt)}</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    {event.actorName || 'Hệ thống'} · {event.eventType}
                  </p>
                  {event.detail && (
                    <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-xs text-slate-600">{event.detail}</pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {!canOpenChat && isTechRoute && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Bạn chỉ có thể mở chat sau khi bấm “Nhận xử lý” ticket này.
        </section>
      )}

      {canOpenChat && (isMobileRoute ? (
        <TicketChatBox ticketId={Number(ticketId)} embedded />
      ) : (
        <>
          {showChat && <TicketChatBox ticketId={Number(ticketId)} onClose={() => setShowChat(false)} />}
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
      ))}
    </div>
  )
}

export default TicketDetail
