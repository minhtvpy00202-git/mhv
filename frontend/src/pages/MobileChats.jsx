import { IconAdjustmentsHorizontal as Filters, IconMessageCircle as MessageCircle, IconSearch as Search } from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'
import { useAuth } from '../context/AuthContext'
import { formatVietnamDateTime } from '../utils/datetime'
import { getInquiryStatusMeta, getInquiryTypeLabel } from '../utils/inquiry'
import { getTicketStatusMeta } from '../utils/ticketStatus'

const CHAT_TABS = [
  { id: 'inquiries', label: 'Yêu cầu' },
  { id: 'repairs', label: 'Sửa chữa' },
]

const INQUIRY_STATUSES = [
  ['NEW', 'Mới tạo'], ['CLAIMED', 'Đã tiếp nhận'], ['IN_PROGRESS', 'Đang trao đổi'],
  ['WAITING_EMPLOYEE', 'Chờ nhân viên'], ['WAITING_APPROVAL', 'Chờ phê duyệt'],
  ['CONVERTED', 'Đã tạo phiếu'], ['COMPLETED', 'Hoàn tất'], ['REJECTED', 'Từ chối'], ['CANCELLED', 'Đã hủy'],
]

const REPAIR_STATUSES = [
  ['PENDING', 'Mới báo hỏng'], ['IN_PROGRESS', 'Đang xử lý'], ['AWAITING_CONFIRMATION', 'Chờ xác nhận'],
  ['WAITING_REPLACEMENT', 'Chờ thay thế'], ['RESOLVED', 'Đã hoàn tất'],
  ['CLOSED_UNRESOLVED', 'Đóng - không thể sửa'], ['REJECTED', 'Đã từ chối'], ['CANCELLED', 'Đã hủy'],
]

