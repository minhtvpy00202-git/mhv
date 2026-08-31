import {
  IconCheck as Check,
  IconClock as Clock,
  IconFileDescription as Detail,
  IconHistory as History,
  IconMessageCircle as MessageCircle,
  IconPlayerPlay as Play,
  IconRefresh as Refresh,
  IconSearch as Search,
  IconSparkles as Sparkles,
  IconTool as Tool,
} from '@tabler/icons-react'
import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../../api/axiosClient'
import AuthenticatedImage from '../../components/AuthenticatedImage'
import ActionIconButton from '../../components/ui/ActionIconButton'
import ColumnVisibilityDropdown from '../../components/ui/ColumnVisibilityDropdown'
import TicketResolutionModal from '../../components/TicketResolutionModal'
import useColumnVisibility from '../../hooks/useColumnVisibility'
import { formatVietnamDateTime } from '../../utils/datetime'
import TicketEventTimelineModal from '../../components/TicketEventTimelineModal'
import { useAuth } from '../../context/AuthContext'
import { getTicketStatusMeta, TICKET_TECH_WORK_STATUSES } from '../../utils/ticketStatus'

const statusOptions = ['PENDING', 'IN_PROGRESS', 'WAITING_REPLACEMENT', 'AWAITING_CONFIRMATION', 'RESOLVED', 'CLOSED_UNRESOLVED', 'CANCELLED', 'REJECTED']
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
  if (status === 'WAITING_REPLACEMENT') return 'Chờ thay thế'
  if (status === 'AWAITING_CONFIRMATION') return 'Chờ xác nhận'
  if (status === 'RESOLVED') return 'Đã hoàn tất'
  if (status === 'CLOSED_UNRESOLVED') return 'Đóng - không thể sửa'
  if (status === 'CANCELLED') return 'Đã hủy'
  if (status === 'REJECTED') return 'Đã từ chối'
  return status
}

function getWorkspaceTickets(pendingRows, myRows) {
  const byId = new Map()
  ;[...(pendingRows || []), ...(myRows || [])].forEach((ticket) => {
    byId.set(ticket.id, ticket)
  })
  return [...byId.values()].sort((left, right) => {
    const leftPriority = left.status === 'PENDING' ? 0 : TICKET_TECH_WORK_STATUSES.includes(left.status) ? 1 : left.status === 'AWAITING_CONFIRMATION' ? 2 : 3
    const rightPriority = right.status === 'PENDING' ? 0 : TICKET_TECH_WORK_STATUSES.includes(right.status) ? 1 : right.status === 'AWAITING_CONFIRMATION' ? 2 : 3
    if (leftPriority !== rightPriority) return leftPriority - rightPriority
    return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime()
  })
}

