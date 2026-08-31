import {
  IconArrowRight as ArrowRight,
  IconMessageCircle as MessageCircle,
  IconPackage as Package,
  IconQrcode as QrCode,
  IconSearch as Search,
} from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'
import { formatVietnamDateTime } from '../utils/datetime'
import { getInquiryStatusMeta, getInquiryTypeLabel } from '../utils/inquiry'

const today = new Date().toISOString().slice(0, 10)
const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

function MobileInquiries() {
  const [searchParams] = useSearchParams()
  const requestedQaCode = (searchParams.get('qaCode') || '').trim()
  const [items, setItems] = useState([])
  const [inquiries, setInquiries] = useState([])
  const [locations, setLocations] = useState([])
  const [keyword, setKeyword] = useState(requestedQaCode)
  const [trackingMode, setTrackingMode] = useState('')
  const [visibleResultCount, setVisibleResultCount] = useState(8)
  const [visibleInquiryCount, setVisibleInquiryCount] = useState(5)
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    destinationLocationId: '',
    quantityRequested: '1',
    neededFrom: today,
    expectedReturnDate: tomorrow,
    purpose: '',
    message: '',
  })

  const loadAvailability = useCallback(async () => {
    setLoading(true)
    try {
      const response = await axiosClient.get('/api/inquiries/availability', {
        params: { keyword: keyword.trim() || undefined, trackingMode: trackingMode || undefined, limit: 50 },
      })
      const nextItems = response.data || []
      setItems(nextItems)
      if (requestedQaCode) {
        const matched = nextItems.find((item) => item.assetQaCode?.toLowerCase() === requestedQaCode.toLowerCase())
        if (matched) setSelected(matched)
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Không tải được danh sách thiết bị và vật tư.')
    } finally {
      setLoading(false)
    }
  }, [keyword, requestedQaCode, trackingMode])

  const loadMine = useCallback(async () => {
    try {
      const response = await axiosClient.get('/api/inquiries/me')
      setInquiries(response.data || [])
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Không tải được lịch sử yêu cầu.')
    }
  }, [])

  useEffect(() => {
    const bootstrap = window.setTimeout(() => {
      void Promise.all([
        axiosClient.get('/api/inquiries/options').then((response) => setLocations(response.data?.locations || [])),
        loadMine(),
      ])
    }, 0)
    return () => window.clearTimeout(bootstrap)
  }, [loadMine])

  useEffect(() => {
    const searchDelay = window.setTimeout(() => {
      void loadAvailability()
    }, 350)
    return () => window.clearTimeout(searchDelay)
  }, [loadAvailability])

  const selectedIsConsumable = selected?.trackingMode === 'CONSUMABLE'
  const canSubmit = useMemo(
    () => Boolean(selected && form.destinationLocationId && form.neededFrom && form.purpose.trim()
      && (selectedIsConsumable || form.expectedReturnDate)),
    [form, selected, selectedIsConsumable],
  )
  const visibleItems = items.slice(0, visibleResultCount)
  const visibleInquiries = inquiries.slice(0, visibleInquiryCount)

  const handleCreate = async (event) => {
    event.preventDefault()
    if (!canSubmit) {
      toast.error('Vui lòng nhập đầy đủ thông tin yêu cầu.')
      return
    }
    setSubmitting(true)
    try {
      await axiosClient.post('/api/inquiries', {
        assetQaCode: selected.assetQaCode,
        destinationLocationId: Number(form.destinationLocationId),
        quantityRequested: selectedIsConsumable ? Number(form.quantityRequested) : 1,
        neededFrom: form.neededFrom,
        expectedReturnDate: selectedIsConsumable ? null : form.expectedReturnDate,
        purpose: form.purpose.trim(),
        message: form.message.trim() || null,
      })
      toast.success('Đã gửi yêu cầu đến đúng bộ phận phụ trách.')
      setSelected(null)
      setForm({
        destinationLocationId: '',
        quantityRequested: '1',
        neededFrom: today,
        expectedReturnDate: tomorrow,
        purpose: '',
        message: '',
      })
      await loadMine()
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Không thể tạo yêu cầu.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden pb-2">
      <section className="relative overflow-hidden rounded-[26px] border border-orange-400/30 bg-gradient-to-br from-orange-500 via-orange-500 to-orange-600 p-4 text-white shadow-lg shadow-orange-200/40 dark:shadow-none min-[360px]:p-5">
        <div className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
        <div className="flex items-start justify-between gap-3">
          <div className="relative min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/75">Tra cứu trước khi yêu cầu</p>
            <h2 className="mt-2 text-lg font-bold leading-7 min-[360px]:text-xl">Mượn thiết bị / Cấp phát vật tư</h2>
            <p className="mt-2 text-sm leading-6 text-white/85">Kiểm tra tình trạng, gửi yêu cầu và theo dõi phản hồi ngay trên hệ thống.</p>
          </div>
          <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/20">
            <Package size={24} className="text-white/90" />
          </span>
        </div>
      </section>

      <section className="min-w-0 overflow-hidden rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-2">
          <h3 className="min-w-0 text-sm font-bold text-slate-800 dark:text-slate-100 min-[360px]:text-base">Tìm thiết bị hoặc vật tư</h3>
          <Link to="/mobile/scan?mode=inquiry" aria-label="Quét mã QR" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 px-2.5 text-xs font-semibold text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300">
            <QrCode size={15} /> <span className="hidden min-[340px]:inline">Quét QR</span>
          </Link>
        </div>
        <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-[1fr_auto]">
          <label className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 focus-within:border-orange-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-orange-100 dark:border-slate-700 dark:bg-slate-950 dark:focus-within:ring-orange-500/10">
            <Search size={17} className="text-slate-400" />
            <input value={keyword} onChange={(event) => { setKeyword(event.target.value); setVisibleResultCount(8) }} placeholder="Tên, mã QA, loại hoặc phòng" className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100" />
          </label>
          <select value={trackingMode} onChange={(event) => { setTrackingMode(event.target.value); setVisibleResultCount(8) }} className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-orange-500/10">
            <option value="">Tất cả</option>
            <option value="ITEMIZED">Thiết bị mượn–trả</option>
            <option value="CONSUMABLE">Vật tư tiêu hao</option>
          </select>
        </div>
        <div className="mt-4 min-w-0 space-y-2">
          {loading && <p aria-live="polite" className="animate-pulse rounded-xl bg-slate-50 p-3 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">Đang tìm...</p>}
          {!loading && items.length === 0 && <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">Không tìm thấy dữ liệu phù hợp.</p>}
          {!loading && visibleItems.map((item) => (
            <button key={item.assetQaCode} type="button" onClick={() => setSelected(item)} className={`w-full min-w-0 overflow-hidden rounded-2xl border p-3 text-left transition ${selected?.assetQaCode === item.assetQaCode ? 'border-orange-400 bg-orange-50 ring-2 ring-orange-100 dark:bg-orange-500/10 dark:ring-orange-500/10' : 'border-slate-200 hover:border-orange-200 dark:border-slate-700 dark:hover:border-orange-500/30'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{item.assetName}</p>
                  <p className="mt-1 break-words text-xs leading-5 text-slate-500 dark:text-slate-400">{item.assetQaCode} · {item.categoryName || 'Chưa phân loại'}</p>
                  <p className="mt-1 break-words text-xs leading-5 text-slate-500 dark:text-slate-400">{item.locationName || item.homeLocationName || 'Chưa xác định vị trí'}</p>
                </div>
                <span className={`max-w-[42%] shrink-0 rounded-full px-2 py-1 text-center text-[10px] font-semibold leading-4 min-[360px]:text-[11px] ${item.available ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'}`}>{item.availabilityLabel}</span>
              </div>
              {item.trackingMode === 'CONSUMABLE' && <p className="mt-2 text-xs font-medium text-slate-600 dark:text-slate-300">Khả dụng: {item.availableQuantity} {item.unit || ''}</p>}
            </button>
          ))}
          {!loading && items.length > visibleResultCount && (
            <button type="button" onClick={() => setVisibleResultCount((count) => count + 8)} className="w-full rounded-xl border border-dashed border-slate-300 px-3 py-2.5 text-xs font-semibold text-slate-600 transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-orange-500/10">
              Xem thêm {Math.min(8, items.length - visibleResultCount)} kết quả
            </button>
          )}
        </div>
      </section>

      {selected && (
        <form onSubmit={handleCreate} className="min-w-0 overflow-hidden rounded-[22px] border border-orange-200 bg-white p-4 shadow-sm dark:border-orange-500/30 dark:bg-slate-900">
          <h3 className="break-words font-semibold text-slate-800 dark:text-slate-100">Tạo yêu cầu cho {selected.assetName}</h3>
          <p className="mt-1 text-xs text-slate-500">Hệ thống sẽ chuyển tới {selectedIsConsumable ? 'Quản lý vật tư' : 'Admin'}.</p>
          <div className="mt-4 grid gap-3">
            <label className="min-w-0 text-sm font-medium text-slate-700 dark:text-slate-200">Phòng sử dụng/nhận
              <select required value={form.destinationLocationId} onChange={(event) => setForm((prev) => ({ ...prev, destinationLocationId: event.target.value }))} className="mt-1 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                <option value="">Chọn phòng</option>
                {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
              </select>
            </label>
            {selectedIsConsumable && <label className="min-w-0 text-sm font-medium text-slate-700 dark:text-slate-200">Số lượng
              <input type="number" min="1" required value={form.quantityRequested} onChange={(event) => setForm((prev) => ({ ...prev, quantityRequested: event.target.value }))} className="mt-1 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
            </label>}
            <div className="grid min-w-0 grid-cols-1 gap-3 min-[360px]:grid-cols-2">
              <label className="min-w-0 text-sm font-medium text-slate-700 dark:text-slate-200">Ngày cần
                <input type="date" min={today} required value={form.neededFrom} onChange={(event) => setForm((prev) => ({ ...prev, neededFrom: event.target.value }))} className="mt-1 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
              </label>
              {!selectedIsConsumable && <label className="min-w-0 text-sm font-medium text-slate-700 dark:text-slate-200">Ngày trả
                <input type="date" min={form.neededFrom || today} required value={form.expectedReturnDate} onChange={(event) => setForm((prev) => ({ ...prev, expectedReturnDate: event.target.value }))} className="mt-1 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
              </label>}
            </div>
            <label className="min-w-0 text-sm font-medium text-slate-700 dark:text-slate-200">Mục đích sử dụng
              <textarea required maxLength={1000} value={form.purpose} onChange={(event) => setForm((prev) => ({ ...prev, purpose: event.target.value }))} rows={3} className="mt-1 w-full min-w-0 resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
            </label>
            <label className="min-w-0 text-sm font-medium text-slate-700 dark:text-slate-200">Câu hỏi mở đầu
              <textarea maxLength={4000} value={form.message} onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))} rows={2} placeholder="Ví dụ: Thiết bị này có thể nhận vào sáng mai không?" className="mt-1 w-full min-w-0 resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
            </label>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setSelected(null)} className="min-w-0 rounded-xl border border-slate-300 px-2 py-2.5 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">Bỏ chọn</button>
            <button type="submit" disabled={!canSubmit || submitting} className="min-w-0 rounded-xl bg-orange-600 px-2 py-2.5 text-sm font-semibold text-white disabled:bg-slate-300 dark:disabled:bg-slate-700">{submitting ? 'Đang gửi...' : 'Gửi yêu cầu'}</button>
          </div>
        </form>
      )}

      <section className="min-w-0 overflow-hidden rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Yêu cầu của tôi</h3>
          <MessageCircle size={19} className="text-orange-600" />
        </div>
        <div className="mt-3 space-y-2">
          {inquiries.length === 0 && <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">Bạn chưa có yêu cầu nào.</p>}
          {visibleInquiries.map((inquiry) => {
            const status = getInquiryStatusMeta(inquiry.status)
            return <Link key={inquiry.id} to={`/mobile/inquiries/${inquiry.id}`} className="block min-w-0 overflow-hidden rounded-2xl border border-slate-200 p-3 transition hover:border-orange-200 hover:bg-orange-50/50 dark:border-slate-700 dark:hover:bg-orange-500/10">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">#{inquiry.id} · {inquiry.assetName}</p><p className="mt-1 break-words text-xs leading-5 text-slate-500 dark:text-slate-400">{getInquiryTypeLabel(inquiry.inquiryType)} · {formatVietnamDateTime(inquiry.updatedAt)}</p></div>
                <span className={`max-w-[42%] shrink-0 rounded-full border px-2 py-1 text-center text-[10px] font-semibold leading-4 min-[360px]:text-[11px] ${status.className}`}>{status.label}</span>
              </div>
              <div className="mt-2 flex min-w-0 items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400"><span className="min-w-0 truncate">{inquiry.assigneeName ? `Phụ trách: ${inquiry.assigneeName}` : 'Chưa có người nhận'}</span><span className="inline-flex shrink-0 items-center gap-1 font-semibold text-orange-700 dark:text-orange-300">Mở <ArrowRight size={13} /></span></div>
            </Link>
          })}
          {inquiries.length > visibleInquiryCount && (
            <button type="button" onClick={() => setVisibleInquiryCount((count) => count + 5)} className="w-full rounded-xl border border-dashed border-slate-300 px-3 py-2.5 text-xs font-semibold text-slate-600 transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-orange-500/10">
              Xem thêm {Math.min(5, inquiries.length - visibleInquiryCount)} yêu cầu
            </button>
          )}
        </div>
      </section>
    </div>
  )
}

export default MobileInquiries
