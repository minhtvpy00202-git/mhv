import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'

function TechSupportChats() {
  const navigate = useNavigate()
  const [ticketId, setTicketId] = useState('')

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-800">Mở chat theo Ticket</h2>
      <p className="mt-1 text-sm text-slate-600">Nhập mã ticket để vào khung trao đổi thời gian thực.</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={ticketId}
          onChange={(event) => setTicketId(event.target.value.replace(/\D/g, ''))}
          placeholder="Ví dụ: 12"
          className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={() => {
            if (!ticketId) {
              toast.error('Vui lòng nhập mã ticket.')
              return
            }
            navigate(`/tech/tickets/${ticketId}`)
          }}
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Vào chat
        </button>
      </div>
    </section>
  )
}

export default TechSupportChats
