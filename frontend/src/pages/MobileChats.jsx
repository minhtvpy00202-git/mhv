import { MessageCircle, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'
import { useAuth } from '../context/AuthContext'
import { formatVietnamDateTime } from '../utils/datetime'
import { getTicketStatusMeta } from '../utils/ticketStatus'

function MobileChats() {
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
          params: { reporter_id: user?.userId },
        })
        const rows = response.data || []
        setTickets(rows)
      } catch (error) {
        const message = error?.response?.data?.message || 'Không tải được danh sách chat ticket.'
        toast.error(message)
      } finally {
        setLoading(false)
      }
    }
    loadTickets()
  }, [user?.userId])

  const filteredTickets = useMemo(() => {
    const normalized = keyword.trim().toLowerCase()
    if (!normalized) return tickets
    return tickets.filter((ticket) => {
      const searchable = `${ticket.id} ${ticket.assetQaCode || ''} ${ticket.assetName || ''} ${ticket.description || ''}`.toLowerCase()
      return searchable.includes(normalized)
    })
  }, [keyword, tickets])

  return (
    <section className="space-y-3">
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Trao đổi với kỹ thuật viên</h2>
            <p className="mt-1 text-sm text-slate-500">Tìm ticket để mở chat realtime và theo dõi tiến độ xử lý.</p>
          </div>
          <div className="rounded-xl bg-orange-50 p-2 text-fptOrange">
            <MessageCircle size={18} />
          </div>
        </div>
        <div className="relative mt-3">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Tìm theo mã ticket hoặc tên thiết bị"
            className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none ring-fptOrange focus:ring-2"
          />
        </div>
      </div>

      <div className="space-y-2">
        {loading && <p className="rounded-2xl bg-white px-4 py-4 text-sm text-slate-500 shadow-sm">Đang tải danh sách chat...</p>}
        {!loading && filteredTickets.length === 0 && (
          <p className="rounded-2xl bg-white px-4 py-4 text-sm text-slate-500 shadow-sm">Bạn chưa có ticket nào để chat.</p>
        )}
        {!loading &&
          filteredTickets.map((ticket) => {
            const statusMeta = getTicketStatusMeta(ticket.status)
            return (
            <button
              key={ticket.id}
              type="button"
              onClick={() => navigate(`/mobile/chats/${ticket.id}`)}
              className="w-full rounded-2xl bg-white p-4 text-left shadow-sm transition hover:bg-orange-50"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Ticket #{ticket.id}</p>
                  <p className="mt-1 text-xs text-slate-600">{ticket.assetQaCode} - {ticket.assetName}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusMeta.badgeClassName}`}>
                  {statusMeta.label}
                </span>
              </div>
              <p className="mt-3 line-clamp-2 text-xs text-slate-600">{ticket.description}</p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-[11px] text-slate-500">{formatVietnamDateTime(ticket.createdAt)}</p>
                <p className="inline-flex items-center gap-1 text-xs font-semibold text-fptOrange">
                  <MessageCircle size={13} />
                  Mở chat
                </p>
              </div>
            </button>
            )
          })}
      </div>
    </section>
  )
}

export default MobileChats