function MobileChats() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') === 'repairs' ? 'repairs' : 'inquiries'
  const [tickets, setTickets] = useState([])
  const [inquiries, setInquiries] = useState([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [sortOrder, setSortOrder] = useState('newest')

  useEffect(() => {
    let mounted = true
    const loadChats = async () => {
      setLoading(true)
      const [inquiryResult, ticketResult] = await Promise.allSettled([
        axiosClient.get('/api/inquiries/me'),
        axiosClient.get('/api/tickets', { params: { reporter_id: user?.userId } }),
      ])
      if (!mounted) return
      if (inquiryResult.status === 'fulfilled') setInquiries(inquiryResult.value.data || [])
      if (ticketResult.status === 'fulfilled') setTickets(ticketResult.value.data || [])
      if (inquiryResult.status === 'rejected' || ticketResult.status === 'rejected') {
        toast.error('Không tải được đầy đủ danh sách hội thoại.')
      }
      setLoading(false)
    }
    void loadChats()
    return () => {
      mounted = false
    }
  }, [user?.userId])

  const filteredInquiries = useMemo(() => {
    const normalized = keyword.trim().toLowerCase()
    return inquiries
      .filter((inquiry) => !normalized || `${inquiry.id} ${inquiry.assetQaCode || ''} ${inquiry.assetName || ''} ${inquiry.purpose || ''}`.toLowerCase().includes(normalized))
      .filter((inquiry) => !statusFilter || inquiry.status === statusFilter)
      .filter((inquiry) => !typeFilter || inquiry.inquiryType === typeFilter)
      .sort((left, right) => {
        const delta = new Date(right.updatedAt || right.createdAt || 0).getTime() - new Date(left.updatedAt || left.createdAt || 0).getTime()
        return sortOrder === 'oldest' ? -delta : delta
      })
  }, [inquiries, keyword, sortOrder, statusFilter, typeFilter])

  const filteredTickets = useMemo(() => {
    const normalized = keyword.trim().toLowerCase()
    return tickets
      .filter((ticket) => !normalized || `${ticket.id} ${ticket.assetQaCode || ''} ${ticket.assetName || ''} ${ticket.description || ''}`.toLowerCase().includes(normalized))
      .filter((ticket) => !statusFilter || ticket.status === statusFilter)
      .sort((left, right) => {
        const delta = new Date(right.updatedAt || right.createdAt || 0).getTime() - new Date(left.updatedAt || left.createdAt || 0).getTime()
        return sortOrder === 'oldest' ? -delta : delta
      })
  }, [keyword, sortOrder, statusFilter, tickets])

  const activeFilterCount = Number(Boolean(statusFilter)) + Number(Boolean(typeFilter && activeTab === 'inquiries')) + Number(sortOrder !== 'newest')

  const resetFilters = () => {
    setStatusFilter('')
    setTypeFilter('')
    setSortOrder('newest')
  }

  const changeTab = (tab) => {
    setKeyword('')
    resetFilters()
    setFiltersOpen(false)
    setSearchParams({ tab }, { replace: true })
  }

  return (
    <section className="space-y-3">
      <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Hội thoại của bạn</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Trao đổi về yêu cầu và sự cố trong cùng một nơi.</p>
          </div>
          <div className="rounded-xl bg-orange-50 p-2 text-fptOrange dark:bg-orange-500/10"><MessageCircle size={18} /></div>
        </div>

        <div className="mt-4 grid grid-cols-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {CHAT_TABS.map((tab) => (
            <button key={tab.id} type="button" onClick={() => changeTab(tab.id)} className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${activeTab === tab.id ? 'bg-white text-fptOrange shadow-sm dark:bg-slate-700 dark:text-orange-300' : 'text-slate-500 dark:text-slate-400'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative mt-3">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder={activeTab === 'inquiries' ? 'Tìm mã yêu cầu hoặc tên thiết bị/vật tư' : 'Tìm mã ticket hoặc tên thiết bị'} className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-14 text-sm outline-none ring-fptOrange focus:ring-2 dark:border-slate-700 dark:bg-slate-950" />
          <button type="button" onClick={() => setFiltersOpen((current) => !current)} aria-label="Mở bộ lọc" className={`absolute right-1.5 top-1/2 inline-flex h-8 min-w-8 -translate-y-1/2 items-center justify-center gap-1 rounded-lg px-2 ${filtersOpen || activeFilterCount ? 'bg-orange-50 text-fptOrange dark:bg-orange-500/10' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
            <Filters size={17} />
            {activeFilterCount > 0 && <span className="text-[10px] font-bold">{activeFilterCount}</span>}
          </button>
        </div>

        {filtersOpen && (
          <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
            {activeTab === 'inquiries' && (
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Loại yêu cầu
                <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal dark:border-slate-700 dark:bg-slate-900">
                  <option value="">Tất cả loại yêu cầu</option>
                  <option value="ASSET_BORROW">Mượn thiết bị</option>
                  <option value="CONSUMABLE_REQUEST">Cấp phát vật tư</option>
                </select>
              </label>
            )}
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Trạng thái
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal dark:border-slate-700 dark:bg-slate-900">
                <option value="">Tất cả trạng thái</option>
                {(activeTab === 'inquiries' ? INQUIRY_STATUSES : REPAIR_STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Sắp xếp
              <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal dark:border-slate-700 dark:bg-slate-900">
                <option value="newest">Mới cập nhật trước</option>
                <option value="oldest">Cũ nhất trước</option>
              </select>
            </label>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500">{activeTab === 'inquiries' ? filteredInquiries.length : filteredTickets.length} kết quả</span>
              <button
                type="button"
                onClick={resetFilters}
                disabled={activeFilterCount === 0}
                className="inline-flex min-h-10 min-w-28 items-center justify-center rounded-xl border border-orange-200 bg-white px-4 py-2 text-sm font-semibold text-orange-600 shadow-sm transition hover:bg-orange-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none"
              >
                Xóa bộ lọc
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {loading && <p className="rounded-2xl bg-white px-4 py-4 text-sm text-slate-500 shadow-sm dark:bg-slate-900">Đang tải danh sách chat...</p>}

        {!loading && activeTab === 'inquiries' && filteredInquiries.length === 0 && <p className="rounded-2xl bg-white px-4 py-4 text-sm text-slate-500 shadow-sm dark:bg-slate-900">Bạn chưa có yêu cầu mượn hoặc cấp phát nào để chat.</p>}
        {!loading && activeTab === 'inquiries' && filteredInquiries.map((inquiry) => {
          const statusMeta = getInquiryStatusMeta(inquiry.status)
          return (
            <button key={inquiry.id} type="button" onClick={() => navigate(`/mobile/chats/inquiries/${inquiry.id}`)} className="w-full rounded-2xl bg-white p-4 text-left shadow-sm transition hover:bg-orange-50 dark:bg-slate-900 dark:hover:bg-orange-500/10">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">Yêu cầu #{inquiry.id} · {inquiry.assetName}</p><p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{getInquiryTypeLabel(inquiry.inquiryType)}</p></div>
                <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusMeta.className}`}>{statusMeta.label}</span>
              </div>
              <p className="mt-3 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">{inquiry.purpose || 'Trao đổi về yêu cầu'}</p>
              <div className="mt-3 flex items-center justify-between gap-3"><p className="text-[11px] text-slate-500">{formatVietnamDateTime(inquiry.updatedAt || inquiry.createdAt)}</p><p className="inline-flex items-center gap-1 text-xs font-semibold text-fptOrange"><MessageCircle size={13} /> Mở chat</p></div>
            </button>
          )
        })}

        {!loading && activeTab === 'repairs' && filteredTickets.length === 0 && <p className="rounded-2xl bg-white px-4 py-4 text-sm text-slate-500 shadow-sm dark:bg-slate-900">Bạn chưa có ticket sửa chữa nào để chat.</p>}
        {!loading && activeTab === 'repairs' && filteredTickets.map((ticket) => {
          const statusMeta = getTicketStatusMeta(ticket.status)
          return (
            <button key={ticket.id} type="button" onClick={() => navigate(`/mobile/chats/repairs/${ticket.id}`)} className="w-full rounded-2xl bg-white p-4 text-left shadow-sm transition hover:bg-orange-50 dark:bg-slate-900 dark:hover:bg-orange-500/10">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Ticket #{ticket.id}</p><p className="mt-1 truncate text-xs text-slate-600 dark:text-slate-300">{ticket.assetQaCode} - {ticket.assetName}</p></div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusMeta.badgeClassName}`}>{statusMeta.label}</span>
              </div>
              <p className="mt-3 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">{ticket.description}</p>
              <div className="mt-3 flex items-center justify-between gap-3"><p className="text-[11px] text-slate-500">{formatVietnamDateTime(ticket.createdAt)}</p><p className="inline-flex items-center gap-1 text-xs font-semibold text-fptOrange"><MessageCircle size={13} /> Mở chat</p></div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

export default MobileChats
