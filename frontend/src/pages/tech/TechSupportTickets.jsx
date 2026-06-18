import {
  IconCheck as Check,
  IconFileDescription as Detail,
  IconHistory as History,
  IconMessageCircle as MessageCircle,
  IconPlayerPlay as Play,
} from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../../api/axiosClient'
import ActionIconButton from '../../components/ui/ActionIconButton'
import ColumnVisibilityDropdown from '../../components/ui/ColumnVisibilityDropdown'
import HelpdeskKpiPanel from '../../components/HelpdeskKpiPanel'
import useColumnVisibility from '../../hooks/useColumnVisibility'
import { formatVietnamDateTime } from '../../utils/datetime'
import { resolveBackendMediaUrl } from '../../utils/mediaUrl'
import TicketEventTimelineModal from '../../components/TicketEventTimelineModal'
import { useAuth } from '../../context/AuthContext'

const statusOptions = ['PENDING', 'IN_PROGRESS', 'RESOLVED']
const techTicketColumnOptions = [
  { key: 'ticket', label: 'Ticket' },
  { key: 'assetQaCode', label: 'Mã thiết bị' },
  { key: 'assetName', label: 'Tên TB' },
  { key: 'description', label: 'Mô tả' },
  { key: 'priority', label: 'Ưu tiên' },
  { key: 'status', label: 'Trạng thái' },
  { key: 'image', label: 'Ảnh lỗi' },
  { key: 'dueDate', label: 'Hạn xử lý' },
  { key: 'actions', label: 'Thao tác' },
]
const defaultTechTicketVisibleColumnKeys = ['ticket', 'assetQaCode', 'assetName', 'priority', 'status', 'dueDate', 'actions']

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

