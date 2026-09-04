import { IconInbox as Inbox, IconRefresh as Refresh } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'
import { useAuth } from '../context/AuthContext'
import { formatVietnamDateTime } from '../utils/datetime'
import { getInquiryBasePath, getInquirySlaMeta, getInquiryStatusMeta, getInquiryTypeLabel } from '../utils/inquiry'

const filters = [
  ['', 'Tất cả'],
  ['NEW', 'Mới'],
  ['CLAIMED', 'Đã phân công'],
  ['IN_PROGRESS', 'Đang xử lý'],
  ['WAITING_APPROVAL', 'Chờ phê duyệt'],
  ['WAITING_EMPLOYEE', 'Chờ nhân viên'],
  ['CONVERTED', 'Đã tạo phiếu'],
  ['OVERDUE', 'Quá hạn'],
  ['COMPLETED', 'Hoàn tất'],
  ['REJECTED', 'Từ chối'],
  ['CANCELLED', 'Đã hủy'],
]

const inquiryTypeFilters = [
  ['', 'Tất cả loại'],
  ['CONSUMABLE_REQUEST', 'Cấp phát vật tư'],
]

const unreadFilters = [
  ['ALL', 'Tất cả'],
  ['UNREAD', 'Có chưa đọc'],
  ['READ', 'Đã đọc hết'],
]

function InquiryInbox() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [filter, setFilter] = useState('')
  const [keyword, setKeyword] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [unreadFilter, setUnreadFilter] = useState('ALL')
  const [loading, setLoading] = useState(false)
  const basePath = getInquiryBasePath(user?.role)

  const loadInbox = useCallback(async () => {
    setLoading(true)
    try {
      const response = await axiosClient.get('/api/inquiries/inbox', { params: { status: filter && filter !== 'OVERDUE' ? filter : undefined } })
      setItems(response.data || [])
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Không tải được hộp thư yêu cầu.')
    } finally {
      setLoading(false)
    }
  }, [filter])

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
      if (typeFilter && item.inquiryType !== typeFilter) return false
      if (unreadFilter === 'UNREAD' && Number(item.unreadCount || 0) <= 0) return false
      if (unreadFilter === 'READ' && Number(item.unreadCount || 0) > 0) return false
      return !normalized || `${item.id} ${item.assetQaCode} ${item.assetName} ${item.requesterName} ${item.assigneeName || ''} ${item.destinationLocationName || ''} ${item.purpose}`.toLowerCase().includes(normalized)
    })
  }, [filter, items, keyword, typeFilter, unreadFilter])

  return (
    <section className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">Hộp thư nghiệp vụ</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{user?.role === 'ConsumableManager' ? 'Yêu cầu cấp phát từ nhân viên' : 'Yêu cầu cấp phát cần Admin xử lý'}</h2>
            <p className="mt-2 text-sm text-slate-500">Mở chi tiết để duyệt, từ chối hoặc tạo phiếu cấp phát vật tư khi cần.</p>
          </div>
          <button type="button" onClick={loadInbox} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600"><Refresh size={16} /> Làm mới</button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {filters.map(([value, label]) => <button key={value || 'all'} type="button" onClick={() => setFilter(value)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${filter === value ? 'border-orange-300 bg-orange-50 text-orange-700' : 'border-slate-200 text-slate-500'}`}>{label}</button>)}
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_200px_180px]">
          <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm theo mã, thiết bị, người yêu cầu..." className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-400" />
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-400">
            {inquiryTypeFilters.map(([value, label]) => <option key={value || 'all'} value={value}>{label}</option>)}
          </select>
          <select value={unreadFilter} onChange={(event) => setUnreadFilter(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-400">
            {unreadFilters.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {loading && items.length === 0 && <p className="p-4 text-sm text-slate-500">Đang tải yêu cầu...</p>}
        {!loading && visibleItems.length === 0 && <div className="p-8 text-center text-slate-500"><Inbox className="mx-auto" /><p className="mt-3 text-sm">Không có yêu cầu phù hợp.</p></div>}
        {visibleItems.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-[1020px] w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Mã / Loại</th>
                  <th className="px-4 py-3">Tài sản / Vật tư</th>
                  <th className="px-4 py-3">Mục đích</th>
                  <th className="px-4 py-3">Người yêu cầu</th>
                  <th className="px-4 py-3">Phụ trách</th>
                  <th className="px-4 py-3">Phòng</th>
                  <th className="px-4 py-3">SLA</th>
                  <th className="px-4 py-3">Cập nhật</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {visibleItems.map((item) => {
                  const status = getInquiryStatusMeta(item.status)
                  const sla = getInquirySlaMeta(item)
                  const unreadCount = Number(item.unreadCount || 0)
                  return (
                    <tr
                      key={item.id}
                      className={`align-top transition hover:bg-orange-50/40 dark:hover:bg-slate-950 ${
                        unreadCount > 0 ? 'bg-orange-50/20 dark:bg-orange-500/5' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">#{item.id}</div>
                        <div className="mt-1 text-xs text-slate-500">{getInquiryTypeLabel(item.inquiryType)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 dark:text-slate-100">{item.assetQaCode} · {item.assetName}</div>
                      </td>
                      <td className="max-w-[280px] px-4 py-3 text-slate-600 dark:text-slate-300">
                        <p className="line-clamp-2">{item.purpose}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{item.requesterName}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{item.assigneeName || 'Chưa phân công'}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{item.destinationLocationName || '—'}</td>
                      <td className="px-4 py-3">
                        {!sla.completed ? (
                          <span className={`text-xs font-semibold ${sla.breached ? 'text-red-600' : 'text-emerald-600'}`}>{sla.label}</span>
                        ) : (
                          <span className="text-xs text-slate-400">Đã kết thúc</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatVietnamDateTime(item.updatedAt)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${status.className}`}>{status.label}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link to={`${basePath}/${item.id}`} className="inline-flex items-center rounded-lg border border-orange-200 px-3 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-50">
                          Xem chi tiết
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

export default InquiryInbox
