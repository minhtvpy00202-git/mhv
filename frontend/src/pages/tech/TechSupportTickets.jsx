import {
  IconCheck as Check,
  IconFileDescription as Detail,
  IconHistory as History,
  IconMessageCircle as MessageCircle,
  IconPlayerPlay as Play,
  IconStar as Star,
} from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../../api/axiosClient'
import AuthenticatedImage from '../../components/AuthenticatedImage'
import ActionIconButton from '../../components/ui/ActionIconButton'
import ColumnVisibilityDropdown from '../../components/ui/ColumnVisibilityDropdown'
import HelpdeskKpiPanel from '../../components/HelpdeskKpiPanel'
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
  { key: 'review', label: 'Đánh giá' },
  { key: 'image', label: 'Ảnh lỗi' },
  { key: 'dueDate', label: 'Hạn xử lý' },
  { key: 'actions', label: 'Thao tác' },
]
const defaultTechTicketVisibleColumnKeys = ['ticket', 'assetQaCode', 'assetName', 'priority', 'status', 'review', 'dueDate', 'actions']

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
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(false)
  const [submittingId, setSubmittingId] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [previewImageUrl, setPreviewImageUrl] = useState('')
  const [resolutionTicketId, setResolutionTicketId] = useState(null)
  const [showTimelineModal, setShowTimelineModal] = useState(false)
  const [timelineTicket, setTimelineTicket] = useState(null)
  const [kpis, setKpis] = useState(null)
  const [kpiLoading, setKpiLoading] = useState(false)
  const [reviewModal, setReviewModal] = useState({
    open: false,
    loading: false,
    ticketId: null,
    score: null,
    comment: '',
    updatedAt: '',
    reviewerName: '',
  })
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
      } else if (['IN_PROGRESS', 'WAITING_REPLACEMENT', 'AWAITING_CONFIRMATION', 'RESOLVED', 'CLOSED_UNRESOLVED', 'CANCELLED', 'REJECTED'].includes(nextStatus)) {
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
      (ticket) => Number(ticket.assigneeId) === Number(user?.userId) && TICKET_TECH_WORK_STATUSES.includes(ticket.status),
    ).length,
    awaitingConfirmation: tickets.filter(
      (ticket) => Number(ticket.assigneeId) === Number(user?.userId) && ticket.status === 'AWAITING_CONFIRMATION',
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
    {
      key: 'description',
      label: 'Mô tả',
      headClassName: 'px-3 py-2 text-left',
      cellClassName: 'px-3 py-2',
      render: (ticket) => {
        const description = ticket.description || '-'
        const shortDescription = description.length > 20 ? `${description.slice(0, 20)}...` : description
        return (
          <span className="group relative inline-flex max-w-[220px] cursor-help">
            <span>{shortDescription}</span>
            {description !== '-' ? (
              <span className="pointer-events-none absolute -top-9 left-1/2 z-20 w-max max-w-xs -translate-x-1/2 whitespace-normal rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-75 group-hover:opacity-100 dark:bg-slate-100 dark:text-slate-900">
                {description}
              </span>
            ) : null}
          </span>
        )
      },
    },
    { key: 'priority', label: 'Ưu tiên', headClassName: 'px-3 py-2 text-left', cellClassName: 'px-3 py-2', render: (ticket) => toVietnamesePriority(ticket.priority) },
    { key: 'status', label: 'Trạng thái', headClassName: 'px-3 py-2 text-left', cellClassName: 'px-3 py-2', render: (ticket) => { const meta = getTicketStatusMeta(ticket.status); return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${meta.badgeClassName}`}>{meta.label}</span> } },
    {
      key: 'review',
      label: 'Đánh giá',
      headClassName: 'px-3 py-2 text-left',
      cellClassName: 'px-3 py-2',
      render: (ticket) => (
        ticket.satisfactionScore
          ? (
            <button
              type="button"
              onClick={() => handleOpenReview(ticket)}
              className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-sm font-semibold text-orange-700 hover:bg-orange-100"
            >
              Xem đánh giá
            </button>
            )
          : <span className="text-sm text-slate-500">Chưa có đánh giá</span>
      ),
    },
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
            {TICKET_TECH_WORK_STATUSES.includes(ticket.status) && isMine && <ActionIconButton icon={Check} label={ticket.status === 'WAITING_REPLACEMENT' ? 'Cập nhật sau thay thế' : 'Gửi kết quả xử lý'} variant="success" onClick={() => setResolutionTicketId(ticket.id)} disabled={submittingId === ticket.id} />}
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

  const handleOpenReview = async (ticket) => {
    if (!ticket?.id) return
    setReviewModal({
      open: true,
      loading: true,
      ticketId: ticket.id,
      score: ticket.satisfactionScore ?? null,
      comment: ticket.satisfactionComment || '',
      updatedAt: ticket.resolvedAt || '',
        reviewerName: ticket.reporterName || '',
    })
    try {
      const response = await axiosClient.get(`/api/tickets/${ticket.id}`)
      const detail = response.data || {}
      setReviewModal({
        open: true,
        loading: false,
        ticketId: ticket.id,
        score: detail.satisfactionScore ?? ticket.satisfactionScore ?? null,
        comment: detail.satisfactionComment || ticket.satisfactionComment || '',
        updatedAt: detail.updatedAt || detail.resolvedAt || ticket.resolvedAt || '',
          reviewerName: detail.reporterName || ticket.reporterName || '',
      })
    } catch (error) {
      const message = error?.response?.data?.message || 'Không tải được chi tiết đánh giá.'
      toast.error(message)
      setReviewModal((prev) => ({ ...prev, loading: false }))
    }
  }

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
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Chờ tiếp nhận: {stats.pending}</div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">Đang xử lý: {stats.myInProgress}</div>
          <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-800">Chờ xác nhận: {stats.awaitingConfirmation}</div>
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
      {reviewModal.open && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Đánh giá người dùng</h3>
                <p className="mt-1 text-sm text-slate-500">Ticket #{reviewModal.ticketId}</p>
              </div>
              <button
                type="button"
                  onClick={() => setReviewModal({ open: false, loading: false, ticketId: null, score: null, comment: '', updatedAt: '', reviewerName: '' })}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Đóng
              </button>
            </div>

            {reviewModal.loading ? (
              <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                Đang tải chi tiết đánh giá...
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold text-slate-500">Điểm đánh giá</p>
                    {reviewModal.score ? (
                      <div className="mt-2 flex items-center gap-3">
                        <p className="text-base font-normal text-slate-700">{reviewModal.score}</p>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((value) => (
                            <Star
                              key={value}
                              size={22}
                              className={value <= Number(reviewModal.score) ? 'fill-current text-amber-400' : 'text-slate-300'}
                            />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-1 text-lg font-semibold text-slate-900">Chưa có đánh giá</p>
                    )}
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold text-slate-500">Người đánh giá</p>
                    <p className="mt-1 text-sm text-slate-700">{reviewModal.reviewerName || 'Chưa rõ người đánh giá'}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold text-slate-500">Nhận xét</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {reviewModal.comment || 'Người dùng chưa để lại nhận xét.'}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold text-slate-500">Cập nhật gần nhất</p>
                  <p className="mt-1 text-sm text-slate-700">{formatVietnamDateTime(reviewModal.updatedAt, 'Chưa rõ')}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default TechSupportTickets
