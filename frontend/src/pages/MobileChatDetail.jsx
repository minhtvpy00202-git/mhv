import { IconArrowLeft as ArrowLeft, IconMessageCircle as MessageCircle } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'
import TicketChatBox from '../components/TicketChatBox'
import { formatVietnamDateTime } from '../utils/datetime'
import { getTicketStatusMeta } from '../utils/ticketStatus'

function MobileChatDetail() {
  const { ticketId } = useParams()
  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!ticketId) return
    let mounted = true
    const loadTicket = async () => {
      setLoading(true)
      try {
        const response = await axiosClient.get(`/api/tickets/${ticketId}`)
        if (!mounted) return
        setTicket(response.data || null)
      } catch (error) {
        const message = error?.response?.data?.message || 'Không tải được thông tin chat ticket.'
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

  const statusMeta = getTicketStatusMeta(ticket?.status)

  return (
    <div className="space-y-3">
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Trao đổi sự cố</h2>
            <p className="mt-1 text-sm text-slate-500">Khu vực chat tách riêng với chi tiết ticket để theo dõi gọn hơn.</p>
          </div>
          <div className="rounded-xl bg-sky-50 p-2 text-sky-600">
            <MessageCircle size={18} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            to="/mobile/chats"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
            Quay lại danh sách chat
          </Link>
          <Link
            to={`/mobile/tickets/${ticketId}`}
            className="inline-flex items-center gap-2 rounded-xl border border-orange-300 bg-orange-50 px-3 py-2 text-sm font-semibold text-fptOrange hover:bg-orange-100"
          >
            Xem ticket
          </Link>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        {loading && <p className="text-sm text-slate-500">Đang tải ticket...</p>}
        {!loading && ticket && (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-800">{ticket.assetName || 'Thiết bị không xác định'}</p>
              <p className="mt-1 text-xs text-slate-500">
                Ticket #{ticket.id} · {ticket.assetQaCode} · {formatVietnamDateTime(ticket.createdAt, '')}
              </p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusMeta.badgeClassName}`}>
              {statusMeta.label}
            </span>
          </div>
        )}
      </section>

      <TicketChatBox ticketId={Number(ticketId)} embedded />
    </div>
  )
}

export default MobileChatDetail
