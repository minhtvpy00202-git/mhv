import {
  IconAdjustmentsHorizontal as Filters,
  IconPackage as Package,
  IconQrcode as QrCode,
  IconSearch as Search,
} from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'
import ModalOverlay from '../components/ui/ModalOverlay'

const today = new Date().toISOString().slice(0, 10)
const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
const PAGE_SIZE = 8

function MobileInquiries() {
  const [searchParams] = useSearchParams()
  const requestedQaCode = (searchParams.get('qaCode') || '').trim()
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [locations, setLocations] = useState([])
  const [keyword, setKeyword] = useState(requestedQaCode)
  const [trackingMode, setTrackingMode] = useState(requestedQaCode ? '' : 'ITEMIZED')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [categoryId, setCategoryId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [availability, setAvailability] = useState('')
  const [minQuantity, setMinQuantity] = useState('')
  const [sortOrder, setSortOrder] = useState('name')
  const [currentPage, setCurrentPage] = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
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
        params: {
          keyword: keyword.trim() || undefined,
          trackingMode: trackingMode || undefined,
          categoryId: categoryId || undefined,
          locationId: locationId || undefined,
          availability: availability || undefined,
          minQuantity: trackingMode === 'CONSUMABLE' && minQuantity ? Number(minQuantity) : undefined,
          sort: sortOrder,
          page: currentPage,
          size: PAGE_SIZE,
        },
      })
      const pageData = response.data || {}
      const nextItems = Array.isArray(pageData) ? pageData : (pageData.items || [])
      setItems(nextItems)
      setCurrentPage(Array.isArray(pageData) ? 0 : (pageData.page || 0))
      setTotalElements(Array.isArray(pageData) ? nextItems.length : (pageData.totalElements || 0))
      setTotalPages(Array.isArray(pageData) ? (nextItems.length ? 1 : 0) : (pageData.totalPages || 0))
      if (requestedQaCode) {
        const matched = nextItems.find((item) => item.assetQaCode?.toLowerCase() === requestedQaCode.toLowerCase())
        if (matched) {
          setTrackingMode(matched.trackingMode)
          setSelected(matched)
        }
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Không tải được danh sách thiết bị và vật tư.')
    } finally {
      setLoading(false)
    }
  }, [availability, categoryId, currentPage, keyword, locationId, minQuantity, requestedQaCode, sortOrder, trackingMode])

  useEffect(() => {
    const bootstrap = window.setTimeout(() => {
      void axiosClient.get('/api/inquiries/options').then((response) => {
        setCategories(response.data?.categories || [])
        setLocations(response.data?.locations || [])
      })
    }, 0)
    return () => window.clearTimeout(bootstrap)
  }, [])

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
  const categoryOptions = categories.filter((category) => (category.categoryKind || 'ITEMIZED') === (trackingMode === 'CONSUMABLE' ? 'CONSUMABLE' : 'ITEMIZED'))
  const locationOptions = trackingMode === 'CONSUMABLE' ? locations.filter((location) => location.storageWarehouse) : locations
  const activeFilterCount = Number(Boolean(categoryId)) + Number(Boolean(locationId)) + Number(Boolean(availability)) + Number(Boolean(trackingMode === 'CONSUMABLE' && minQuantity)) + Number(sortOrder !== 'name')
  const selectedCategoryName = categories.find((category) => String(category.id) === String(categoryId))?.name
  const selectedLocationName = locations.find((location) => String(location.id) === String(locationId))?.name
  const availabilityLabel = {
    AVAILABLE: 'Có thể mượn', BORROWED: 'Đang được mượn', RESERVED: 'Đã giữ chỗ', REPAIRING: 'Đang sửa chữa',
    IN_STOCK: 'Còn hàng', LOW_STOCK: 'Sắp hết', OUT_OF_STOCK: 'Hết hàng',
  }[availability]

  const resetFilters = () => {
    setCategoryId('')
    setLocationId('')
    setAvailability('')
    setMinQuantity('')
    setSortOrder('name')
    setCurrentPage(0)
  }

  const changeTrackingMode = (nextMode) => {
    setTrackingMode(nextMode)
    setSelected(null)
    resetFilters()
    setFiltersOpen(false)
    setCurrentPage(0)
  }

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
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/75">Tạo yêu cầu mới</p>
            <h2 className="mt-2 text-lg font-bold leading-7 min-[360px]:text-xl">{trackingMode === 'CONSUMABLE' ? 'Cấp phát vật tư' : 'Mượn thiết bị'}</h2>
            <p className="mt-2 text-sm leading-6 text-white/85">Kiểm tra tình trạng và gửi yêu cầu đến bộ phận phụ trách.</p>
          </div>
          <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/20">
            <Package size={24} className="text-white/90" />
          </span>
        </div>
      </section>

      <section className="min-w-0 overflow-hidden rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 grid grid-cols-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          <button type="button" onClick={() => changeTrackingMode('ITEMIZED')} className={`rounded-lg px-2 py-2.5 text-xs font-semibold transition min-[360px]:text-sm ${trackingMode === 'ITEMIZED' ? 'bg-white text-orange-600 shadow-sm dark:bg-slate-700 dark:text-orange-300' : 'text-slate-500 dark:text-slate-400'}`}>Mượn thiết bị</button>
          <button type="button" onClick={() => changeTrackingMode('CONSUMABLE')} className={`rounded-lg px-2 py-2.5 text-xs font-semibold transition min-[360px]:text-sm ${trackingMode === 'CONSUMABLE' ? 'bg-white text-orange-600 shadow-sm dark:bg-slate-700 dark:text-orange-300' : 'text-slate-500 dark:text-slate-400'}`}>Cấp phát vật tư</button>
        </div>
        <div className="flex items-center justify-between gap-2">
          <h3 className="min-w-0 text-sm font-bold text-slate-800 dark:text-slate-100 min-[360px]:text-base">{trackingMode === 'CONSUMABLE' ? 'Tìm vật tư' : 'Tìm thiết bị'}</h3>
          <Link to="/mobile/scan?mode=inquiry" aria-label="Quét mã QR" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 px-2.5 text-xs font-semibold text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300">
            <QrCode size={15} /> <span className="hidden min-[340px]:inline">Quét QR</span>
          </Link>
        </div>
        <div className="relative mt-3 min-w-0">
          <label className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-3 pr-12 focus-within:border-orange-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-orange-100 dark:border-slate-700 dark:bg-slate-950 dark:focus-within:ring-orange-500/10">
            <Search size={17} className="text-slate-400" />
            <input value={keyword} onChange={(event) => { setKeyword(event.target.value); setCurrentPage(0) }} placeholder={trackingMode === 'CONSUMABLE' ? 'Tên, mã QA, loại hoặc kho' : 'Tên, mã QA, loại hoặc phòng'} className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100" />
          </label>
          <button type="button" onClick={() => setFiltersOpen((current) => !current)} aria-label="Mở bộ lọc" className={`absolute right-1.5 top-1/2 inline-flex h-8 min-w-8 -translate-y-1/2 items-center justify-center gap-1 rounded-lg px-2 ${filtersOpen || activeFilterCount ? 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-300' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
            <Filters size={17} />
            {activeFilterCount > 0 && <span className="text-[10px] font-bold">{activeFilterCount}</span>}
          </button>
        </div>

        {filtersOpen && (
          <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Danh mục
              <select value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setCurrentPage(0) }} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal dark:border-slate-700 dark:bg-slate-900">
                <option value="">Tất cả danh mục</option>
                {categoryOptions.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">{trackingMode === 'CONSUMABLE' ? 'Kho' : 'Vị trí hiện tại'}
              <select value={locationId} onChange={(event) => { setLocationId(event.target.value); setCurrentPage(0) }} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal dark:border-slate-700 dark:bg-slate-900">
                <option value="">{trackingMode === 'CONSUMABLE' ? 'Tất cả kho' : 'Tất cả vị trí'}</option>
                {locationOptions.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Tình trạng
              <select value={availability} onChange={(event) => { setAvailability(event.target.value); setCurrentPage(0) }} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal dark:border-slate-700 dark:bg-slate-900">
                <option value="">Tất cả tình trạng</option>
                {trackingMode === 'CONSUMABLE' ? <><option value="IN_STOCK">Còn hàng</option><option value="LOW_STOCK">Sắp hết</option><option value="OUT_OF_STOCK">Hết hàng</option></> : <><option value="AVAILABLE">Có thể mượn</option><option value="BORROWED">Đang được mượn</option><option value="RESERVED">Đã được giữ chỗ</option><option value="REPAIRING">Đang hỏng hoặc sửa chữa</option></>}
              </select>
            </label>
            {trackingMode === 'CONSUMABLE' && <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Số lượng khả dụng tối thiểu
              <input type="number" min="0" value={minQuantity} onChange={(event) => { setMinQuantity(event.target.value); setCurrentPage(0) }} placeholder="Ví dụ: 10" className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal dark:border-slate-700 dark:bg-slate-900" />
            </label>}
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Sắp xếp
              <select value={sortOrder} onChange={(event) => { setSortOrder(event.target.value); setCurrentPage(0) }} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal dark:border-slate-700 dark:bg-slate-900">
                <option value="name">Tên A–Z</option>
                <option value="availability">Khả dụng trước</option>
                {trackingMode === 'CONSUMABLE' && <option value="quantity_desc">Tồn kho nhiều nhất</option>}
              </select>
            </label>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500">{totalElements} kết quả</span>
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
        {activeFilterCount > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {categoryId && <button type="button" onClick={() => { setCategoryId(''); setCurrentPage(0) }} className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">{selectedCategoryName} ×</button>}
            {locationId && <button type="button" onClick={() => { setLocationId(''); setCurrentPage(0) }} className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">{selectedLocationName} ×</button>}
            {availability && <button type="button" onClick={() => { setAvailability(''); setCurrentPage(0) }} className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">{availabilityLabel} ×</button>}
            {trackingMode === 'CONSUMABLE' && minQuantity && <button type="button" onClick={() => { setMinQuantity(''); setCurrentPage(0) }} className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">Tối thiểu {minQuantity} ×</button>}
            {sortOrder !== 'name' && <button type="button" onClick={() => { setSortOrder('name'); setCurrentPage(0) }} className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">{sortOrder === 'quantity_desc' ? 'Tồn kho nhiều nhất' : 'Khả dụng trước'} ×</button>}
            <button type="button" onClick={resetFilters} className="ml-auto text-[11px] font-semibold text-slate-500 underline decoration-dotted underline-offset-2">Xóa tất cả</button>
          </div>
        )}
        <div className="mt-4 min-w-0 space-y-2">
          {loading && <p aria-live="polite" className="animate-pulse rounded-xl bg-slate-50 p-3 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">Đang tìm...</p>}
          {!loading && items.length === 0 && <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">Không tìm thấy dữ liệu phù hợp.</p>}
          {!loading && items.map((item) => (
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
          {!loading && totalPages > 1 && (
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 pt-2">
              <button type="button" disabled={currentPage === 0} onClick={() => setCurrentPage((page) => Math.max(0, page - 1))} className="rounded-xl border border-slate-300 px-2 py-2.5 text-xs font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300">← Trang trước</button>
              <span className="px-1 text-center text-xs font-semibold text-slate-500">{currentPage + 1}/{totalPages}</span>
              <button type="button" disabled={currentPage >= totalPages - 1} onClick={() => setCurrentPage((page) => Math.min(totalPages - 1, page + 1))} className="rounded-xl border border-slate-300 px-2 py-2.5 text-xs font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300">Trang sau →</button>
            </div>
          )}
          {!loading && totalElements > 0 && <p className="text-center text-[11px] text-slate-400">Hiển thị {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, totalElements)} trong {totalElements} kết quả</p>}
        </div>
      </section>

      {selected && (
        <ModalOverlay className="bg-slate-950/60 p-3 backdrop-blur-sm" zIndex={120}>
        <form onSubmit={handleCreate} className="mt-auto max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-[26px] border border-orange-200 bg-white p-4 shadow-2xl dark:border-orange-500/30 dark:bg-slate-900 sm:my-auto sm:rounded-[26px]">
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
        </ModalOverlay>
      )}

    </div>
  )
}

export default MobileInquiries
