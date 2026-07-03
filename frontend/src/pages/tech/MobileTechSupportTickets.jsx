import {
  IconAlertCircle as AlertCircle,
  IconArrowUpRight as ArrowUpRight,
  IconCircleCheck as CheckCircle2,
  IconClockHour3 as Clock3,
  IconCopy as Copy,
  IconMessageCircle as MessageCircle,
  IconPhone as Phone,
  IconPhoto as ImageIcon,
  IconSearch as Search,
  IconX as X,
} from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../../api/axiosClient'
import ModalOverlay from '../../components/ui/ModalOverlay'
import { useAuth } from '../../context/AuthContext'
import { copyText, getZaloUrl, normalizePhone } from '../../utils/contact'
import { formatVietnamDateTime } from '../../utils/datetime'
import { resolveBackendMediaUrl } from '../../utils/mediaUrl'
import { getTicketStatusMeta } from '../../utils/ticketStatus'

const filterTabs = [
  { value: '', label: 'Tất cả' },
  { value: 'PENDING', label: 'Mới báo' },
  { value: 'IN_PROGRESS', label: 'Đang xử lý' },
  { value: 'RESOLVED', label: 'Hoàn tất' },
]

function toVietnamesePriority(priority) {
  if (priority === 'HIGH') return 'Cao'
  if (priority === 'LOW') return 'Thấp'
  return 'Trung bình'
}

function EmptyState({ children }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400">
      {children}
    </div>
  )
}

function TicketActionIconButton({
  icon: Icon,
  label,
  onClick,
  tone = 'default',
  disabled = false,
}) {
  const toneClassName = tone === 'accent'
    ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
    : tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition disabled:opacity-60 ${toneClassName}`}
    >
      <Icon size={16} />
    </button>
  )
}

function TicketActionLink({
  icon: Icon,
  label,
  href,
  tone = 'default',
}) {
  const toneClassName = tone === 'accent'
    ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
    : tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'

  return (
    <a
      href={href}
      aria-label={label}
      title={label}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition ${toneClassName}`}
    >
      <Icon size={16} />
    </a>
  )
}

