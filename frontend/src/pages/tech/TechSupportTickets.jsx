import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../../api/axiosClient'
import AssetRepairTimelineModal from '../../components/AssetRepairTimelineModal'
import { useAuth } from '../../context/AuthContext'

const statusOptions = ['PENDING', 'IN_PROGRESS', 'RESOLVED']

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

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('vi-VN')
}

function TechSupportTickets() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(false)
  const [submittingId, setSubmittingId] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [previewImageUrl, setPreviewImageUrl] = useState('')
  const [showTimelineModal, setShowTimelineModal] = useState(false)
  const [timelineAsset, setTimelineAsset] = useState(null)

  const loadTickets = async (nextStatus = statusFilter) => {
    setLoading(true)
    try {
      const params = {}
      if (nextStatus) {
        params.status = nextStatus
      }
      const response = await axiosClient.get('/api/tickets', { params })
      const data = (response.data || []).filter(
        (item) => Number(item.assigneeId) === Number(user?.userId) || item.status === 'PENDING',
      )
      setTickets(data)
    } catch (error) {
      const message = error?.response?.data?.message || 'Không tải được ticket hỗ trợ.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTickets()
  }, [user?.userId])

  const stats = useMemo(() => ({
    myInProgress: tickets.filter(
      (ticket) => Number(ticket.assigneeId) === Number(user?.userId) && ticket.status === 'IN_PROGRESS',
    ).length,
    myResolved: tickets.filter(
      (ticket) => Number(ticket.assigneeId) === Number(user?.userId) && ticket.status === 'RESOLVED',
    ).length,
    pending: tickets.filter((ticket) => ticket.status === 'PENDING').length,
  }), [tickets, user?.userId])

  const handleTakeTicket = async (ticketId) => {
    setSubmittingId(ticketId)
    try {
      await axiosClient.put(`/api/tickets/${ticketId}/assign`, {
        assignee_id: Number(user?.userId),
      })
      toast.success(`Đã nhận xử lý ticket #${ticketId}.`)
      await loadTickets()
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
      await loadTickets()
    } catch (error) {
      const message = error?.response?.data?.message || 'Hoàn tất ticket thất bại.'
      toast.error(message)
    } finally {
      setSubmittingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800">Bảng việc kỹ thuật viên</h2>
        <p className="mt-1 text-sm text-slate-600">Nhận việc, xử lý sự cố và trao đổi trực tiếp với người báo.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Chờ tiếp nhận: {stats.pending}</div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">Đang xử lý: {stats.myInProgress}</div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Đã hoàn tất: {stats.myResolved}</div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-3 grid gap-2 md:grid-cols-3">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tất cả trạng thái</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {toVietnameseStatus(status)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => loadTickets(statusFilter)}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Lọc ticket
          </button>
          <button
            type="button"
            onClick={async () => {
              setStatusFilter('')
              await loadTickets('')
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Đặt lại
          </button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-[1250px] text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left">Ticket</th>
                <th className="px-3 py-2 text-left">Mã thiết bị</th>
                <th className="px-3 py-2 text-left">Tên TB</th>
                <th className="px-3 py-2 text-left">Mô tả</th>
                <th className="px-3 py-2 text-left">Ưu tiên</th>
                <th className="px-3 py-2 text-left">Trạng thái</th>
                <th className="px-3 py-2 text-left">Ảnh lỗi</th>
                <th className="px-3 py-2 text-left">Hạn xử lý</th>
                <th className="px-3 py-2 text-left">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {!loading && tickets.map((ticket) => {
                const isMine = Number(ticket.assigneeId) === Number(user?.userId)
                return (
                  <tr key={ticket.id} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-2">#{ticket.id}</td>
                    <td className="px-3 py-2">{ticket.assetQaCode}</td>
                    <td className="px-3 py-2">{ticket.assetName || '-'}</td>
                    <td className="px-3 py-2">{ticket.description}</td>
                    <td className="px-3 py-2">{toVietnamesePriority(ticket.priority)}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        ticket.status === 'RESOLVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : ticket.status === 'IN_PROGRESS'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                      }`}
                      >
                        {toVietnameseStatus(ticket.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!ticket.imageUrl) {
                            toast.info('Ticket này chưa có ảnh lỗi.')
                            return
                          }
                          setPreviewImageUrl(ticket.imageUrl)
                        }}
                        className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Lỗi
                      </button>
                    </td>
                    <td className="px-3 py-2">{formatDateTime(ticket.dueDate)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        {ticket.status === 'PENDING' && (
                          <button
                            type="button"
                            onClick={() => handleTakeTicket(ticket.id)}
                            disabled={submittingId === ticket.id}
                            className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                          >
                            Nhận xử lý
                          </button>
                        )}
                        {ticket.status === 'IN_PROGRESS' && isMine && (
                          <button
                            type="button"
                            onClick={() => handleResolve(ticket.id)}
                            disabled={submittingId === ticket.id}
                            className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                          >
                            Hoàn tất
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => navigate(`/tech/tickets/${ticket.id}`)}
                          className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Mở chat
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTimelineAsset({
                              qaCode: ticket.assetQaCode,
                              name: ticket.assetName,
                            })
                            setShowTimelineModal(true)
                          }}
                          className="rounded border border-violet-300 px-2 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-50"
                        >
                          Timeline
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {!loading && tickets.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-3 text-center text-slate-500">
                    Không có ticket cần xử lý.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {loading && <p className="px-3 py-3 text-sm text-slate-500">Đang tải ticket...</p>}
        </div>

      </section>
      {previewImageUrl && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4">
          <div className="rounded-2xl bg-white p-4 shadow-xl">
            <img src={previewImageUrl} alt="error-preview" className="h-[300px] w-[300px] rounded-lg object-cover" />
            <button
              type="button"
              onClick={() => setPreviewImageUrl('')}
              className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
      <AssetRepairTimelineModal
        open={showTimelineModal}
        onClose={() => {
          setShowTimelineModal(false)
          setTimelineAsset(null)
        }}
        assetQaCode={timelineAsset?.qaCode}
        assetName={timelineAsset?.name}
      />
    </div>
  )
}

export default TechSupportTickets
