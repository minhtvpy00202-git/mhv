import {
  IconArrowLeft as ArrowLeft,
  IconMessage2 as MessageSquareText,
  IconSend as Send,
  IconStar as Star,
} from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'
import { useAuth } from '../context/AuthContext'
import { getAssetStatusMeta } from '../utils/assetStatus'
import { formatVietnamDateTime } from '../utils/datetime'
import { getTicketStatusMeta } from '../utils/ticketStatus'

function getBackPath(pathname = '', ticketId = '') {
  if (pathname.startsWith('/admin/')) {
    return `/admin/tickets/${ticketId}`
  }
  return `/mobile/tickets/${ticketId}`
}

function TicketSatisfactionReview() {
  const { ticketId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [ticket, setTicket] = useState(null)
  const [score, setScore] = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!ticketId) return
    let mounted = true
    const loadTicket = async () => {
      setLoading(true)
      try {
        const response = await axiosClient.get(`/api/tickets/${ticketId}`)
        const nextTicket = response.data || null
        if (!mounted) return
        setTicket(nextTicket)
        setScore(Number(nextTicket?.satisfactionScore) || 0)
        setComment(nextTicket?.satisfactionComment || '')
      } catch (error) {
        const message = error?.response?.data?.message || 'Không tải được ticket để đánh giá.'
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
  const assetStatusMeta = useMemo(() => getAssetStatusMeta(ticket?.assetDisplayStatus), [ticket?.assetDisplayStatus])
  const canRate = ticket?.status === 'RESOLVED'
    && (Number(ticket?.reporterId) === Number(user?.userId) || user?.role === 'Admin')

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (saving || !ticket?.id) return
    if (score < 1 || score > 5) {
      toast.error('Vui lòng chọn điểm hài lòng từ 1 đến 5.')
      return
    }
    setSaving(true)
    try {
      const response = await axiosClient.put(`/api/tickets/${ticket.id}/satisfaction`, {
        satisfactionScore: score,
        satisfactionComment: comment.trim(),
      })
      setTicket(response.data || null)
      toast.success('Đã lưu đánh giá xử lý ticket.')
      navigate(getBackPath(location.pathname, ticket.id), { replace: true })
    } catch (error) {
      const message = error?.response?.data?.message || 'Không lưu được đánh giá.'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <section className="overflow-hidden rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-600 to-fptOrange p-5 text-white shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/90">
              <MessageSquareText size={14} />
              Đánh giá sau xử lý
            </p>
            <h2 className="mt-3 text-2xl font-bold">Gửi phản hồi riêng cho ticket #{ticketId}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/90">
              Chấm điểm mức độ hài lòng và để lại nhận xét ngắn để đội kỹ thuật cải thiện chất lượng hỗ trợ.
            </p>
          </div>
          <Link
            to={getBackPath(location.pathname, ticketId)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15"
          >
            <ArrowLeft size={16} />
            Quay lại ticket
          </Link>
        </div>
      </section>

      {loading && (
        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Đang tải dữ liệu ticket...</p>
        </section>
      )}

      {!loading && ticket && (
        <>
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-slate-800">{ticket.assetName || 'Thiết bị không xác định'}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {ticket.assetQaCode} · {ticket.assetLocationName || 'Không rõ vị trí'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusMeta.badgeClassName}`}>{statusMeta.label}</span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  {assetStatusMeta.label}
                </span>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                <p><span className="font-semibold">Người báo:</span> {ticket.reporterName || '-'}</p>
                <p className="mt-2"><span className="font-semibold">Kỹ thuật viên:</span> {ticket.assigneeName || 'Chưa gán'}</p>
                <p className="mt-2"><span className="font-semibold">Tiếp nhận lúc:</span> {formatVietnamDateTime(ticket.acceptedAt, 'Chưa tiếp nhận')}</p>
                <p className="mt-2"><span className="font-semibold">Hoàn tất lúc:</span> {formatVietnamDateTime(ticket.resolvedAt, 'Chưa hoàn tất')}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-semibold text-slate-800">Mô tả sự cố</p>
                <p className="mt-2 leading-6 text-slate-600">{ticket.description || 'Không có mô tả.'}</p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl bg-white p-5 shadow-sm">
            {!canRate ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Ticket này chưa đủ điều kiện để đánh giá hoặc bạn không có quyền đánh giá.
              </div>
            ) : ticket.satisfactionScore ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm font-semibold text-emerald-800">Đánh giá đã được ghi nhận</p>
                  <p className="mt-2 text-3xl font-bold text-emerald-700">{ticket.satisfactionScore}/5</p>
                  <p className="mt-2 text-sm text-emerald-800">
                    {ticket.satisfactionComment || 'Bạn chưa để lại nhận xét thêm.'}
                  </p>
                </div>
                <Link
                  to={getBackPath(location.pathname, ticket.id)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <ArrowLeft size={16} />
                  Quay lại ticket
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <p className="text-base font-semibold text-slate-800">Mức độ hài lòng của bạn</p>
                  <p className="mt-1 text-sm text-slate-500">Chọn số sao phù hợp với trải nghiệm xử lý ticket này.</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {[1, 2, 3, 4, 5].map((value) => {
                      const active = score >= value
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setScore(value)}
                          className={`inline-flex min-w-16 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                            active
                              ? 'border-amber-300 bg-amber-50 text-amber-700'
                              : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <Star size={16} className={active ? 'fill-current' : ''} />
                          {value}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <label htmlFor="satisfaction-comment" className="block text-base font-semibold text-slate-800">
                    Nhận xét thêm
                  </label>
                  <p className="mt-1 text-sm text-slate-500">Cho biết điều gì đã tốt hoặc cần cải thiện thêm.</p>
                  <textarea
                    id="satisfaction-comment"
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    rows={5}
                    maxLength={1000}
                    placeholder="Ví dụ: Kỹ thuật viên đến nhanh, giải thích rõ nguyên nhân và xử lý dứt điểm."
                    className="mt-3 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none ring-fptOrange focus:ring-2"
                  />
                  <p className="mt-1 text-right text-xs text-slate-400">{comment.length}/1000</p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-2xl bg-fptOrange px-5 py-3 text-sm font-semibold text-white hover:bg-fptOrangeDark disabled:opacity-60"
                  >
                    <Send size={16} />
                    Gửi đánh giá
                  </button>
                  <Link
                    to={getBackPath(location.pathname, ticket.id)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <ArrowLeft size={16} />
                    Hủy
                  </Link>
                </div>
              </form>
            )}
          </section>
        </>
      )}
    </div>
  )
}

export default TicketSatisfactionReview