function TicketsTableModal({
  open,
  onClose,
  loading,
  keyword,
  onKeywordChange,
  activeFilter,
  onFilterChange,
  filteredTickets,
  submittingId,
  userId,
  onTakeTicket,
  onResolve,
  onOpenPreview,
  onOpenTicket,
}) {
  if (!open) return null

  return (
    <ModalOverlay className="bg-slate-950/70 backdrop-blur-sm" zIndex={120}>
      <div className="w-full max-w-[min(100vw-1rem,72rem)] overflow-hidden rounded-[28px] bg-white shadow-2xl dark:bg-slate-950">
        <div className="flex max-h-[min(88dvh,52rem)] flex-col">
          <div className="border-b border-slate-200 px-4 py-4 dark:border-slate-800 sm:px-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Danh sách công việc hiện trường</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Tìm kiếm, lọc trạng thái và xử lý ticket trực tiếp trong bảng.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng modal"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <label className="flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 dark:border-slate-700">
                <Search size={16} className="text-slate-400" />
                <input
                  value={keyword}
                  onChange={(event) => onKeywordChange(event.target.value)}
                  placeholder="Tìm theo ticket, thiết bị, người báo..."
                  className="w-full bg-transparent text-sm outline-none"
                />
              </label>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {filterTabs.map((tab) => (
                  <button
                    key={tab.value || 'all'}
                    type="button"
                    onClick={() => onFilterChange(tab.value)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                      activeFilter === tab.value
                        ? 'bg-blue-600 text-white'
                        : 'border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="min-h-0 overflow-auto px-4 py-4 sm:px-5">
            {loading && (
              <EmptyState>Đang tải ticket hỗ trợ...</EmptyState>
            )}
            {!loading && filteredTickets.length === 0 && (
              <EmptyState>Không có ticket phù hợp với bộ lọc hiện tại.</EmptyState>
            )}
            {!loading && filteredTickets.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-[56rem] w-full table-fixed text-left text-xs text-slate-600 dark:text-slate-300">
                  <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur dark:bg-slate-900/95">
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <th className="w-[21%] px-3 py-3 font-semibold text-slate-700 dark:text-slate-200">Ticket</th>
                      <th className="w-[20%] px-3 py-3 font-semibold text-slate-700 dark:text-slate-200">Người báo</th>
                      <th className="w-[18%] px-3 py-3 font-semibold text-slate-700 dark:text-slate-200">Ưu tiên / SLA</th>
                      <th className="w-[17%] px-3 py-3 font-semibold text-slate-700 dark:text-slate-200">Trạng thái</th>
                      <th className="w-[24%] px-3 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTickets.map((ticket) => {
                      const isMine = Number(ticket.assigneeId) === Number(userId)
                      const reporterPhone = normalizePhone(ticket.reporterPhone)
                      const zaloUrl = getZaloUrl(ticket.reporterPhone)
                      const statusMeta = getTicketStatusMeta(ticket.status)

                      return (
                        <tr key={ticket.id} className="border-b border-slate-100 align-top dark:border-slate-800">
                          <td className="px-3 py-3">
                            <p className="font-semibold text-slate-800 dark:text-slate-100">Ticket #{ticket.id}</p>
                            <p className="mt-1 break-words text-[11px] text-slate-500 dark:text-slate-400">
                              {ticket.assetQaCode || '-'} - {ticket.assetName || 'Thiết bị'}
                            </p>
                            <p className="mt-1 line-clamp-2 text-[11px] text-slate-500 dark:text-slate-400">
                              {ticket.description || 'Không có mô tả'}
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            <p className="font-medium text-slate-700 dark:text-slate-200">{ticket.reporterName || '-'}</p>
                            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                              {ticket.reporterPhone || 'Chưa có số'}
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            <p className="font-medium text-slate-700 dark:text-slate-200">
                              Ưu tiên: {toVietnamesePriority(ticket.priority)}
                            </p>
                            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                              Hạn: {formatVietnamDateTime(ticket.dueDate, '-')}
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            <p className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusMeta.badgeClassName}`}>
                              {statusMeta.label}
                            </p>
                            <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                              {isMine ? 'Bạn đang xử lý' : 'Chưa nhận'}
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap justify-end gap-2">
                              {ticket.imageUrl && (
                                <TicketActionIconButton
                                  icon={ImageIcon}
                                  label={`Xem ảnh lỗi ticket #${ticket.id}`}
                                  onClick={() => onOpenPreview(ticket.imageUrl)}
                                />
                              )}
                              {reporterPhone && (
                                <TicketActionLink
                                  icon={Phone}
                                  label={`Gọi ${reporterPhone}`}
                                  href={`tel:${reporterPhone}`}
                                  tone="success"
                                />
                              )}
                              {zaloUrl && (
                                <TicketActionLink
                                  icon={MessageCircle}
                                  label={`Nhắn Zalo cho ${ticket.reporterName || 'người báo'}`}
                                  href={zaloUrl}
                                  tone="accent"
                                />
                              )}
                              {reporterPhone && (
                                <TicketActionIconButton
                                  icon={Copy}
                                  label={`Copy số ${reporterPhone}`}
                                  onClick={async () => {
                                    try {
                                      await copyText(reporterPhone)
                                      toast.success(`Đã copy số ${reporterPhone}.`)
                                    } catch {
                                      toast.error('Không copy được số điện thoại.')
                                    }
                                  }}
                                />
                              )}
                              {ticket.status === 'PENDING' && (
                                <TicketActionIconButton
                                  icon={CheckCircle2}
                                  label={`Nhận xử lý ticket #${ticket.id}`}
                                  tone="accent"
                                  disabled={submittingId === ticket.id}
                                  onClick={() => onTakeTicket(ticket.id)}
                                />
                              )}
                              {ticket.status === 'IN_PROGRESS' && isMine && (
                                <TicketActionIconButton
                                  icon={CheckCircle2}
                                  label={`Hoàn tất ticket #${ticket.id}`}
                                  tone="success"
                                  disabled={submittingId === ticket.id}
                                  onClick={() => onResolve(ticket.id)}
                                />
                              )}
                              <TicketActionIconButton
                                icon={ArrowUpRight}
                                label={`Mở ticket #${ticket.id}`}
                                tone="accent"
                                onClick={() => onOpenTicket(ticket.id)}
                              />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalOverlay>
  )
}

function formatMinutes(minutes) {
  const safeMinutes = Number(minutes) || 0
  if (safeMinutes <= 0) return '-'
  if (safeMinutes < 60) return `${safeMinutes}p`
  const hours = Math.floor(safeMinutes / 60)
  const remainMinutes = safeMinutes % 60
  return remainMinutes > 0 ? `${hours}g ${remainMinutes}p` : `${hours}g`
}

function formatPercentage(value) {
  const safeValue = Number(value) || 0
  return `${safeValue.toFixed(1)}%`
}

function formatSatisfaction(score) {
  const safeScore = Number(score) || 0
  if (safeScore <= 0) return '-'
  return `${safeScore.toFixed(1)}/5`
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

function MobileTechSupportTickets() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [tickets, setTickets] = useState([])
  const [kpis, setKpis] = useState(null)
  const [loading, setLoading] = useState(false)
  const [kpiLoading, setKpiLoading] = useState(false)
  const [submittingId, setSubmittingId] = useState(null)
  const [activeFilter, setActiveFilter] = useState('')
  const [keyword, setKeyword] = useState('')
  const [showTicketsModal, setShowTicketsModal] = useState(false)
  const [previewImageUrl, setPreviewImageUrl] = useState('')

  const loadTickets = async () => {
    setLoading(true)
    try {
      const [pendingRes, myRes] = await Promise.all([
        axiosClient.get('/api/tickets', { params: { status: 'PENDING' } }),
        axiosClient.get('/api/tickets', { params: { assignee_id: user?.userId } }),
      ])
      const data = getWorkspaceTickets(pendingRes.data || [], myRes.data || [])
      setTickets(data)
    } catch (error) {
      const message = error?.response?.data?.message || 'Không tải được danh sách ticket hỗ trợ.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const loadKpis = async () => {
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
    loadKpis()
  }, [user?.userId])

  const filteredTickets = useMemo(() => {
    const normalized = keyword.trim().toLowerCase()
    return tickets.filter((ticket) => {
      if (activeFilter && ticket.status !== activeFilter) {
        return false
      }
      if (!normalized) {
        return true
      }
      const searchable = `${ticket.id} ${ticket.assetQaCode || ''} ${ticket.assetName || ''} ${ticket.description || ''} ${ticket.reporterName || ''}`.toLowerCase()
      return searchable.includes(normalized)
    })
  }, [activeFilter, keyword, tickets])

  const summaryCards = [
    {
      label: 'Tiếp nhận nhanh',
      value: formatPercentage(kpis?.fastResponseRate ?? 0),
      icon: AlertCircle,
      className: 'border-cyan-200 bg-cyan-50 text-cyan-800',
    },
    {
      label: 'Đúng hạn',
      value: formatPercentage(kpis?.onTimeResolutionRate ?? 0),
      icon: Clock3,
      className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    },
    {
      label: 'Xử lý TB',
      value: formatMinutes(kpis?.averageResolutionMinutes ?? 0),
      icon: AlertCircle,
      className: 'border-blue-200 bg-blue-50 text-blue-800',
    },
    {
      label: 'Tái lỗi',
      value: formatPercentage(kpis?.repeatIncidentRate ?? 0),
      icon: MessageCircle,
      className: 'border-rose-200 bg-rose-50 text-rose-800',
    },
    {
      label: 'Lần đầu',
      value: formatPercentage(kpis?.firstTimeFixRate ?? 0),
      icon: CheckCircle2,
      className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    },
    {
      label: 'Hài lòng',
      value: formatSatisfaction(kpis?.averageSatisfactionScore ?? 0),
      icon: MessageCircle,
      className: 'border-violet-200 bg-violet-50 text-violet-800',
    },
    {
      label: 'Xếp loại',
      value: kpis?.performanceGrade || '-',
      icon: Clock3,
      className: 'border-amber-200 bg-amber-50 text-amber-800',
    },
  ]

  const handleTakeTicket = async (ticketId) => {
    setSubmittingId(ticketId)
    try {
      await axiosClient.put(`/api/tickets/${ticketId}/assign`, {
        assignee_id: Number(user?.userId),
      })
      toast.success(`Đã nhận xử lý ticket #${ticketId}.`)
      await Promise.all([loadTickets(), loadKpis()])
      navigate(`/tech-mobile/tickets/${ticketId}`)
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
      await Promise.all([loadTickets(), loadKpis()])
    } catch (error) {
      const message = error?.response?.data?.message || 'Hoàn tất ticket thất bại.'
      toast.error(message)
    } finally {
      setSubmittingId(null)
    }
  }

  return (
    <section className="space-y-3">
      <div className="rounded-xl bg-white p-3 shadow-sm">
        <h2 className="text-base font-semibold text-slate-800">Bảng việc hiện trường</h2>
        <p className="mt-1 text-sm text-slate-500">Nhận việc nhanh, xem SLA và mở chat ngay trong lúc sửa chữa.</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {summaryCards.map(({ label, value, icon: Icon, className }) => (
          <div key={label} className={`rounded-xl border p-3 shadow-sm ${className}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium opacity-80">{label}</p>
              <Icon size={16} />
            </div>
            <p className="mt-2 text-xl font-semibold">{kpiLoading ? '...' : value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-white p-3 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-800">Danh sách ticket</h3>
            <p className="mt-1 text-sm text-slate-500">
              Mở modal bảng để tìm kiếm, lọc nhanh và thao tác trực tiếp trên ticket.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowTicketsModal(true)}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <ArrowUpRight size={16} />
            Mở bảng
          </button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-xs font-medium text-slate-500">Tổng ticket</p>
            <p className="mt-1 text-xl font-bold text-slate-800">{tickets.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-xs font-medium text-slate-500">Đang lọc</p>
            <p className="mt-1 text-xl font-bold text-slate-800">{filteredTickets.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-xs font-medium text-slate-500">Đang tải</p>
            <p className="mt-1 text-xl font-bold text-slate-800">{loading ? '...' : 'Xong'}</p>
          </div>
        </div>
      </div>

      <TicketsTableModal
        open={showTicketsModal}
        onClose={() => setShowTicketsModal(false)}
        loading={loading}
        keyword={keyword}
        onKeywordChange={setKeyword}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        filteredTickets={filteredTickets}
        submittingId={submittingId}
        userId={user?.userId}
        onTakeTicket={handleTakeTicket}
        onResolve={handleResolve}
        onOpenPreview={setPreviewImageUrl}
        onOpenTicket={(ticketId) => navigate(`/tech-mobile/tickets/${ticketId}`)}
      />

      {previewImageUrl && (
        <ModalOverlay className="bg-black/70 backdrop-blur-sm" zIndex={130}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-3 shadow-xl">
            <img
              src={resolveBackendMediaUrl(previewImageUrl)}
              alt="ticket-error"
              className="max-h-[70vh] w-full rounded-xl object-contain"
            />
            <button
              type="button"
              onClick={() => setPreviewImageUrl('')}
              className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
            >
              Đóng
            </button>
          </div>
        </ModalOverlay>
      )}
    </section>
  )
}

export default MobileTechSupportTickets
