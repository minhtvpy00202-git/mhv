import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('vi-VN')
}

function formatTimeShort(value) {
  if (!value) return '--:--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--:--'
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

function toActionLabel(event) {
  if (event?.eventType === 'TICKET_CREATED') return 'Tạo ticket'
  if (event?.eventType === 'TICKET_ASSIGNED') return 'Assign kỹ thuật viên'
  if (event?.eventType === 'TICKET_STATUS_CHANGED') return 'Cập nhật trạng thái'
  if (event?.eventType === 'TICKET_CHAT') return 'Comment/Chat'
  return event?.message || event?.eventType || 'Sự kiện'
}

function TicketEventTimelineModal({ open, onClose, ticket }) {
  const [loading, setLoading] = useState(false)
  const [events, setEvents] = useState([])

  useEffect(() => {
    if (!open || !ticket?.id) return
    const loadTimeline = async () => {
      setLoading(true)
      try {
        const response = await axiosClient.get(`/api/tickets/${ticket.id}/timeline`, {
          params: { limit: 200 },
        })
        setEvents(response.data || [])
      } catch (error) {
        const message = error?.response?.data?.message || 'Không tải được timeline ticket.'
        toast.error(message)
      } finally {
        setLoading(false)
      }
    }
    loadTimeline()
  }, [open, ticket?.id])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Timeline Ticket #{ticket?.id}</h3>
            <p className="text-sm text-slate-600">
              {ticket?.assetQaCode} {ticket?.assetName ? `- ${ticket.assetName}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Đóng
          </button>
        </div>

        <div className="max-h-[70vh] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-4">
          {!loading && events.length === 0 && (
            <p className="text-center text-sm text-slate-500">Ticket này chưa có lịch sử sự kiện.</p>
          )}
          {!loading && events.length > 0 && (
            <div className="relative pl-5">
              <div className="absolute bottom-0 left-1.5 top-0 w-px bg-slate-300" />
              <div className="space-y-3">
                {events.map((event) => (
                  <div key={event.id} className="relative rounded-lg border border-slate-200 bg-white p-3">
                    <div className="absolute -left-[17px] top-4 h-3 w-3 rounded-full border-2 border-white bg-fptOrange" />
                    <p className="text-sm font-semibold text-slate-800">
                      {formatTimeShort(event.occurredAt)} - {event.actorName || 'Hệ thống'} - {toActionLabel(event)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{formatDateTime(event.occurredAt)}</p>
                    {event.detail && <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-600">{event.detail}</pre>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {loading && <p className="text-sm text-slate-500">Đang tải timeline...</p>}
        </div>
      </div>
    </div>
  )
}

export default TicketEventTimelineModal
