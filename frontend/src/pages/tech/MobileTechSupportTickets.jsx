import { AlertCircle, CheckCircle2, Clock3, Copy, Image as ImageIcon, MessageCircle, Phone, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../../api/axiosClient'
import { useAuth } from '../../context/AuthContext'
import { copyText, getZaloUrl, normalizePhone } from '../../utils/contact'
import { formatVietnamDateTime } from '../../utils/datetime'
import { resolveBackendMediaUrl } from '../../utils/mediaUrl'

const filterTabs = [
  { value: '', label: 'Tất cả' },
  { value: 'PENDING', label: 'Mới báo' },
  { value: 'IN_PROGRESS', label: 'Đang xử lý' },
  { value: 'RESOLVED', label: 'Hoàn tất' },
]

function toVietnamesePriority(priority) {
  if (priority === 'HIGH') return 'Cao'
  if (priority === 'LOW') return 'Thấp'
  return 'Trung bình'
}

function toVietnameseStatus(status) {
  if (status === 'PENDING') return 'Mới báo hỏng'
  if (status === 'IN_PROGRESS') return 'Đang xử lý'
  if (status === 'RESOLVED') return 'Đã hoàn tất'
  return status
}

function formatMinutes(minutes) {
  const safeMinutes = Number(minutes) || 0
  if (safeMinutes <= 0) return '-'
  if (safeMinutes < 60) return `${safeMinutes}p`
  const hours = Math.floor(safeMinutes / 60)
  const remainMinutes = safeMinutes % 60
  return remainMinutes > 0 ? `${hours}g ${remainMinutes}p` : `${hours}g`
}

function getWorkspaceTickets(pendingRows, myRows) {
  const byId = new Map()
  ;[...(pendingRows || []), ...(myRows || [])].forEach((ticket) => {
    byId.set(ticket.id, ticket)
  })
  return [...byId.values()].sort((left, right) => {
    const leftPriority = left.status === 'PENDING' ? 0 : left.status === 'IN_PROGRESS' ? 1 : 2
    const rightPriority = right.status === 'PENDING' ? 0 : right.status === 'IN_PROGRESS' ? 1 : 2
    if (leftPriority !== rightPriority) return leftPriority - rightPriority
    return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime()
  })
}

function MobileTechSupportTickets() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [tickets, setTickets] = useState([])
  const [kpis, setKpis] = useState(null)
  const [loading, setLoading] = useState(false)
  const [kpiLoading, setKpiLoading] = useState(false)
  const [submittingId, setSubmittingId] = useState(null)
  const [activeFilter, setActiveFilter] = useState('')
  const [keyword, setKeyword] = useState('')
  const [previewImageUrl, setPreviewImageUrl] = useState('')

  const loadTickets = async () => {
    setLoading(true)
    try {
      const [pendingRes, myRes] = await Promise.all([
        axiosClient.get('/api/tickets', { params: { status: 'PENDING' } }),
        axiosClient.get('/api/tickets', { params: { assignee_id: user?.userId } }),
      ])
      const data = getWorkspaceTickets(pendingRes.data || [], myRes.data || [])
      setTickets(data)
    } catch (error) {
      const message = error?.response?.data?.message || 'Không tải được danh sách ticket hỗ trợ.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const loadKpis = async () => {
    setKpiLoading(true)
    try {
      const response = await axiosClient.get('/api/dashboard/helpdesk-kpis/me')
      setKpis(response.data)
    } catch (error) {
      const message = error?.response?.data?.message || 'Không tải được KPI cá nhân.'
      toast.error(message)
    } finally {
      setKpiLoading(false)
    }
  }

  useEffect(() => {
    loadTickets()
    loadKpis()
  }, [user?.userId])

  const filteredTickets = useMemo(() => {
    const normalized = keyword.trim().toLowerCase()
    return tickets.filter((ticket) => {
      if (activeFilter && ticket.status !== activeFilter) {
        return false
      }
      if (!normalized) {
        return true
      }
      const searchable = `${ticket.id} ${ticket.assetQaCode || ''} ${ticket.assetName || ''} ${ticket.description || ''} ${ticket.reporterName || ''}`.toLowerCase()
      return searchable.includes(normalized)
    })
  }, [activeFilter, keyword, tickets])

  const summaryCards = [
    {
      label: 'Ticket mới phù hợp',
      value: kpis?.newTicketCount ?? 0,
      icon: AlertCircle,
      className: 'border-amber-200 bg-amber-50 text-amber-800',
    },
    {
      label: 'Đang xử lý',
      value: tickets.filter((item) => Number(item.assigneeId) === Number(user?.userId) && item.status === 'IN_PROGRESS').length,
      icon: Clock3,
      className: 'border-blue-200 bg-blue-50 text-blue-800',
    },
    {
      label: 'Quá hạn SLA',
      value: kpis?.overdueTicketCount ?? 0,
      icon: AlertCircle,
      className: 'border-rose-200 bg-rose-50 text-rose-800',
    },
    {
      label: 'Phản hồi TB',
      value: formatMinutes(kpis?.averageFirstResponseMinutes ?? 0),
      icon: MessageCircle,
      className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    },
  ]

  const handleTakeTicket = async (ticketId) => {
    setSubmittingId(ticketId)
    try {
      await axiosClient.put(`/api/tickets/${ticketId}/assign`, {
        assignee_id: Number(user?.userId),
      })
      toast.success(`Đã nhận xử lý ticket #${ticketId}.`)
      await Promise.all([loadTickets(), loadKpis()])
      navigate(`/tech-mobile/tickets/${ticketId}`)
    } catch (error) {
      const message = error?.response?.data?.message || 'Nhận xử lý ticket thất bại.'
      toast.error(message)
    } finally {
      setSubmittingId(null)
    }
  }

  const handleResolve = async (ticketId) => {
    setSubmittingId(ticketId)
    try {
      await axiosClient.put(`/api/tickets/${ticketId}/resolve`)
      toast.success(`Đã hoàn tất ticket #${ticketId}.`)
      await Promise.all([loadTickets(), loadKpis()])
    } catch (error) {
      const message = error?.response?.data?.message || 'Hoàn tất ticket thất bại.'
      toast.error(message)
    } finally {
      setSubmittingId(null)
    }
  }

  return (
    <section className="space-y-3">
      <div className="rounded-xl bg-white p-3 shadow-sm">
        <h2 className="text-base font-semibold text-slate-800">Bảng việc hiện trường</h2>
        <p className="mt-1 text-sm text-slate-500">Nhận việc nhanh, xem SLA và mở chat ngay trong lúc sửa chữa.</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {summaryCards.map(({ label, value, icon: Icon, className }) => (
          <div key={label} className={`rounded-xl border p-3 shadow-sm ${className}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium opacity-80">{label}</p>
              <Icon size={16} />
            </div>
            <p className="mt-2 text-xl font-semibold">{kpiLoading ? '...' : value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-white p-3 shadow-sm">
        <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
          <Search size={16} className="text-slate-400" />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Tìm theo ticket, thiết bị, người báo..."
            className="w-full text-sm outline-none"
          />
        </label>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {filterTabs.map((tab) => (
            <button
              key={tab.value || 'all'}
              type="button"
              onClick={() => setActiveFilter(tab.value)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                activeFilter === tab.value
                  ? 'bg-blue-600 text-white'
                  : 'border border-slate-200 bg-slate-50 text-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 pb-2">
        {loading && <p className="rounded-xl bg-white px-3 py-3 text-sm text-slate-500 shadow-sm">Đang tải ticket...</p>}
        {!loading && filteredTickets.length === 0 && (
          <p className="rounded-xl bg-white px-3 py-3 text-sm text-slate-500 shadow-sm">Không có ticket phù hợp với bộ lọc hiện tại.</p>
        )}
        {!loading && filteredTickets.map((ticket) => {
          const isMine = Number(ticket.assigneeId) === Number(user?.userId)
          const reporterPhone = normalizePhone(ticket.reporterPhone)
          const zaloUrl = getZaloUrl(ticket.reporterPhone)
          return (
            <article key={ticket.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">Ticket #{ticket.id}</p>
                  <p className="mt-1 truncate text-sm text-slate-600">{ticket.assetQaCode} - {ticket.assetName || 'Thiết bị'}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${
                  ticket.status === 'RESOLVED'
                    ? 'bg-emerald-100 text-emerald-700'
                    : ticket.status === 'IN_PROGRESS'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-amber-100 text-amber-700'
                }`}
                >
                  {toVietnameseStatus(ticket.status)}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                <p><span className="font-semibold">Người báo:</span> {ticket.reporterName || '-'}</p>
                <p><span className="font-semibold">Ưu tiên:</span> {toVietnamesePriority(ticket.priority)}</p>
                <p className="col-span-2"><span className="font-semibold">Điện thoại:</span> {ticket.reporterPhone || 'Chưa có số'}</p>
                <p className="col-span-2"><span className="font-semibold">Hạn xử lý:</span> {formatVietnamDateTime(ticket.dueDate)}</p>
              </div>

              <p className="mt-3 line-clamp-3 text-sm text-slate-700">{ticket.description}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                {ticket.imageUrl && (
                  <button
                    type="button"
                    onClick={() => setPreviewImageUrl(ticket.imageUrl)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
                  >
                    <ImageIcon size={14} />
                    Ảnh lỗi
                  </button>
                )}
                {reporterPhone && (
                  <a
                    href={`tel:${reporterPhone}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"
                  >
                    <Phone size={14} />
                    Gọi điện
                  </a>
                )}
                {zaloUrl && (
                  <a
                    href={zaloUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700"
                  >
                    <MessageCircle size={14} />
                    Nhắn Zalo
                  </a>
                )}
                {reporterPhone && (
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
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700"
                  >
                    <Copy size={14} />
                    Copy số ĐT
                  </button>
                )}
                {ticket.status === 'PENDING' && (
                  <button
                    type="button"
                    onClick={() => handleTakeTicket(ticket.id)}
                    disabled={submittingId === ticket.id}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    Nhận xử lý
                  </button>
                )}
                {ticket.status === 'IN_PROGRESS' && isMine && (
                  <button
                    type="button"
                    onClick={() => handleResolve(ticket.id)}
                    disabled={submittingId === ticket.id}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    <CheckCircle2 size={14} />
                    Hoàn tất
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => navigate(`/tech-mobile/tickets/${ticket.id}`)}
                  className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700"
                >
                  <MessageCircle size={14} />
                  Mở ticket
                </button>
              </div>
            </article>
          )
        })}
      </div>

      {previewImageUrl && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-3 shadow-xl">
            <img
              src={resolveBackendMediaUrl(previewImageUrl)}
              alt="ticket-error"
              className="max-h-[70vh] w-full rounded-xl object-contain"
            />
            <button
              type="button"
              onClick={() => setPreviewImageUrl('')}
              className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

export default MobileTechSupportTickets
