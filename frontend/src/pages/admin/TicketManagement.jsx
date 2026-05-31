import { IconCheck as Check, IconPhoto as ImageIcon } from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import axiosClient from '../../api/axiosClient'
import ActionIconButton from '../../components/ui/ActionIconButton'
import { formatVietnamDateTime, getServerDateTimeMs } from '../../utils/datetime'
import { resolveBackendMediaUrl } from '../../utils/mediaUrl'

const statusOptions = ['PENDING', 'IN_PROGRESS', 'RESOLVED']
const PAGE_SIZE = 10
const defaultPageInfo = {
  page: 0,
  size: PAGE_SIZE,
  totalPages: 1,
  totalItems: 0,
}
const defaultStats = {
  pending: 0,
  inProgress: 0,
  resolved: 0,
}

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

function isOverdue(ticket) {
  if (!ticket?.dueDate || ticket?.status === 'RESOLVED') return false
  const dueTime = getServerDateTimeMs(ticket.dueDate)
  if (Number.isNaN(dueTime)) return false
  return dueTime < Date.now()
}

function TicketManagement() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(false)
  const [submittingId, setSubmittingId] = useState(null)
  const [techSupports, setTechSupports] = useState([])
  const [pageInfo, setPageInfo] = useState(defaultPageInfo)
  const [stats, setStats] = useState(defaultStats)
  const [previewImageUrl, setPreviewImageUrl] = useState('')
  const [filters, setFilters] = useState({
    status: '',
    assigneeId: '',
  })
  const [assignDraft, setAssignDraft] = useState({})

  const getEligibleTechSupports = (ticket) => {
    const techTypeId = Number(ticket?.assetCategoryTechTypeId) || 0
    if (!techTypeId) return []
    return techSupports.filter((tech) => Array.isArray(tech.techTypeIds) && tech.techTypeIds.map(Number).includes(techTypeId))
  }

  const loadTechSupports = async () => {
    try {
      const response = await axiosClient.get('/api/users/tech-supports')
      setTechSupports(response.data || [])
    } catch (error) {
      const message = error?.response?.data?.message || 'Không tải được danh sách kỹ thuật viên.'
      toast.error(message)
    }
  }

  const buildTicketQueryParams = (page = pageInfo.page, nextFilters = filters) => {
    const params = {
      page,
      size: pageInfo.size || PAGE_SIZE,
    }
    if (nextFilters.status) params.status = nextFilters.status
    if (nextFilters.assigneeId) params.assignee_id = Number(nextFilters.assigneeId)
    return params
  }

  const loadTickets = async (page = pageInfo.page, nextFilters = filters) => {
    setLoading(true)
    try {
      const response = await axiosClient.get('/api/tickets/admin', {
        params: buildTicketQueryParams(page, nextFilters),
      })
      const data = response.data || {}
      const items = data.items || []
      setTickets(items)
      setPageInfo({
        page: data.page ?? 0,
        size: data.size ?? pageInfo.size ?? PAGE_SIZE,
        totalPages: data.totalPages || 1,
        totalItems: data.totalItems || 0,
      })
      setStats({
        pending: data.pendingCount || 0,
        inProgress: data.inProgressCount || 0,
        resolved: data.resolvedCount || 0,
      })
      setAssignDraft(
        items.reduce((acc, item) => ({
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
      await loadTickets(pageInfo.page)
    } catch (error) {
      const message = error?.response?.data?.message || 'Gán kỹ thuật viên thất bại.'
      toast.error(message)
    } finally {
      setSubmittingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Điều phối ticket sửa chữa</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Theo dõi ticket báo hỏng, xem nhanh thông tin sự cố và gán kỹ thuật viên phụ trách.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Chờ tiếp nhận</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{stats.pending}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Đang xử lý</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{stats.inProgress}</p>
          </div>
          <div className="rounded-xl border border-orange-200 bg-orange-50/70 px-4 py-3 dark:border-orange-500/30 dark:bg-orange-500/10">
            <p className="text-xs font-medium text-orange-700 dark:text-orange-300">Đã giải quyết</p>
            <p className="mt-1 text-2xl font-semibold text-orange-900 dark:text-orange-200">{stats.resolved}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 grid gap-2 md:grid-cols-4">
          <select
            value={filters.status}
            onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-fptOrange"
          >
            <option value="">Tất cả trạng thái</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {toVietnameseStatus(status)}
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
            onClick={() => loadTickets(0, filters)}
            className="rounded-lg bg-fptOrange px-3 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark"
          >
            Lọc ticket
          </button>
          <button
            type="button"
            onClick={async () => {
              const reset = { status: '', assigneeId: '' }
              setFilters(reset)
              await loadTickets(0, reset)
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Đặt lại
          </button>
        </div>

        <div className="overflow-auto rounded-2xl border border-slate-200">
          <table className="min-w-[1750px] text-sm">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="whitespace-nowrap px-3 py-2 text-left">Ticket</th>
                <th className="whitespace-nowrap px-3 py-2 text-left">Mã thiết bị</th>
                <th className="whitespace-nowrap px-3 py-2 text-left">Tên thiết bị</th>
                <th className="whitespace-nowrap px-3 py-2 text-left">Phòng</th>
                <th className="whitespace-nowrap px-3 py-2 text-left">Người báo</th>
                <th className="whitespace-nowrap px-3 py-2 text-left">Mô tả sự cố</th>
                <th className="whitespace-nowrap px-3 py-2 text-left">Ảnh lỗi</th>
                <th className="whitespace-nowrap px-3 py-2 text-left">Ưu tiên</th>
                <th className="whitespace-nowrap px-3 py-2 text-left">Trạng thái</th>
                <th className="whitespace-nowrap px-3 py-2 text-left">KTV phụ trách</th>
                <th className="whitespace-nowrap px-3 py-2 text-left">Ngày báo</th>
                <th className="whitespace-nowrap px-3 py-2 text-left">Hạn sửa chữa</th>
              </tr>
            </thead>
            <tbody>
              {!loading && tickets.map((ticket) => (
                <tr key={ticket.id} className="border-t border-slate-100 align-top hover:bg-slate-50/60">
                  <td className="whitespace-nowrap px-3 py-2">#{ticket.id}</td>
                  <td className="whitespace-nowrap px-3 py-2">{ticket.assetQaCode}</td>
                  <td className="max-w-[180px] truncate whitespace-nowrap px-3 py-2" title={ticket.assetName || '-'}>
                    {ticket.assetName || '-'}
                  </td>
                  <td className="max-w-[150px] truncate whitespace-nowrap px-3 py-2" title={ticket.assetLocationName || '-'}>
                    {ticket.assetLocationName || '-'}
                  </td>
                  <td className="max-w-[150px] truncate whitespace-nowrap px-3 py-2" title={ticket.reporterName || `#${ticket.reporterId}`}>
                    {ticket.reporterName || `#${ticket.reporterId}`}
                  </td>
                  <td className="max-w-[260px] truncate whitespace-nowrap px-3 py-2 text-slate-700" title={ticket.description || '-'}>
                    {ticket.description || '-'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <ActionIconButton
                      icon={ImageIcon}
                      label="Xem ảnh lỗi"
                      onClick={() => {
                        if (!ticket.imageUrl) {
                          toast.info('Ticket này chưa có ảnh lỗi.')
                          return
                        }
                        setPreviewImageUrl(ticket.imageUrl)
                      }}
                    />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{toVietnamesePriority(ticket.priority)}</td>
                  <td className="whitespace-nowrap px-3 py-2">
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
                    {ticket.status === 'PENDING' ? (
                      <div className="flex min-w-[240px] items-center gap-2">
                        {getEligibleTechSupports(ticket).length === 0 ? (
                          <p className="whitespace-nowrap text-xs text-amber-700">Chưa có KTV đúng chuyên môn</p>
                        ) : (
                          <select
                            value={assignDraft[ticket.id] || ''}
                            onChange={(event) =>
                              setAssignDraft((prev) => ({ ...prev, [ticket.id]: event.target.value }))
                            }
                            className="rounded border border-slate-300 px-2 py-1 text-xs"
                          >
                            <option value="">Chọn kỹ thuật viên</option>
                            {getEligibleTechSupports(ticket).map((tech) => (
                              <option key={tech.id} value={tech.id}>
                                {tech.fullName || tech.username}
                              </option>
                            ))}
                          </select>
                        )}
                        <ActionIconButton
                          icon={Check}
                          label="Gán kỹ thuật viên"
                          variant="primary"
                          onClick={() => handleAssign(ticket.id)}
                          disabled={submittingId === ticket.id}
                        />
                      </div>
                    ) : (
                      <p className="whitespace-nowrap text-xs text-slate-700">{ticket.assigneeName || `#${ticket.assigneeId}`}</p>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{formatVietnamDateTime(ticket.createdAt)}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <p className="whitespace-nowrap">{formatVietnamDateTime(ticket.dueDate)}</p>
                    {isOverdue(ticket) && <p className="text-xs font-semibold text-red-600">Quá hạn SLA</p>}
                  </td>
                </tr>
              ))}
              {!loading && tickets.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-3 py-8 text-center text-slate-500">
                    Không có ticket phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {loading && <p className="px-3 py-4 text-sm text-slate-500">Đang tải ticket...</p>}
        </div>
        {!loading && pageInfo.totalItems > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
            <p>
              Trang {pageInfo.page + 1} / {Math.max(1, pageInfo.totalPages)} • Tổng {pageInfo.totalItems} ticket
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => loadTickets(0)}
                disabled={pageInfo.page <= 0}
                className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
              >
                Đầu
              </button>
              <button
                type="button"
                onClick={() => loadTickets(Math.max(0, pageInfo.page - 1))}
                disabled={pageInfo.page <= 0}
                className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
              >
                Trước
              </button>
              <button
                type="button"
                onClick={() => loadTickets(Math.min(pageInfo.totalPages - 1, pageInfo.page + 1))}
                disabled={pageInfo.page >= pageInfo.totalPages - 1}
                className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
              >
                Sau
              </button>
              <button
                type="button"
                onClick={() => loadTickets(Math.max(0, pageInfo.totalPages - 1))}
                disabled={pageInfo.page >= pageInfo.totalPages - 1}
                className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
              >
                Cuối
              </button>
            </div>
          </div>
        )}
      </section>

      {previewImageUrl && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4">
          <div className="rounded-2xl bg-white p-4 shadow-xl">
            <img src={resolveBackendMediaUrl(previewImageUrl)} alt="ticket-error-preview" className="max-h-[70vh] max-w-[80vw] rounded-lg object-contain" />
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
    </div>
  )
}

export default TicketManagement
