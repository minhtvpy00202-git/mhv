import { IconInbox as Inbox, IconMessageCircle as MessageCircle, IconRefresh as Refresh } from '@tabler/icons-react'
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

function InquiryInbox() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [filter, setFilter] = useState('')
  const [keyword, setKeyword] = useState('')
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
      return !normalized || `${item.id} ${item.assetQaCode} ${item.assetName} ${item.requesterName} ${item.purpose}`.toLowerCase().includes(normalized)
    })
  }, [filter, items, keyword])

  return (
    <section className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">Hộp thư nghiệp vụ</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{user?.role === 'ConsumableManager' ? 'Yêu cầu cấp phát vật tư' : 'Yêu cầu cần Admin xử lý'}</h2>
            <p className="mt-2 text-sm text-slate-500">Nhận xử lý, trao đổi và chuyển cuộc hội thoại thành phiếu nghiệp vụ.</p>
          </div>
          <button type="button" onClick={loadInbox} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600"><Refresh size={16} /> Làm mới</button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {filters.map(([value, label]) => <button key={value || 'all'} type="button" onClick={() => setFilter(value)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${filter === value ? 'border-orange-300 bg-orange-50 text-orange-700' : 'border-slate-200 text-slate-500'}`}>{label}</button>)}
        </div>
        <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm theo mã, thiết bị, người yêu cầu..." className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-400" />
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        {loading && items.length === 0 && <p className="rounded-2xl bg-white p-4 text-sm text-slate-500">Đang tải yêu cầu...</p>}
        {!loading && visibleItems.length === 0 && <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500"><Inbox className="mx-auto" /><p className="mt-3 text-sm">Không có yêu cầu phù hợp.</p></div>}
        {visibleItems.map((item) => {
          const status = getInquiryStatusMeta(item.status)
          const sla = getInquirySlaMeta(item)
          return <Link key={item.id} to={`${basePath}/${item.id}`} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{getInquiryTypeLabel(item.inquiryType)} #{item.id}</p><h3 className="mt-2 truncate font-semibold text-slate-900 dark:text-slate-100">{item.assetQaCode} · {item.assetName}</h3></div>
              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${status.className}`}>{status.label}</span>
            </div>
            <p className="mt-3 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{item.purpose}</p>
            <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-950">
              <p><span className="font-semibold text-slate-700">Người yêu cầu:</span> {item.requesterName}</p>
              <p><span className="font-semibold text-slate-700">Phụ trách:</span> {item.assigneeName || 'Chưa nhận'}</p>
              <p><span className="font-semibold text-slate-700">Phòng:</span> {item.destinationLocationName}</p>
              <p><span className="font-semibold text-slate-700">Cập nhật:</span> {formatVietnamDateTime(item.updatedAt)}</p>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm"><span className="inline-flex items-center gap-1 text-slate-500"><MessageCircle size={15} /> {item.unreadCount || 0} chưa đọc</span><span className="font-semibold text-orange-700">Mở xử lý →</span></div>
            {!sla.completed && <p className={`mt-2 text-xs font-semibold ${sla.breached ? 'text-red-600' : 'text-emerald-600'}`}>{sla.label}</p>}
          </Link>
        })}
      </div>
    </section>
  )
}

export default InquiryInbox
