import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../../api/axiosClient'

function TechSupportChats() {
  const navigate = useNavigate()
  const [tickets, setTickets] = useState([])
  const [ticketId, setTicketId] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const loadPendingTickets = async () => {
      setLoading(true)
      try {
        const response = await axiosClient.get('/api/tickets', {
          params: { status: 'PENDING' },
        })
        const items = (response.data || []).filter((item) => !item.assigneeId)
        setTickets(items)
        if (items.length > 0) {
          setTicketId(String(items[0].id))
        }
      } catch (error) {
        const message = error?.response?.data?.message || 'Không tải được danh sách ticket mới báo hỏng.'
        toast.error(message)
      } finally {
        setLoading(false)
      }
    }
    loadPendingTickets()
  }, [])

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-800">Mở chat theo Ticket mới báo hỏng</h2>
      <p className="mt-1 text-sm text-slate-600">Chọn ticket chưa có người nhận để mở nhanh khung trao đổi.</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select
          value={ticketId}
          onChange={(event) => setTicketId(event.target.value)}
          className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading || tickets.length === 0}
        >
          {tickets.length === 0 && <option value="">Không có ticket mới báo hỏng</option>}
          {tickets.map((ticket) => (
            <option key={ticket.id} value={ticket.id}>
              #{ticket.id} - {ticket.assetName || ticket.assetQaCode}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            if (!ticketId) {
              toast.error('Vui lòng chọn ticket.')
              return
            }
            navigate(`/tech/tickets/${ticketId}`)
          }}
          disabled={!ticketId}
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Vào chat
        </button>
      </div>
    </section>
  )
}

export default TechSupportChats