function getWorkspaceTickets(pendingRows, myRows) {
  const byId = new Map()
  ;[...(pendingRows || []), ...(myRows || [])].forEach((ticket) => {
    byId.set(ticket.id, ticket)
  })
  return [...byId.values()].sort((left, right) => {
    const leftPriority = left.status === 'PENDING' ? 0 : left.status === 'IN_PROGRESS' ? 1 : 2
    const rightPriority = right.status === 'PENDING' ? 0 : right.status === 'IN_PROGRESS' ? 1 : 2
    if (leftPriority !== rightPriority) return leftPriority - rightPriority
    return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime()
  })
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
  const [timelineTicket, setTimelineTicket] = useState(null)
  const [kpis, setKpis] = useState(null)
  const [kpiLoading, setKpiLoading] = useState(false)
  const {
    visibleColumns,
    activeColumns,
    selectedCount,
    allSelected,
    toggleColumn,
    selectAllColumns,
    resetDefaultColumns,
  } = useColumnVisibility({
    storageKey: 'mhv-tech-tickets-visible-columns',
    columns: techTicketColumnOptions,
    defaultVisibleKeys: defaultTechTicketVisibleColumnKeys,
  })

  const loadTickets = async (nextStatus = statusFilter) => {
    setLoading(true)
    try {
      let data = []
      if (nextStatus === 'PENDING') {
        const response = await axiosClient.get('/api/tickets', {
          params: { status: 'PENDING' },
        })
        data = response.data || []
      } else if (nextStatus === 'IN_PROGRESS' || nextStatus === 'RESOLVED') {
        const response = await axiosClient.get('/api/tickets', {
          params: { status: nextStatus, assignee_id: user?.userId },
        })
        data = response.data || []
      } else {
        const [pendingRes, myRes] = await Promise.all([
          axiosClient.get('/api/tickets', { params: { status: 'PENDING' } }),
          axiosClient.get('/api/tickets', { params: { assignee_id: user?.userId } }),
        ])
        data = getWorkspaceTickets(pendingRes.data || [], myRes.data || [])
      }
      setTickets(data)
    } catch (error) {
      const message = error?.response?.data?.message || 'Không tải được ticket hỗ trợ.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const loadMyKpis = async () => {
    setKpiLoading(true)
    try {
      const response = await axiosClient.get('/api/dashboard/helpdesk-kpis/me')
      setKpis(response.data)
    } catch (error) {
      const message = error?.response?.data?.message || 'Không tải được KPI cá nhân.'
      toast.error(message)
    } finally {
      setKpiLoading(false)
    }
  }

  useEffect(() => {
    loadTickets()
    loadMyKpis()
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
  const tableColumns = useMemo(() => ([
    { key: 'ticket', label: 'Ticket', headClassName: 'px-3 py-2 text-left', cellClassName: 'px-3 py-2', render: (ticket) => `#${ticket.id}` },
    { key: 'assetQaCode', label: 'Mã thiết bị', headClassName: 'px-3 py-2 text-left', cellClassName: 'px-3 py-2', render: (ticket) => ticket.assetQaCode },
    { key: 'assetName', label: 'Tên TB', headClassName: 'px-3 py-2 text-left', cellClassName: 'px-3 py-2', render: (ticket) => ticket.assetName || '-' },
    { key: 'description', label: 'Mô tả', headClassName: 'px-3 py-2 text-left', cellClassName: 'px-3 py-2', render: (ticket) => ticket.description },
    { key: 'priority', label: 'Ưu tiên', headClassName: 'px-3 py-2 text-left', cellClassName: 'px-3 py-2', render: (ticket) => toVietnamesePriority(ticket.priority) },
    { key: 'status', label: 'Trạng thái', headClassName: 'px-3 py-2 text-left', cellClassName: 'px-3 py-2', render: (ticket) => <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ticket.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-800' : ticket.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>{toVietnameseStatus(ticket.status)}</span> },
    { key: 'image', label: 'Ảnh lỗi', headClassName: 'px-3 py-2 text-left', cellClassName: 'px-3 py-2', render: (ticket) => <ActionIconButton icon={Detail} label="Xem ảnh lỗi" onClick={() => { if (!ticket.imageUrl) { toast.info('Ticket này chưa có ảnh lỗi.'); return } setPreviewImageUrl(ticket.imageUrl) }} /> },
    { key: 'dueDate', label: 'Hạn xử lý', headClassName: 'px-3 py-2 text-left', cellClassName: 'px-3 py-2', render: (ticket) => formatVietnamDateTime(ticket.dueDate) },
    {
      key: 'actions',
      label: 'Thao tác',
      headClassName: 'px-3 py-2 text-left',
      cellClassName: 'px-3 py-2',
      render: (ticket) => {
        const isMine = Number(ticket.assigneeId) === Number(user?.userId)
        return (
          <div className="flex flex-wrap gap-2">
            {ticket.status === 'PENDING' && <ActionIconButton icon={Play} label="Nhận xử lý" variant="primary" onClick={() => handleTakeTicket(ticket.id)} disabled={submittingId === ticket.id} />}
            {ticket.status === 'IN_PROGRESS' && isMine && <ActionIconButton icon={Check} label="Hoàn tất xử lý" variant="success" onClick={() => handleResolve(ticket.id)} disabled={submittingId === ticket.id} />}
            <ActionIconButton icon={MessageCircle} label="Mở chat ticket" onClick={() => navigate(`/tech/tickets/${ticket.id}`)} />
            <ActionIconButton icon={History} label="Xem timeline ticket" variant="violet" onClick={() => { setTimelineTicket({ id: ticket.id, qaCode: ticket.assetQaCode, assetQaCode: ticket.assetQaCode, name: ticket.assetName, assetName: ticket.assetName }); setShowTimelineModal(true) }} />
          </div>
        )
      },
    },
  ]), [navigate, submittingId, user?.userId])
  const renderedColumns = useMemo(
    () => tableColumns.filter((column) => activeColumns.some((activeColumn) => activeColumn.key === column.key)),
    [activeColumns, tableColumns],
  )

  const handleTakeTicket = async (ticketId) => {
    setSubmittingId(ticketId)
    try {
      await axiosClient.put(`/api/tickets/${ticketId}/assign`, {
        assignee_id: Number(user?.userId),
      })
      toast.success(`Đã nhận xử lý ticket #${ticketId}.`)
      await Promise.all([loadTickets(), loadMyKpis()])
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
      await Promise.all([loadTickets(), loadMyKpis()])
    } catch (error) {
      const message = error?.response?.data?.message || 'Hoàn tất ticket thất bại.'
      toast.error(message)
    } finally {
      setSubmittingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <HelpdeskKpiPanel
        title="KPI cá nhân"
        subtitle="Bộ KPI giai đoạn 2 của kỹ thuật viên, dùng acceptedAt, điểm hài lòng và xếp loại tự động."
        summary={kpis}
        loading={kpiLoading}
        tableTitle="Chi tiết xếp loại của bạn"
        emptyText="Chưa có dữ liệu KPI cá nhân."
      />

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

        <div className="mb-3 flex justify-end">
          <ColumnVisibilityDropdown
            columns={techTicketColumnOptions}
            visibleColumns={visibleColumns}
            selectedCount={selectedCount}
            allSelected={allSelected}
            onToggleColumn={(columnKey) => {
              if (visibleColumns[columnKey] && selectedCount === 1) {
                toast.info('Cần giữ lại ít nhất 1 cột hiển thị.')
                return
              }
              toggleColumn(columnKey)
            }}
            onSelectAll={selectAllColumns}
            onResetDefault={resetDefaultColumns}
          />
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-[1250px] text-sm">
            <thead className="bg-slate-50">
              <tr>
                {renderedColumns.map((column) => (
                  <th key={column.key} className={column.headClassName}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading && tickets.map((ticket) => {
                return (
                  <tr key={ticket.id} className="border-t border-slate-100 align-top">
                    {renderedColumns.map((column) => (
                      <td key={`${ticket.id}-${column.key}`} className={column.cellClassName}>
                        {column.render(ticket)}
                      </td>
                    ))}
                  </tr>
                )
              })}
              {!loading && tickets.length === 0 && (
                <tr>
                  <td colSpan={Math.max(renderedColumns.length, 1)} className="px-3 py-3 text-center text-slate-500">
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
            <img src={resolveBackendMediaUrl(previewImageUrl)} alt="error-preview" className="h-[300px] w-[300px] rounded-lg object-cover" />
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
      <TicketEventTimelineModal
        open={showTimelineModal}
        onClose={() => {
          setShowTimelineModal(false)
          setTimelineTicket(null)
        }}
        ticket={timelineTicket}
      />
    </div>
  )
}

export default TechSupportTickets
