import { MessageCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'
import { useAuth } from '../context/AuthContext'

function toVietnameseStatus(status) {
  if (status === 'PENDING') return 'Mới báo hỏng'
  if (status === 'IN_PROGRESS') return 'Đang xử lý'
  if (status === 'RESOLVED') return 'Đã hoàn tất'
  return status
}

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
        const response = await axiosClient.get('/api/tickets')
        const rows = (response.data || []).filter((item) => Number(item.reporterId) === Number(user?.userId))
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
      <div className="rounded-xl bg-white p-3 shadow-sm">
        <h2 className="text-base font-semibold text-slate-800">Chat hỗ trợ kỹ thuật</h2>
        <p className="mt-1 text-sm text-slate-500">Chọn ticket để mở khung chat realtime.</p>
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="Tìm theo mã ticket / thiết bị"
          className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
        />
      </div>

      <div className="space-y-2">
        {loading && <p className="rounded-xl bg-white px-3 py-3 text-sm text-slate-500 shadow-sm">Đang tải danh sách chat...</p>}
        {!loading && filteredTickets.length === 0 && (
          <p className="rounded-xl bg-white px-3 py-3 text-sm text-slate-500 shadow-sm">Bạn chưa có ticket nào để chat.</p>
        )}
        {!loading &&
          filteredTickets.map((ticket) => (
            <button
              key={ticket.id}
              type="button"
              onClick={() => navigate(`/mobile/tickets/${ticket.id}`)}
              className="w-full rounded-xl bg-white p-3 text-left shadow-sm transition hover:bg-orange-50"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Ticket #{ticket.id}</p>
                  <p className="mt-1 text-xs text-slate-600">{ticket.assetQaCode} - {ticket.assetName}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                  {toVietnameseStatus(ticket.status)}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-xs text-slate-600">{ticket.description}</p>
              <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-fptOrange">
                <MessageCircle size={13} />
                Mở chat
              </p>
            </button>
          ))}
      </div>
    </section>
  )
}

export default MobileChats