function TechSupportTickets() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const userId = user?.userId
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(false)
  const [submittingId, setSubmittingId] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')
  const statusFilterRef = useRef(statusFilter)
  const [keyword, setKeyword] = useState('')
  const [previewImageUrl, setPreviewImageUrl] = useState('')
  const [resolutionTicketId, setResolutionTicketId] = useState(null)
  const [showTimelineModal, setShowTimelineModal] = useState(false)
  const [timelineTicket, setTimelineTicket] = useState(null)
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

  const loadTickets = useCallback(async (nextStatus = '') => {
    setLoading(true)
    try {
      let data = []
      if (nextStatus === 'PENDING') {
        const response = await axiosClient.get('/api/tickets', {
          params: { status: 'PENDING' },
        })
        data = response.data || []
      } else if (['IN_PROGRESS', 'WAITING_REPLACEMENT', 'AWAITING_CONFIRMATION', 'RESOLVED', 'CLOSED_UNRESOLVED', 'CANCELLED', 'REJECTED'].includes(nextStatus)) {
        const response = await axiosClient.get('/api/tickets', {
          params: { status: nextStatus, assignee_id: userId },
        })
        data = response.data || []
      } else {
        const [pendingRes, myRes] = await Promise.all([
          axiosClient.get('/api/tickets', { params: { status: 'PENDING' } }),
          axiosClient.get('/api/tickets', { params: { assignee_id: userId } }),
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
  }, [userId])

  useEffect(() => {
    statusFilterRef.current = statusFilter
  }, [statusFilter])

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadTickets(statusFilterRef.current)
    }, 0)
    return () => window.clearTimeout(timerId)
  }, [loadTickets])

  const handleTakeTicket = useCallback(async (ticketId) => {
    setSubmittingId(ticketId)
    try {
      await axiosClient.put(`/api/tickets/${ticketId}/assign`, {
        assignee_id: Number(userId),
      })
      toast.success(`Đã nhận xử lý ticket #${ticketId}.`)
      await loadTickets(statusFilter)
    } catch (error) {
      const message = error?.response?.data?.message || 'Nhận xử lý ticket thất bại.'
      toast.error(message)
    } finally {
      setSubmittingId(null)
    }
  }, [loadTickets, statusFilter, userId])

  const stats = useMemo(() => ({
    myInProgress: tickets.filter(
      (ticket) => Number(ticket.assigneeId) === Number(userId) && TICKET_TECH_WORK_STATUSES.includes(ticket.status),
    ).length,
    awaitingConfirmation: tickets.filter(
      (ticket) => Number(ticket.assigneeId) === Number(userId) && ticket.status === 'AWAITING_CONFIRMATION',
    ).length,
    myResolved: tickets.filter(
      (ticket) => Number(ticket.assigneeId) === Number(userId) && ticket.status === 'RESOLVED',
    ).length,
    pending: tickets.filter((ticket) => ticket.status === 'PENDING').length,
  }), [tickets, userId])
  const filteredTickets = useMemo(() => {
    const normalized = keyword.trim().toLowerCase()
    if (!normalized) return tickets
    return tickets.filter((ticket) => `${ticket.id} ${ticket.assetQaCode} ${ticket.assetName} ${ticket.description} ${ticket.reporterName}`.toLowerCase().includes(normalized))
  }, [keyword, tickets])
  const tableColumns = useMemo(() => ([
    { key: 'ticket', label: 'Ticket', headClassName: 'px-4 py-3 text-left', cellClassName: 'px-4 py-3', render: (ticket) => <span className="font-bold text-orange-600">#{ticket.id}</span> },
    { key: 'assetQaCode', label: 'Mã thiết bị', headClassName: 'px-4 py-3 text-left', cellClassName: 'px-4 py-3', render: (ticket) => <span className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-700">{ticket.assetQaCode}</span> },
    { key: 'assetName', label: 'Thiết bị', headClassName: 'px-4 py-3 text-left', cellClassName: 'px-4 py-3', render: (ticket) => <div><p className="max-w-64 font-semibold text-slate-900">{ticket.assetName || '-'}</p>{ticket.reporterName && <p className="mt-0.5 text-xs text-slate-400">Báo bởi {ticket.reporterName}</p>}</div> },
    { key: 'description', label: 'Mô tả', headClassName: 'px-3 py-2 text-left', cellClassName: 'px-3 py-2', render: (ticket) => ticket.description },
    { key: 'priority', label: 'Ưu tiên', headClassName: 'px-4 py-3 text-left', cellClassName: 'px-4 py-3', render: (ticket) => <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ticket.priority === 'HIGH' ? 'bg-red-50 text-red-700' : ticket.priority === 'LOW' ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-700'}`}>{toVietnamesePriority(ticket.priority)}</span> },
    { key: 'status', label: 'Trạng thái', headClassName: 'px-3 py-2 text-left', cellClassName: 'px-3 py-2', render: (ticket) => { const meta = getTicketStatusMeta(ticket.status); return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${meta.badgeClassName}`}>{meta.label}</span> } },
    { key: 'image', label: 'Ảnh lỗi', headClassName: 'px-3 py-2 text-left', cellClassName: 'px-3 py-2', render: (ticket) => <ActionIconButton icon={Detail} label="Xem ảnh lỗi" onClick={() => { if (!ticket.imageUrl) { toast.info('Ticket này chưa có ảnh lỗi.'); return } setPreviewImageUrl(ticket.imageUrl) }} /> },
    { key: 'dueDate', label: 'Hạn xử lý', headClassName: 'px-3 py-2 text-left', cellClassName: 'px-3 py-2', render: (ticket) => formatVietnamDateTime(ticket.dueDate) },
    {
      key: 'actions',
      label: 'Thao tác',
      headClassName: 'px-3 py-2 text-left',
      cellClassName: 'px-3 py-2',
      render: (ticket) => {
        const isMine = Number(ticket.assigneeId) === Number(userId)
        return (
          <div className="flex flex-wrap gap-2">
            {ticket.status === 'PENDING' && <ActionIconButton icon={Play} label="Nhận xử lý" variant="primary" onClick={() => handleTakeTicket(ticket.id)} disabled={submittingId === ticket.id} />}
            {TICKET_TECH_WORK_STATUSES.includes(ticket.status) && isMine && <ActionIconButton icon={Check} label={ticket.status === 'WAITING_REPLACEMENT' ? 'Cập nhật sau thay thế' : 'Gửi kết quả xử lý'} variant="success" onClick={() => setResolutionTicketId(ticket.id)} disabled={submittingId === ticket.id} />}
            <ActionIconButton icon={MessageCircle} label="Mở chat ticket" onClick={() => navigate(`/tech/tickets/${ticket.id}`)} />
            <ActionIconButton icon={History} label="Xem timeline ticket" variant="violet" onClick={() => { setTimelineTicket({ id: ticket.id, qaCode: ticket.assetQaCode, assetQaCode: ticket.assetQaCode, name: ticket.assetName, assetName: ticket.assetName }); setShowTimelineModal(true) }} />
          </div>
        )
      },
    },
  ]), [handleTakeTicket, navigate, submittingId, userId])
  const renderedColumns = useMemo(
    () => tableColumns.filter((column) => activeColumns.some((activeColumn) => activeColumn.key === column.key)),
    [activeColumns, tableColumns],
  )

  const handleResolve = async ({ outcome, note, image }) => {
    const ticketId = resolutionTicketId
    if (!ticketId) return
    setSubmittingId(ticketId)
    try {
      const formData = new FormData()
      formData.append('outcome', outcome)
      formData.append('note', note)
      if (image) formData.append('image', image)
      await axiosClient.put(`/api/tickets/${ticketId}/resolve`, formData)
      toast.success(`Đã cập nhật kết quả ticket #${ticketId}.`)
      setResolutionTicketId(null)
      await loadTickets(statusFilter)
    } catch (error) {
      const message = error?.response?.data?.message || 'Hoàn tất ticket thất bại.'
      toast.error(message)
    } finally {
      setSubmittingId(null)
    }
  }

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[28px] border border-blue-100 bg-gradient-to-br from-white via-blue-50/70 to-cyan-50 p-5 shadow-sm dark:border-blue-500/20 dark:from-slate-950 dark:via-slate-950 dark:to-blue-950/30 sm:p-6">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-blue-200/40 blur-3xl dark:bg-blue-500/10" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-blue-600"><Sparkles size={15} /> Không gian làm việc</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-3xl">Bảng việc kỹ thuật viên</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">Ưu tiên ticket cần nhận, theo dõi SLA và hoàn tất công việc ngay trên một màn hình.</p>
          </div>
          <button type="button" onClick={() => loadTickets(statusFilter)} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-white/80 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><Refresh size={17} className={loading ? 'animate-spin' : ''} /> Đồng bộ dữ liệu</button>
        </div>
        <div className="relative mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Chờ tiếp nhận', value: stats.pending, icon: Clock, tone: 'border-amber-200 bg-amber-50/90 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300' },
            { label: 'Đang xử lý', value: stats.myInProgress, icon: Tool, tone: 'border-blue-200 bg-blue-50/90 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300' },
            { label: 'Chờ xác nhận', value: stats.awaitingConfirmation, icon: MessageCircle, tone: 'border-violet-200 bg-violet-50/90 text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300' },
            { label: 'Đã hoàn tất', value: stats.myResolved, icon: Check, tone: 'border-emerald-200 bg-emerald-50/90 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300' },
          ].map(({ label, value, icon, tone }) => <div key={label} className={`flex items-center gap-3 rounded-2xl border p-3.5 shadow-sm backdrop-blur ${tone}`}><span className="grid h-10 w-10 place-items-center rounded-xl bg-white/80 shadow-sm dark:bg-slate-950/50">{createElement(icon, { size: 20 })}</span><div><p className="text-2xl font-bold leading-none">{value}</p><p className="mt-1 text-xs font-semibold opacity-80">{label}</p></div></div>)}
        </div>
      </section>

      <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div><h3 className="text-lg font-bold text-slate-900 dark:text-white">Hàng đợi ticket</h3><p className="mt-1 text-sm text-slate-500">{filteredTickets.length} ticket đang hiển thị</p></div>
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
        <div className="mb-4 grid gap-2 lg:grid-cols-[minmax(220px,0.8fr)_minmax(280px,1.2fr)_auto_auto]">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">Tất cả trạng thái</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {toVietnameseStatus(status)}
              </option>
            ))}
          </select>
          <div className="relative">
            <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm ticket, mã QA hoặc thiết bị..." className="h-full w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950" />
          </div>
          <button
            type="button"
            onClick={() => loadTickets(statusFilter)}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            Áp dụng
          </button>
          <button
            type="button"
            onClick={async () => {
              setStatusFilter('')
              setKeyword('')
              await loadTickets('')
            }}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Đặt lại
          </button>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
          <table className="min-w-[1250px] text-sm">
            <thead className="bg-slate-50/90 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950">
              <tr>
                {renderedColumns.map((column) => (
                  <th key={column.key} className={column.headClassName}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading && filteredTickets.map((ticket) => {
                return (
                  <tr key={ticket.id} className="border-t border-slate-100 align-middle transition hover:bg-blue-50/40 dark:border-slate-800 dark:hover:bg-blue-500/5">
                    {renderedColumns.map((column) => (
                      <td key={`${ticket.id}-${column.key}`} className={column.cellClassName}>
                        {column.render(ticket)}
                      </td>
                    ))}
                  </tr>
                )
              })}
              {!loading && filteredTickets.length === 0 && (
                <tr>
                  <td colSpan={Math.max(renderedColumns.length, 1)} className="px-4 py-12 text-center text-slate-500">
                    Không có ticket cần xử lý.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {loading && <p className="px-4 py-10 text-center text-sm text-slate-500">Đang tải ticket...</p>}
        </div>
      </section>
      {previewImageUrl && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4">
          <div className="rounded-2xl bg-white p-4 shadow-xl">
            <AuthenticatedImage src={previewImageUrl} alt="Ảnh lỗi ticket" className="h-[300px] w-[300px] rounded-lg object-cover" />
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
      <TicketResolutionModal
        open={Boolean(resolutionTicketId)}
        ticketId={resolutionTicketId}
        submitting={submittingId === resolutionTicketId}
        onClose={() => setResolutionTicketId(null)}
        onSubmit={handleResolve}
      />
    </div>
  )
}

export default TechSupportTickets
