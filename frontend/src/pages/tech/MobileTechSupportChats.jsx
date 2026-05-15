import { Clock3, MessageCircle, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../../api/axiosClient'
import { useAuth } from '../../context/AuthContext'
import { formatVietnamDateTime } from '../../utils/datetime'

function toVietnameseStatus(status) {
  if (status === 'PENDING') return 'Mới báo hỏng'
  if (status === 'IN_PROGRESS') return 'Đang xử lý'
  if (status === 'RESOLVED') return 'Đã hoàn tất'
  return status
}

function MobileTechSupportChats() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    const loadTickets = async () => {
      setLoading(true)
      try {
        const response = await axiosClient.get('/api/tickets', {
          params: { assignee_id: user?.userId },
        })
        const rows = response.data || []
        setTickets(rows)
      } catch (error) {
        const message = error?.response?.data?.message || 'Không tải được các cuộc trao đổi đang phụ trách.'
        toast.error(message)
      } finally {
        setLoading(false)
      }
    }
    loadTickets()
  }, [user?.userId])

  const filteredTickets = useMemo(() => {
    const normalized = keyword.trim().toLowerCase()
    return tickets
      .filter((ticket) => Number(ticket.assigneeId) === Number(user?.userId))
      .filter((ticket) => {
        if (!normalized) return true
        const searchable = `${ticket.id} ${ticket.assetQaCode || ''} ${ticket.assetName || ''} ${ticket.reporterName || ''} ${ticket.description || ''}`.toLowerCase()
        return searchable.includes(normalized)
      })
      .sort((left, right) => {
        const leftScore = left.status === 'IN_PROGRESS' ? 0 : left.status === 'PENDING' ? 1 : 2
        const rightScore = right.status === 'IN_PROGRESS' ? 0 : right.status === 'PENDING' ? 1 : 2
        return leftScore - rightScore
      })
  }, [keyword, tickets, user?.userId])

  return (
    <section className="space-y-3">
      <div className="rounded-xl bg-white p-3 shadow-sm">
        <h2 className="text-base font-semibold text-slate-800">Trao đổi với người báo hỏng</h2>
        <p className="mt-1 text-sm text-slate-500">Mở nhanh ticket bạn đang phụ trách để nhắn tin, gửi ảnh hoặc ghi âm.</p>
        <label className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
          <Search size={16} className="text-slate-400" />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Tìm theo ticket, thiết bị, người báo..."
            className="w-full text-sm outline-none"
          />
        </label>
      </div>

      <div className="space-y-2">
        {loading && <p className="rounded-xl bg-white px-3 py-3 text-sm text-slate-500 shadow-sm">Đang tải danh sách chat...</p>}
        {!loading && filteredTickets.length === 0 && (
          <p className="rounded-xl bg-white px-3 py-3 text-sm text-slate-500 shadow-sm">Bạn chưa có ticket nào đang phụ trách để trao đổi.</p>
        )}
        {!loading && filteredTickets.map((ticket) => (
          <button
            key={ticket.id}
            type="button"
            onClick={() => navigate(`/tech-mobile/tickets/${ticket.id}`)}
            className="w-full rounded-2xl bg-white p-4 text-left shadow-sm transition hover:bg-blue-50"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800">Ticket #{ticket.id}</p>
                <p className="mt-1 truncate text-xs text-slate-600">{ticket.assetQaCode} - {ticket.assetName}</p>
              </div>
              <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
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

            <p className="mt-3 text-xs text-slate-600">
              <span className="font-semibold">Người báo:</span> {ticket.reporterName || '-'}
            </p>
            <p className="mt-1 line-clamp-2 text-xs text-slate-500">{ticket.description}</p>

            <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Clock3 size={13} />
                {formatVietnamDateTime(ticket.dueDate)}
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-blue-700">
                <MessageCircle size={13} />
                Mở chat
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}

export default MobileTechSupportChats
