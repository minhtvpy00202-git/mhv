import {
  IconAlertTriangle as AlertTriangle,
  IconArrowRight as ArrowRight,
  IconCheck as Check,
  IconFilter as Filter,
  IconInbox as Inbox,
  IconRefresh as Refresh,
  IconSearch as Search,
  IconX as X,
} from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'
import { useAuth } from '../context/AuthContext'
import { formatVietnamDate, formatVietnamDateTime } from '../utils/datetime'
import { getInquiryBasePath, getInquirySlaMeta, getInquiryStatusMeta, getInquiryTypeLabel } from '../utils/inquiry'

const filters = [
  ['', 'Tất cả'],
  ['NEW', 'Mới'],
  ['CLAIMED', 'Đã nhận'],
  ['IN_PROGRESS', 'Đang xử lý'],
  ['WAITING_APPROVAL', 'Chờ phê duyệt'],
  ['WAITING_EMPLOYEE', 'Chờ nhân viên'],
  ['CONVERTED', 'Đã tạo phiếu'],
  ['OVERDUE', 'Quá hạn'],
  ['COMPLETED', 'Hoàn tất'],
  ['REJECTED', 'Từ chối'],
  ['CANCELLED', 'Đã hủy'],
]
const PAGE_SIZE = 8

function getCompactSlaLabel(label) {
  return String(label || 'Chưa có SLA')
    .replace('Phản hồi đúng SLA (', 'Đúng SLA · ')
    .replace('Phản hồi trễ ', 'Trễ ')
    .replace('Quá hạn phản hồi ', 'Quá hạn ')
    .replace(' phút để phản hồi', 'p')
    .replace(' phút sớm)', 'p sớm')
    .replace(' phút', 'p')
}

