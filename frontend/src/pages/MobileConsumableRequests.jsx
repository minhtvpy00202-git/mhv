import {
  IconArrowLeft as ArrowLeft,
  IconArrowRight as ArrowRight,
  IconX as X,
  IconPackage as Package,
  IconSearch as Search,
} from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'
import ModalOverlay from '../components/ui/ModalOverlay'

const today = new Date().toISOString().slice(0, 10)
const DEFAULT_LIMIT = 20

function getUnitBreakdownText(item) {
  const retailUnit = String(item?.retailUnit || item?.unit || '').trim()
  const wholesaleUnit = String(item?.wholesaleUnit || '').trim()
  const factor = Number(item?.wholesaleToRetailFactor ?? 1)
  if (!retailUnit || !wholesaleUnit || !Number.isInteger(factor) || factor <= 1) return ''
  return `Quy đổi: 1 ${wholesaleUnit} = ${factor} ${retailUnit}`
}

function MobileConsumableRequests() {
  const [searchParams] = useSearchParams()
  const requestedQaCode = (searchParams.get('qaCode') || '').trim()
  const [items, setItems] = useState([])
  const [locations, setLocations] = useState([])
  const [keyword, setKeyword] = useState(requestedQaCode)
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    destinationLocationId: '',
    quantityRequested: '1',
    quantityRequestedUnit: 'RETAIL',
    neededFrom: today,
    purpose: '',
    message: '',
  })

  const loadAvailability = useCallback(async () => {
    setLoading(true)
    try {
      const response = await axiosClient.get('/api/inquiries/availability', {
        params: {
          keyword: keyword.trim() || undefined,
          trackingMode: 'CONSUMABLE',
          limit: DEFAULT_LIMIT,
        },
      })
      const nextItems = response.data || []
      setItems(nextItems)
      if (requestedQaCode) {
        const matched = nextItems.find((item) => item.assetQaCode?.toLowerCase() === requestedQaCode.toLowerCase())
        if (matched) setSelected(matched)
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Không tải được danh sách vật tư.')
    } finally {
      setLoading(false)
    }
  }, [keyword, requestedQaCode])

  useEffect(() => {
    const bootstrap = window.setTimeout(() => {
      void Promise.all([
        axiosClient.get('/api/inquiries/options').then((response) => setLocations(response.data?.locations || [])),
        loadAvailability(),
      ])
    }, 0)
    return () => window.clearTimeout(bootstrap)
  }, [loadAvailability])

  useEffect(() => {
    if (!selected) return
    const canUseWholesale = Number(selected?.wholesaleToRetailFactor ?? 1) > 1
    setForm((prev) => ({
      ...prev,
      quantityRequestedUnit: canUseWholesale ? prev.quantityRequestedUnit : 'RETAIL',
    }))
  }, [selected])

  const canSubmit = useMemo(
    () => Boolean(selected && form.destinationLocationId && form.neededFrom && form.purpose.trim() && Number(form.quantityRequested) > 0),
    [form, selected],
  )

  const destinationOptions = useMemo(() => (
    locations.filter((location) => String(location.id) !== String(selected?.locationId ?? ''))
  ), [locations, selected])

  useEffect(() => {
    if (!selected || !form.destinationLocationId) return
    if (String(form.destinationLocationId) === String(selected.locationId ?? '')) {
      setForm((prev) => ({ ...prev, destinationLocationId: '' }))
    }
  }, [form.destinationLocationId, selected])

  const handleCreate = async (event) => {
    event.preventDefault()
    if (!canSubmit) {
      toast.error('Vui lòng nhập đầy đủ thông tin cấp phát vật tư.')
      return
    }
    if (String(form.destinationLocationId) === String(selected?.locationId ?? '')) {
      toast.error('Phòng nhận không được trùng với kho hiện đang chứa vật tư.')
      return
    }
    setSubmitting(true)
    try {
      await axiosClient.post('/api/inquiries', {
        assetQaCode: selected.assetQaCode,
        destinationLocationId: Number(form.destinationLocationId),
        quantityRequested: Number(form.quantityRequested),
        quantityRequestedUnit: form.quantityRequestedUnit,
        neededFrom: form.neededFrom,
        expectedReturnDate: null,
        purpose: form.purpose.trim(),
        message: form.message.trim() || null,
      })
      toast.success('Đã gửi yêu cầu cấp phát vật tư.')
      setSelected(null)
      setForm({
        destinationLocationId: '',
        quantityRequested: '1',
        quantityRequestedUnit: 'RETAIL',
        neededFrom: today,
        purpose: '',
        message: '',
      })
      if (requestedQaCode) setKeyword('')
      await loadAvailability()
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Không thể tạo yêu cầu cấp phát.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-gradient-to-br from-orange-500 to-amber-600 p-5 text-white shadow-lg">
        <Link to="/mobile/home" className="inline-flex items-center gap-1 text-xs font-semibold text-white/80">
          <ArrowLeft size={15} /> Quay lại trang chủ
        </Link>
        <div className="mt-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/75">Cấp phát vật tư</p>
            <h2 className="mt-2 text-xl font-semibold">Tạo yêu cầu cấp phát vật tư</h2>
          </div>
          <Package size={30} className="shrink-0 text-white/90" />
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Danh sách vật tư</h3>
        </div>
        <label className="mt-3 flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2">
          <Search size={17} className="text-slate-400" />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Tên vật tư, mã QA hoặc phòng"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </label>
        <button
          type="button"
          onClick={loadAvailability}
          className="mt-2 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white dark:bg-orange-600"
        >
          {loading ? 'Đang tìm...' : 'Tìm vật tư'}
        </button>

        <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
          {!loading && items.length === 0 && (
            <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">Không tìm thấy vật tư phù hợp.</p>
          )}
          {items.map((item) => (
            <button
              key={item.assetQaCode}
              type="button"
              onClick={() => setSelected(item)}
              className={`w-full rounded-2xl border p-3 text-left transition ${
                selected?.assetQaCode === item.assetQaCode
                  ? 'border-orange-400 bg-orange-50'
                  : 'border-slate-200 hover:border-orange-200'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{item.assetName}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.assetQaCode} · {item.categoryName || 'Chưa phân loại'}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.locationName || item.homeLocationName || 'Chưa xác định vị trí'}</p>
                  <p className="mt-2 text-xs font-medium text-slate-600">
                    Khả dụng: {item.formattedAvailableQuantity || `${item.availableQuantity} ${item.retailUnit || item.unit || ''}`}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700">
                  Chọn <ArrowRight size={13} />
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {selected && (
        <ModalOverlay className="bg-slate-950/70 backdrop-blur-sm" zIndex={120}>
          <form onSubmit={handleCreate} className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">Yêu cầu cấp phát vật tư</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Vật tư: {selected.assetName}. Hệ thống sẽ chuyển yêu cầu đến quản lý vật tư.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="Đóng form yêu cầu cấp phát"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="text-sm font-medium text-slate-700">Phòng nhận
                <select
                  required
                  value={form.destinationLocationId}
                  onChange={(event) => setForm((prev) => ({ ...prev, destinationLocationId: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                >
                  <option value="">Chọn phòng</option>
                  {destinationOptions.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                </select>
              </label>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px]">
                <label className="text-sm font-medium text-slate-700">Số lượng
                  <input
                    type="number"
                    min="1"
                    required
                    value={form.quantityRequested}
                    onChange={(event) => setForm((prev) => ({ ...prev, quantityRequested: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">Đơn vị
                  <select
                    value={form.quantityRequestedUnit}
                    onChange={(event) => setForm((prev) => ({ ...prev, quantityRequestedUnit: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                  >
                    <option value="RETAIL">{selected.retailUnit || selected.unit || 'đơn vị lẻ'}</option>
                    {Number(selected.wholesaleToRetailFactor ?? 1) > 1 && (
                      <option value="WHOLESALE">{selected.wholesaleUnit || selected.retailUnit || selected.unit || 'đơn vị sỉ'}</option>
                    )}
                  </select>
                </label>
                <p className="sm:col-span-2 -mt-1 text-xs text-slate-500">
                  Tồn hiện có: {selected.formattedAvailableQuantity || `${selected.availableQuantity} ${selected.retailUnit || selected.unit || ''}`}
                  {selected.formattedAvailableQuantityRetailOnly && selected.formattedAvailableQuantityRetailOnly !== selected.formattedAvailableQuantity
                    ? ` (${selected.formattedAvailableQuantityRetailOnly})`
                    : ''}
                </p>
                {getUnitBreakdownText(selected) && (
                  <p className="sm:col-span-2 -mt-1 text-xs font-medium text-orange-700">
                    {getUnitBreakdownText(selected)}
                  </p>
                )}
              </div>
              <label className="text-sm font-medium text-slate-700">Ngày cần
                <input
                  type="date"
                  min={today}
                  required
                  value={form.neededFrom}
                  onChange={(event) => setForm((prev) => ({ ...prev, neededFrom: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">Mục đích sử dụng
                <textarea
                  required
                  maxLength={1000}
                  value={form.purpose}
                  onChange={(event) => setForm((prev) => ({ ...prev, purpose: event.target.value }))}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">Ghi chú thêm
                <textarea
                  maxLength={4000}
                  value={form.message}
                  onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}
                  rows={2}
                  placeholder="Ví dụ: Cần cấp cho phòng họp trước 9 giờ sáng."
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setSelected(null)} className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600">Đóng</button>
              <button type="submit" disabled={!canSubmit || submitting} className="flex-1 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white disabled:bg-slate-300">
                {submitting ? 'Đang gửi...' : 'Gửi yêu cầu cấp phát'}
              </button>
            </div>
          </form>
        </ModalOverlay>
      )}
    </div>
  )
}

export default MobileConsumableRequests
