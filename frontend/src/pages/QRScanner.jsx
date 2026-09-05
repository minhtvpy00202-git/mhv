import { useEffect, useMemo, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'
import ModalOverlay from '../components/ui/ModalOverlay'
import SearchableSelect from '../components/ui/SearchableSelect'
import { useAuth } from '../context/AuthContext'
import { getTechnicalStatusLabel, getUsageStatusMeta } from '../utils/assetStatus'
import { parseSpecsToEntries } from '../utils/assetSpecs'
import { getFutureDateTimeLocalValue, toServerDateTimeValue } from '../utils/datetime'

const scannerElementId = 'qa-scanner'
const ASSET_PICKER_PAGE_SIZE = 8
const defaultAssetPickerFilters = {
  keyword: '',
  categoryId: '',
  locationId: '',
  usageStatus: '',
  technicalStatus: '',
}

function isItemizedCategory(category) {
  return String(category?.categoryKind || 'ITEMIZED').trim().toUpperCase() === 'ITEMIZED'
}

function getBadgeClassName(tone) {
  switch (tone) {
    case 'emerald':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'blue':
      return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'amber':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'red':
      return 'bg-rose-50 text-rose-700 border-rose-200'
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200'
  }
}

function QRScanner() {
  const { user } = useAuth()
  const scannerRef = useRef(null)
  const isScanningRef = useRef(false)
  const keepScannerAliveRef = useRef(true)
  const [scannedQaCode, setScannedQaCode] = useState('')
  const [scannedAssetName, setScannedAssetName] = useState('')
  const [scannedLocationId, setScannedLocationId] = useState(null)
  const [scannedHomeLocationId, setScannedHomeLocationId] = useState(null)
  const [scannedLocationName, setScannedLocationName] = useState('')
  const [scannedHomeLocationName, setScannedHomeLocationName] = useState('')
  const [scannedSpecs, setScannedSpecs] = useState([])
  const [showActionModal, setShowActionModal] = useState(false)
  const [toLocationId, setToLocationId] = useState('')
  const [locations, setLocations] = useState([])
  const [loadingAction, setLoadingAction] = useState(false)
  const [manualQaCode, setManualQaCode] = useState('')
  const [manualLookupLoading, setManualLookupLoading] = useState(false)
  const [startAt, setStartAt] = useState(() => getFutureDateTimeLocalValue(0))
  const [endAt, setEndAt] = useState(() => getFutureDateTimeLocalValue(24))
  const [purpose, setPurpose] = useState('')
  const [actionMode, setActionMode] = useState('AUTO')
  const [showAssetPickerModal, setShowAssetPickerModal] = useState(false)
  const [showAssetPickerAdvancedFilters, setShowAssetPickerAdvancedFilters] = useState(false)
  const [assetPickerLoading, setAssetPickerLoading] = useState(false)
  const [assetPickerItems, setAssetPickerItems] = useState([])
  const [assetPickerPageInfo, setAssetPickerPageInfo] = useState({
    page: 0,
    size: ASSET_PICKER_PAGE_SIZE,
    totalPages: 1,
    totalItems: 0,
  })
  const [assetPickerCategories, setAssetPickerCategories] = useState([])
  const [assetPickerLocations, setAssetPickerLocations] = useState([])
  const [assetPickerFilters, setAssetPickerFilters] = useState(defaultAssetPickerFilters)
  const [assetPickerDraftFilters, setAssetPickerDraftFilters] = useState(defaultAssetPickerFilters)
  const isAnyModalOpen = showActionModal || showAssetPickerModal

  useEffect(() => {
    if (!isAnyModalOpen && keepScannerAliveRef.current) {
      void startScanner()
    } else {
      void stopScanner()
    }
    void fetchLocations()
    const handleVisibilityChange = () => {
      if (document.hidden) {
        void stopScanner()
        return
      }
      if (!isAnyModalOpen && keepScannerAliveRef.current) {
        void startScanner()
      }
    }
    const handlePageHide = () => {
      void stopScanner()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', handlePageHide)
    return () => {
      keepScannerAliveRef.current = false
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', handlePageHide)
      void stopScanner()
    }
  }, [isAnyModalOpen])

  async function fetchLocations() {
    try {
      const response = await axiosClient.get('/api/inquiries/options')
      setLocations(response.data?.locations || [])
    } catch (error) {
      const message = error?.response?.data?.message || 'Không tải được danh sách phòng.'
      toast.error(message)
    }
  }

  const fetchAssetInfo = async (qaCode) => {
    try {
      const response = await axiosClient.get(`/api/assets/${qaCode}`)
      const asset = response.data || {}
      setScannedAssetName(asset.name || '')
      setScannedLocationId(asset.locationId || null)
      setScannedHomeLocationId(asset.homeLocationId || null)
      setScannedLocationName(asset.locationName || '')
      setScannedHomeLocationName(asset.homeLocationName || '')
      setScannedSpecs(parseSpecsToEntries(asset.specs))
      return asset
    } catch {
      setScannedAssetName('')
      setScannedLocationId(null)
      setScannedHomeLocationId(null)
      setScannedLocationName('')
      setScannedHomeLocationName('')
      setScannedSpecs([])
      toast.error('Mã tài sản không tồn tại')
      return null
    }
  }

  const isAssetBorrowed = (asset) => {
    const usageStatus = String(asset?.usageStatus || '').trim()
    const activeBorrowStatus = String(asset?.activeBorrowRequestStatus || '').trim()
    return usageStatus === 'Đang cho mượn' || activeBorrowStatus === 'CHECKED_OUT' || activeBorrowStatus === 'RETURN_PENDING'
  }

  const isBorrowedByCurrentUser = (asset) => {
    if (!isAssetBorrowed(asset)) return false
    return Number(asset?.activeBorrowRequesterId) > 0
      && Number(asset.activeBorrowRequesterId) === Number(user?.userId)
  }

  const extractQaCode = (decodedText) => {
    try {
      const parsed = JSON.parse(decodedText)
      if (parsed?.qa_code) {
        return String(parsed.qa_code).trim()
      }
    } catch {
      return decodedText.trim()
    }
    return decodedText.trim()
  }

  async function startScanner() {
    if (isScanningRef.current) return
    const scanner = new Html5Qrcode(scannerElementId)
    scannerRef.current = scanner
    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decodedText) => {
          const qaCode = extractQaCode(decodedText)
          if (!qaCode) return
          await stopScanner()
          const exists = await openActionModalByQaCode(qaCode)
          if (!exists) {
            startScanner()
            return
          }
        },
        () => {},
      )
      isScanningRef.current = true
    } catch {
      toast.error('Không thể mở camera. Vui lòng cấp quyền truy cập camera.')
    }
  }

  const openActionModalByQaCode = async (qaCode, options = {}) => {
    const normalizedQaCode = String(qaCode || '').trim()
    if (!normalizedQaCode) return false
    setScannedQaCode(normalizedQaCode)
    setManualQaCode(normalizedQaCode)
    const asset = await fetchAssetInfo(normalizedQaCode)
    if (!asset) {
      setScannedQaCode('')
      return false
    }
    setActionMode(options.actionMode === 'BORROW' ? 'BORROW' : 'AUTO')
    setShowActionModal(true)
    return true
  }

  async function stopScanner() {
    const scanner = scannerRef.current
    if (!scanner) return
    try {
      if (isScanningRef.current) {
        await scanner.stop()
      }
      await scanner.clear()
    } catch {
      return
    } finally {
      isScanningRef.current = false
      scannerRef.current = null
    }
  }

  const closeModal = () => {
    keepScannerAliveRef.current = true
    setShowActionModal(false)
    setScannedQaCode('')
    setScannedAssetName('')
    setScannedLocationId(null)
    setScannedHomeLocationId(null)
    setScannedLocationName('')
    setScannedHomeLocationName('')
    setScannedSpecs([])
    setToLocationId('')
    setStartAt(getFutureDateTimeLocalValue(0))
    setEndAt(getFutureDateTimeLocalValue(24))
    setPurpose('')
    setManualQaCode('')
    setActionMode('AUTO')
  }

  const buildAssetPickerParams = (page = 0, nextFilters = assetPickerFilters) => ({
    page,
    size: ASSET_PICKER_PAGE_SIZE,
    trackingMode: 'ITEMIZED',
    name: String(nextFilters.keyword || '').trim() || undefined,
    categoryId: nextFilters.categoryId ? Number(nextFilters.categoryId) : undefined,
    locationId: nextFilters.locationId ? Number(nextFilters.locationId) : undefined,
    usageStatus: nextFilters.usageStatus || undefined,
    technicalStatus: nextFilters.technicalStatus || undefined,
    sortKey: 'createdAt',
    sortDirection: 'desc',
  })

  const loadAssetPickerAssets = async (page = 0, nextFilters = assetPickerFilters) => {
    setAssetPickerLoading(true)
    try {
      const response = await axiosClient.get('/api/assets', {
        params: buildAssetPickerParams(page, nextFilters),
      })
      const data = response.data || {}
      setAssetPickerItems(data.items || [])
      setAssetPickerPageInfo({
        page: data.page ?? page,
        size: data.size ?? ASSET_PICKER_PAGE_SIZE,
        totalPages: data.totalPages || 1,
        totalItems: data.totalItems || 0,
      })
    } catch (error) {
      const message = error?.response?.data?.message || 'Không tải được danh sách tài sản.'
      toast.error(message)
    } finally {
      setAssetPickerLoading(false)
    }
  }

  const loadAssetPickerBootstrap = async (nextFilters = assetPickerFilters) => {
    setAssetPickerLoading(true)
    try {
      const response = await axiosClient.get('/api/assets/bootstrap', {
        params: buildAssetPickerParams(0, nextFilters),
      })
      const data = response.data || {}
      const assetPage = data.assets || {}
      setAssetPickerItems(assetPage.items || [])
      setAssetPickerPageInfo({
        page: assetPage.page ?? 0,
        size: assetPage.size ?? ASSET_PICKER_PAGE_SIZE,
        totalPages: assetPage.totalPages || 1,
        totalItems: assetPage.totalItems || 0,
      })
      setAssetPickerCategories((data.categories || []).filter(isItemizedCategory))
      setAssetPickerLocations(data.locations || [])
    } catch (error) {
      const message = error?.response?.data?.message || 'Không tải được danh sách tài sản.'
      toast.error(message)
    } finally {
      setAssetPickerLoading(false)
    }
  }

  const handleOpenAssetPicker = async () => {
    keepScannerAliveRef.current = false
    await stopScanner()
    setShowAssetPickerModal(true)
    if (assetPickerCategories.length === 0 && assetPickerLocations.length === 0 && assetPickerItems.length === 0) {
      await loadAssetPickerBootstrap(assetPickerFilters)
      return
    }
    await loadAssetPickerAssets(0, assetPickerFilters)
  }

  const handleCloseAssetPicker = () => {
    keepScannerAliveRef.current = true
    setShowAssetPickerModal(false)
  }

  const handleApplyAssetPickerFilters = async () => {
    setAssetPickerFilters(assetPickerDraftFilters)
    await loadAssetPickerAssets(0, assetPickerDraftFilters)
  }

  const handleResetAssetPickerFilters = async () => {
    setAssetPickerFilters(defaultAssetPickerFilters)
    setAssetPickerDraftFilters(defaultAssetPickerFilters)
    await loadAssetPickerAssets(0, defaultAssetPickerFilters)
  }

  const handleSelectAssetFromPicker = async (asset) => {
    if (isAssetBorrowed(asset)) {
      let latestAsset = asset
      try {
        const response = await axiosClient.get(`/api/assets/${asset?.qaCode}`)
        latestAsset = response.data || asset
      } catch (error) {
        const message = error?.response?.data?.message || 'Không kiểm tra được trạng thái mượn hiện tại của tài sản.'
        toast.error(message)
        return
      }

      if (!isBorrowedByCurrentUser(latestAsset)) {
        toast.info('Tài sản này hiện đang được cho mượn nên chưa thể gửi yêu cầu mượn mới.')
        return
      }
      keepScannerAliveRef.current = false
      setShowAssetPickerModal(false)
      const exists = await openActionModalByQaCode(latestAsset?.qaCode, { actionMode: 'AUTO' })
      if (!exists) {
        keepScannerAliveRef.current = true
        startScanner()
      }
      return
    }
    keepScannerAliveRef.current = false
    setShowAssetPickerModal(false)
    const exists = await openActionModalByQaCode(asset?.qaCode, { actionMode: 'BORROW' })
    if (!exists) {
      keepScannerAliveRef.current = true
      startScanner()
    }
  }

  const handleManualLookup = async () => {
    const normalizedQaCode = extractQaCode(manualQaCode)
    if (!normalizedQaCode) {
      toast.error('Vui lòng nhập mã QA của thiết bị.')
      return
    }
    setManualLookupLoading(true)
    keepScannerAliveRef.current = false
    await stopScanner()
    const exists = await openActionModalByQaCode(normalizedQaCode)
    if (!exists) {
      keepScannerAliveRef.current = true
      startScanner()
    }
    setManualLookupLoading(false)
  }

  const handleCheckout = async () => {
    if (!toLocationId) {
      toast.error('Vui lòng chọn phòng đích.')
      return
    }
    if (!startAt) {
      toast.error('Vui lòng chọn thời điểm bắt đầu mượn.')
      return
    }
    if (!endAt) {
      toast.error('Vui lòng chọn thời điểm hẹn trả.')
      return
    }
    if (endAt <= startAt) {
      toast.error('Thời điểm hẹn trả phải sau thời điểm bắt đầu mượn.')
      return
    }
    if (!purpose.trim()) {
      toast.error('Vui lòng nhập mục đích sử dụng thiết bị.')
      return
    }
    if (scannedLocationId !== null && Number(toLocationId) === Number(scannedLocationId)) {
      toast.error('Phòng đích không được trùng với phòng hiện tại của thiết bị.')
      return
    }
    setLoadingAction(true)
    try {
      await axiosClient.post('/api/borrow-requests', {
        assetQaCode: scannedQaCode,
        destinationLocationId: Number(toLocationId),
        startAt: toServerDateTimeValue(startAt),
        endAt: toServerDateTimeValue(endAt),
        purpose: purpose.trim(),
      })
      toast.success(`Đã gửi phiếu mượn${scannedAssetName ? ` cho ${scannedAssetName}` : ''}. Vui lòng chờ Admin duyệt giữ chỗ.`)
      closeModal()
    } catch (error) {
      const message = error?.response?.data?.message || 'Gửi phiếu mượn thiết bị thất bại.'
      toast.error(message)
    } finally {
      setLoadingAction(false)
    }
  }

  const handleCheckin = async () => {
    setLoadingAction(true)
    try {
      await axiosClient.post('/api/borrow-requests/request-return', {
        assetQaCode: scannedQaCode,
      })
      toast.success(`Đã gửi yêu cầu trả${scannedAssetName ? ` cho ${scannedAssetName}` : ''}. Vui lòng chờ Admin xác nhận.`)
      closeModal()
    } catch (error) {
      const message = error?.response?.data?.message || 'Gửi yêu cầu trả thiết bị thất bại.'
      toast.error(message)
    } finally {
      setLoadingAction(false)
    }
  }

  const canCheckout = scannedLocationId !== null && scannedHomeLocationId !== null
    ? Number(scannedLocationId) === Number(scannedHomeLocationId)
    : true
  const canCheckin = scannedLocationId !== null && scannedHomeLocationId !== null
    ? Number(scannedLocationId) !== Number(scannedHomeLocationId)
    : true
  const shouldForceBorrowMode = actionMode === 'BORROW'
  const showBorrowSection = shouldForceBorrowMode || canCheckout
  const showReturnSection = shouldForceBorrowMode ? false : canCheckin
  const hasActiveAssetPickerFilters = useMemo(
    () => Boolean(
      assetPickerFilters.keyword ||
      assetPickerFilters.categoryId ||
      assetPickerFilters.locationId ||
      assetPickerFilters.usageStatus ||
      assetPickerFilters.technicalStatus,
    ),
    [assetPickerFilters],
  )

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Quét QR để gửi yêu cầu mượn hoặc trả thiết bị</h2>
        <div id={scannerElementId} className="overflow-hidden rounded-xl border border-slate-200" />
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-800">Hoặc nhập tay mã QA</p>
          <p className="mt-1 text-xs text-slate-500">Dùng khi mã QR bị mờ, hỏng hoặc camera trên thiết bị không hoạt động.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={manualQaCode}
              onChange={(event) => setManualQaCode(event.target.value)}
              placeholder="Ví dụ: QA000123"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
            />
            <button
              type="button"
              onClick={() => {
                void handleManualLookup()
              }}
              disabled={manualLookupLoading}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {manualLookupLoading ? 'Đang kiểm tra...' : 'Tra cứu mã'}
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-800">Hoặc chọn từ danh sách tài sản cố định</p>
          <p className="mt-1 text-xs text-slate-500">Phù hợp khi bạn muốn tìm thiết bị theo tên, loại, vị trí hoặc trạng thái mượn.</p>
          <button
            type="button"
            onClick={() => {
              void handleOpenAssetPicker()
            }}
            className="mt-3 w-full rounded-lg border border-fptOrange px-4 py-2 text-sm font-semibold text-fptOrange hover:bg-orange-50"
          >
            Mở danh sách tài sản
          </button>
        </div>
      </div>

      {showAssetPickerModal && (
        <ModalOverlay className="bg-black/60 backdrop-blur-sm" zIndex={130}>
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-3xl bg-white">
            <div className="border-b border-slate-200 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-800">Danh sách tài sản cố định</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Chạm vào tài sản để mở nhanh phiếu mượn hoặc phiếu trả. Danh sách có hiển thị vị trí và trạng thái mượn hiện tại.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseAssetPicker}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Đóng
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Tìm nhanh
                  </label>
                  <input
                    type="text"
                    value={assetPickerDraftFilters.keyword}
                    onChange={(event) => setAssetPickerDraftFilters((prev) => ({ ...prev, keyword: event.target.value }))}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        void handleApplyAssetPickerFilters()
                      }
                    }}
                    placeholder="Tên tài sản, mã QA..."
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAssetPickerAdvancedFilters((value) => !value)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium ${showAssetPickerAdvancedFilters ? 'border-fptOrange bg-orange-50 text-fptOrangeDark' : 'border-slate-300 text-slate-600 hover:bg-slate-100'}`}
                  >
                    {showAssetPickerAdvancedFilters ? 'Ẩn bộ lọc nâng cao' : 'Bộ lọc nâng cao'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleApplyAssetPickerFilters()
                    }}
                    disabled={assetPickerLoading}
                    className="rounded-lg bg-fptOrange px-3 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark disabled:opacity-60"
                  >
                    Lọc danh sách
                  </button>
                  {hasActiveAssetPickerFilters && (
                    <button
                      type="button"
                      onClick={() => {
                        void handleResetAssetPickerFilters()
                      }}
                      disabled={assetPickerLoading}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60"
                    >
                      Xóa bộ lọc
                    </button>
                  )}
                </div>

                {showAssetPickerAdvancedFilters && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Loại thiết bị
                      </label>
                      <SearchableSelect
                        value={assetPickerDraftFilters.categoryId}
                        onChange={(nextValue) => setAssetPickerDraftFilters((prev) => ({ ...prev, categoryId: String(nextValue || '') }))}
                        options={assetPickerCategories}
                        getOptionValue={(category) => category.id}
                        getOptionLabel={(category) => category.name}
                        placeholder="Gõ để tìm loại"
                        emptyOptionLabel="Tất cả loại"
                        dropdownZIndex={150}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Vị trí hiện tại
                      </label>
                      <SearchableSelect
                        value={assetPickerDraftFilters.locationId}
                        onChange={(nextValue) => setAssetPickerDraftFilters((prev) => ({ ...prev, locationId: String(nextValue || '') }))}
                        options={assetPickerLocations}
                        getOptionValue={(location) => location.id}
                        getOptionLabel={(location) => location.roomName || location.name || `Phòng #${location.id}`}
                        placeholder="Gõ để tìm vị trí"
                        emptyOptionLabel="Tất cả vị trí"
                        dropdownZIndex={150}
                      />
                    </div>
                    <label className="text-sm font-medium text-slate-700">
                      Trạng thái sử dụng
                      <select
                        value={assetPickerDraftFilters.usageStatus}
                        onChange={(event) => setAssetPickerDraftFilters((prev) => ({ ...prev, usageStatus: event.target.value }))}
                        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
                      >
                        <option value="">Tất cả trạng thái mượn</option>
                        <option value="Tại vị trí gốc">Tại vị trí gốc</option>
                        <option value="Đang cho mượn">Đang cho mượn</option>
                      </select>
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      Tình trạng kỹ thuật
                      <select
                        value={assetPickerDraftFilters.technicalStatus}
                        onChange={(event) => setAssetPickerDraftFilters((prev) => ({ ...prev, technicalStatus: event.target.value }))}
                        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
                      >
                        <option value="">Tất cả tình trạng</option>
                        <option value="Hoạt động tốt">Hoạt động tốt</option>
                        <option value="Hỏng">Hỏng</option>
                        <option value="Thất lạc">Thất lạc</option>
                      </select>
                    </label>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Hiển thị {assetPickerItems.length} / {assetPickerPageInfo.totalItems} tài sản</span>
                <span>Trang {assetPickerPageInfo.page + 1} / {Math.max(assetPickerPageInfo.totalPages, 1)}</span>
              </div>

              <div className="space-y-3">
                {assetPickerLoading && (
                  <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                    Đang tải danh sách tài sản...
                  </div>
                )}

                {!assetPickerLoading && assetPickerItems.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                    Không có tài sản phù hợp với bộ lọc hiện tại.
                  </div>
                )}

                {!assetPickerLoading && assetPickerItems.map((asset) => {
                  const usageMeta = getUsageStatusMeta(asset.usageStatus)
                  const currentLocation = asset.locationName || 'Không xác định'
                  const homeLocation = asset.homeLocationName || 'Không xác định'
                  const borrowedByCurrentUser = isBorrowedByCurrentUser(asset)
                  const borrowedByAnotherUser = isAssetBorrowed(asset) && !borrowedByCurrentUser

                  return (
                    <button
                      key={asset.qaCode}
                      type="button"
                      onClick={() => {
                        void handleSelectAssetFromPicker(asset)
                      }}
                      className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-fptOrange hover:bg-orange-50/30"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{asset.name || asset.qaCode}</p>
                          <p className="mt-1 text-xs font-medium text-slate-500">QA: {asset.qaCode}</p>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getBadgeClassName(usageMeta.tone)}`}>
                          {usageMeta.label}
                        </span>
                      </div>
                      <div className="mt-3 space-y-1.5 text-sm text-slate-600">
                        <p>
                          <span className="font-medium text-slate-700">Vị trí hiện tại:</span> {currentLocation}
                        </p>
                        <p>
                          <span className="font-medium text-slate-700">Vị trí gốc:</span> {homeLocation}
                        </p>
                        <p>
                          <span className="font-medium text-slate-700">Tình trạng:</span> {getTechnicalStatusLabel(asset.technicalStatus || asset.status)}
                        </p>
                        {borrowedByCurrentUser && (
                          <p className="text-emerald-700">
                            Bạn đang là người mượn tài sản này. Chạm để mở yêu cầu trả.
                          </p>
                        )}
                        {borrowedByAnotherUser && (
                          <p className="text-amber-700">
                            Tài sản này đang được người khác mượn nên chưa thể gửi yêu cầu mượn mới.
                          </p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
              <button
                type="button"
                onClick={() => {
                  void loadAssetPickerAssets(Math.max(assetPickerPageInfo.page - 1, 0))
                }}
                disabled={assetPickerLoading || assetPickerPageInfo.page <= 0}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                Trang trước
              </button>
              <button
                type="button"
                onClick={() => {
                  void loadAssetPickerAssets(Math.min(assetPickerPageInfo.page + 1, Math.max(assetPickerPageInfo.totalPages - 1, 0)))
                }}
                disabled={assetPickerLoading || assetPickerPageInfo.page >= assetPickerPageInfo.totalPages - 1}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                Trang sau
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {showActionModal && (
        <div className="fixed inset-0 z-[1000] flex items-end justify-center overflow-y-auto bg-black/50 p-4 sm:items-center sm:p-6">
          <div className="flex max-h-[92vh] w-full max-w-md flex-col rounded-2xl bg-white p-4">
            <div className="overflow-y-auto pr-1">
            <h3 className="text-base font-semibold text-slate-800">{shouldForceBorrowMode ? 'Gửi yêu cầu mượn thiết bị' : 'Xác nhận thao tác thiết bị'}</h3>
            <p className="mt-1 text-sm text-slate-600">Mã QA: {scannedQaCode}</p>
            <p className="text-sm text-slate-600">Tên thiết bị: {scannedAssetName || 'Đang tải...'}</p>
            <p className="text-sm text-slate-600">Phòng hiện tại: {scannedLocationName || 'Không xác định'}</p>
            <p className="text-sm text-slate-600">Phòng gốc: {scannedHomeLocationName || 'Không xác định'}</p>
            {scannedSpecs.length > 0 && (
              <div className="mt-3 rounded-xl bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-700">Đặc tính kỹ thuật</p>
                <div className="mt-2 space-y-1 text-sm text-slate-600">
                  {scannedSpecs.map((entry) => (
                    <p key={`${entry.name}-${entry.value}`}>
                      <span className="font-medium text-slate-700">{entry.name}:</span> {entry.value}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {showBorrowSection && (
              <div className="mt-3 space-y-3">
                {shouldForceBorrowMode && !canCheckout && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                    Tài sản này hiện không ở vị trí gốc nên chưa thể gửi yêu cầu mượn mới.
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-slate-700">Phòng sử dụng</label>
                  <SearchableSelect
                    value={toLocationId}
                    onChange={(nextValue) => setToLocationId(String(nextValue || ''))}
                    options={locations}
                    placeholder="Gõ để tìm phòng, ví dụ: Hành lang 1"
                    emptyText="Không có phòng phù hợp."
                    getOptionValue={(location) => location.id}
                    getOptionLabel={(location) => location.roomName || location.name || `Phòng #${location.id}`}
                    getOptionSearchText={(location) => `${location.roomName || location.name || ''} ${location.description || ''}`}
                    dropdownZIndex={1100}
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-sm font-medium text-slate-700">
                    Bắt đầu mượn
                    <input
                      type="datetime-local"
                      value={startAt}
                      min={getFutureDateTimeLocalValue(0)}
                      onChange={(event) => setStartAt(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
                    />
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Hẹn trả
                    <input
                      type="datetime-local"
                      value={endAt}
                      min={startAt || getFutureDateTimeLocalValue(0)}
                      onChange={(event) => setEndAt(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
                    />
                  </label>
                </div>
                <label className="block text-sm font-medium text-slate-700">
                  Mục đích sử dụng
                  <textarea
                    rows={3}
                    value={purpose}
                    onChange={(event) => setPurpose(event.target.value)}
                    placeholder="Ví dụ: Mượn máy chiếu cho buổi họp phòng kinh doanh."
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
                  />
                </label>
              </div>
            )}
            </div>

            <div className={`mt-4 grid gap-2 ${showBorrowSection && showReturnSection ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {showBorrowSection && (
                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={loadingAction || (shouldForceBorrowMode && !canCheckout)}
                  className="rounded-lg bg-fptOrange px-3 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark disabled:opacity-60"
                >
                  Gửi yêu cầu mượn
                </button>
              )}
              {showReturnSection && (
                <button
                  type="button"
                  onClick={handleCheckin}
                  disabled={loadingAction}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  Gửi yêu cầu trả
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={closeModal}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default QRScanner
