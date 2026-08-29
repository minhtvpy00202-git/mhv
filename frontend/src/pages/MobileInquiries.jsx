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
        loadAvailability(),
        loadMine(),
      ])
    }, 0)
    return () => window.clearTimeout(bootstrap)
  }, [loadAvailability, loadMine])

  const selectedIsConsumable = selected?.trackingMode === 'CONSUMABLE'
  const canSubmit = useMemo(
    () => Boolean(selected && form.destinationLocationId && form.neededFrom && form.purpose.trim()
      && (selectedIsConsumable || form.expectedReturnDate)),
    [form, selected, selectedIsConsumable],
  )

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
    <div className="space-y-4">
      <section className="rounded-3xl bg-gradient-to-br from-orange-500 to-orange-600 p-5 text-white shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/75">Tra cứu trước khi yêu cầu</p>
            <h2 className="mt-2 text-xl font-semibold">Mượn thiết bị / Cấp phát vật tư</h2>
            <p className="mt-2 text-sm leading-6 text-white/85">Kiểm tra tình trạng, gửi yêu cầu và trao đổi với bộ phận phụ trách ngay trên hệ thống.</p>
          </div>
          <Package size={30} className="shrink-0 text-white/90" />
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Tìm thiết bị hoặc vật tư</h3>
          <Link to="/mobile/scan?mode=inquiry" className="inline-flex items-center gap-1 rounded-xl border border-orange-200 px-3 py-2 text-xs font-semibold text-orange-700">
            <QrCode size={15} /> Quét QR
          </Link>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
          <label className="flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2">
            <Search size={17} className="text-slate-400" />
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tên, mã QA, loại hoặc phòng" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </label>
          <select value={trackingMode} onChange={(event) => setTrackingMode(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
            <option value="">Tất cả</option>
            <option value="ITEMIZED">Thiết bị mượn–trả</option>
            <option value="CONSUMABLE">Vật tư tiêu hao</option>
          </select>
        </div>
        <button type="button" onClick={loadAvailability} className="mt-2 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white dark:bg-orange-600">
          {loading ? 'Đang tìm...' : 'Tra cứu tình trạng'}
        </button>

        <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
          {!loading && items.length === 0 && <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">Không tìm thấy dữ liệu phù hợp.</p>}
          {items.map((item) => (
            <button key={item.assetQaCode} type="button" onClick={() => setSelected(item)} className={`w-full rounded-2xl border p-3 text-left transition ${selected?.assetQaCode === item.assetQaCode ? 'border-orange-400 bg-orange-50' : 'border-slate-200 hover:border-orange-200'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{item.assetName}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.assetQaCode} · {item.categoryName || 'Chưa phân loại'}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.locationName || item.homeLocationName || 'Chưa xác định vị trí'}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${item.available ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{item.availabilityLabel}</span>
              </div>
              {item.trackingMode === 'CONSUMABLE' && <p className="mt-2 text-xs font-medium text-slate-600">Khả dụng: {item.availableQuantity} {item.unit || ''}</p>}
            </button>
          ))}
        </div>
      </section>

      {selected && (
        <form onSubmit={handleCreate} className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Tạo yêu cầu cho {selected.assetName}</h3>
          <p className="mt-1 text-xs text-slate-500">Hệ thống sẽ chuyển tới {selectedIsConsumable ? 'Quản lý vật tư' : 'Admin'}.</p>
          <div className="mt-4 grid gap-3">
            <label className="text-sm font-medium text-slate-700">Phòng sử dụng/nhận
              <select required value={form.destinationLocationId} onChange={(event) => setForm((prev) => ({ ...prev, destinationLocationId: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
                <option value="">Chọn phòng</option>
                {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
              </select>
            </label>
            {selectedIsConsumable && <label className="text-sm font-medium text-slate-700">Số lượng
              <input type="number" min="1" required value={form.quantityRequested} onChange={(event) => setForm((prev) => ({ ...prev, quantityRequested: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
            </label>}
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-medium text-slate-700">Ngày cần
                <input type="date" min={today} required value={form.neededFrom} onChange={(event) => setForm((prev) => ({ ...prev, neededFrom: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
              </label>
              {!selectedIsConsumable && <label className="text-sm font-medium text-slate-700">Ngày trả
                <input type="date" min={form.neededFrom || today} required value={form.expectedReturnDate} onChange={(event) => setForm((prev) => ({ ...prev, expectedReturnDate: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
              </label>}
            </div>
            <label className="text-sm font-medium text-slate-700">Mục đích sử dụng
              <textarea required maxLength={1000} value={form.purpose} onChange={(event) => setForm((prev) => ({ ...prev, purpose: event.target.value }))} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
            </label>
            <label className="text-sm font-medium text-slate-700">Câu hỏi mở đầu
              <textarea maxLength={4000} value={form.message} onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))} rows={2} placeholder="Ví dụ: Thiết bị này có thể nhận vào sáng mai không?" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => setSelected(null)} className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600">Bỏ chọn</button>
            <button type="submit" disabled={!canSubmit || submitting} className="flex-1 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white disabled:bg-slate-300">{submitting ? 'Đang gửi...' : 'Gửi yêu cầu'}</button>
          </div>
        </form>
      )}

      <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Yêu cầu của tôi</h3>
          <MessageCircle size={19} className="text-orange-600" />
        </div>
        <div className="mt-3 space-y-2">
          {inquiries.length === 0 && <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">Bạn chưa có yêu cầu nào.</p>}
          {inquiries.map((inquiry) => {
            const status = getInquiryStatusMeta(inquiry.status)
            return <Link key={inquiry.id} to={`/mobile/inquiries/${inquiry.id}`} className="block rounded-2xl border border-slate-200 p-3 hover:border-orange-200 hover:bg-orange-50/50">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">#{inquiry.id} · {inquiry.assetName}</p><p className="mt-1 text-xs text-slate-500">{getInquiryTypeLabel(inquiry.inquiryType)} · {formatVietnamDateTime(inquiry.updatedAt)}</p></div>
                <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${status.className}`}>{status.label}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500"><span>{inquiry.assigneeName ? `Phụ trách: ${inquiry.assigneeName}` : 'Chưa có người nhận'}</span><span className="inline-flex items-center gap-1 font-semibold text-orange-700">Mở <ArrowRight size={13} /></span></div>
            </Link>
          })}
        </div>
      </section>
    </div>
  )
}

export default MobileInquiries