function InquiryInbox() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [filter, setFilter] = useState('')
  const [keyword, setKeyword] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const basePath = getInquiryBasePath(user?.role)

  const loadInbox = useCallback(async () => {
    setLoading(true)
    try {
      const response = await axiosClient.get('/api/inquiries/inbox')
      setItems(response.data || [])
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Không tải được hộp thư yêu cầu.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadInbox(), 0)
    const interval = window.setInterval(() => void loadInbox(), 15000)
    return () => {
      window.clearTimeout(timer)
      window.clearInterval(interval)
    }
  }, [loadInbox])

  const visibleItems = useMemo(() => {
    const normalized = keyword.trim().toLowerCase()
    return items.filter((item) => {
      const sla = getInquirySlaMeta(item)
      if (filter === 'OVERDUE' && (!sla.breached || sla.completed || ['COMPLETED', 'REJECTED', 'CANCELLED'].includes(item.status))) return false
      if (filter && filter !== 'OVERDUE' && item.status !== filter) return false
      return !normalized || `${item.id} ${item.assetQaCode} ${item.assetName} ${item.requesterName} ${item.purpose}`.toLowerCase().includes(normalized)
    })
  }, [filter, items, keyword])

  const totalPages = Math.max(1, Math.ceil(visibleItems.length / PAGE_SIZE))
  const activePage = Math.min(currentPage, totalPages)
  const paginatedItems = useMemo(() => {
    const start = (activePage - 1) * PAGE_SIZE
    return visibleItems.slice(start, start + PAGE_SIZE)
  }, [activePage, visibleItems])

  const overview = useMemo(() => {
    const terminalStatuses = ['COMPLETED', 'REJECTED', 'CANCELLED']
    return {
      total: items.length,
      newCount: items.filter((item) => item.status === 'NEW').length,
      active: items.filter((item) => !terminalStatuses.includes(item.status)).length,
      overdue: items.filter((item) => {
        const sla = getInquirySlaMeta(item)
        return sla.breached && !sla.completed && !terminalStatuses.includes(item.status)
      }).length,
      unread: items.reduce((total, item) => total + Number(item.unreadCount || 0), 0),
    }
  }, [items])

  const filterCounts = useMemo(() => Object.fromEntries(filters.map(([value]) => {
    if (!value) return [value, items.length]
    if (value === 'OVERDUE') return [value, overview.overdue]
    return [value, items.filter((item) => item.status === value).length]
  })), [items, overview.overdue])

  const resetFilters = () => {
    setKeyword('')
    setFilter('')
    setCurrentPage(1)
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              {user?.role === 'ConsumableManager' ? 'Quản lý yêu cầu cấp phát vật tư' : 'Quản lý yêu cầu & phê duyệt'}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Tiếp nhận, phân công, theo dõi SLA và xử lý yêu cầu của nhân viên.
            </p>
          </div>
          <button
            type="button"
            onClick={loadInbox}
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Refresh size={15} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300">Tổng: {overview.total}</span>
          <span className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">Mới: {overview.newCount}</span>
          <span className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">Đang xử lý: {overview.active}</span>
          <span className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-300">Quá hạn: {overview.overdue}</span>
          <span className="rounded-lg bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">Chưa đọc: {overview.unread}</span>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value)
                setCurrentPage(1)
              }}
              placeholder="Tìm mã yêu cầu, thiết bị, người yêu cầu hoặc mục đích"
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none ring-fptOrange focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="relative min-w-0 sm:min-w-56">
              <Filter size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={filter}
                onChange={(event) => {
                  setFilter(event.target.value)
                  setCurrentPage(1)
                }}
                className="w-full appearance-none rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-8 text-sm text-slate-700 outline-none ring-fptOrange focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                {filters.map(([value, label]) => (
                  <option key={value || 'all'} value={value}>{label} ({filterCounts[value] || 0})</option>
                ))}
              </select>
            </label>
            {(keyword || filter) && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <X size={14} /> Xóa bộ lọc
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Danh sách yêu cầu</h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Theo dõi và mở yêu cầu để xử lý chi tiết.</p>
          </div>
          <p className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">{visibleItems.length} yêu cầu</p>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-800">
          <table className="w-full table-fixed divide-y divide-slate-200 text-xs dark:divide-slate-800">
            <colgroup>
              <col className="w-[5%]" />
              <col className="w-[11%]" />
              <col className="w-[21%]" />
              <col className="w-[12%]" />
              <col className="w-[13%]" />
              <col className="w-[11%]" />
              <col className="w-[13%]" />
              <col className="w-[7%]" />
              <col className="w-[7%]" />
            </colgroup>
            <thead className="bg-gradient-to-r from-slate-50 to-slate-100/70 dark:from-slate-900 dark:to-slate-900/70">
              <tr>
                <th className="truncate whitespace-nowrap px-2 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400" title="Mã yêu cầu">Mã</th>
                <th className="truncate whitespace-nowrap px-2 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Loại yêu cầu</th>
                <th className="truncate whitespace-nowrap px-2 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Thiết bị / vật tư</th>
                <th className="truncate whitespace-nowrap px-2 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Người yêu cầu</th>
                <th className="truncate whitespace-nowrap px-2 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Phụ trách</th>
                <th className="truncate whitespace-nowrap px-2 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Trạng thái</th>
                <th className="truncate whitespace-nowrap px-2 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">SLA phản hồi</th>
                <th className="truncate whitespace-nowrap px-2 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Cập nhật</th>
                <th className="truncate whitespace-nowrap px-1 py-3 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading && items.length === 0 && Array.from({ length: 6 }).map((_, rowIndex) => (
                <tr key={`skeleton-${rowIndex}`} className="animate-pulse">
                  {Array.from({ length: 9 }).map((__, cellIndex) => (
                    <td key={`cell-${cellIndex}`} className="px-2.5 py-3"><div className="h-3.5 w-full max-w-24 rounded bg-slate-200 dark:bg-slate-700" /></td>
                  ))}
                </tr>
              ))}
              {paginatedItems.map((item) => {
                const status = getInquiryStatusMeta(item.status)
                const sla = getInquirySlaMeta(item)
                const isConsumable = item.inquiryType === 'CONSUMABLE_REQUEST'
                const hasUnread = Number(item.unreadCount || 0) > 0
                return (
                  <tr key={item.id} className={`group h-12 transition-colors ${sla.breached ? 'bg-red-50/30 hover:bg-red-50/60 dark:bg-red-500/[0.04] dark:hover:bg-red-500/[0.08]' : 'odd:bg-white even:bg-slate-50/40 hover:bg-orange-50/50 dark:odd:bg-slate-950 dark:even:bg-slate-900/35 dark:hover:bg-orange-500/[0.06]'}`}>
                    <td className={`min-w-0 border-l-2 px-2 py-2 align-middle ${sla.breached ? 'border-red-400' : hasUnread ? 'border-orange-400' : 'border-transparent'}`}>
                      <div className="flex min-w-0 items-center gap-1.5">
                        <Link to={`${basePath}/${item.id}`} className="inline-flex shrink-0 rounded-md bg-slate-100 px-1.5 py-1 font-bold text-slate-700 transition hover:bg-orange-100 hover:text-fptOrangeDark dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-orange-500/15">#{item.id}</Link>
                        {hasUnread && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-orange-500 ring-2 ring-orange-100 dark:ring-orange-500/20" title={`${item.unreadCount} tin chưa đọc`} />
                        )}
                      </div>
                    </td>
                    <td className="min-w-0 px-2 py-2 align-middle"><span title={getInquiryTypeLabel(item.inquiryType)} className={`block max-w-full truncate rounded-md px-2 py-1 text-center text-[10px] font-semibold ${isConsumable ? 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300' : 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'}`}>{getInquiryTypeLabel(item.inquiryType)}</span></td>
                    <td className="min-w-0 px-2 py-2 align-middle"><p className="truncate text-[12px] font-semibold text-slate-800 dark:text-slate-100" title={item.assetName || '-'}>{item.assetName || '-'}</p></td>
                    <td className="min-w-0 px-2 py-2 align-middle">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-orange-50 text-[10px] font-bold uppercase text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">{String(item.requesterName || '?').slice(0, 1)}</span>
                        <p className="min-w-0 truncate text-slate-700 dark:text-slate-200" title={item.requesterName || '-'}>{item.requesterName || '-'}</p>
                      </div>
                    </td>
                    <td className="min-w-0 px-2 py-2 align-middle"><div className="flex min-w-0 items-center gap-1.5"><span className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.assigneeName ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} /><p className="min-w-0 truncate text-slate-700 dark:text-slate-200" title={item.assigneeName || 'Chưa nhận'}>{item.assigneeName || 'Chưa nhận'}</p></div></td>
                    <td className="min-w-0 px-2 py-2 align-middle"><span title={status.label} className={`block max-w-full truncate rounded-full border px-2 py-1 text-center text-[10px] font-semibold leading-4 ${status.className}`}>{status.label}</span></td>
                    <td className="min-w-0 px-2 py-2 align-middle">
                      <span title={sla.label} className={`flex min-w-0 items-center gap-1 text-[11px] font-semibold ${sla.breached ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {sla.breached ? <AlertTriangle size={13} className="shrink-0" /> : <Check size={13} className="shrink-0" />}
                        <span className="min-w-0 truncate">{getCompactSlaLabel(sla.label)}</span>
                      </span>
                    </td>
                    <td title={formatVietnamDateTime(item.updatedAt)} className="whitespace-nowrap px-2 py-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">{formatVietnamDate(item.updatedAt)}</td>
                    <td className="px-1 py-2 text-center align-middle">
                      <Link to={`${basePath}/${item.id}`} aria-label={`Mở xử lý yêu cầu #${item.id}`} title="Mở xử lý" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-orange-200 bg-orange-50 text-orange-700 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-300 hover:bg-orange-100 hover:shadow dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300 dark:hover:bg-orange-500/20">
                        <ArrowRight size={14} />
                      </Link>
                    </td>
                  </tr>
                )
              })}
              {!loading && visibleItems.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                    <Inbox className="mx-auto mb-2" size={24} />
                    Chưa có yêu cầu phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {!loading && visibleItems.length > 0 && (
          <div className="mt-4 flex flex-col gap-3 text-sm text-slate-600 dark:text-slate-300 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500 dark:text-slate-400">Hiển thị {paginatedItems.length} / {visibleItems.length} yêu cầu</p>
            <div className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={activePage === 1}
                className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
                title="Trang đầu"
              >«</button>
              <button
                type="button"
                onClick={() => setCurrentPage(Math.max(1, activePage - 1))}
                disabled={activePage === 1}
                className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
                title="Trang trước"
              >‹</button>
              <span className="min-w-16 rounded-md bg-orange-50 px-3 py-1.5 text-center text-xs font-bold text-fptOrangeDark dark:bg-orange-500/10 dark:text-orange-300">{activePage} / {totalPages}</span>
              <button
                type="button"
                onClick={() => setCurrentPage(Math.min(totalPages, activePage + 1))}
                disabled={activePage >= totalPages}
                className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
                title="Trang tiếp"
              >›</button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={activePage >= totalPages}
                className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
                title="Trang cuối"
              >»</button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

export default InquiryInbox
