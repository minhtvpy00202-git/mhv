import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../../api/axiosClient'

const statusOptions = ['PENDING', 'IN_PROGRESS', 'RESOLVED']

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('vi-VN')
}

function isOverdue(ticket) {
  if (!ticket?.dueDate || ticket?.status === 'RESOLVED') return false
  const dueTime = new Date(ticket.dueDate).getTime()
  if (Number.isNaN(dueTime)) return false
  return dueTime < Date.now()
}

function TicketManagement() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(false)
  const [submittingId, setSubmittingId] = useState(null)
  const [techSupports, setTechSupports] = useState([])
  const [filters, setFilters] = useState({
    status: '',
    assigneeId: '',
  })
  const [assignDraft, setAssignDraft] = useState({})

  const loadTechSupports = async () => {
    try {
      const response = await axiosClient.get('/api/users', {
        params: { page: 0, size: 100, role: 'TechSupport' },
      })
      setTechSupports(response.data?.items || [])
    } catch (error) {
      const message = error?.response?.data?.message || 'Không tải được danh sách kỹ thuật viên.'
      toast.error(message)
    }
  }

  const loadTickets = async (nextFilters = filters) => {
    setLoading(true)
    try {
      const params = {}
      if (nextFilters.status) params.status = nextFilters.status
      if (nextFilters.assigneeId) params.assignee_id = Number(nextFilters.assigneeId)
      const response = await axiosClient.get('/api/tickets', { params })
      const data = response.data || []
      setTickets(data)
      setAssignDraft(
        data.reduce((acc, item) => ({
          ...acc,
          [item.id]: item.assigneeId ? String(item.assigneeId) : '',
        }), {}),
      )
    } catch (error) {
      const message = error?.response?.data?.message || 'Không tải được danh sách ticket.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTechSupports()
    loadTickets()
  }, [])

  const stats = useMemo(() => ({
    pending: tickets.filter((ticket) => ticket.status === 'PENDING').length,
    inProgress: tickets.filter((ticket) => ticket.status === 'IN_PROGRESS').length,
    resolved: tickets.filter((ticket) => ticket.status === 'RESOLVED').length,
  }), [tickets])

  const handleAssign = async (ticketId) => {
    const assigneeId = assignDraft[ticketId]
    if (!assigneeId) {
      toast.error('Vui lòng chọn kỹ thuật viên.')
      return
    }
    setSubmittingId(ticketId)
    try {
      await axiosClient.put(`/api/tickets/${ticketId}/assign`, {
        assignee_id: Number(assigneeId),
      })
      toast.success(`Đã gán ticket #${ticketId} cho kỹ thuật viên.`)
      await loadTickets()
    } catch (error) {
      const message = error?.response?.data?.message || 'Gán kỹ thuật viên thất bại.'
      toast.error(message)
    } finally {
      setSubmittingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800">Điều phối Ticket sự cố</h2>
        <p className="mt-1 text-sm text-slate-600">Admin theo dõi ticket, gán kỹ thuật viên và truy cập chat theo ngữ cảnh.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Chờ tiếp nhận: {stats.pending}</div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">Đang xử lý: {stats.inProgress}</div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Đã giải quyết: {stats.resolved}</div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-3 grid gap-2 md:grid-cols-4">
          <select
            value={filters.status}
            onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-fptOrange"
          >
            <option value="">Tất cả trạng thái</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <select
            value={filters.assigneeId}
            onChange={(event) => setFilters((prev) => ({ ...prev, assigneeId: event.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-fptOrange"
          >
            <option value="">Tất cả kỹ thuật viên</option>
            {techSupports.map((tech) => (
              <option key={tech.id} value={tech.id}>
                {tech.fullName || tech.username}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => loadTickets(filters)}
            className="rounded-lg bg-fptOrange px-3 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark"
          >
            Lọc ticket
          </button>
          <button
            type="button"
            onClick={async () => {
              const reset = { status: '', assigneeId: '' }
              setFilters(reset)
              await loadTickets(reset)
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Đặt lại
          </button>
        </div>

        <div className="overflow-auto rounded-lg border border-slate-200">
          <table className="min-w-[1200px] text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left">Ticket</th>
                <th className="px-3 py-2 text-left">Thiết bị</th>
                <th className="px-3 py-2 text-left">Người báo</th>
                <th className="px-3 py-2 text-left">Ưu tiên</th>
                <th className="px-3 py-2 text-left">Trạng thái</th>
                <th className="px-3 py-2 text-left">KTV phụ trách</th>
                <th className="px-3 py-2 text-left">SLA</th>
                <th className="px-3 py-2 text-left">Chat</th>
              </tr>
            </thead>
            <tbody>
              {!loading && tickets.map((ticket) => (
                <tr key={ticket.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2">#{ticket.id}</td>
                  <td className="px-3 py-2">{ticket.assetQaCode}</td>
                  <td className="px-3 py-2">#{ticket.reporterId}</td>
                  <td className="px-3 py-2">{ticket.priority}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      ticket.status === 'RESOLVED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : ticket.status === 'IN_PROGRESS'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                    }`}
                    >
                      {ticket.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {ticket.status === 'PENDING' ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={assignDraft[ticket.id] || ''}
                          onChange={(event) =>
                            setAssignDraft((prev) => ({ ...prev, [ticket.id]: event.target.value }))
                          }
                          className="rounded border border-slate-300 px-2 py-1 text-xs"
                        >
                          <option value="">Chọn kỹ thuật viên</option>
                          {techSupports.map((tech) => (
                            <option key={tech.id} value={tech.id}>
                              {tech.fullName || tech.username}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleAssign(ticket.id)}
                          disabled={submittingId === ticket.id}
                          className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                          Gán
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-700">#{ticket.assigneeId}</p>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <p>{formatDateTime(ticket.dueDate)}</p>
                    {isOverdue(ticket) && <p className="text-xs font-semibold text-red-600">Quá hạn SLA</p>}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      to={`/admin/tickets/${ticket.id}`}
                      className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Mở chat
                    </Link>
                  </td>
                </tr>
              ))}
              {!loading && tickets.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-3 text-center text-slate-500">
                    Không có ticket phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {loading && <p className="px-3 py-3 text-sm text-slate-500">Đang tải ticket...</p>}
        </div>
      </section>
    </div>
  )
}

export default TicketManagement
