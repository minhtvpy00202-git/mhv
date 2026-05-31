import {
  IconAlertTriangle as AlertTriangle,
  IconBoxMultiple as Boxes,
  IconCheck as Check,
  IconChevronDown as ChevronDown,
  IconChevronRight as ChevronRight,
  IconDownload as Download,
  IconFileDescription as Detail,
  IconHistory as History,
  IconPackage as Package,
  IconPackageImport as PackagePlus,
  IconPlus as Plus,
  IconQrcode as QrCode,
  IconRefresh as RefreshCw,
  IconSearch as Search,
  IconSend as Send,
  IconTool as Wrench,
  IconTrash as Trash2,
  IconX as X,
} from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'react-toastify'
import axiosClient from '../../api/axiosClient'
import AssetRepairTimelineModal from '../../components/AssetRepairTimelineModal'
import ActionIconButton from '../../components/ui/ActionIconButton'
import { useAuth } from '../../context/AuthContext'
import { mergeSpecEntries, normalizeSpecTemplates, parseSpecsToEntries, stringifySpecs } from '../../utils/assetSpecs'
import {
  getAssetStatusLabel,
  getTechnicalStatusLabel,
  getUsageStatusLabel,
  itemizedStatusOptions,
  technicalStatusOptions,
  usageStatusOptions,
} from '../../utils/assetStatus'
import { formatVietnamDate, formatVietnamDateTime } from '../../utils/datetime'
import { validateAssetForm, validateSupplierForm } from '../../utils/validation'

const consumableStatusOptions = ['Còn hàng', 'Cần nhập']
const managementTabs = [
  {
    value: 'ITEMIZED',
    label: 'Tài sản cố định',
    description: 'Quản lý từng thiết bị riêng lẻ, có QR, bảo hành, lịch sử sửa chữa và mượn trả.',
  },
  {
    value: 'CONSUMABLE',
    label: 'Vật tư tiêu hao',
    description: 'Quản lý theo số lượng tồn kho, đơn giá và các lần cấp phát cho phòng ban.',
  },
]
const PAGE_SIZE = 10
const defaultPageInfo = {
  page: 0,
  size: PAGE_SIZE,
  totalPages: 1,
  totalItems: 0,
}
const defaultConsumableStatusCounts = {
  all: 0,
  healthy: 0,
  restock: 0,
}
const defaultSortState = {
  key: 'qaCode',
  direction: 'asc',
}

function getCategoryLabel(category) {
  return category?.description || category?.name || ''
}

function getSupplierLabel(supplier) {
  return supplier?.name || ''
}

function formatCurrency(value) {
  if (value == null || value === '') return 'Chưa cập nhật'
  const numericValue = Number(value)
  if (Number.isNaN(numericValue)) return String(value)
  return `${numericValue.toLocaleString('vi-VN')} VND`
}

function normalizePurchasePriceInput(value) {
  return String(value || '').replace(/\D/g, '')
}

function formatPurchasePriceInput(value) {
  const normalizedValue = normalizePurchasePriceInput(value)
  if (!normalizedValue) return ''
  return normalizedValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function formatDate(value) {
  return formatVietnamDate(value, 'Chưa cập nhật')
}

function formatDateTime(value) {
  return formatVietnamDateTime(value, 'Chưa cập nhật')
}

function getActorName(stock) {
  return stock?.lastUpdatedByFullName || stock?.lastUpdatedByUsername || 'Chưa cập nhật'
}

function getTrackingModeLabel(value) {
  return value === 'CONSUMABLE' ? 'Tiêu hao' : 'Cố định'
}

function isConsumableMode(value) {
  return String(value || 'ITEMIZED').trim().toUpperCase() === 'CONSUMABLE'
}

function normalizeCategoryKind(value) {
  return String(value || 'ITEMIZED').trim().toUpperCase() === 'CONSUMABLE' ? 'CONSUMABLE' : 'ITEMIZED'
}

function categoryMatchesTrackingMode(category, trackingMode) {
  const categoryKind = normalizeCategoryKind(category?.categoryKind)
  return isConsumableMode(trackingMode) ? categoryKind === 'CONSUMABLE' : categoryKind === 'ITEMIZED'
}

function calculateInventoryValue(asset) {
  const unitPrice = Number(asset?.purchasePrice)
  if (Number.isNaN(unitPrice) || unitPrice <= 0) return null
  const quantityOnHand = Number(asset?.quantityOnHand ?? 0)
  if (Number.isNaN(quantityOnHand) || quantityOnHand < 0) return null
  return unitPrice * quantityOnHand
}

function getConsumableInventoryState(asset) {
  const quantityOnHand = Number(asset?.quantityOnHand ?? 0)
  const minimumStock = Number(asset?.minimumStock ?? 0)
  if (Number.isNaN(quantityOnHand)) {
    return { queryStatus: 'Cần nhập', label: 'Cần nhập', tone: 'red' }
  }
  if (!Number.isNaN(minimumStock) && minimumStock > 0 && quantityOnHand <= minimumStock) {
    return { queryStatus: 'Cần nhập', label: 'Cần nhập', tone: quantityOnHand <= 0 ? 'red' : 'amber' }
  }
  return { queryStatus: 'Còn hàng', label: 'Đủ dùng', tone: 'emerald' }
}

function getStatusBadgeClass(tone) {
  if (tone === 'slate') return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'
  if (tone === 'red') return 'bg-red-100 text-red-700 ring-1 ring-red-200'
  if (tone === 'amber') return 'bg-amber-100 text-amber-700 ring-1 ring-amber-200'
  return 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200'
}

function parseDateOnly(value) {
  const raw = String(value || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  const [year, month, day] = raw.split('-').map(Number)
  const parsed = new Date(year, month - 1, day)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function getConsumableExpiryState(asset) {
  if (!asset?.expiryTrackingEnabled) {
    return {
      label: 'Không quản lý',
      tone: 'slate',
      dateLabel: 'Không áp dụng',
    }
  }
  if (!asset?.expirationDate) {
    return {
      label: 'Chưa cập nhật',
      tone: 'amber',
      dateLabel: 'Chưa cập nhật',
    }
  }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expirationDate = parseDateOnly(asset.expirationDate)
  if (!expirationDate) {
    return {
      label: 'Chưa cập nhật',
      tone: 'amber',
      dateLabel: 'Chưa cập nhật',
    }
  }
  const diffDays = Math.round((expirationDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
  if (diffDays < 0) {
    return {
      label: 'Đã hết hạn',
      tone: 'red',
      dateLabel: formatDate(asset.expirationDate),
    }
  }
  if (diffDays === 0) {
    return {
      label: 'Hết hạn hôm nay',
      tone: 'red',
      dateLabel: formatDate(asset.expirationDate),
    }
  }
  if (diffDays <= 30) {
    return {
      label: 'Sắp hết hạn',
      tone: 'amber',
      dateLabel: formatDate(asset.expirationDate),
    }
  }
  return {
    label: 'Còn hạn',
    tone: 'emerald',
    dateLabel: formatDate(asset.expirationDate),
  }
}

function getConsumableExpiryGroupKey(expirationDate) {
  return expirationDate || '__NO_EXPIRY__'
}

function buildConsumableExpiryGroups(asset, detail) {
  const receiptLots = Array.isArray(detail?.receiptLots) ? detail.receiptLots : []
  const activeLots = receiptLots.filter((lot) => Number(lot?.quantityRemaining ?? 0) > 0)

  if (activeLots.length === 0) {
    return [
      {
        key: `${asset.qaCode}-fallback`,
        expirationDate: asset?.expiryTrackingEnabled ? (asset.expirationDate || null) : null,
        quantityOnHand: Number(asset?.quantityOnHand ?? 0),
        purchasePrice: asset?.purchasePrice ?? null,
        lotCount: 0,
      },
    ]
  }

  const groupedMap = new Map()
  activeLots.forEach((lot) => {
    const expirationDate = asset?.expiryTrackingEnabled ? (lot.expirationDate || null) : null
    const groupKey = getConsumableExpiryGroupKey(expirationDate)
    const quantityRemaining = Number(lot?.quantityRemaining ?? 0)
    const unitPrice = Number(lot?.unitPrice ?? 0)
    const existingGroup = groupedMap.get(groupKey) || {
      key: `${asset.qaCode}-${groupKey}`,
      expirationDate,
      quantityOnHand: 0,
      totalValue: 0,
      lotCount: 0,
    }
    existingGroup.quantityOnHand += Number.isNaN(quantityRemaining) ? 0 : quantityRemaining
    existingGroup.totalValue += Number.isNaN(quantityRemaining) || Number.isNaN(unitPrice) ? 0 : quantityRemaining * unitPrice
    existingGroup.lotCount += 1
    groupedMap.set(groupKey, existingGroup)
  })

  return Array.from(groupedMap.values())
    .map((group) => ({
      key: group.key,
      expirationDate: group.expirationDate,
      quantityOnHand: group.quantityOnHand,
      purchasePrice: group.quantityOnHand > 0 ? group.totalValue / group.quantityOnHand : null,
      lotCount: group.lotCount,
    }))
    .sort((left, right) => {
      const leftDate = parseDateOnly(left.expirationDate)
      const rightDate = parseDateOnly(right.expirationDate)
      if (!leftDate && !rightDate) return 0
      if (!leftDate) return 1
      if (!rightDate) return -1
      return leftDate.getTime() - rightDate.getTime()
    })
}

function getConsumableRequestStatusMeta(status) {
  const normalizedStatus = String(status || 'PENDING').trim().toUpperCase()
  if (normalizedStatus === 'APPROVED') {
    return {
      label: 'Đã cấp phát',
      className: 'bg-emerald-100 text-emerald-700',
    }
  }
  if (normalizedStatus === 'REJECTED') {
    return {
      label: 'Từ chối',
      className: 'bg-red-100 text-red-700',
    }
  }
  return {
    label: 'Chờ duyệt',
    className: 'bg-amber-100 text-amber-700',
  }
}

function getConsumableDisposalStatusMeta(status) {
  const normalizedStatus = String(status || 'PENDING').trim().toUpperCase()
  if (normalizedStatus === 'APPROVED') {
    return {
      label: 'Đã tiêu huỷ',
      className: 'bg-emerald-100 text-emerald-700',
    }
  }
  if (normalizedStatus === 'REJECTED') {
    return {
      label: 'Từ chối',
      className: 'bg-red-100 text-red-700',
    }
  }
  return {
    label: 'Chờ duyệt',
    className: 'bg-amber-100 text-amber-700',
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function getFieldClass(hasError) {
  return `w-full rounded-lg border px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2 ${hasError ? 'border-red-400 bg-red-50' : 'border-slate-300'}`
}

function AssetManagement({ restrictToConsumable = false }) {
  const specEntryIdRef = useRef(0)
  const { user } = useAuth()
  const [assets, setAssets] = useState([])
  const [locations, setLocations] = useState([])
  const [categories, setCategories] = useState([])
  const [categoryDetailsById, setCategoryDetailsById] = useState({})
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [qrImage, setQrImage] = useState('')
  const [qrModalImage, setQrModalImage] = useState('')
  const [qrModalQaCode, setQrModalQaCode] = useState('')
  const [showQrModal, setShowQrModal] = useState(false)
  const [qrModalLoading, setQrModalLoading] = useState(false)
  const [showTimelineModal, setShowTimelineModal] = useState(false)
  const [timelineAsset, setTimelineAsset] = useState(null)
  const [showFormModal, setShowFormModal] = useState(false)
  const [showSpecsModal, setShowSpecsModal] = useState(false)
  const [selectedSpecsAsset, setSelectedSpecsAsset] = useState(null)
  const [showOriginModal, setShowOriginModal] = useState(false)
  const [selectedOriginAsset, setSelectedOriginAsset] = useState(null)
  const [showIssueModal, setShowIssueModal] = useState(false)
  const [selectedIssueAsset, setSelectedIssueAsset] = useState(null)
  const [issueSubmitting, setIssueSubmitting] = useState(false)
  const [showReceiveModal, setShowReceiveModal] = useState(false)
  const [selectedReceiveAsset, setSelectedReceiveAsset] = useState(null)
  const [receiveSubmitting, setReceiveSubmitting] = useState(false)
  const [receiveForm, setReceiveForm] = useState({
    quantity: '',
    unitPrice: '',
    supplierId: '',
    lotCode: '',
    receivedDate: '',
    expirationDate: '',
    note: '',
  })
  const [issueHistoryLoading, setIssueHistoryLoading] = useState(false)
  const [issueHistory, setIssueHistory] = useState([])
  const [issueLocationStocks, setIssueLocationStocks] = useState([])
  const [issueForm, setIssueForm] = useState({
    issuedToLocationId: '',
    quantity: '',
    note: '',
  })
  const [showLocationOverviewModal, setShowLocationOverviewModal] = useState(false)
  const [selectedOverviewLocationId, setSelectedOverviewLocationId] = useState('')
  const [locationOverviewLoading, setLocationOverviewLoading] = useState(false)
  const [locationOverview, setLocationOverview] = useState(null)
  const [showLocationIssueHistory, setShowLocationIssueHistory] = useState(false)
  const [showConsumableRequestModal, setShowConsumableRequestModal] = useState(false)
  const [consumableRequestSubmitting, setConsumableRequestSubmitting] = useState(false)
  const [selectedRequestAssetQaCode, setSelectedRequestAssetQaCode] = useState('')
  const [consumableRequestForm, setConsumableRequestForm] = useState({
    assetQaCode: '',
    quantityRequested: '',
    reason: '',
  })
  const [pendingConsumableRequests, setPendingConsumableRequests] = useState([])
  const [pendingConsumableRequestsLoading, setPendingConsumableRequestsLoading] = useState(false)
  const [showConsumableDecisionModal, setShowConsumableDecisionModal] = useState(false)
  const [consumableDecisionSubmitting, setConsumableDecisionSubmitting] = useState(false)
  const [selectedConsumableRequest, setSelectedConsumableRequest] = useState(null)
  const [consumableDecisionAction, setConsumableDecisionAction] = useState('APPROVE')
  const [consumableDecisionNote, setConsumableDecisionNote] = useState('')
  const [expiredLots, setExpiredLots] = useState([])
  const [expiredLotsLoading, setExpiredLotsLoading] = useState(false)
  const [showDisposalRequestModal, setShowDisposalRequestModal] = useState(false)
  const [selectedExpiredLot, setSelectedExpiredLot] = useState(null)
  const [disposalRequestForm, setDisposalRequestForm] = useState({
    reason: 'Do hết hạn sử dụng.',
    items: [],
  })
  const [disposalRequestSubmitting, setDisposalRequestSubmitting] = useState(false)
  const [disposalRequests, setDisposalRequests] = useState([])
  const [disposalRequestsLoading, setDisposalRequestsLoading] = useState(false)
  const [disposalHistoryFilters, setDisposalHistoryFilters] = useState({
    status: '',
    keyword: '',
  })
  const [pendingDisposalRequests, setPendingDisposalRequests] = useState([])
  const [pendingDisposalRequestsLoading, setPendingDisposalRequestsLoading] = useState(false)
  const [showDisposalDecisionModal, setShowDisposalDecisionModal] = useState(false)
  const [selectedDisposalRequest, setSelectedDisposalRequest] = useState(null)
  const [disposalDecisionAction, setDisposalDecisionAction] = useState('APPROVE')
  const [disposalDecisionNote, setDisposalDecisionNote] = useState('')
  const [disposalDecisionSubmitting, setDisposalDecisionSubmitting] = useState(false)
  const [downloadingDisposalRequestId, setDownloadingDisposalRequestId] = useState(null)
  const [selectedDisposalHistoryRequest, setSelectedDisposalHistoryRequest] = useState(null)
  const [showStockAdjustModal, setShowStockAdjustModal] = useState(false)
  const [selectedStockRecord, setSelectedStockRecord] = useState(null)
  const [stockAdjustSubmitting, setStockAdjustSubmitting] = useState(false)
  const [stockAdjustForm, setStockAdjustForm] = useState({
    quantityRemaining: '',
    note: '',
  })
  const [formMode, setFormMode] = useState('create')
  const [selectedQaCode, setSelectedQaCode] = useState(null)
  const [showCategoryFilterOptions, setShowCategoryFilterOptions] = useState(false)
  const [showSupplierOptions, setShowSupplierOptions] = useState(false)
  const [supplierKeyword, setSupplierKeyword] = useState('')
  const [showSupplierCreateModal, setShowSupplierCreateModal] = useState(false)
  const [creatingSupplier, setCreatingSupplier] = useState(false)
  const [supplierForm, setSupplierForm] = useState({ name: '', address: '', phoneNumber: '' })
  const [supplierFormErrors, setSupplierFormErrors] = useState({})
  const [activeTab, setActiveTab] = useState(restrictToConsumable ? 'CONSUMABLE' : 'ITEMIZED')
  const [consumableWorkspace, setConsumableWorkspace] = useState('OVERVIEW')
  const [showConsumableOverviewSummary, setShowConsumableOverviewSummary] = useState(false)
  const [showExpiredLotsSummary, setShowExpiredLotsSummary] = useState(false)
  const [roomSearchKeyword, setRoomSearchKeyword] = useState('')
  const [pageInfo, setPageInfo] = useState(defaultPageInfo)
  const [consumableStatusCounts, setConsumableStatusCounts] = useState(defaultConsumableStatusCounts)
  const [sortState, setSortState] = useState(defaultSortState)
  const [filters, setFilters] = useState({
    name: '',
    status: '',
    trackingMode: restrictToConsumable ? 'CONSUMABLE' : 'ITEMIZED',
    categoryId: '',
    locationId: '',
    categoryKeyword: '',
  })
  const [form, setForm] = useState({
    trackingMode: restrictToConsumable ? 'CONSUMABLE' : 'ITEMIZED',
    name: '',
    categoryId: '',
    locationId: '',
    technicalStatus: 'Hoạt động tốt',
    usageStatus: 'Tại vị trí gốc',
    supplierId: '',
    purchasePrice: '',
    purchaseDate: '',
    warrantyExpirationDate: '',
    expiryTrackingEnabled: false,
    expirationDate: '',
    quantityOnHand: '',
    minimumStock: '',
    unit: '',
    specEntries: [],
  })
  const [formErrors, setFormErrors] = useState({})
  const [assetDetailsByQaCode, setAssetDetailsByQaCode] = useState({})
  const activeTrackingMode = activeTab
  const isConsumableTab = isConsumableMode(activeTrackingMode)
  const isAdmin = user?.role === 'Admin'
  const isConsumableManager = user?.role === 'ConsumableManager'

  const filteredCategoryOptions = useMemo(() => {
    const keyword = filters.categoryKeyword.trim().toLowerCase()
    const matchingCategories = categories.filter((category) => categoryMatchesTrackingMode(category, activeTrackingMode))
    if (!keyword) return matchingCategories
    return matchingCategories.filter((category) => getCategoryLabel(category).toLowerCase().includes(keyword))
  }, [activeTrackingMode, categories, filters.categoryKeyword])
  const formCategoryOptions = useMemo(
    () => categories.filter((category) => categoryMatchesTrackingMode(category, form.trackingMode)),
    [categories, form.trackingMode],
  )
  const consumableStorageLocation = useMemo(
    () => locations.find((location) => String(location?.roomName || '').trim().toLowerCase() === 'kho') || null,
    [locations],
  )

  const filteredSupplierOptions = useMemo(() => {
    const keyword = supplierKeyword.trim().toLowerCase()
    if (!keyword) return suppliers
    return suppliers.filter((supplier) => getSupplierLabel(supplier).toLowerCase().includes(keyword))
  }, [supplierKeyword, suppliers])

  const selectedSpecsEntries = useMemo(() => parseSpecsToEntries(selectedSpecsAsset?.specs), [selectedSpecsAsset])
  const isEditing = formMode === 'update' && Boolean(selectedQaCode)
  const isConsumableForm = isConsumableMode(form.trackingMode)
  const consumableSummary = useMemo(() => {
    const summary = assets.reduce(
      (accumulator, asset) => {
        const inventoryValue = calculateInventoryValue(asset) || 0
        const stockState = getConsumableInventoryState(asset)
        accumulator.totalInventoryValue += inventoryValue
        if (stockState.queryStatus === 'Còn hàng') accumulator.healthyCount += 1
        if (stockState.queryStatus === 'Cần nhập') accumulator.restockCount += 1
        return accumulator
      },
      { totalInventoryValue: 0, healthyCount: 0, restockCount: 0 },
    )
    return {
      ...summary,
      trackedCount: pageInfo.totalItems || assets.length,
    }
  }, [assets, pageInfo.totalItems])
  const filteredRoomOptions = useMemo(() => {
    const keyword = roomSearchKeyword.trim().toLowerCase()
    const nextLocations = [...locations].sort((a, b) => a.roomName.localeCompare(b.roomName, 'vi'))
    if (!keyword) return nextLocations
    return nextLocations.filter((location) => location.roomName.toLowerCase().includes(keyword))
  }, [locations, roomSearchKeyword])
  const consumableRequestAssetOptions = useMemo(() => {
    const roomStockOptions = (locationOverview?.stocks || []).map((stock) => ({
      qaCode: stock.assetQaCode,
      name: stock.assetName,
      unit: stock.unit,
    }))
    const inventoryOptions = assets
      .filter((asset) => isConsumableMode(asset?.trackingMode || activeTrackingMode))
      .map((asset) => ({
        qaCode: asset.qaCode,
        name: asset.name,
        unit: asset.unit,
      }))
    const merged = [...roomStockOptions, ...inventoryOptions]
    return merged.filter((option, index, collection) => collection.findIndex((item) => item.qaCode === option.qaCode) === index)
  }, [activeTrackingMode, assets, locationOverview?.stocks])
  const consumableExpiryGroupsByQaCode = useMemo(
    () =>
      assets.reduce((accumulator, asset) => {
        accumulator[asset.qaCode] = buildConsumableExpiryGroups(asset, assetDetailsByQaCode[asset.qaCode])
        return accumulator
      }, {}),
    [assetDetailsByQaCode, assets],
  )
  const filteredDisposalRequests = useMemo(() => {
    const keyword = disposalHistoryFilters.keyword.trim().toLowerCase()
    return disposalRequests.filter((request) => {
      if (disposalHistoryFilters.status && request.status !== disposalHistoryFilters.status) {
        return false
      }
      if (!keyword) return true
      const haystacks = [
        request.assetName,
        request.assetQaCode,
        request.reason,
        request.requestedByFullName,
        request.requestedByUsername,
        request.lotCode,
        ...(request.items || []).flatMap((item) => [item.lotCode, item.supplierName]),
      ]
      return haystacks.some((value) => String(value || '').toLowerCase().includes(keyword))
    })
  }, [disposalHistoryFilters.keyword, disposalHistoryFilters.status, disposalRequests])

  const createSpecEntryWithKey = (entry = {}) => {
    specEntryIdRef.current += 1
    return {
      ...entry,
      clientKey: `spec-${specEntryIdRef.current}`,
    }
  }

  const withSpecEntryKeys = (entries = []) => entries.map((entry) => createSpecEntryWithKey(entry))

  const getCategorySpecTemplates = async (categoryId) => {
    const normalizedCategoryId = Number(categoryId)
    if (!normalizedCategoryId) return []
    const cachedDetail = categoryDetailsById[normalizedCategoryId]
    if (cachedDetail) {
      return normalizeSpecTemplates(cachedDetail.specTemplates)
    }
    const response = await axiosClient.get(`/api/categories/${normalizedCategoryId}`)
    const detail = response.data || {}
    setCategoryDetailsById((prev) => ({
      ...prev,
      [normalizedCategoryId]: detail,
    }))
    return normalizeSpecTemplates(detail.specTemplates)
  }

  const fetchAssetDetail = async (qaCode) => {
    const cachedDetail = assetDetailsByQaCode[qaCode]
    if (cachedDetail) return cachedDetail
    const response = await axiosClient.get(`/api/assets/${qaCode}`)
    const detail = response.data || {}
    setAssetDetailsByQaCode((prev) => ({
      ...prev,
      [qaCode]: detail,
    }))
    return detail
  }

  const buildAssetQueryParams = useCallback((page = 0, nextFilters = {}, nextSort = defaultSortState) => {
    const params = {
      page,
      size: PAGE_SIZE,
      sortKey: nextSort.key,
      sortDirection: nextSort.direction,
    }
    if ((nextFilters.name || '').trim()) params.name = nextFilters.name.trim()
    if (nextFilters.status) params.status = nextFilters.status
    if (nextFilters.trackingMode) params.trackingMode = nextFilters.trackingMode
    if (nextFilters.categoryId) params.categoryId = Number(nextFilters.categoryId)
    if (nextFilters.locationId) params.locationId = Number(nextFilters.locationId)
    return params
  }, [])

  useEffect(() => {
    if (!isConsumableTab || assets.length === 0) return
    const missingQaCodes = assets
      .map((asset) => asset.qaCode)
      .filter((qaCode) => !Array.isArray(assetDetailsByQaCode[qaCode]?.receiptLots))
    if (missingQaCodes.length === 0) return
    let cancelled = false

    const loadMissingAssetDetails = async () => {
      const results = await Promise.allSettled(
        missingQaCodes.map((qaCode) => axiosClient.get(`/api/assets/${qaCode}`)),
      )
      if (cancelled) return
      setAssetDetailsByQaCode((prev) => {
        const next = { ...prev }
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            next[missingQaCodes[index]] = result.value?.data || {}
          }
        })
        return next
      })
    }

    void loadMissingAssetDetails()
    return () => {
      cancelled = true
    }
  }, [assetDetailsByQaCode, assets, isConsumableTab])

  const loadAssets = async (page = pageInfo.page, nextFilters = filters, nextSort = sortState) => {
    setLoading(true)
    try {
      const response = await axiosClient.get('/api/assets', {
        params: buildAssetQueryParams(page, nextFilters, nextSort),
      })
      const data = response.data || {}
      setAssets(data.items || [])
      setPageInfo({
        page: data.page ?? 0,
        size: data.size ?? pageInfo.size ?? PAGE_SIZE,
        totalPages: data.totalPages || 1,
        totalItems: data.totalItems || 0,
      })
      if (isConsumableMode(nextFilters.trackingMode)) {
        await loadConsumableStatusCounts(nextFilters)
      } else {
        setConsumableStatusCounts(defaultConsumableStatusCounts)
      }
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể tải danh sách thiết bị.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const buildConsumableStatusCountFilters = (nextFilters) => ({
    name: nextFilters.name,
    trackingMode: 'CONSUMABLE',
    categoryId: nextFilters.categoryId,
    locationId: nextFilters.locationId,
  })

  const loadConsumableStatusCounts = useCallback(async (baseFilters) => {
    const countFilters = buildConsumableStatusCountFilters(baseFilters)
    try {
      const [allResponse, healthyResponse, restockResponse] = await Promise.all([
        axiosClient.get('/api/assets', {
          params: {
            ...buildAssetQueryParams(0, { ...countFilters, status: '' }, defaultSortState),
            size: 1,
          },
        }),
        axiosClient.get('/api/assets', {
          params: {
            ...buildAssetQueryParams(0, { ...countFilters, status: 'Còn hàng' }, defaultSortState),
            size: 1,
          },
        }),
        axiosClient.get('/api/assets', {
          params: {
            ...buildAssetQueryParams(0, { ...countFilters, status: 'Cần nhập' }, defaultSortState),
            size: 1,
          },
        }),
      ])
      setConsumableStatusCounts({
        all: allResponse.data?.totalItems || 0,
        healthy: healthyResponse.data?.totalItems || 0,
        restock: restockResponse.data?.totalItems || 0,
      })
    } catch (error) {
      setConsumableStatusCounts(defaultConsumableStatusCounts)
      const message = error?.response?.data?.message || 'Không thể tải thống kê trạng thái vật tư.'
      toast.error(message)
    }
  }, [buildAssetQueryParams])

  const fetchConsumableLocationStocks = async (qaCode) => {
    const response = await axiosClient.get(`/api/assets/${qaCode}/location-stocks`)
    return response.data || []
  }

  const loadLocationOverview = async (locationId) => {
    if (!locationId) {
      setLocationOverview(null)
      return
    }
    setLocationOverviewLoading(true)
    try {
      const response = await axiosClient.get(`/api/assets/locations/${locationId}/consumables`)
      setLocationOverview(response.data || null)
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể tải dữ liệu vật tư theo phòng.'
      toast.error(message)
    } finally {
      setLocationOverviewLoading(false)
    }
  }

  const loadPendingConsumableRequests = async () => {
    if (!isAdmin) return
    setPendingConsumableRequestsLoading(true)
    try {
      const response = await axiosClient.get('/api/assets/consumable-requests', {
        params: { status: 'PENDING' },
      })
      setPendingConsumableRequests(response.data || [])
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể tải danh sách phiếu yêu cầu chờ duyệt.'
      toast.error(message)
    } finally {
      setPendingConsumableRequestsLoading(false)
    }
  }

  const loadExpiredLots = async () => {
    setExpiredLotsLoading(true)
    try {
      const response = await axiosClient.get('/api/assets/expired-lots')
      setExpiredLots(response.data || [])
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể tải danh sách lô hết hạn.'
      toast.error(message)
    } finally {
      setExpiredLotsLoading(false)
    }
  }

  const loadDisposalRequests = async (status = '') => {
    setDisposalRequestsLoading(true)
    try {
      const response = await axiosClient.get('/api/assets/disposal-requests', {
        params: status ? { status } : {},
      })
      setDisposalRequests(response.data || [])
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể tải lịch sử tiêu huỷ.'
      toast.error(message)
    } finally {
      setDisposalRequestsLoading(false)
    }
  }

  const loadPendingDisposalRequests = async () => {
    if (!isAdmin) return
    setPendingDisposalRequestsLoading(true)
    try {
      const response = await axiosClient.get('/api/assets/disposal-requests', {
        params: { status: 'PENDING' },
      })
      setPendingDisposalRequests(response.data || [])
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể tải danh sách yêu cầu tiêu huỷ chờ duyệt.'
      toast.error(message)
    } finally {
      setPendingDisposalRequestsLoading(false)
    }
  }

  useEffect(() => {
    if (!isConsumableForm || !consumableStorageLocation?.id) return
    const storageLocationId = String(consumableStorageLocation.id)
    if (String(form.locationId || '') === storageLocationId) return
    const syncStorageLocationTimer = window.setTimeout(() => {
      setForm((prev) => ({ ...prev, locationId: storageLocationId }))
      setFormErrors((prev) => ({ ...prev, locationId: '' }))
    }, 0)
    return () => window.clearTimeout(syncStorageLocationTimer)
  }, [consumableStorageLocation?.id, form.locationId, isConsumableForm])

  useEffect(() => {
    const initializePage = async () => {
      try {
        const response = await axiosClient.get('/api/assets/bootstrap', {
          params: {
            page: 0,
            size: PAGE_SIZE,
            trackingMode: restrictToConsumable ? 'CONSUMABLE' : 'ITEMIZED',
            sortKey: defaultSortState.key,
            sortDirection: defaultSortState.direction,
          },
        })
        const data = response.data || {}
        const assetPage = data.assets || {}
        setAssets(assetPage.items || [])
        setPageInfo({
          page: assetPage.page ?? 0,
          size: assetPage.size ?? PAGE_SIZE,
          totalPages: assetPage.totalPages || 1,
          totalItems: assetPage.totalItems || 0,
        })
        setLocations(data.locations || [])
        setCategories(data.categories || [])
        setCategoryDetailsById({})
        setAssetDetailsByQaCode({})
        setSuppliers(data.suppliers || [])
        setSortState(defaultSortState)
        if (restrictToConsumable) {
          await loadConsumableStatusCounts({
            name: '',
            status: '',
            trackingMode: 'CONSUMABLE',
            categoryId: '',
            locationId: '',
            categoryKeyword: '',
          })
        } else {
          setConsumableStatusCounts(defaultConsumableStatusCounts)
        }
      } catch (error) {
        const message = error?.response?.data?.message || 'Không thể tải dữ liệu trang thiết bị.'
        toast.error(message)
      } finally {
        setLoading(false)
      }
    }
    void initializePage()
  }, [loadConsumableStatusCounts, restrictToConsumable])

  useEffect(() => {
    if (!isConsumableTab || !isAdmin) return
    void loadPendingConsumableRequests()
  }, [isAdmin, isConsumableTab])

  useEffect(() => {
    if (!isConsumableTab) return
    void loadExpiredLots()
  }, [isConsumableTab])

  useEffect(() => {
    if (!isConsumableTab) return
    void loadDisposalRequests()
  }, [isConsumableTab])

  useEffect(() => {
    if (!isConsumableTab || !isAdmin) return
    void loadPendingDisposalRequests()
  }, [isAdmin, isConsumableTab])

  const resetForm = () => {
    setSelectedQaCode(null)
    setSupplierKeyword('')
    setShowSupplierOptions(false)
    setFormErrors({})
    setForm({
      trackingMode: activeTrackingMode,
      name: '',
      categoryId: '',
      locationId: activeTrackingMode === 'CONSUMABLE' && consumableStorageLocation?.id ? String(consumableStorageLocation.id) : '',
      technicalStatus: 'Hoạt động tốt',
      usageStatus: 'Tại vị trí gốc',
      supplierId: '',
      purchasePrice: '',
      purchaseDate: '',
      warrantyExpirationDate: '',
      expiryTrackingEnabled: false,
      expirationDate: '',
      quantityOnHand: '',
      minimumStock: '',
      unit: '',
      specEntries: [],
    })
  }

  const openCreateModal = () => {
    setFormMode('create')
    setQrImage('')
    resetForm()
    setShowFormModal(true)
  }

  const handleSwitchTab = async (nextTab) => {
    if (nextTab === activeTrackingMode) return
    const nextFilters = {
      name: '',
      status: '',
      trackingMode: nextTab,
      categoryId: '',
      locationId: '',
      categoryKeyword: '',
    }
    setActiveTab(nextTab)
    setFilters(nextFilters)
    setSortState(defaultSortState)
    setShowCategoryFilterOptions(false)
    setQrImage('')
    setConsumableWorkspace('OVERVIEW')
    if (showFormModal) {
      setShowFormModal(false)
      resetForm()
    }
    await loadAssets(0, nextFilters, defaultSortState)
    if (nextTab === 'CONSUMABLE' && isAdmin) {
      await loadPendingConsumableRequests()
    }
  }

  const handleSwitchConsumableWorkspace = async (nextWorkspace) => {
    setConsumableWorkspace(nextWorkspace)
    if (nextWorkspace === 'REQUESTS') {
      if (isAdmin) {
        await loadPendingConsumableRequests()
      }
      return
    }
    if (nextWorkspace === 'DISPOSAL') {
      await Promise.all([
        loadExpiredLots(),
        loadDisposalRequests(),
        isAdmin ? loadPendingDisposalRequests() : Promise.resolve(),
      ])
      return
    }
    if (nextWorkspace !== 'ROOMS') return
    const initialLocationId = selectedOverviewLocationId || filters.locationId || String(locations[0]?.id || '')
    if (!initialLocationId) return
    if (selectedOverviewLocationId !== initialLocationId) {
      setSelectedOverviewLocationId(initialLocationId)
    }
    if (!locationOverview || String(locationOverview.locationId || '') !== String(initialLocationId)) {
      await loadLocationOverview(initialLocationId)
    }
  }

  const resetSupplierForm = () => {
    setSupplierForm({ name: '', address: '', phoneNumber: '' })
    setSupplierFormErrors({})
  }

  const closeSupplierCreateModal = () => {
    setShowSupplierCreateModal(false)
    resetSupplierForm()
  }

  const closeFormModal = () => {
    setShowFormModal(false)
    resetForm()
  }

  const closeIssueModal = () => {
    setShowIssueModal(false)
    setSelectedIssueAsset(null)
    setIssueHistory([])
    setIssueLocationStocks([])
    setIssueForm({
      issuedToLocationId: '',
      quantity: '',
      note: '',
    })
  }

  const closeReceiveModal = () => {
    setShowReceiveModal(false)
    setSelectedReceiveAsset(null)
    setReceiveForm({
      quantity: '',
      unitPrice: '',
      supplierId: '',
      lotCode: '',
      receivedDate: '',
      expirationDate: '',
      note: '',
    })
  }

  const closeConsumableRequestModal = () => {
    setShowConsumableRequestModal(false)
    setSelectedRequestAssetQaCode('')
    setConsumableRequestForm({
      assetQaCode: '',
      quantityRequested: '',
      reason: '',
    })
  }

  const closeConsumableDecisionModal = () => {
    setShowConsumableDecisionModal(false)
    setSelectedConsumableRequest(null)
    setConsumableDecisionAction('APPROVE')
    setConsumableDecisionNote('')
  }

  const closeDisposalRequestModal = () => {
    setShowDisposalRequestModal(false)
    setSelectedExpiredLot(null)
    setDisposalRequestForm({
      reason: 'Do hết hạn sử dụng.',
      items: [],
    })
  }

  const closeDisposalDecisionModal = () => {
    setShowDisposalDecisionModal(false)
    setSelectedDisposalRequest(null)
    setDisposalDecisionAction('APPROVE')
    setDisposalDecisionNote('')
  }

  const closeDisposalHistoryDetailModal = () => {
    setSelectedDisposalHistoryRequest(null)
  }

  const closeLocationOverviewModal = () => {
    setShowLocationOverviewModal(false)
    setSelectedOverviewLocationId('')
    setLocationOverview(null)
    setShowLocationIssueHistory(false)
  }

  const closeStockAdjustModal = () => {
    setShowStockAdjustModal(false)
    setSelectedStockRecord(null)
    setStockAdjustForm({
      quantityRemaining: '',
      note: '',
    })
  }

  const handleDownloadExcel = async () => {
    setDownloading(true)
    try {
      const response = await axiosClient.get('/api/reports/export-assets', { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'danh-sach-thiet-bi.xlsx')
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Đang tải báo cáo Excel.')
    } catch (error) {
      const message = error?.response?.data?.message || 'Tải báo cáo Excel thất bại.'
      toast.error(message)
    } finally {
      setDownloading(false)
    }
  }

  const handleCreateAsset = async () => {
    const nextErrors = validateAssetForm(form)
    setFormErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      toast.error(Object.values(nextErrors)[0])
      return
    }
    setSubmitting(true)
    try {
      const response = await axiosClient.post('/api/assets', {
        trackingMode: form.trackingMode,
        name: form.name.trim(),
        categoryId: Number(form.categoryId),
        locationId: Number(isConsumableMode(form.trackingMode) ? consumableStorageLocation?.id || form.locationId : form.locationId),
        status: isConsumableMode(form.trackingMode) ? 'Còn hàng' : itemizedStatusOptions[0].value,
        technicalStatus: isConsumableMode(form.trackingMode) ? null : form.technicalStatus,
        usageStatus: isConsumableMode(form.trackingMode) ? null : form.usageStatus,
        specs: isConsumableMode(form.trackingMode) ? '{}' : stringifySpecs(form.specEntries),
        purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : null,
        purchaseDate: form.purchaseDate || null,
        warrantyExpirationDate: isConsumableMode(form.trackingMode) ? null : (form.warrantyExpirationDate || null),
        expiryTrackingEnabled: isConsumableMode(form.trackingMode) ? Boolean(form.expiryTrackingEnabled) : null,
        expirationDate: isConsumableMode(form.trackingMode) && form.expiryTrackingEnabled ? (form.expirationDate || null) : null,
        supplierId: form.supplierId ? Number(form.supplierId) : null,
        quantityOnHand: isConsumableMode(form.trackingMode) ? Number(form.quantityOnHand) : null,
        minimumStock: isConsumableMode(form.trackingMode) ? Number(form.minimumStock) : null,
        unit: isConsumableMode(form.trackingMode) ? form.unit.trim() : null,
      })
      if (response.data?.qrCodeBase64) {
        setQrImage(`data:image/png;base64,${response.data.qrCodeBase64}`)
      } else {
        setQrImage('')
      }
      toast.success(`${isConsumableMode(form.trackingMode) ? 'Thêm vật tư' : 'Thêm thiết bị'} thành công. Mã mới: ${response.data?.qaCode || 'đã tự sinh'}.`)
      if (response.data?.qaCode) {
        setAssetDetailsByQaCode((prev) => ({
          ...prev,
          [response.data.qaCode]: response.data,
        }))
      }
      closeFormModal()
      await loadAssets(pageInfo.page)
    } catch (error) {
      const message = error?.response?.data?.message || 'Thêm thiết bị thất bại.'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateAsset = async () => {
    if (!selectedQaCode) return
    const nextErrors = validateAssetForm(form)
    setFormErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      toast.error(Object.values(nextErrors)[0])
      return
    }
    setSubmitting(true)
    try {
      const response = await axiosClient.put(`/api/assets/${selectedQaCode}`, {
        trackingMode: form.trackingMode,
        name: form.name.trim(),
        categoryId: Number(form.categoryId),
        locationId: Number(isConsumableMode(form.trackingMode) ? consumableStorageLocation?.id || form.locationId : form.locationId),
        technicalStatus: isConsumableMode(form.trackingMode) ? null : form.technicalStatus,
        usageStatus: isConsumableMode(form.trackingMode) ? null : form.usageStatus,
        specs: isConsumableMode(form.trackingMode) ? '{}' : stringifySpecs(form.specEntries),
        purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : null,
        purchaseDate: form.purchaseDate || null,
        warrantyExpirationDate: isConsumableMode(form.trackingMode) ? null : (form.warrantyExpirationDate || null),
        expiryTrackingEnabled: isConsumableMode(form.trackingMode) ? Boolean(form.expiryTrackingEnabled) : null,
        expirationDate: isConsumableMode(form.trackingMode) && form.expiryTrackingEnabled ? (form.expirationDate || null) : null,
        supplierId: form.supplierId ? Number(form.supplierId) : null,
        quantityOnHand: isConsumableMode(form.trackingMode) ? Number(form.quantityOnHand) : null,
        minimumStock: isConsumableMode(form.trackingMode) ? Number(form.minimumStock) : null,
        unit: isConsumableMode(form.trackingMode) ? form.unit.trim() : null,
      })
      toast.success(`${isConsumableMode(form.trackingMode) ? 'Cập nhật vật tư' : 'Cập nhật thiết bị'} thành công.`)
      if (response.data?.qaCode) {
        setAssetDetailsByQaCode((prev) => ({
          ...prev,
          [response.data.qaCode]: response.data,
        }))
      }
      closeFormModal()
      await loadAssets(pageInfo.page)
    } catch (error) {
      const message = error?.response?.data?.message || 'Cập nhật thiết bị thất bại.'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteAsset = async (qaCode = selectedQaCode) => {
    if (!qaCode) return
    const confirmed = window.confirm(`Bạn có chắc muốn xóa thiết bị ${qaCode}?`)
    if (!confirmed) return
    setSubmitting(true)
    try {
      await axiosClient.delete(`/api/assets/${qaCode}`)
      toast.success('Xóa thiết bị thành công.')
      if (qaCode === selectedQaCode) {
        resetForm()
      }
      setAssetDetailsByQaCode((prev) => {
        const next = { ...prev }
        delete next[qaCode]
        return next
      })
      await loadAssets(pageInfo.page)
    } catch (error) {
      const message = error?.response?.data?.message || 'Xóa thiết bị thất bại.'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSelectAsset = async (asset) => {
    try {
      const detail = await fetchAssetDetail(asset.qaCode)
      const categoryTemplates = await getCategorySpecTemplates(detail.categoryId || asset.categoryId)
      setSelectedQaCode(asset.qaCode)
      setQrImage('')
      setSupplierKeyword(detail.supplierName || asset.supplierName || '')
      setForm({
        trackingMode: detail.trackingMode || 'ITEMIZED',
        name: detail.name || asset.name,
        categoryId: String(detail.categoryId || asset.categoryId),
        locationId: isConsumableMode(detail.trackingMode || asset.trackingMode)
          ? String(consumableStorageLocation?.id || detail.homeLocationId || detail.locationId || asset.homeLocationId || asset.locationId || '')
          : String(detail.homeLocationId || detail.locationId || asset.homeLocationId || asset.locationId),
        technicalStatus: detail.technicalStatus || asset.technicalStatus || 'Hoạt động tốt',
        usageStatus: detail.usageStatus || asset.usageStatus || 'Tại vị trí gốc',
        supplierId: detail.supplierId ? String(detail.supplierId) : '',
        purchasePrice: detail.purchasePrice ?? asset.purchasePrice ?? '',
        purchaseDate: detail.purchaseDate || asset.purchaseDate || '',
        warrantyExpirationDate: detail.warrantyExpirationDate || asset.warrantyExpirationDate || '',
        expiryTrackingEnabled: Boolean(detail.expiryTrackingEnabled ?? asset.expiryTrackingEnabled),
        expirationDate: detail.expirationDate || asset.expirationDate || '',
        quantityOnHand: detail.quantityOnHand ?? '',
        minimumStock: detail.minimumStock ?? '',
        unit: detail.unit || '',
        specEntries: withSpecEntryKeys(parseSpecsToEntries(detail.specs, categoryTemplates)),
      })
      setFormMode('update')
      setShowFormModal(true)
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể tải template đặc tính kỹ thuật của loại thiết bị.'
      toast.error(message)
    }
  }

  const handleCategoryChange = async (categoryId) => {
    try {
      const categoryTemplates = await getCategorySpecTemplates(categoryId)
      setForm((prev) => ({
        ...prev,
        categoryId,
        specEntries: withSpecEntryKeys(mergeSpecEntries(categoryTemplates, [])),
      }))
      setFormErrors((prev) => ({ ...prev, categoryId: '', specEntries: '' }))
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể tải template đặc tính kỹ thuật của loại thiết bị.'
      toast.error(message)
    }
  }

  const updateSpecEntry = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      specEntries: prev.specEntries.map((entry, entryIndex) => (entryIndex === index ? { ...entry, [field]: value } : entry)),
    }))
    setFormErrors((prev) => ({ ...prev, specEntries: '' }))
  }

  const addCustomSpecEntry = () => {
    setForm((prev) => ({
      ...prev,
      specEntries: [...prev.specEntries, createSpecEntryWithKey({ name: '', value: '', isCustom: true })],
    }))
    setFormErrors((prev) => ({ ...prev, specEntries: '' }))
  }

  const removeSpecEntry = (index) => {
    setForm((prev) => ({
      ...prev,
      specEntries: prev.specEntries.filter((_, entryIndex) => entryIndex !== index),
    }))
    setFormErrors((prev) => ({ ...prev, specEntries: '' }))
  }

  const handleCreateSupplierInline = async () => {
    const nextErrors = validateSupplierForm(supplierForm)
    setSupplierFormErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      toast.error(Object.values(nextErrors)[0])
      return
    }

    setCreatingSupplier(true)
    try {
      const response = await axiosClient.post('/api/suppliers', {
        name: supplierForm.name.trim(),
        address: supplierForm.address.trim(),
        phoneNumber: supplierForm.phoneNumber.trim(),
      })
      const createdSupplier = response.data
      setSuppliers((prev) => [...prev, createdSupplier].sort((a, b) => getSupplierLabel(a).localeCompare(getSupplierLabel(b), 'vi')))
      setForm((prev) => ({ ...prev, supplierId: String(createdSupplier.id) }))
      setSupplierKeyword(getSupplierLabel(createdSupplier))
      setShowSupplierOptions(false)
      setFormErrors((prev) => ({ ...prev, supplierId: '' }))
      toast.success('Đã thêm nhà cung cấp mới.')
      closeSupplierCreateModal()
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể thêm nhà cung cấp mới.'
      toast.error(message)
    } finally {
      setCreatingSupplier(false)
    }
  }

  const handleSearch = async () => {
    await loadAssets(0)
  }

  const handleResetFilters = async () => {
    const reset = { name: '', status: '', trackingMode: activeTrackingMode, categoryId: '', locationId: '', categoryKeyword: '' }
    setFilters(reset)
    await loadAssets(0, reset)
  }

  const handleOpenIssueModal = async (asset) => {
    setIssueHistoryLoading(true)
    try {
      const [detail, historyResponse, locationStocks] = await Promise.all([
        fetchAssetDetail(asset.qaCode),
        axiosClient.get(`/api/assets/${asset.qaCode}/issues`),
        fetchConsumableLocationStocks(asset.qaCode),
      ])
      setSelectedIssueAsset(detail)
      setIssueHistory(historyResponse.data || [])
      setIssueLocationStocks(locationStocks || [])
      setIssueForm({
        issuedToLocationId: '',
        quantity: '',
        note: '',
      })
      setShowIssueModal(true)
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể tải dữ liệu cấp phát vật tư.'
      toast.error(message)
    } finally {
      setIssueHistoryLoading(false)
    }
  }

  const handleOpenReceiveModal = async (asset) => {
    try {
      const detail = await fetchAssetDetail(asset.qaCode)
      setSelectedReceiveAsset(detail)
      setReceiveForm({
        quantity: '',
        unitPrice: detail?.purchasePrice ? String(detail.purchasePrice) : '',
        supplierId: detail?.supplierId ? String(detail.supplierId) : '',
        lotCode: '',
        receivedDate: new Date().toISOString().slice(0, 10),
        expirationDate: '',
        note: '',
      })
      setShowReceiveModal(true)
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể tải dữ liệu nhập hàng.'
      toast.error(message)
    }
  }

  const handleOpenConsumableRequestModal = (assetQaCode = '') => {
    const resolvedAssetQaCode = assetQaCode || selectedRequestAssetQaCode || consumableRequestAssetOptions[0]?.qaCode || ''
    setSelectedRequestAssetQaCode(resolvedAssetQaCode)
    setConsumableRequestForm({
      assetQaCode: resolvedAssetQaCode,
      quantityRequested: '',
      reason: '',
    })
    setShowConsumableRequestModal(true)
  }

  const handleOpenConsumableDecisionModal = (request, action) => {
    setSelectedConsumableRequest(request)
    setConsumableDecisionAction(action)
    setConsumableDecisionNote(action === 'REJECT' ? '' : (request?.decisionNote || ''))
    setShowConsumableDecisionModal(true)
  }

  const handleOpenDisposalRequestModal = (lot) => {
    const relatedLots = expiredLots.filter((item) => item.assetQaCode === lot?.assetQaCode)
    setSelectedExpiredLot(lot)
    setDisposalRequestForm({
      reason: 'Do hết hạn sử dụng.',
      items: relatedLots.map((item) => ({
        receiptLotId: item.lotId,
        lotCode: item.lotCode || `Lô #${item.lotId}`,
        expirationDate: item.expirationDate,
        receivedDate: item.receivedDate,
        quantityRemaining: item.quantityRemaining,
        unit: item.unit,
        selected: item.lotId === lot?.lotId,
        quantityRequested: item.lotId === lot?.lotId ? String(item.quantityRemaining || '') : '',
      })),
    })
    setShowDisposalRequestModal(true)
  }

  const handleOpenDisposalDecisionModal = (request, action) => {
    setSelectedDisposalRequest(request)
    setDisposalDecisionAction(action)
    setDisposalDecisionNote(action === 'REJECT' ? '' : (request?.decisionNote || ''))
    setShowDisposalDecisionModal(true)
  }

  const handleReceiveConsumable = async () => {
    if (!selectedReceiveAsset?.qaCode) return
    const quantity = Number(receiveForm.quantity)
    const unitPrice = Number(receiveForm.unitPrice)
    if (!Number.isInteger(quantity) || quantity <= 0) {
      toast.error('Số lượng nhập phải là số nguyên lớn hơn 0.')
      return
    }
    if (Number.isNaN(unitPrice) || unitPrice <= 0) {
      toast.error('Đơn giá nhập phải lớn hơn 0.')
      return
    }
    if (!receiveForm.supplierId) {
      toast.error('Vui lòng chọn nhà cung cấp cho lô nhập.')
      return
    }
    if (!receiveForm.receivedDate) {
      toast.error('Vui lòng chọn ngày nhập lô.')
      return
    }
    if (selectedReceiveAsset.expiryTrackingEnabled && !receiveForm.expirationDate) {
      toast.error('Vui lòng chọn hạn sử dụng cho lô nhập này.')
      return
    }
    if (receiveForm.expirationDate && new Date(receiveForm.expirationDate) < new Date(receiveForm.receivedDate)) {
      toast.error('Hạn sử dụng phải sau hoặc bằng ngày nhập lô.')
      return
    }
    setReceiveSubmitting(true)
    try {
      const response = await axiosClient.post(`/api/assets/${selectedReceiveAsset.qaCode}/receipts`, {
        quantity,
        unitPrice,
        supplierId: Number(receiveForm.supplierId),
        lotCode: receiveForm.lotCode.trim() || null,
        receivedDate: receiveForm.receivedDate,
        expirationDate: selectedReceiveAsset.expiryTrackingEnabled ? (receiveForm.expirationDate || null) : null,
        note: receiveForm.note.trim() || null,
      })
      const updatedDetail = response.data || {}
      setAssetDetailsByQaCode((prev) => ({
        ...prev,
        [selectedReceiveAsset.qaCode]: updatedDetail,
      }))
      toast.success('Nhập hàng thành công.')
      await loadAssets(pageInfo.page)
      closeReceiveModal()
    } catch (error) {
      const message = error?.response?.data?.message || 'Nhập hàng thất bại.'
      toast.error(message)
    } finally {
      setReceiveSubmitting(false)
    }
  }

  const handleCreateConsumableRequest = async () => {
    if (!selectedOverviewLocationId) {
      toast.error('Vui lòng chọn phòng cần yêu cầu cấp phát.')
      return
    }
    const assetQaCode = consumableRequestForm.assetQaCode || selectedRequestAssetQaCode
    const quantityRequested = Number(consumableRequestForm.quantityRequested)
    if (!assetQaCode) {
      toast.error('Vui lòng chọn vật tư cần cấp phát.')
      return
    }
    if (!Number.isInteger(quantityRequested) || quantityRequested <= 0) {
      toast.error('Số lượng yêu cầu phải là số nguyên lớn hơn 0.')
      return
    }
    if (!consumableRequestForm.reason.trim()) {
      toast.error('Vui lòng nhập lý do cần cấp phát.')
      return
    }
    setConsumableRequestSubmitting(true)
    try {
      await axiosClient.post(`/api/assets/locations/${selectedOverviewLocationId}/consumable-requests`, {
        assetQaCode,
        quantityRequested,
        reason: consumableRequestForm.reason.trim(),
      })
      toast.success('Đã gửi yêu cầu cấp phát.')
      await loadLocationOverview(selectedOverviewLocationId)
      if (isAdmin) {
        await loadPendingConsumableRequests()
      }
      closeConsumableRequestModal()
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể tạo yêu cầu cấp phát.'
      toast.error(message)
    } finally {
      setConsumableRequestSubmitting(false)
    }
  }

  const handleSubmitConsumableDecision = async () => {
    if (!selectedConsumableRequest?.id) return
    if (consumableDecisionAction === 'REJECT' && !consumableDecisionNote.trim()) {
      toast.error('Vui lòng nhập lý do từ chối phiếu yêu cầu.')
      return
    }
    setConsumableDecisionSubmitting(true)
    try {
      const endpoint = consumableDecisionAction === 'APPROVE' ? 'approve' : 'reject'
      await axiosClient.post(`/api/assets/consumable-requests/${selectedConsumableRequest.id}/${endpoint}`, {
        note: consumableDecisionNote.trim(),
      })
      toast.success(consumableDecisionAction === 'APPROVE' ? 'Đã duyệt cấp phát phiếu yêu cầu.' : 'Đã từ chối phiếu yêu cầu.')
      await Promise.all([
        loadAssets(pageInfo.page),
        loadPendingConsumableRequests(),
        selectedOverviewLocationId ? loadLocationOverview(selectedOverviewLocationId) : Promise.resolve(),
      ])
      closeConsumableDecisionModal()
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể xử lý phiếu yêu cầu.'
      toast.error(message)
    } finally {
      setConsumableDecisionSubmitting(false)
    }
  }

  const handleCreateDisposalRequest = async () => {
    if (!selectedExpiredLot?.assetQaCode) return
    if (!disposalRequestForm.reason.trim()) {
      toast.error('Vui lòng nhập lý do tiêu huỷ.')
      return
    }
    const selectedItems = (disposalRequestForm.items || [])
      .filter((item) => item.selected)
      .map((item) => ({
        receiptLotId: item.receiptLotId,
        quantityRequested: Number(item.quantityRequested),
      }))
      .filter((item) => Number.isInteger(item.quantityRequested) && item.quantityRequested > 0)
    if (selectedItems.length === 0) {
      toast.error('Vui lòng chọn ít nhất một lô và nhập số lượng tiêu huỷ hợp lệ.')
      return
    }
    setDisposalRequestSubmitting(true)
    try {
      await axiosClient.post('/api/assets/disposal-requests', {
        reason: disposalRequestForm.reason.trim(),
        items: selectedItems,
      })
      toast.success('Đã tạo yêu cầu tiêu huỷ.')
      await Promise.all([
        loadExpiredLots(),
        loadAssets(pageInfo.page),
        loadDisposalRequests(),
        isAdmin ? loadPendingDisposalRequests() : Promise.resolve(),
      ])
      closeDisposalRequestModal()
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể tạo yêu cầu tiêu huỷ.'
      toast.error(message)
    } finally {
      setDisposalRequestSubmitting(false)
    }
  }

  const handleDownloadDisposalDocument = async (requestId) => {
    if (!requestId) return
    setDownloadingDisposalRequestId(requestId)
    try {
      const response = await axiosClient.get(`/api/reports/export-expired-disposal/${requestId}`, {
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = `bien-ban-huy-hang-hoa-het-han-${requestId}.docx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể tải biên bản tiêu huỷ.'
      toast.error(message)
    } finally {
      setDownloadingDisposalRequestId(null)
    }
  }

  const handleSubmitDisposalDecision = async () => {
    if (!selectedDisposalRequest?.id) return
    if (disposalDecisionAction === 'REJECT' && !disposalDecisionNote.trim()) {
      toast.error('Vui lòng nhập lý do từ chối yêu cầu tiêu huỷ.')
      return
    }
    setDisposalDecisionSubmitting(true)
    try {
      const endpoint = disposalDecisionAction === 'APPROVE' ? 'approve' : 'reject'
      const response = await axiosClient.post(`/api/assets/disposal-requests/${selectedDisposalRequest.id}/${endpoint}`, {
        note: disposalDecisionNote.trim(),
      })
      toast.success(disposalDecisionAction === 'APPROVE' ? 'Đã duyệt yêu cầu tiêu huỷ.' : 'Đã từ chối yêu cầu tiêu huỷ.')
      await Promise.all([
        loadAssets(pageInfo.page),
        loadExpiredLots(),
        loadDisposalRequests(),
        loadPendingDisposalRequests(),
      ])
      closeDisposalDecisionModal()
      if (disposalDecisionAction === 'APPROVE') {
        await handleDownloadDisposalDocument(response.data?.id || selectedDisposalRequest.id)
      }
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể xử lý yêu cầu tiêu huỷ.'
      toast.error(message)
    } finally {
      setDisposalDecisionSubmitting(false)
    }
  }

  const handleIssueConsumable = async () => {
    if (!selectedIssueAsset?.qaCode) return
    const quantity = Number(issueForm.quantity)
    if (!Number.isInteger(quantity) || quantity <= 0) {
      toast.error('Số lượng cấp phát phải lớn hơn 0.')
      return
    }
    if (!issueForm.issuedToLocationId) {
      toast.error('Vui lòng chọn phòng nhận.')
      return
    }
    setIssueSubmitting(true)
    try {
      await axiosClient.post(`/api/assets/${selectedIssueAsset.qaCode}/issues`, {
        issuedToLocationId: Number(issueForm.issuedToLocationId),
        quantity,
        note: issueForm.note.trim(),
      })
      const [detailResponse, historyResponse, locationStocks] = await Promise.all([
        axiosClient.get(`/api/assets/${selectedIssueAsset.qaCode}`),
        axiosClient.get(`/api/assets/${selectedIssueAsset.qaCode}/issues`),
        fetchConsumableLocationStocks(selectedIssueAsset.qaCode),
      ])
      const updatedDetail = detailResponse.data || {}
      setSelectedIssueAsset(updatedDetail)
      setIssueHistory(historyResponse.data || [])
      setIssueLocationStocks(locationStocks || [])
      setAssetDetailsByQaCode((prev) => ({
        ...prev,
        [selectedIssueAsset.qaCode]: updatedDetail,
      }))
      setIssueForm({
        issuedToLocationId: '',
        quantity: '',
        note: '',
      })
      toast.success('Cấp phát vật phẩm thành công.')
      await loadAssets(pageInfo.page)
      if (showLocationOverviewModal && selectedOverviewLocationId) {
        await loadLocationOverview(selectedOverviewLocationId)
      }
    } catch (error) {
      const message = error?.response?.data?.message || 'Cấp phát vật phẩm thất bại.'
      toast.error(message)
    } finally {
      setIssueSubmitting(false)
    }
  }

  const handleLocationOverviewChange = async (locationId) => {
    setSelectedOverviewLocationId(locationId)
    setShowLocationIssueHistory(false)
    await loadLocationOverview(locationId)
  }

  const handleOpenStockAdjustModal = (stock) => {
    setSelectedStockRecord(stock)
    setStockAdjustForm({
      quantityRemaining: String(stock?.quantityRemaining ?? 0),
      note: stock?.lastNote || '',
    })
    setShowStockAdjustModal(true)
  }

  const handleUpdateStockRemaining = async () => {
    if (!selectedStockRecord?.assetQaCode || !selectedStockRecord?.locationId) return
    const quantityRemaining = Number(stockAdjustForm.quantityRemaining)
    if (!Number.isInteger(quantityRemaining) || quantityRemaining < 0) {
      toast.error('Số lượng còn lại phải là số nguyên từ 0 trở lên.')
      return
    }
    setStockAdjustSubmitting(true)
    try {
      await axiosClient.put(
        `/api/assets/${selectedStockRecord.assetQaCode}/location-stocks/${selectedStockRecord.locationId}`,
        {
          quantityRemaining,
          note: stockAdjustForm.note.trim(),
        },
      )

      if (selectedIssueAsset?.qaCode === selectedStockRecord.assetQaCode) {
        const latestStocks = await fetchConsumableLocationStocks(selectedStockRecord.assetQaCode)
        setIssueLocationStocks(latestStocks || [])
      }
      if (showLocationOverviewModal && selectedOverviewLocationId) {
        await loadLocationOverview(selectedOverviewLocationId)
      }
      toast.success('Đã cập nhật số lượng còn lại tại phòng.')
      closeStockAdjustModal()
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể cập nhật số lượng còn lại.'
      toast.error(message)
    } finally {
      setStockAdjustSubmitting(false)
    }
  }

  const handleOpenQrModal = async (qaCode) => {
    setQrModalLoading(true)
    try {
      let qrCodeBase64 = ''
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await axiosClient.get(`/api/assets/${qaCode}/qr`)
        qrCodeBase64 = String(response.data?.qrCodeBase64 || '').trim()
        if (qrCodeBase64) break
        if (attempt === 0) {
          await sleep(300)
        }
      }
      if (!qrCodeBase64) {
        toast.error('Không lấy được mã QR của thiết bị này.')
        return
      }
      setQrModalQaCode(qaCode)
      setQrModalImage(`data:image/png;base64,${qrCodeBase64}`)
      setShowQrModal(true)
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể tải mã QR của thiết bị.'
      toast.error(message)
    } finally {
      setQrModalLoading(false)
    }
  }

  const handleCloseQrModal = () => {
    setShowQrModal(false)
    setQrModalQaCode('')
    setQrModalImage('')
  }

  const handleSort = async (key) => {
    const nextSort = {
      key,
      direction: sortState.key === key && sortState.direction === 'asc' ? 'desc' : 'asc',
    }
    setSortState(nextSort)
    await loadAssets(0, filters, nextSort)
  }

  const getSortLabel = (key, label) => {
    if (sortState.key !== key) return label
    return `${label} ${sortState.direction === 'asc' ? '▲' : '▼'}`
  }

  const currentPage = pageInfo.page + 1
  const totalPages = Math.max(1, pageInfo.totalPages)
  const goToFirstPage = async () => loadAssets(0)
  const goToPrevPage = async () => loadAssets(Math.max(0, pageInfo.page - 1))
  const goToNextPage = async () => loadAssets(Math.min(totalPages - 1, pageInfo.page + 1))
  const goToLastPage = async () => loadAssets(Math.max(0, totalPages - 1))

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{restrictToConsumable ? 'Quản lý cấp phát vật tư' : 'Quản lý tài sản'}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {restrictToConsumable ? 'Không gian làm việc cho vật tư tiêu hao, cấp phát và theo dõi theo phòng.' : 'Tài sản cố định và vật tư tiêu hao.'}
          </p>
        </div>
        {!restrictToConsumable && (
        <div className="mb-4 grid gap-3 md:grid-cols-2">
          {managementTabs.map((tab) => {
            const active = tab.value === activeTrackingMode
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => handleSwitchTab(tab.value)}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  active
                    ? 'border-fptOrange bg-orange-50 text-fptOrangeDark dark:bg-orange-500/10 dark:text-orange-300'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-orange-200 hover:bg-orange-50/50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-orange-500/40 dark:hover:bg-orange-500/10'
                }`}
              >
                <p className="text-sm font-semibold">{tab.label}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{tab.description}</p>
              </button>
            )
          })}
        </div>
        )}
        <div className="grid gap-2 border-t border-slate-100 pt-4 dark:border-slate-800 sm:grid-cols-2">
          <button
            type="button"
            onClick={openCreateModal}
            disabled={submitting}
            className="rounded-lg bg-fptOrange px-3 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark disabled:opacity-60"
          >
            {isConsumableTab ? 'Thêm mới vật tư tiêu hao' : 'Thêm mới tài sản cố định'}
          </button>
          <button
            type="button"
            onClick={() => loadAssets()}
            disabled={submitting}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            Tải lại
          </button>
        </div>
        {qrImage && (
          <div className="mt-4 rounded-lg border border-slate-200 p-3">
            <p className="mb-2 text-sm font-medium text-slate-700">QR thiết bị vừa tạo</p>
            <img src={qrImage} alt="QR thiết bị" className="h-40 w-40 rounded border border-slate-200" />
          </div>
        )}
      </div>

      {isConsumableTab ? (
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => handleSwitchConsumableWorkspace('OVERVIEW')}
                    className={`border-b-2 px-1 pb-2 text-sm font-semibold ${
                      consumableWorkspace === 'OVERVIEW'
                        ? 'border-fptOrange text-fptOrangeDark dark:text-orange-300'
                        : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    Tổng quan kho
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchConsumableWorkspace('ROOMS')}
                    className={`border-b-2 px-1 pb-2 text-sm font-semibold ${
                      consumableWorkspace === 'ROOMS'
                        ? 'border-fptOrange text-fptOrangeDark dark:text-orange-300'
                        : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    Theo dõi theo phòng
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchConsumableWorkspace('DISPOSAL')}
                    className={`border-b-2 px-1 pb-2 text-sm font-semibold ${
                      consumableWorkspace === 'DISPOSAL'
                        ? 'border-fptOrange text-fptOrangeDark dark:text-orange-300'
                        : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    Tiêu huỷ
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleSwitchConsumableWorkspace('REQUESTS')}
                      className={`inline-flex items-center gap-2 border-b-2 px-1 pb-2 text-sm font-semibold ${
                        consumableWorkspace === 'REQUESTS'
                          ? 'border-fptOrange text-fptOrangeDark dark:text-orange-300'
                          : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                    >
                      <span>Phiếu chờ duyệt</span>
                      <span
                        className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] ${
                          consumableWorkspace === 'REQUESTS'
                            ? 'bg-orange-100 text-fptOrangeDark dark:bg-orange-500/15 dark:text-orange-300'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {pendingConsumableRequests.length + pendingDisposalRequests.length}
                      </span>
                    </button>
                  )}
                </div>
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                  {consumableWorkspace === 'OVERVIEW'
                    ? 'Theo dõi tồn kho, các mặt hàng cần nhập và giá trị tồn của toàn kho.'
                    : consumableWorkspace === 'ROOMS'
                      ? 'Theo dõi lượng vật tư đã cấp cho từng phòng và cập nhật số lượng còn lại.'
                      : consumableWorkspace === 'DISPOSAL'
                        ? 'Tạo phiếu tiêu huỷ theo lô, gộp nhiều lô cùng vật tư và tra cứu lịch sử xử lý.'
                      : 'Admin duyệt hoặc từ chối các phiếu yêu cầu cấp phát và tiêu huỷ đang chờ xử lý.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={openCreateModal}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-fptOrange px-3 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark disabled:opacity-60"
                >
                  <Plus size={16} />
                  Thêm mới
                </button>
                <button
                  type="button"
                  onClick={() => loadAssets()}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <RefreshCw size={16} />
                  Tải lại
                </button>
                <button
                  type="button"
                  onClick={handleDownloadExcel}
                  disabled={downloading}
                  className="inline-flex items-center gap-2 rounded-lg border border-orange-200 px-3 py-2 text-sm font-semibold text-fptOrangeDark hover:bg-orange-50 disabled:opacity-60 dark:border-orange-500/30 dark:text-orange-300 dark:hover:bg-orange-500/10"
                >
                  <Package size={16} />
                  Xuất Excel
                </button>
              </div>
            </div>
          </div>

          {consumableWorkspace === 'OVERVIEW' ? (
            <>
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <button
                  type="button"
                  onClick={() => setShowConsumableOverviewSummary((prev) => !prev)}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-900"
                >
                  {showConsumableOverviewSummary ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <span>Số liệu tổng quan</span>
                </button>
                {showConsumableOverviewSummary && (
                  <div className="grid gap-4 border-t border-slate-200 px-4 py-4 dark:border-slate-800 xl:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                      <div className="mb-3 flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Tổng giá trị tồn</p>
                          <h3 className="mt-2 whitespace-nowrap text-3xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(consumableSummary.totalInventoryValue)}</h3>
                        </div>
                        <div className="rounded-xl bg-orange-50 p-3 text-fptOrangeDark dark:bg-orange-500/10 dark:text-orange-300">
                          <Boxes size={20} />
                        </div>
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {consumableSummary.trackedCount} vật tư đang được theo dõi trong kho hiện tại.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                      <div className="mb-3 flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Mặt hàng đang đủ dùng</p>
                          <h3 className="mt-2 whitespace-nowrap text-3xl font-bold text-slate-900 dark:text-slate-100">{consumableSummary.healthyCount} loại</h3>
                        </div>
                        <div className="rounded-xl bg-orange-50 p-3 text-fptOrangeDark dark:bg-orange-500/10 dark:text-orange-300">
                          <Package size={20} />
                        </div>
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Các vật tư đang còn trên ngưỡng cảnh báo và đủ để phục vụ cấp phát.</p>
                    </div>
                    <div className="rounded-2xl border border-orange-200 bg-orange-50/70 p-5 shadow-sm dark:border-orange-500/30 dark:bg-orange-500/10">
                      <div className="mb-3 flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-orange-700 dark:text-orange-300">Cần nhập thêm</p>
                          <h3 className="mt-2 whitespace-nowrap text-3xl font-bold text-orange-900 dark:text-orange-200">{consumableSummary.restockCount} loại</h3>
                        </div>
                        <div className="rounded-xl bg-white/80 p-3 text-orange-700 dark:bg-slate-950/80 dark:text-orange-300">
                          <History size={20} />
                        </div>
                      </div>
                      <p className="text-sm text-orange-700 dark:text-orange-300">Các vật tư đã chạm hoặc thấp hơn ngưỡng cảnh báo và cần nhập thêm.</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-red-200 bg-red-50/70 shadow-sm dark:border-red-500/30 dark:bg-red-500/10">
                <button
                  type="button"
                  onClick={() => setShowExpiredLotsSummary((prev) => !prev)}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-red-700 hover:bg-red-100/50 dark:text-red-300 dark:hover:bg-red-500/10"
                >
                  {showExpiredLotsSummary ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <span>Lô hàng đã hết hạn cần tiêu huỷ</span>
                  <span className="ml-auto whitespace-nowrap text-xs font-semibold text-red-700/80 dark:text-red-300/80">
                    {expiredLotsLoading ? 'Đang kiểm tra...' : `${expiredLots.length} lô cần xử lý`}
                  </span>
                </button>
                {showExpiredLotsSummary && (
                  <div className="border-t border-red-200 px-4 py-4 dark:border-red-500/20">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-red-900 dark:text-red-200">
                          {expiredLotsLoading ? 'Đang kiểm tra lô hết hạn...' : `${expiredLots.length} lô cần xử lý`}
                        </h3>
                        <p className="mt-2 text-sm text-red-700 dark:text-red-300">
                          Người dùng xem danh sách các lô đã hết hạn, tạo yêu cầu tiêu huỷ và chuyển Admin phê duyệt.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => loadExpiredLots()}
                        disabled={expiredLotsLoading}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100/70 disabled:opacity-60 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/10"
                      >
                        <RefreshCw size={16} />
                        Làm mới lô hết hạn
                      </button>
                    </div>
                    <div className="mt-4 space-y-3">
                      {expiredLotsLoading && (
                        <div className="rounded-2xl border border-dashed border-red-200 px-4 py-6 text-center text-sm text-red-700 dark:border-red-500/30 dark:text-red-300">
                          Đang tải danh sách lô hàng hết hạn...
                        </div>
                      )}
                      {!expiredLotsLoading && expiredLots.slice(0, 6).map((lot) => (
                        <div
                          key={lot.lotId}
                          className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-white/80 p-4 dark:border-red-500/30 dark:bg-slate-950/70 lg:flex-row lg:items-center lg:justify-between"
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-slate-800 dark:text-slate-100">{lot.assetName}</p>
                              <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-300">
                                Quá hạn {lot.daysExpired} ngày
                              </span>
                              {lot.pendingDisposal && (
                                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                                  Đã có phiếu chờ duyệt
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-300">
                              {lot.assetQaCode} • {lot.lotCode || `Lô #${lot.lotId}`} • {lot.quantityRemaining} {lot.unit || ''}
                            </p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              Hạn sử dụng: {formatDate(lot.expirationDate)} • Ngày nhập: {formatDate(lot.receivedDate)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleOpenDisposalRequestModal(lot)}
                            disabled={lot.pendingDisposal}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100/70 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/10"
                          >
                            <Trash2 size={16} />
                            {lot.pendingDisposal ? 'Đang chờ duyệt' : 'Tạo yêu cầu tiêu huỷ'}
                          </button>
                        </div>
                      ))}
                      {!expiredLotsLoading && expiredLots.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-emerald-200 px-4 py-6 text-center text-sm text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-300">
                          Hiện chưa có lô vật tư nào hết hạn cần tiêu huỷ.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
                <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-4 border-b border-slate-200 pb-3 dark:border-slate-800">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Trạng thái</h3>
                  </div>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={async () => {
                        const reset = { ...filters, status: '' }
                        setFilters(reset)
                        await loadAssets(0, reset)
                      }}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm ${
                        !filters.status ? 'border-fptOrange bg-orange-50 text-fptOrangeDark dark:bg-orange-500/10 dark:text-orange-300' : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="whitespace-nowrap">Tất cả vật tư</span>
                      <span className="whitespace-nowrap text-xs tabular-nums text-slate-400 dark:text-slate-500">{consumableStatusCounts.all}</span>
                    </button>
                    {consumableStatusOptions.map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={async () => {
                          const nextFilters = { ...filters, status }
                          setFilters(nextFilters)
                          await loadAssets(0, nextFilters)
                        }}
                        className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm ${
                          filters.status === status
                            ? 'border-fptOrange bg-orange-50 text-fptOrangeDark dark:bg-orange-500/10 dark:text-orange-300'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className="whitespace-nowrap">{status === 'Còn hàng' ? 'Đủ dùng' : 'Cần nhập'}</span>
                        <span className="whitespace-nowrap text-xs tabular-nums text-slate-400 dark:text-slate-500">
                          {status === 'Còn hàng' ? consumableStatusCounts.healthy : consumableStatusCounts.restock}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white/80 p-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-400">
                    Mẹo: dùng bộ lọc nhanh để xem ngay mặt hàng đang đủ dùng hoặc các vật tư cần nhập thêm.
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                  <div className="mb-4 flex flex-col gap-3 border-b border-slate-200 pb-4 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Danh sách quản lý</p>
                      <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Tổng quan kho</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Danh sách vật tư trong kho với đơn giá trung bình và trạng thái hạn sử dụng nếu mặt hàng có quản lý hạn dùng.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleSearch}
                        disabled={loading}
                        className="rounded-lg bg-fptOrange px-3 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark disabled:opacity-60"
                      >
                        Tìm kiếm
                      </button>
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        disabled={loading}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        Xóa bộ lọc
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <div className="xl:col-span-2">
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Tìm vật tư</label>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                          value={filters.name}
                          onChange={(e) => setFilters((prev) => ({ ...prev, name: e.target.value }))}
                          className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none ring-fptOrange focus:ring-2"
                          placeholder="Tên vật tư..."
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Chọn loại</label>
                      <select
                        value={filters.categoryId}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            categoryId: e.target.value,
                            categoryKeyword: getCategoryLabel(categories.find((category) => String(category.id) === e.target.value)) || '',
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
                      >
                        <option value="">Tất cả loại</option>
                        {filteredCategoryOptions.map((category) => (
                          <option key={category.id} value={category.id}>
                            {getCategoryLabel(category)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Chọn kho</label>
                      <select
                        value={filters.locationId}
                        onChange={(e) => setFilters((prev) => ({ ...prev, locationId: e.target.value }))}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
                      >
                        <option value="">Tất cả kho</option>
                        {locations.map((location) => (
                          <option key={location.id} value={location.id}>
                            {location.roomName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Trạng thái</label>
                      <select
                        value={filters.status}
                        onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
                      >
                        <option value="">Chọn trạng thái</option>
                        {consumableStatusOptions.map((status) => (
                          <option key={status} value={status}>
                            {status === 'Còn hàng' ? 'Mặt hàng đang đủ dùng' : 'Cần nhập'}
                          </option>
                        ))}
                      </select>
                    </div>
                    </div>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                    <div className="overflow-x-auto">
                    <table className="min-w-[1080px] text-sm">
                      <thead className="bg-fptOrange text-white">
                        <tr>
                          <th className="w-[22%] px-3 py-2 text-left font-semibold text-white">
                            <button type="button" onClick={() => handleSort('name')} className="transition-colors hover:text-orange-100">
                              {getSortLabel('name', 'Tên vật tư')}
                            </button>
                          </th>
                          <th className="w-[14%] px-3 py-2 text-left font-semibold text-white">
                            <button type="button" onClick={() => handleSort('category')} className="transition-colors hover:text-orange-100">
                              {getSortLabel('category', 'Loại')}
                            </button>
                          </th>
                          <th className="w-[14%] px-3 py-2 text-left font-semibold text-white">
                            <button type="button" onClick={() => handleSort('quantityOnHand')} className="transition-colors hover:text-orange-100">
                              Tồn theo HSD
                            </button>
                          </th>
                          <th className="w-[10%] px-3 py-2 text-right font-semibold text-white">Ngưỡng báo</th>
                          <th className="w-[12%] px-3 py-2 text-right font-semibold text-white">Đơn giá</th>
                          <th className="w-[12%] px-3 py-2 text-left font-semibold text-white">Hạn sử dụng</th>
                          <th className="w-[8%] px-3 py-2 text-left font-semibold text-white">Trạng thái</th>
                          <th className="w-[8%] px-3 py-2 text-right font-semibold text-white">Hành động</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {loading &&
                          Array.from({ length: 6 }).map((_, index) => (
                            <tr key={`skeleton-consumable-${index}`} className="animate-pulse">
                              {Array.from({ length: 8 }).map((__, cellIndex) => (
                                <td key={`cell-consumable-${cellIndex}`} className="px-3 py-2 align-top">
                                  <div className="h-4 w-24 rounded bg-slate-200" />
                                </td>
                              ))}
                            </tr>
                          ))}
                        {!loading &&
                          assets.flatMap((asset) => {
                            const stockState = getConsumableInventoryState(asset)
                            const expiryGroups = consumableExpiryGroupsByQaCode[asset.qaCode] || buildConsumableExpiryGroups(asset)
                            return expiryGroups.map((group, groupIndex) => {
                              const expiryState = getConsumableExpiryState({
                                ...asset,
                                expirationDate: group.expirationDate,
                              })
                              return (
                                <tr key={group.key} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/80">
                                  {groupIndex === 0 && (
                                    <td rowSpan={expiryGroups.length} className="px-3 py-3 align-top">
                                      <div className="font-medium text-slate-700">{asset.name}</div>
                                      <div className="text-xs text-slate-500">{asset.qaCode}</div>
                                      {expiryGroups.length > 1 && (
                                        <div className="mt-1 text-xs text-slate-400">{expiryGroups.length} nhóm hạn sử dụng</div>
                                      )}
                                    </td>
                                  )}
                                  {groupIndex === 0 && <td rowSpan={expiryGroups.length} className="px-3 py-3 align-top">{asset.category}</td>}
                                  <td className="px-3 py-3 align-top">
                                    <div className="whitespace-nowrap font-medium tabular-nums text-slate-700">{`${group.quantityOnHand ?? 0} ${asset.unit || ''}`.trim()}</div>
                                    <div className="whitespace-nowrap text-xs tabular-nums text-slate-500">{`Tổng mặt hàng: ${asset.quantityOnHand ?? 0} ${asset.unit || ''}`.trim()}</div>
                                  </td>
                                  {groupIndex === 0 && (
                                    <td rowSpan={expiryGroups.length} className="px-3 py-3 text-right align-top">
                                      <span className="whitespace-nowrap tabular-nums">{`${asset.minimumStock ?? 0} ${asset.unit || ''}`.trim()}</span>
                                    </td>
                                  )}
                                  <td className="px-3 py-3 text-right align-top">
                                    <div className="whitespace-nowrap font-medium tabular-nums text-slate-700">{formatCurrency(group.purchasePrice)}</div>
                                    {group.lotCount > 1 && <div className="whitespace-nowrap text-xs text-slate-500">{`Gộp ${group.lotCount} lô cùng HSD`}</div>}
                                  </td>
                                  <td className={`px-3 py-3 ${asset.expiryTrackingEnabled ? 'align-top' : 'text-center align-middle'}`}>
                                    {asset.expiryTrackingEnabled ? (
                                      <div className="flex flex-col gap-1">
                                        <span className="whitespace-nowrap text-xs text-slate-500">{expiryState.dateLabel}</span>
                                        <span className={`inline-flex w-fit whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(expiryState.tone)}`}>
                                          {expiryState.label}
                                        </span>
                                      </div>
                                    ) : (
                                      <span
                                        aria-label="Không áp dụng"
                                        className="inline-flex w-full justify-center text-base font-medium leading-none text-slate-400 dark:text-slate-500"
                                      >
                                        –
                                      </span>
                                    )}
                                  </td>
                                  {groupIndex === 0 && (
                                    <td rowSpan={expiryGroups.length} className="px-3 py-3 align-top">
                                      <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(stockState.tone)}`}>
                                        {stockState.label}
                                      </span>
                                    </td>
                                  )}
                                  {groupIndex === 0 && (
                                    <td rowSpan={expiryGroups.length} className="px-3 py-3 align-top">
                                      <div className="flex justify-end gap-2">
                                        <ActionIconButton
                                          icon={PackagePlus}
                                          label="Nhập hàng"
                                          variant="info"
                                          onClick={() => handleOpenReceiveModal(asset)}
                                        />
                                        {!isConsumableManager && (
                                          <ActionIconButton
                                            icon={Send}
                                            label="Cấp phát"
                                            variant="success"
                                            onClick={() => handleOpenIssueModal(asset)}
                                          />
                                        )}
                                        <ActionIconButton
                                          icon={Wrench}
                                          label="Sửa vật tư"
                                          variant="primary"
                                          onClick={() => handleSelectAsset(asset)}
                                        />
                                        <ActionIconButton
                                          icon={Trash2}
                                          label="Xóa vật tư"
                                          variant="danger"
                                          onClick={() => handleDeleteAsset(asset.qaCode)}
                                        />
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              )
                            })
                          })}
                        {!loading && assets.length === 0 && (
                          <tr>
                            <td colSpan={8} className="px-3 py-8 text-center text-sm text-slate-500">
                              Chưa có vật tư tiêu hao phù hợp.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                    </div>
                  </div>

                  {!loading && pageInfo.totalItems > 0 && (
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
                      {currentPage >= 3 && (
                        <button type="button" onClick={goToFirstPage} className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100">
                          Trang đầu
                        </button>
                      )}
                      {currentPage >= 2 && (
                        <button type="button" onClick={goToPrevPage} className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100">
                          Trang trước
                        </button>
                      )}
                      <span className="font-semibold text-slate-700">Trang {currentPage}</span>
                      {currentPage < totalPages && (
                        <button type="button" onClick={goToNextPage} className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100">
                          Trang tiếp
                        </button>
                      )}
                      {currentPage < totalPages && (
                        <button type="button" onClick={goToLastPage} className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100">
                          Trang cuối
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : consumableWorkspace === 'ROOMS' ? (
            <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-4 border-b border-slate-200 pb-3 dark:border-slate-800">
                  <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Tìm phòng</label>
                </div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    value={roomSearchKeyword}
                    onChange={(e) => setRoomSearchKeyword(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none ring-fptOrange focus:ring-2"
                    placeholder="Tìm phòng..."
                  />
                </div>
                <div className="mt-4 max-h-[424px] space-y-2 overflow-y-auto pr-1">
                  {filteredRoomOptions.map((location) => {
                    const active = String(location.id) === String(selectedOverviewLocationId)
                    return (
                      <button
                        key={location.id}
                        type="button"
                        onClick={() => handleLocationOverviewChange(String(location.id))}
                        className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm ${
                          active ? 'border-fptOrange bg-orange-50 text-fptOrangeDark dark:bg-orange-500/10 dark:text-orange-300' : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className="truncate">{location.roomName}</span>
                        <span className="whitespace-nowrap text-xs text-slate-400 dark:text-slate-500">{active ? 'Đang xem' : ''}</span>
                      </button>
                    )
                  })}
                  {filteredRoomOptions.length === 0 && (
                    <p className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500">
                      Không có phòng phù hợp với từ khóa tìm kiếm.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-4 flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-600">Không gian theo phòng</p>
                      <h3 className="text-lg font-semibold text-slate-800">
                        {locationOverview?.locationName ? `Danh sách vật tư tại: ${locationOverview.locationName}` : 'Theo dõi vật tư theo phòng'}
                      </h3>
                      <p className="text-sm text-slate-500">
                        Theo dõi số lượng đã cấp, số còn lại và cập nhật tiêu hao thực tế tại từng phòng.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenConsumableRequestModal()}
                        disabled={!selectedOverviewLocationId}
                        className="inline-flex items-center gap-2 rounded-lg border border-fptOrange px-3 py-2 text-sm font-semibold text-fptOrangeDark hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Plus size={16} />
                        Yêu cầu cấp phát
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowLocationIssueHistory((prev) => !prev)}
                        disabled={!selectedOverviewLocationId}
                        className="inline-flex items-center gap-2 rounded-lg border border-indigo-300 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <History size={16} />
                        {showLocationIssueHistory ? 'Ẩn lịch sử' : 'Lịch sử'}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (selectedOverviewLocationId) {
                            await loadLocationOverview(selectedOverviewLocationId)
                          }
                        }}
                        disabled={!selectedOverviewLocationId || locationOverviewLoading}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <RefreshCw size={16} />
                        Làm mới phòng
                      </button>
                    </div>
                  </div>

                  {!selectedOverviewLocationId && (
                    <p className="rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500">
                      Chọn một phòng ở cột bên trái để xem vật tư đang có tại phòng đó.
                    </p>
                  )}

                  {selectedOverviewLocationId && (
                    <div className="overflow-hidden rounded-2xl border border-slate-200">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-100/80">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold text-slate-600">Tên vật tư</th>
                            <th className="px-3 py-2 text-left font-semibold text-slate-600">Đơn vị</th>
                            <th className="px-3 py-2 text-left font-semibold text-slate-600">Lần cấp gần nhất</th>
                            <th className="px-3 py-2 text-left font-semibold text-slate-600">Tồn tại phòng</th>
                            <th className="px-3 py-2 text-left font-semibold text-slate-600">Đã cấp</th>
                            <th className="px-3 py-2 text-left font-semibold text-slate-600">Đã dùng</th>
                            <th className="px-3 py-2 text-left font-semibold text-slate-600">Hạn sử dụng</th>
                            <th className="px-3 py-2 text-left font-semibold text-slate-600">Hành động</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {locationOverviewLoading &&
                            Array.from({ length: 5 }).map((_, index) => (
                              <tr key={`room-stock-skeleton-${index}`} className="animate-pulse">
                                {Array.from({ length: 8 }).map((__, cellIndex) => (
                                  <td key={`room-stock-cell-${cellIndex}`} className="px-3 py-3">
                                    <div className="h-4 w-24 rounded bg-slate-200" />
                                  </td>
                                ))}
                              </tr>
                            ))}
                          {!locationOverviewLoading &&
                            (locationOverview?.stocks || []).map((stock) => (
                              (() => {
                                const expiryState = getConsumableExpiryState(stock)
                                return (
                                  <tr key={`${stock.assetQaCode}-${stock.locationId}`} className="hover:bg-slate-50/70">
                                    <td className="px-3 py-3">
                                      <div className="font-medium text-slate-700">{stock.assetName}</div>
                                      <div className="text-xs text-slate-500">{stock.categoryName}</div>
                                    </td>
                                    <td className="px-3 py-3">{stock.unit || 'đơn vị'}</td>
                                    <td className="px-3 py-3">
                                      <div>{formatDateTime(stock.lastIssuedAt)}</div>
                                      <div className="text-xs text-slate-500">{getActorName(stock)}</div>
                                    </td>
                                    <td className="px-3 py-3">
                                      <div
                                        className={`inline-flex min-w-[72px] justify-end rounded-md px-2 py-1 font-semibold ${
                                          stock.quantityRemaining <= 0
                                            ? 'bg-red-100 text-red-700'
                                            : stock.quantityRemaining <= Math.max(1, Math.floor(stock.quantityIssued * 0.2))
                                              ? 'bg-amber-100 text-amber-700'
                                              : 'bg-emerald-100 text-emerald-700'
                                        }`}
                                      >
                                        {stock.quantityRemaining}
                                      </div>
                                    </td>
                                    <td className="px-3 py-3">{stock.quantityIssued}</td>
                                    <td className="px-3 py-3">{stock.quantityConsumed}</td>
                                    <td className={`px-3 py-3 ${stock.expiryTrackingEnabled ? '' : 'text-center align-middle'}`}>
                                      {stock.expiryTrackingEnabled ? (
                                        <div className="flex flex-col gap-1">
                                          <span className="text-xs text-slate-500">{expiryState.dateLabel}</span>
                                          <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(expiryState.tone)}`}>
                                            {expiryState.label}
                                          </span>
                                        </div>
                                      ) : (
                                        <span
                                          aria-label="Không áp dụng"
                                          className="inline-flex w-full justify-center text-base font-medium leading-none text-slate-400 dark:text-slate-500"
                                        >
                                          –
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-3 py-3">
                                      <div className="flex gap-2">
                                        <ActionIconButton
                                          icon={Package}
                                          label="Tạo yêu cầu cấp phát"
                                          variant="primary"
                                          onClick={() => handleOpenConsumableRequestModal(stock.assetQaCode)}
                                        />
                                        <ActionIconButton
                                          icon={RefreshCw}
                                          label="Cập nhật số lượng còn lại"
                                          variant="warning"
                                          onClick={() => handleOpenStockAdjustModal(stock)}
                                        />
                                      </div>
                                    </td>
                                  </tr>
                                )
                              })()
                            ))}
                          {!locationOverviewLoading && selectedOverviewLocationId && (locationOverview?.stocks || []).length === 0 && (
                            <tr>
                              <td colSpan={8} className="px-3 py-10 text-center text-sm text-slate-500">
                                Phòng này chưa có vật tư tiêu hao được cấp phát.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    </div>
                  )}
                </div>

                {showLocationIssueHistory && selectedOverviewLocationId && (
                  <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-3">
                      <h4 className="text-base font-semibold text-slate-800">Lịch sử cấp phát của phòng</h4>
                      {locationOverviewLoading && <span className="text-xs text-slate-500">Đang tải...</span>}
                    </div>
                    <div className="space-y-2">
                      {(locationOverview?.issueHistory || []).map((item) => (
                        <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                          <div className="flex flex-col gap-1 lg:flex-row lg:items-center lg:justify-between">
                            <p className="font-medium text-slate-700">{item.assetName}</p>
                            <p className="text-slate-500">
                              {item.quantity} {item.unit || ''} • {formatCurrency(item.unitPrice)}
                            </p>
                          </div>
                          <p className="text-slate-500">{formatDateTime(item.issuedAt)}</p>
                          <p className="text-slate-500">{item.issuedByFullName || item.issuedByUsername}</p>
                          {item.note && <p className="mt-1 text-slate-600">{item.note}</p>}
                        </div>
                      ))}
                      {(locationOverview?.issueHistory || []).length === 0 && !locationOverviewLoading && (
                        <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                          Chưa có lịch sử cấp phát cho phòng này.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {selectedOverviewLocationId && (
                  <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-3">
                      <h4 className="text-base font-semibold text-slate-800">Yêu cầu cấp phát gần đây</h4>
                      {(isConsumableManager || isAdmin) && (
                        <button
                          type="button"
                          onClick={() => handleOpenConsumableRequestModal()}
                          className="rounded-lg border border-fptOrange px-3 py-2 text-sm font-semibold text-fptOrangeDark hover:bg-orange-50"
                        >
                          Tạo yêu cầu mới
                        </button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {(locationOverview?.requestHistory || []).map((item) => (
                        <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                          <div className="flex flex-col gap-1 lg:flex-row lg:items-center lg:justify-between">
                            <p className="font-medium text-slate-700">{item.assetName}</p>
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getConsumableRequestStatusMeta(item.status).className}`}>
                              {getConsumableRequestStatusMeta(item.status).label}
                            </span>
                          </div>
                          <p className="text-slate-500">
                            {item.quantityRequested} {item.unit || ''} • {formatDateTime(item.createdAt)}
                          </p>
                          <p className="text-slate-500">Người tạo phiếu: {item.requestedByFullName || item.requestedByUsername}</p>
                          <p className="mt-1 text-slate-600">{item.reason}</p>
                          {item.decisionNote && (
                            <p className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-600">
                              Ghi chú xử lý: {item.decisionNote}
                            </p>
                          )}
                          {item.resolvedAt && (
                            <p className="mt-2 text-xs text-slate-500">
                              Xử lý lúc {formatDateTime(item.resolvedAt)} bởi {item.resolvedByFullName || item.resolvedByUsername}
                            </p>
                          )}
                          {isAdmin && String(item.status || '').toUpperCase() === 'PENDING' && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <ActionIconButton
                                icon={Check}
                                label="Duyệt cấp phát"
                                variant="success"
                                className="h-8 w-8"
                                onClick={() => handleOpenConsumableDecisionModal(item, 'APPROVE')}
                              />
                              <ActionIconButton
                                icon={X}
                                label="Từ chối phiếu"
                                variant="danger"
                                className="h-8 w-8"
                                onClick={() => handleOpenConsumableDecisionModal(item, 'REJECT')}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                      {(locationOverview?.requestHistory || []).length === 0 && !locationOverviewLoading && (
                        <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                          Chưa có yêu cầu cấp phát nào cho phòng này.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : consumableWorkspace === 'DISPOSAL' ? (
            <div className="space-y-5">
              <div className="rounded-3xl border border-red-200 bg-white p-4 shadow-sm dark:border-red-500/30 dark:bg-slate-950">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-red-700 dark:text-red-300">Lịch sử tiêu huỷ</p>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Tra cứu phiếu tiêu huỷ theo trạng thái</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Có thể lọc theo trạng thái, tìm theo tên vật tư, mã QA, lô hàng hoặc người đề nghị.</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px_auto]">
                    <input
                      value={disposalHistoryFilters.keyword}
                      onChange={(e) => setDisposalHistoryFilters((prev) => ({ ...prev, keyword: e.target.value }))}
                      className={getFieldClass(false)}
                      placeholder="Tìm vật tư, mã QA, lô hàng..."
                    />
                    <select
                      value={disposalHistoryFilters.status}
                      onChange={(e) => setDisposalHistoryFilters((prev) => ({ ...prev, status: e.target.value }))}
                      className={getFieldClass(false)}
                    >
                      <option value="">Tất cả trạng thái</option>
                      <option value="PENDING">Chờ duyệt</option>
                      <option value="APPROVED">Đã tiêu huỷ</option>
                      <option value="REJECTED">Từ chối</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => loadDisposalRequests(disposalHistoryFilters.status)}
                      disabled={disposalRequestsLoading}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/10"
                    >
                      <RefreshCw size={16} />
                      Làm mới
                    </button>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
                {disposalRequestsLoading && (
                  <div className="border-b border-slate-200 px-4 py-8 text-center text-sm text-red-700 dark:border-slate-800 dark:text-red-300">
                    Đang tải lịch sử tiêu huỷ...
                  </div>
                )}
                {!disposalRequestsLoading && (
                  <div className="overflow-x-auto">
                    <table className="min-w-[1120px] text-sm">
                      <thead className="bg-slate-100/80 dark:bg-slate-900/70">
                        <tr>
                          <th className="w-[8%] px-3 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Phiếu</th>
                          <th className="w-[20%] px-3 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Vật tư</th>
                          <th className="w-[12%] px-3 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">Số lượng</th>
                          <th className="w-[10%] px-3 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Số lô</th>
                          <th className="w-[16%] px-3 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Người đề nghị</th>
                          <th className="w-[10%] px-3 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Trạng thái</th>
                          <th className="w-[14%] px-3 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Xử lý</th>
                          <th className="w-[10%] px-3 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">Hành động</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {filteredDisposalRequests.map((item) => {
                          const statusMeta = getConsumableDisposalStatusMeta(item.status)
                          return (
                            <tr key={item.id} className="align-top hover:bg-slate-50/70 dark:hover:bg-slate-900/60">
                              <td className="px-3 py-3 text-slate-700 dark:text-slate-200">
                                <div className="font-semibold">#{item.id}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">{item.assetQaCode}</div>
                              </td>
                              <td className="px-3 py-3 text-slate-700 dark:text-slate-200">
                                <div className="font-medium">{item.assetName}</div>
                                <div className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{item.reason}</div>
                              </td>
                              <td className="px-3 py-3 text-right tabular-nums text-slate-700 dark:text-slate-200">
                                <div className="font-medium whitespace-nowrap">{item.quantityRequested} {item.unit || ''}</div>
                              </td>
                              <td className="px-3 py-3 text-slate-700 dark:text-slate-200">
                                <div className="font-medium">{item.itemCount || item.items?.length || 1} lô</div>
                                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                  {(item.items || []).slice(0, 2).map((lotItem) => lotItem.lotCode || `Lô #${lotItem.receiptLotId}`).join(', ') || (item.lotCode || `Lô #${item.receiptLotId}`)}
                                </div>
                              </td>
                              <td className="px-3 py-3 text-slate-700 dark:text-slate-200">
                                <div className="font-medium">{item.requestedByFullName || item.requestedByUsername}</div>
                                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatDateTime(item.createdAt)}</div>
                              </td>
                              <td className="px-3 py-3">
                                <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${statusMeta.className}`}>
                                  {statusMeta.label}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-slate-700 dark:text-slate-200">
                                {item.resolvedAt ? (
                                  <>
                                    <div className="font-medium">{item.resolvedByFullName || item.resolvedByUsername}</div>
                                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatDateTime(item.resolvedAt)}</div>
                                  </>
                                ) : (
                                  <span className="text-sm text-slate-500 dark:text-slate-400">Đang chờ xử lý</span>
                                )}
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex justify-end gap-2">
                                  <ActionIconButton
                                    icon={Detail}
                                    label="Xem chi tiết phiếu tiêu huỷ"
                                    variant="info"
                                    className="h-9 w-9"
                                    onClick={() => setSelectedDisposalHistoryRequest(item)}
                                  />
                                  {isAdmin && String(item.status || '').toUpperCase() === 'PENDING' && (
                                    <>
                                      <ActionIconButton
                                        icon={Check}
                                        label="Duyệt tiêu huỷ"
                                        variant="success"
                                        className="h-9 w-9"
                                        onClick={() => handleOpenDisposalDecisionModal(item, 'APPROVE')}
                                      />
                                      <ActionIconButton
                                        icon={X}
                                        label="Từ chối yêu cầu tiêu huỷ"
                                        variant="danger"
                                        className="h-9 w-9"
                                        onClick={() => handleOpenDisposalDecisionModal(item, 'REJECT')}
                                      />
                                    </>
                                  )}
                                  {String(item.status || '').toUpperCase() === 'APPROVED' && (
                                    <ActionIconButton
                                      icon={Download}
                                      label="Tải biên bản tiêu huỷ"
                                      variant="default"
                                      className="h-9 w-9"
                                      onClick={() => handleDownloadDisposalDocument(item.id)}
                                      disabled={downloadingDisposalRequestId === item.id}
                                    />
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                        {filteredDisposalRequests.length === 0 && (
                          <tr>
                            <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                              Không có phiếu tiêu huỷ nào khớp với bộ lọc hiện tại.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-600">Workflow cấp phát</p>
                    <h3 className="text-lg font-semibold text-slate-800">Phiếu yêu cầu cấp phát chờ duyệt</h3>
                    <p className="text-sm text-slate-500">Admin duyệt hoặc từ chối các phiếu yêu cầu do nhân viên quản lý cấp phát tạo.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => loadPendingConsumableRequests()}
                    disabled={pendingConsumableRequestsLoading}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                  >
                    <RefreshCw size={16} />
                    Làm mới phiếu
                  </button>
                </div>
                <div className="space-y-3">
                  {pendingConsumableRequestsLoading && (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                      Đang tải danh sách phiếu chờ duyệt...
                    </div>
                  )}
                  {!pendingConsumableRequestsLoading && pendingConsumableRequests.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-slate-800">{item.assetName}</p>
                            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">Chờ duyệt</span>
                          </div>
                          <p className="text-sm text-slate-500">
                            Phiếu #{item.id} • {item.locationName} • {item.quantityRequested} {item.unit || ''}
                          </p>
                          <p className="text-sm text-slate-500">
                            Người yêu cầu: {item.requestedByFullName || item.requestedByUsername} • {formatDateTime(item.createdAt)}
                          </p>
                          <p className="text-sm text-slate-700">{item.reason}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <ActionIconButton
                            icon={Check}
                            label="Duyệt cấp phát"
                            variant="success"
                            className="h-9 w-9"
                            onClick={() => handleOpenConsumableDecisionModal(item, 'APPROVE')}
                          />
                          <ActionIconButton
                            icon={X}
                            label="Từ chối phiếu"
                            variant="danger"
                            className="h-9 w-9"
                            onClick={() => handleOpenConsumableDecisionModal(item, 'REJECT')}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  {!pendingConsumableRequestsLoading && pendingConsumableRequests.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                      Hiện không có phiếu yêu cầu cấp phát nào đang chờ Admin duyệt.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-red-200 bg-white p-4 shadow-sm dark:border-red-500/30 dark:bg-slate-950">
                <div className="mb-4 flex flex-col gap-3 border-b border-red-200 pb-4 dark:border-red-500/20 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-red-700 dark:text-red-300">Workflow tiêu huỷ</p>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Yêu cầu tiêu huỷ hàng hết hạn chờ duyệt</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Admin duyệt tiêu huỷ, xác nhận cập nhật tồn kho và tải biên bản Word ngay sau khi xử lý.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => loadPendingDisposalRequests()}
                    disabled={pendingDisposalRequestsLoading}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/10"
                  >
                    <RefreshCw size={16} />
                    Làm mới yêu cầu
                  </button>
                </div>
                <div className="space-y-3">
                  {pendingDisposalRequestsLoading && (
                    <div className="rounded-2xl border border-dashed border-red-200 px-4 py-8 text-center text-sm text-red-700 dark:border-red-500/30 dark:text-red-300">
                      Đang tải danh sách yêu cầu tiêu huỷ...
                    </div>
                  )}
                  {!pendingDisposalRequestsLoading && pendingDisposalRequests.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-red-200 bg-red-50/50 p-4 dark:border-red-500/30 dark:bg-red-500/5">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-slate-800 dark:text-slate-100">{item.assetName}</p>
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getConsumableDisposalStatusMeta(item.status).className}`}>
                              {getConsumableDisposalStatusMeta(item.status).label}
                            </span>
                          </div>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            Phiếu #{item.id} • {item.quantityRequested} {item.unit || ''} • {item.itemCount || item.items?.length || 1} lô
                          </p>
                          {(item.items || []).slice(0, 2).map((lotItem) => (
                            <p key={lotItem.id || lotItem.receiptLotId} className="text-sm text-slate-500 dark:text-slate-400">
                              {lotItem.lotCode || `Lô #${lotItem.receiptLotId}`} • HSD {formatDate(lotItem.expirationDate)} • {lotItem.quantityRequested} {item.unit || ''}
                            </p>
                          ))}
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            Người đề nghị: {item.requestedByFullName || item.requestedByUsername} • {formatDateTime(item.createdAt)}
                          </p>
                          <p className="text-sm text-slate-700 dark:text-slate-200">{item.reason}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <ActionIconButton
                            icon={Check}
                            label="Duyệt tiêu huỷ"
                            variant="success"
                            className="h-9 w-9"
                            onClick={() => handleOpenDisposalDecisionModal(item, 'APPROVE')}
                            disabled={downloadingDisposalRequestId === item.id}
                          />
                          <ActionIconButton
                            icon={X}
                            label="Từ chối yêu cầu tiêu huỷ"
                            variant="danger"
                            className="h-9 w-9"
                            onClick={() => handleOpenDisposalDecisionModal(item, 'REJECT')}
                            disabled={downloadingDisposalRequestId === item.id}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  {!pendingDisposalRequestsLoading && pendingDisposalRequests.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-red-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-red-500/30 dark:text-slate-400">
                      Hiện không có yêu cầu tiêu huỷ nào đang chờ Admin duyệt.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-base font-semibold text-slate-800">Lọc và tìm kiếm tài sản cố định</h3>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <input
                value={filters.name}
                onChange={(e) => setFilters((prev) => ({ ...prev, name: e.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
                placeholder="Tên thiết bị"
              />
              <div className="relative">
                <input
                  value={filters.categoryKeyword}
                  onFocus={() => setShowCategoryFilterOptions(true)}
                  onChange={(e) => {
                    setFilters((prev) => ({ ...prev, categoryKeyword: e.target.value, categoryId: '' }))
                    setShowCategoryFilterOptions(true)
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
                  placeholder="Loại thiết bị (gõ để lọc)"
                />
                {showCategoryFilterOptions && (
                  <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setFilters((prev) => ({ ...prev, categoryId: '', categoryKeyword: '' }))
                        setShowCategoryFilterOptions(false)
                      }}
                      className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-orange-50"
                    >
                      Tất cả loại
                    </button>
                    {filteredCategoryOptions.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => {
                          setFilters((prev) => ({
                            ...prev,
                            categoryId: String(category.id),
                            categoryKeyword: getCategoryLabel(category),
                          }))
                          setShowCategoryFilterOptions(false)
                        }}
                        className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-orange-50"
                      >
                        {getCategoryLabel(category)}
                      </button>
                    ))}
                    {filteredCategoryOptions.length === 0 && (
                      <p className="px-3 py-2 text-sm text-slate-500">Không có loại phù hợp.</p>
                    )}
                  </div>
                )}
              </div>
              <select
                value={filters.status}
                onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
              >
                <option value="">Tất cả trạng thái</option>
                {itemizedStatusOptions.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
              <select
                value={filters.locationId}
                onChange={(e) => setFilters((prev) => ({ ...prev, locationId: e.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
              >
                <option value="">Tất cả phòng</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.roomName}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={handleSearch}
                disabled={loading}
                className="rounded-lg bg-fptOrange px-3 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark disabled:opacity-60"
              >
                Tìm kiếm
              </button>
              <button
                type="button"
                onClick={handleResetFilters}
                disabled={loading}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              >
                Xóa bộ lọc
              </button>
              <button
                type="button"
                onClick={handleDownloadExcel}
                disabled={downloading}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                Tải báo cáo Excel
              </button>
            </div>
          </div>

          <div className="rounded-xl bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">Danh sách tài sản cố định</h2>
              <p className="text-sm text-slate-500">Tổng: {pageInfo.totalItems}</p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">
                    <button type="button" onClick={() => handleSort('qaCode')} className="hover:text-fptOrange">
                      {getSortLabel('qaCode', 'Mã QA')}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">
                    <button type="button" onClick={() => handleSort('name')} className="hover:text-fptOrange">
                      {getSortLabel('name', 'Tên thiết bị')}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">
                    <button type="button" onClick={() => handleSort('category')} className="hover:text-fptOrange">
                      {getSortLabel('category', 'Loại')}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">
                    <button type="button" onClick={() => handleSort('homeLocationName')} className="hover:text-fptOrange">
                      {getSortLabel('homeLocationName', 'Vị trí')}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">
                    <button type="button" onClick={() => handleSort('status')} className="hover:text-fptOrange">
                      {getSortLabel('status', 'Tình trạng kỹ thuật')}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Trạng thái sử dụng</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Thuộc tính</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Nguồn gốc tài sản</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-600">Thao tác</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading &&
                    Array.from({ length: 6 }).map((_, index) => (
                      <tr key={`skeleton-${index}`} className="animate-pulse">
                        {Array.from({ length: 9 }).map((__, cellIndex) => (
                          <td key={`cell-${cellIndex}`} className="px-3 py-2">
                            <div className="h-4 w-24 rounded bg-slate-200" />
                          </td>
                        ))}
                      </tr>
                    ))}
                  {!loading &&
                    assets.map((asset) => (
                      <tr key={asset.qaCode}>
                        <td className="px-3 py-2">{asset.qaCode}</td>
                        <td className="px-3 py-2">{asset.name}</td>
                        <td className="px-3 py-2">{asset.category}</td>
                        <td className="px-3 py-2">{asset.homeLocationName || asset.homeLocationId}</td>
                        <td className="px-3 py-2">
                          <div className="space-y-1">
                            <p>{getTechnicalStatusLabel(asset.technicalStatus || asset.status)}</p>
                            {asset.status && asset.status !== asset.technicalStatus && asset.status !== 'Hoạt động tốt' && (
                              <p className="text-xs text-slate-500">Hiển thị: {getAssetStatusLabel(asset.status)}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2">{getUsageStatusLabel(asset.usageStatus)}</td>
                        <td className="px-3 py-2">
                          <ActionIconButton
                            icon={Detail}
                            label="Xem đặc tính kỹ thuật"
                            variant="violet"
                            onClick={async () => {
                              try {
                                const detail = await fetchAssetDetail(asset.qaCode)
                                setSelectedSpecsAsset(detail)
                                setShowSpecsModal(true)
                              } catch (error) {
                                const message = error?.response?.data?.message || 'Không thể tải đặc tính kỹ thuật của thiết bị.'
                                toast.error(message)
                              }
                            }}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <ActionIconButton
                            icon={Search}
                            label="Xem nguồn gốc tài sản"
                            variant="warning"
                            onClick={async () => {
                              try {
                                const detail = await fetchAssetDetail(asset.qaCode)
                                setSelectedOriginAsset(detail)
                                setShowOriginModal(true)
                              } catch (error) {
                                const message = error?.response?.data?.message || 'Không thể tải nguồn gốc tài sản của thiết bị.'
                                toast.error(message)
                              }
                            }}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-2">
                            <ActionIconButton
                              icon={QrCode}
                              label="Xem mã QR"
                              variant="success"
                              onClick={() => handleOpenQrModal(asset.qaCode)}
                              disabled={qrModalLoading}
                            />
                            <ActionIconButton
                              icon={History}
                              label="Xem timeline sửa chữa"
                              variant="violet"
                              onClick={() => {
                                setTimelineAsset(asset)
                                setShowTimelineModal(true)
                              }}
                            />
                            <ActionIconButton
                              icon={Wrench}
                              label="Sửa tài sản"
                              variant="primary"
                              onClick={() => handleSelectAsset(asset)}
                            />
                            <ActionIconButton
                              icon={Trash2}
                              label="Xóa tài sản"
                              variant="danger"
                              onClick={() => handleDeleteAsset(asset.qaCode)}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  {!loading && assets.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-6 text-center text-sm text-slate-500">
                        Chưa có tài sản cố định phù hợp.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {!loading && pageInfo.totalItems > 0 && (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
                {currentPage >= 3 && (
                  <button type="button" onClick={goToFirstPage} className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100">
                    Trang đầu
                  </button>
                )}
                {currentPage >= 2 && (
                  <button type="button" onClick={goToPrevPage} className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100">
                    Trang trước
                  </button>
                )}
                <span className="font-semibold text-slate-700">Trang {currentPage}</span>
                {currentPage < totalPages && (
                  <button type="button" onClick={goToNextPage} className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100">
                    Trang tiếp
                  </button>
                )}
                {currentPage < totalPages && (
                  <button type="button" onClick={goToLastPage} className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100">
                    Trang cuối
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[95vh] w-full max-w-4xl overflow-auto rounded-xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-base font-semibold text-slate-800">
                {isEditing ? `Chỉnh sửa ${isConsumableForm ? 'vật phẩm' : 'thiết bị'} ${selectedQaCode}` : `Thêm mới ${isConsumableForm ? 'vật phẩm tiêu hao' : 'thiết bị'}`}
              </h4>
              <button
                type="button"
                onClick={closeFormModal}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Đóng
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {isEditing && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Mã QA</label>
                  <input
                    value={selectedQaCode || ''}
                    disabled
                    className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-600"
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{isConsumableForm ? 'Tên vật phẩm' : 'Tên thiết bị'}</label>
                <input
                  value={form.name}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                    setFormErrors((prev) => ({ ...prev, name: '' }))
                  }}
                  className={getFieldClass(Boolean(formErrors.name))}
                  placeholder={isConsumableForm ? 'Nhập tên vật tư tiêu hao' : 'Nhập tên thiết bị'}
                />
                {formErrors.name && <p className="mt-1 text-xs text-red-600">{formErrors.name}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{isConsumableForm ? 'Loại vật phẩm' : 'Loại thiết bị'}</label>
                <select
                  value={form.categoryId}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className={getFieldClass(Boolean(formErrors.categoryId))}
                >
                  <option value="">Chọn loại</option>
                  {formCategoryOptions.map((category) => (
                    <option key={category.id} value={category.id}>
                      {getCategoryLabel(category)}
                    </option>
                  ))}
                </select>
                {formErrors.categoryId && <p className="mt-1 text-xs text-red-600">{formErrors.categoryId}</p>}
                <p className="mt-1 text-xs text-slate-500">
                  Chỉ hiển thị category phù hợp với kiểu theo dõi đang chọn.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{isConsumableForm ? 'Kho lưu trữ' : 'Phòng gốc'}</label>
                <select
                  value={form.locationId}
                  onChange={(e) => {
                    if (isConsumableForm) return
                    setForm((prev) => ({ ...prev, locationId: e.target.value }))
                    setFormErrors((prev) => ({ ...prev, locationId: '' }))
                  }}
                  disabled={isConsumableForm}
                  className={`${getFieldClass(Boolean(formErrors.locationId))} ${isConsumableForm ? 'cursor-not-allowed bg-slate-100 text-slate-600' : ''}`}
                >
                  {isConsumableForm ? (
                    <option value={consumableStorageLocation?.id || ''}>
                      {consumableStorageLocation?.roomName || 'Chưa tìm thấy phòng Kho'}
                    </option>
                  ) : (
                    <>
                      <option value="">Chọn phòng</option>
                      {locations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.roomName}
                        </option>
                      ))}
                    </>
                  )}
                </select>
                {formErrors.locationId && <p className="mt-1 text-xs text-red-600">{formErrors.locationId}</p>}
                {isConsumableForm && (
                  <p className="mt-1 text-xs text-slate-500">
                    Vật tư tiêu hao luôn được ghi nhận về phòng `Kho` trước khi cấp phát, nên không thể thay đổi kho lưu trữ tại đây.
                  </p>
                )}
              </div>
              {!isConsumableForm && (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Tình trạng kỹ thuật</label>
                    <select
                      value={form.technicalStatus}
                      onChange={(e) => {
                        setForm((prev) => ({ ...prev, technicalStatus: e.target.value }))
                        setFormErrors((prev) => ({ ...prev, technicalStatus: '' }))
                      }}
                      className={getFieldClass(Boolean(formErrors.technicalStatus))}
                    >
                      {technicalStatusOptions.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                    {formErrors.technicalStatus && <p className="mt-1 text-xs text-red-600">{formErrors.technicalStatus}</p>}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Trạng thái sử dụng</label>
                    <select
                      value={form.usageStatus}
                      onChange={(e) => {
                        setForm((prev) => ({ ...prev, usageStatus: e.target.value }))
                        setFormErrors((prev) => ({ ...prev, usageStatus: '' }))
                      }}
                      className={getFieldClass(Boolean(formErrors.usageStatus))}
                    >
                      {usageStatusOptions.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                    {formErrors.usageStatus && <p className="mt-1 text-xs text-red-600">{formErrors.usageStatus}</p>}
                    <p className="mt-1 text-xs text-slate-500">
                      `Tình trạng kỹ thuật` và `Trạng thái sử dụng` được lưu riêng để tránh chồng nghĩa giữa hỏng và đang sửa chữa.
                    </p>
                  </div>
                </>
              )}
              {isConsumableForm && (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Số lượng nhập kho ban đầu</label>
                    <input
                      type="number"
                      min="0"
                      value={form.quantityOnHand}
                      onChange={(e) => {
                        setForm((prev) => ({ ...prev, quantityOnHand: e.target.value }))
                        setFormErrors((prev) => ({ ...prev, quantityOnHand: '' }))
                      }}
                      disabled={isEditing}
                      className={`${getFieldClass(Boolean(formErrors.quantityOnHand))} ${isEditing ? 'cursor-not-allowed bg-slate-100 text-slate-500' : ''}`}
                      placeholder="Ví dụ: 500"
                    />
                    {formErrors.quantityOnHand && <p className="mt-1 text-xs text-red-600">{formErrors.quantityOnHand}</p>}
                    {isEditing && <p className="mt-1 text-xs text-slate-500">Tồn kho tổng được quản lý theo từng lô nhập, vui lòng dùng `Nhập hàng` để tăng tồn.</p>}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Ngưỡng cảnh báo tồn</label>
                    <input
                      type="number"
                      min="0"
                      value={form.minimumStock}
                      onChange={(e) => {
                        setForm((prev) => ({ ...prev, minimumStock: e.target.value }))
                        setFormErrors((prev) => ({ ...prev, minimumStock: '' }))
                      }}
                      className={getFieldClass(Boolean(formErrors.minimumStock))}
                      placeholder="Ví dụ: 50"
                    />
                    {formErrors.minimumStock && <p className="mt-1 text-xs text-red-600">{formErrors.minimumStock}</p>}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Đơn vị tính</label>
                    <input
                      value={form.unit}
                      onChange={(e) => {
                        setForm((prev) => ({ ...prev, unit: e.target.value }))
                        setFormErrors((prev) => ({ ...prev, unit: '' }))
                      }}
                      className={getFieldClass(Boolean(formErrors.unit))}
                      placeholder="Ví dụ: cây, hộp, ram"
                    />
                    {formErrors.unit && <p className="mt-1 text-xs text-red-600">{formErrors.unit}</p>}
                  </div>
                  <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">Quản lý hạn sử dụng</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Bật cho các mặt hàng như thực phẩm, thuốc thang hoặc các vật tư cần theo dõi ngày hết hạn theo từng lô nhập.
                        </p>
                      </div>
                      <label className="inline-flex items-center gap-3 rounded-full border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={Boolean(form.expiryTrackingEnabled)}
                          onChange={(e) => {
                            const enabled = e.target.checked
                            setForm((prev) => ({
                              ...prev,
                              expiryTrackingEnabled: enabled,
                              expirationDate: enabled ? prev.expirationDate : '',
                            }))
                            setFormErrors((prev) => ({ ...prev, expirationDate: '' }))
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-fptOrange focus:ring-fptOrange"
                        />
                        <span>{form.expiryTrackingEnabled ? 'Có quản lý hạn dùng' : 'Không quản lý hạn dùng'}</span>
                      </label>
                    </div>
                    {form.expiryTrackingEnabled ? (
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">
                            {formMode === 'edit' ? 'Lô gần hết hạn hiện tại' : 'Hạn dùng lô khởi tạo ban đầu'}
                          </label>
                          <input
                            type="date"
                            value={form.expirationDate}
                            onChange={(e) => {
                              setForm((prev) => ({ ...prev, expirationDate: e.target.value }))
                              setFormErrors((prev) => ({ ...prev, expirationDate: '' }))
                            }}
                            disabled={formMode === 'edit'}
                            className={getFieldClass(Boolean(formErrors.expirationDate))}
                          />
                          {formErrors.expirationDate && <p className="mt-1 text-xs text-red-600">{formErrors.expirationDate}</p>}
                        </div>
                        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-3 py-3 text-xs text-slate-500">
                          {formMode === 'edit'
                            ? 'Mặt hàng này đang quản lý hạn dùng theo từng lô. Muốn cập nhật hạn mới, hãy dùng chức năng Nhập hàng để tạo lô mới hoặc xử lý các lô tồn hiện có.'
                            : 'Khi tạo mới có tồn đầu kỳ, ngày này sẽ được lưu cho lô khởi tạo ban đầu. Các lần nhập hàng sau sẽ có hạn dùng riêng cho từng lô.'}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-3 text-xs text-slate-500">
                        Nếu tắt, vật tư này vẫn quản lý tồn kho bình thường nhưng không hiển thị cột cảnh báo hạn sử dụng.
                      </p>
                    )}
                  </div>
                </>
              )}
              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label className="block text-sm font-medium text-slate-700">Nhà cung cấp</label>
                  <button
                    type="button"
                    onClick={() => {
                      resetSupplierForm()
                      setShowSupplierCreateModal(true)
                    }}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-emerald-300 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
                    title="Thêm nhà cung cấp mới"
                    aria-label="Thêm nhà cung cấp mới"
                  >
                    +
                  </button>
                </div>
                <div className="relative">
                  <input
                    value={supplierKeyword}
                    onFocus={() => setShowSupplierOptions(true)}
                    onChange={(e) => {
                      setSupplierKeyword(e.target.value)
                      setForm((prev) => ({ ...prev, supplierId: '' }))
                      setShowSupplierOptions(true)
                      setFormErrors((prev) => ({ ...prev, supplierId: '' }))
                    }}
                    className={getFieldClass(Boolean(formErrors.supplierId))}
                    placeholder="Gõ để tìm nhà cung cấp"
                  />
                  {showSupplierOptions && (
                    <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                      {filteredSupplierOptions.map((supplier) => (
                        <button
                          key={supplier.id}
                          type="button"
                          onClick={() => {
                            setForm((prev) => ({ ...prev, supplierId: String(supplier.id) }))
                            setSupplierKeyword(getSupplierLabel(supplier))
                            setShowSupplierOptions(false)
                            setFormErrors((prev) => ({ ...prev, supplierId: '' }))
                          }}
                          className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-orange-50"
                        >
                          <div>
                            <p className="font-medium text-slate-700">{getSupplierLabel(supplier)}</p>
                            <p className="text-xs text-slate-500">{supplier.phoneNumber || 'Chưa có SĐT'}</p>
                          </div>
                        </button>
                      ))}
                      {filteredSupplierOptions.length === 0 && (
                        <p className="px-3 py-2 text-sm text-slate-500">Không có nhà cung cấp phù hợp.</p>
                      )}
                    </div>
                  )}
                </div>
                {formErrors.supplierId && <p className="mt-1 text-xs text-red-600">{formErrors.supplierId}</p>}
                {isConsumableForm && <p className="mt-1 text-xs text-slate-500">Trường này là tùy chọn với vật phẩm tiêu hao.</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{isConsumableForm ? 'Đơn giá' : 'Giá mua'}</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatPurchasePriceInput(form.purchasePrice)}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, purchasePrice: normalizePurchasePriceInput(e.target.value) }))
                    setFormErrors((prev) => ({ ...prev, purchasePrice: '' }))
                  }}
                  disabled={isConsumableForm && isEditing}
                  className={`${getFieldClass(Boolean(formErrors.purchasePrice))} ${isConsumableForm && isEditing ? 'cursor-not-allowed bg-slate-100 text-slate-500' : ''}`}
                  placeholder={isConsumableForm ? 'Nhập đơn giá 1 đơn vị, ví dụ 12.000' : 'Nhập giá mua, ví dụ 4.590.000'}
                />
                {formErrors.purchasePrice && <p className="mt-1 text-xs text-red-600">{formErrors.purchasePrice}</p>}
                {isConsumableForm && <p className="mt-1 text-xs text-slate-500">{isEditing ? 'Đơn giá trung bình hiện tại được tổng hợp từ các lô nhập và không sửa trực tiếp tại đây.' : 'Đây là đơn giá của 1 đơn vị sản phẩm.'}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{isConsumableForm ? 'Ngày nhập kho ban đầu' : 'Ngày mua'}</label>
                <input
                  type="date"
                  value={form.purchaseDate}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, purchaseDate: e.target.value }))
                    setFormErrors((prev) => ({ ...prev, purchaseDate: '', warrantyExpirationDate: '' }))
                  }}
                  disabled={isConsumableForm && isEditing}
                  className={`${getFieldClass(Boolean(formErrors.purchaseDate))} ${isConsumableForm && isEditing ? 'cursor-not-allowed bg-slate-100 text-slate-500' : ''}`}
                />
                {formErrors.purchaseDate && <p className="mt-1 text-xs text-red-600">{formErrors.purchaseDate}</p>}
              </div>
              {!isConsumableForm && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Hạn bảo hành</label>
                  <input
                    type="date"
                    value={form.warrantyExpirationDate}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, warrantyExpirationDate: e.target.value }))
                      setFormErrors((prev) => ({ ...prev, warrantyExpirationDate: '' }))
                    }}
                    className={getFieldClass(Boolean(formErrors.warrantyExpirationDate))}
                  />
                  {formErrors.warrantyExpirationDate && <p className="mt-1 text-xs text-red-600">{formErrors.warrantyExpirationDate}</p>}
                </div>
              )}

              {!isConsumableForm && (
                <div className="md:col-span-2">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label className="block text-sm font-medium text-slate-700">Đặc tính kỹ thuật</label>
                  <button
                    type="button"
                    onClick={addCustomSpecEntry}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Thêm thông số kỹ thuật tuỳ chỉnh
                  </button>
                </div>
                <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  {form.specEntries.map((entry, index) => (
                    <div key={entry.clientKey || `spec-${index}`} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                      {entry.isCustom ? (
                        <input
                          value={entry.name}
                          onChange={(e) => updateSpecEntry(index, 'name', e.target.value)}
                          placeholder="Tên thuộc tính"
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
                        />
                      ) : (
                        <input
                          value={entry.name}
                          disabled
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                        />
                      )}
                      <input
                        value={entry.value}
                        onChange={(e) => updateSpecEntry(index, 'value', e.target.value)}
                        placeholder="Giá trị thuộc tính"
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
                      />
                      <button
                        type="button"
                        onClick={() => removeSpecEntry(index)}
                        className="inline-flex items-center justify-center rounded-lg border border-red-300 px-3 py-2 text-red-700 hover:bg-red-50"
                        title="Xóa đặc tính kỹ thuật"
                        aria-label="Xóa đặc tính kỹ thuật"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  {form.specEntries.length === 0 && (
                    <p className="text-sm text-slate-500">Chọn loại thiết bị để hệ thống gợi ý các đặc tính kỹ thuật phù hợp.</p>
                  )}
                </div>
                {formErrors.specEntries && <p className="mt-1 text-xs text-red-600">{formErrors.specEntries}</p>}
                </div>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              {!isEditing && (
                <button
                  type="button"
                  onClick={handleCreateAsset}
                  disabled={submitting}
                  className="rounded-lg bg-fptOrange px-4 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark disabled:opacity-60"
                >
                  Thêm mới
                </button>
              )}
              {isEditing && (
                <button
                  type="button"
                  onClick={handleUpdateAsset}
                  disabled={submitting}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  Lưu chỉnh sửa
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showIssueModal && selectedIssueAsset && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[95vh] w-full max-w-6xl overflow-auto rounded-xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h4 className="text-base font-semibold text-slate-800">Cấp phát vật phẩm - {selectedIssueAsset.name}</h4>
                <p className="text-sm text-slate-500">
                  Tồn hiện tại: {(selectedIssueAsset.quantityOnHand ?? 0)} {selectedIssueAsset.unit || ''}
                </p>
              </div>
              <button
                type="button"
                onClick={closeIssueModal}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Đóng
              </button>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)_minmax(0,1fr)]">
              <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Phòng nhận</label>
                  <select
                    value={issueForm.issuedToLocationId}
                    onChange={(e) => setIssueForm((prev) => ({ ...prev, issuedToLocationId: e.target.value }))}
                    className={getFieldClass(false)}
                  >
                    <option value="">Chọn phòng nhận</option>
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.roomName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Số lượng cấp phát</label>
                  <input
                    type="number"
                    min="1"
                    value={issueForm.quantity}
                    onChange={(e) => setIssueForm((prev) => ({ ...prev, quantity: e.target.value }))}
                    className={getFieldClass(false)}
                    placeholder={`Ví dụ: 10 ${selectedIssueAsset.unit || ''}`}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Ghi chú</label>
                  <textarea
                    rows={3}
                    value={issueForm.note}
                    onChange={(e) => setIssueForm((prev) => ({ ...prev, note: e.target.value }))}
                    className={getFieldClass(false)}
                    placeholder="Ghi chú đợt cấp phát này"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleIssueConsumable}
                  disabled={issueSubmitting}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  Xác nhận cấp phát
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h5 className="font-semibold text-slate-800">Tồn theo phòng</h5>
                  {issueHistoryLoading && <span className="text-xs text-slate-500">Đang tải...</span>}
                </div>
                <div className="max-h-80 space-y-2 overflow-auto">
                  {issueLocationStocks.map((stock) => (
                    <div key={`${stock.assetQaCode}-${stock.locationId}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-700">{stock.locationName}</p>
                          <p className="text-slate-500">
                            Đã cấp: {stock.quantityIssued} {stock.unit || ''}
                          </p>
                          <p className="text-slate-500">
                            Còn lại: {stock.quantityRemaining} {stock.unit || ''} • Đã dùng: {stock.quantityConsumed} {stock.unit || ''}
                          </p>
                          <p className="text-slate-500">
                            Đơn giá: {formatCurrency(stock.unitPrice)} • Giá trị còn lại: {formatCurrency(stock.remainingValue)}
                          </p>
                          <p className="text-slate-500">
                            Cập nhật gần nhất: {formatDateTime(stock.lastUpdatedAt)} • {getActorName(stock)}
                          </p>
                          {stock.lastNote && <p className="mt-1 text-slate-600">{stock.lastNote}</p>}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenStockAdjustModal(stock)}
                          className="rounded-md border border-amber-300 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50"
                        >
                          Cập nhật còn lại
                        </button>
                      </div>
                    </div>
                  ))}
                  {issueLocationStocks.length === 0 && !issueHistoryLoading && (
                    <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
                      Vật tư này chưa được cấp phát cho phòng nào.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h5 className="font-semibold text-slate-800">Lịch sử cấp phát</h5>
                  {issueHistoryLoading && <span className="text-xs text-slate-500">Đang tải...</span>}
                </div>
                <div className="max-h-80 space-y-2 overflow-auto">
                  {issueHistory.map((item) => (
                    <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                      <p className="font-medium text-slate-700">
                        {item.quantity} {item.unit || ''} {'->'} {item.issuedToLocationName}
                      </p>
                      <p className="text-slate-500">
                        {item.issuedByFullName || item.issuedByUsername} • {formatDateTime(item.issuedAt)}
                      </p>
                      <p className="text-slate-500">Đơn giá lúc cấp phát: {formatCurrency(item.unitPrice)}</p>
                      {item.note && <p className="mt-1 text-slate-600">{item.note}</p>}
                    </div>
                  ))}
                  {issueHistory.length === 0 && !issueHistoryLoading && (
                    <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
                      Chưa có lịch sử cấp phát.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showLocationOverviewModal && (
        <div className="fixed inset-0 z-[56] flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[95vh] w-full max-w-6xl overflow-auto rounded-xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h4 className="text-base font-semibold text-slate-800">Vật tư tiêu hao theo phòng</h4>
                <p className="text-sm text-slate-500">
                  Theo dõi vật tư đã cấp cho từng phòng và cập nhật số lượng còn lại sau quá trình sử dụng.
                </p>
              </div>
              <button
                type="button"
                onClick={closeLocationOverviewModal}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Đóng
              </button>
            </div>

            <div className="mb-4 max-w-md">
              <label className="mb-1 block text-sm font-medium text-slate-700">Chọn phòng</label>
              <select
                value={selectedOverviewLocationId}
                onChange={(e) => handleLocationOverviewChange(e.target.value)}
                className={getFieldClass(false)}
              >
                <option value="">Chọn phòng cần xem</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.roomName}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h5 className="font-semibold text-slate-800">
                    {locationOverview?.locationName ? `Vật tư tại ${locationOverview.locationName}` : 'Danh sách vật tư theo phòng'}
                  </h5>
                  <div className="flex items-center gap-2">
                    {locationOverviewLoading && <span className="text-xs text-slate-500">Đang tải...</span>}
                    <button
                      type="button"
                      onClick={() => setShowLocationIssueHistory((prev) => !prev)}
                      disabled={!selectedOverviewLocationId}
                      className="rounded-md border border-indigo-300 px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {showLocationIssueHistory ? 'Ẩn lịch sử' : 'Lịch sử'}
                    </button>
                  </div>
                </div>

                {selectedOverviewLocationId && !locationOverviewLoading && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-slate-600">Vật tư</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-600">Loại</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-600">Đã cấp</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-600">Còn lại</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-600">Đơn giá</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-600">Lần cấp gần nhất</th>
                          <th className="px-3 py-2 text-right font-semibold text-slate-600">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(locationOverview?.stocks || []).map((stock) => (
                          <tr key={`${stock.assetQaCode}-${stock.locationId}`}>
                            <td className="px-3 py-2">
                              <div className="font-medium text-slate-700">{stock.assetName}</div>
                              <div className="text-xs text-slate-500">{stock.assetQaCode}</div>
                            </td>
                            <td className="px-3 py-2">{stock.categoryName}</td>
                            <td className="px-3 py-2">{stock.quantityIssued} {stock.unit || ''}</td>
                            <td className="px-3 py-2">
                              <div>{stock.quantityRemaining} {stock.unit || ''}</div>
                              <div className="text-xs text-slate-500">Đã dùng: {stock.quantityConsumed} {stock.unit || ''}</div>
                            </td>
                            <td className="px-3 py-2">
                              <div>{formatCurrency(stock.unitPrice)}</div>
                              <div className="text-xs text-slate-500">Còn lại: {formatCurrency(stock.remainingValue)}</div>
                            </td>
                            <td className="px-3 py-2">
                              <div>{formatDateTime(stock.lastIssuedAt)}</div>
                              <div className="text-xs text-slate-500">{getActorName(stock)}</div>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <ActionIconButton
                                icon={RefreshCw}
                                label="Cập nhật số lượng còn lại"
                                variant="warning"
                                onClick={() => handleOpenStockAdjustModal(stock)}
                              />
                            </td>
                          </tr>
                        ))}
                        {selectedOverviewLocationId && (locationOverview?.stocks || []).length === 0 && (
                          <tr>
                            <td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-500">
                              Phòng này chưa có vật tư tiêu hao được cấp phát.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {!selectedOverviewLocationId && (
                  <p className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                    Chọn một phòng để xem danh sách vật tư đã cấp phát.
                  </p>
                )}
              </div>

              {showLocationIssueHistory && selectedOverviewLocationId && (
                <div className="rounded-xl border border-slate-200 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h5 className="font-semibold text-slate-800">Lịch sử cấp phát của phòng</h5>
                  {locationOverviewLoading && <span className="text-xs text-slate-500">Đang tải...</span>}
                </div>
                <div className="max-h-[60vh] space-y-2 overflow-auto">
                  {(locationOverview?.issueHistory || []).map((item) => (
                    <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                      <p className="font-medium text-slate-700">
                        {item.assetName} • {item.quantity} {item.unit || ''}
                      </p>
                      <p className="text-slate-500">
                        {formatDateTime(item.issuedAt)} • {formatCurrency(item.unitPrice)}
                      </p>
                      <p className="text-slate-500">{item.issuedByFullName || item.issuedByUsername}</p>
                      {item.note && <p className="mt-1 text-slate-600">{item.note}</p>}
                    </div>
                  ))}
                  {selectedOverviewLocationId && (locationOverview?.issueHistory || []).length === 0 && !locationOverviewLoading && (
                    <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
                      Chưa có lịch sử cấp phát cho phòng này.
                    </p>
                  )}
                </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showReceiveModal && selectedReceiveAsset && (
        <div className="fixed inset-0 z-[57] flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-3xl rounded-xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h4 className="text-base font-semibold text-slate-800">Nhập hàng vật tư</h4>
                <p className="text-sm text-slate-500">
                  {selectedReceiveAsset.name} • Tồn kho hiện tại: {selectedReceiveAsset.quantityOnHand ?? 0} {selectedReceiveAsset.unit || ''}
                </p>
              </div>
              <button
                type="button"
                onClick={closeReceiveModal}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Đóng
              </button>
            </div>

            <div className="grid gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                <p>Kho hiện tại: {selectedReceiveAsset.homeLocationName || selectedReceiveAsset.locationName || 'Chưa cập nhật'}</p>
                <p>Đơn giá trung bình hiện tại: {formatCurrency(selectedReceiveAsset.purchasePrice)}</p>
                <p>Quản lý hạn dùng theo lô: {selectedReceiveAsset.expiryTrackingEnabled ? 'Có' : 'Không'}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Số lượng nhập</label>
                  <input
                    type="number"
                    min="1"
                    value={receiveForm.quantity}
                    onChange={(e) => setReceiveForm((prev) => ({ ...prev, quantity: e.target.value }))}
                    className={getFieldClass(false)}
                    placeholder={`Ví dụ: 100 ${selectedReceiveAsset.unit || ''}`}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Đơn giá lô nhập</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatPurchasePriceInput(receiveForm.unitPrice)}
                    onChange={(e) => setReceiveForm((prev) => ({ ...prev, unitPrice: normalizePurchasePriceInput(e.target.value) }))}
                    className={getFieldClass(false)}
                    placeholder="Ví dụ: 12.000"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Mã lô</label>
                  <input
                    value={receiveForm.lotCode}
                    onChange={(e) => setReceiveForm((prev) => ({ ...prev, lotCode: e.target.value }))}
                    className={getFieldClass(false)}
                    placeholder="Ví dụ: LOT-202605"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Ngày nhập lô</label>
                  <input
                    type="date"
                    value={receiveForm.receivedDate}
                    onChange={(e) => setReceiveForm((prev) => ({ ...prev, receivedDate: e.target.value }))}
                    className={getFieldClass(false)}
                  />
                </div>
                {selectedReceiveAsset.expiryTrackingEnabled && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Hạn sử dụng của lô</label>
                    <input
                      type="date"
                      value={receiveForm.expirationDate}
                      onChange={(e) => setReceiveForm((prev) => ({ ...prev, expirationDate: e.target.value }))}
                      className={getFieldClass(false)}
                    />
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Nhà cung cấp</label>
                  <select
                    value={receiveForm.supplierId}
                    onChange={(e) => setReceiveForm((prev) => ({ ...prev, supplierId: e.target.value }))}
                    className={getFieldClass(false)}
                  >
                    <option value="">Chọn nhà cung cấp</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {getSupplierLabel(supplier)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Ghi chú lô nhập</label>
                  <textarea
                    rows={3}
                    value={receiveForm.note}
                    onChange={(e) => setReceiveForm((prev) => ({ ...prev, note: e.target.value }))}
                    className={getFieldClass(false)}
                    placeholder="Ví dụ: Lô nhập cho tủ thuốc phòng y tế"
                  />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-sm font-semibold text-slate-800">Các lô đang có</p>
                <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                  {(selectedReceiveAsset.receiptLots || []).length === 0 && (
                    <p className="text-sm text-slate-500">Chưa có lô nhập nào được ghi nhận.</p>
                  )}
                  {(selectedReceiveAsset.receiptLots || []).map((lot) => (
                    <div key={lot.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-slate-800">{lot.lotCode || `Lô #${lot.id}`}</p>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(getConsumableExpiryState({ ...lot, expiryTrackingEnabled: selectedReceiveAsset.expiryTrackingEnabled }).tone)}`}>
                          {getConsumableExpiryState({ ...lot, expiryTrackingEnabled: selectedReceiveAsset.expiryTrackingEnabled }).label}
                        </span>
                      </div>
                      <p className="mt-1">Còn lại: {lot.quantityRemaining ?? 0} / {lot.quantityReceived ?? 0} {selectedReceiveAsset.unit || ''}</p>
                      <p>Ngày nhập: {formatDate(lot.receivedDate)} | Hạn dùng: {getConsumableExpiryState({ ...lot, expiryTrackingEnabled: selectedReceiveAsset.expiryTrackingEnabled }).dateLabel}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleReceiveConsumable}
                disabled={receiveSubmitting}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
              >
                Xác nhận nhập hàng
              </button>
            </div>
          </div>
        </div>
      )}

      {showConsumableRequestModal && (
        <div className="fixed inset-0 z-[57] flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-3xl rounded-xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h4 className="text-base font-semibold text-slate-800">Yêu cầu cấp phát vật tư</h4>
                <p className="text-sm text-slate-500">
                  {locationOverview?.locationName ? `Phòng nhận: ${locationOverview.locationName}` : 'Chọn phòng trước khi gửi yêu cầu cấp phát.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeConsumableRequestModal}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Đóng
              </button>
            </div>

            <div className="grid gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Vật tư cần cấp phát</label>
                <select
                  value={consumableRequestForm.assetQaCode}
                  onChange={(e) => {
                    setSelectedRequestAssetQaCode(e.target.value)
                    setConsumableRequestForm((prev) => ({ ...prev, assetQaCode: e.target.value }))
                  }}
                  className={getFieldClass(false)}
                >
                  <option value="">Chọn vật tư</option>
                  {consumableRequestAssetOptions.map((option) => (
                    <option key={option.qaCode} value={option.qaCode}>
                      {option.name} ({option.qaCode})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Số lượng cần cấp phát</label>
                <input
                  type="number"
                  min="1"
                  value={consumableRequestForm.quantityRequested}
                  onChange={(e) => setConsumableRequestForm((prev) => ({ ...prev, quantityRequested: e.target.value }))}
                  className={getFieldClass(false)}
                  placeholder="Ví dụ: 20"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Lý do cần cấp phát</label>
                <textarea
                  rows={4}
                  value={consumableRequestForm.reason}
                  onChange={(e) => setConsumableRequestForm((prev) => ({ ...prev, reason: e.target.value }))}
                  className={getFieldClass(false)}
                  placeholder="Ví dụ: chuẩn bị đầu kỳ học mới, bổ sung cho nhân sự mới, sắp hết vật tư tại phòng..."
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleCreateConsumableRequest}
                disabled={consumableRequestSubmitting}
                className="rounded-lg bg-fptOrange px-4 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark disabled:opacity-60"
              >
                Gửi yêu cầu
              </button>
            </div>
          </div>
        </div>
      )}

      {showDisposalRequestModal && selectedExpiredLot && (
        <div className="fixed inset-0 z-[58] flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-4xl rounded-xl bg-white p-4 shadow-xl dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h4 className="text-base font-semibold text-slate-800 dark:text-slate-100">Tạo yêu cầu tiêu huỷ vật tư hết hạn</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Chọn một hoặc nhiều lô cùng vật tư và nhập số lượng tiêu huỷ theo từng lô.
                </p>
              </div>
              <button
                type="button"
                onClick={closeDisposalRequestModal}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Đóng
              </button>
            </div>

            <div className="grid gap-3">
              <div className="rounded-xl border border-red-200 bg-red-50/70 p-3 text-sm text-slate-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-slate-200">
                <p><span className="font-semibold">Tên vật phẩm:</span> {selectedExpiredLot.assetName}</p>
                <p><span className="font-semibold">Mã vật tư:</span> {selectedExpiredLot.assetQaCode}</p>
                <p><span className="font-semibold">Số lô hết hạn đang có:</span> {disposalRequestForm.items.length}</p>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-900/70">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">Chọn</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">Lô hàng</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">Ngày nhập</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">Hạn sử dụng</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-200">Còn lại</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-200">Số lượng huỷ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {disposalRequestForm.items.map((item) => (
                      <tr key={item.receiptLotId} className="border-t border-slate-200 dark:border-slate-800">
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={Boolean(item.selected)}
                            onChange={(e) => {
                              const checked = e.target.checked
                              setDisposalRequestForm((prev) => ({
                                ...prev,
                                items: prev.items.map((entry) => (
                                  entry.receiptLotId === item.receiptLotId
                                    ? {
                                        ...entry,
                                        selected: checked,
                                        quantityRequested: checked ? (entry.quantityRequested || String(entry.quantityRemaining || '')) : '',
                                      }
                                    : entry
                                )),
                              }))
                            }}
                          />
                        </td>
                        <td className="px-3 py-3 text-slate-700 dark:text-slate-200">{item.lotCode}</td>
                        <td className="px-3 py-3 text-slate-500 dark:text-slate-400">{formatDate(item.receivedDate)}</td>
                        <td className="px-3 py-3 text-slate-500 dark:text-slate-400">{formatDate(item.expirationDate)}</td>
                        <td className="px-3 py-3 text-right text-slate-700 dark:text-slate-200">{item.quantityRemaining} {item.unit || ''}</td>
                        <td className="px-3 py-3">
                          <input
                            type="number"
                            min="1"
                            max={item.quantityRemaining}
                            disabled={!item.selected}
                            value={item.quantityRequested}
                            onChange={(e) => {
                              const nextValue = e.target.value
                              setDisposalRequestForm((prev) => ({
                                ...prev,
                                items: prev.items.map((entry) => (
                                  entry.receiptLotId === item.receiptLotId
                                    ? { ...entry, quantityRequested: nextValue }
                                    : entry
                                )),
                              }))
                            }}
                            className={`${getFieldClass(false)} text-right`}
                            placeholder="0"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Lý do cần tiêu huỷ</label>
                <textarea
                  rows={4}
                  value={disposalRequestForm.reason}
                  onChange={(e) => setDisposalRequestForm((prev) => ({ ...prev, reason: e.target.value }))}
                  className={getFieldClass(false)}
                  placeholder="Do hết hạn sử dụng."
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleCreateDisposalRequest}
                disabled={disposalRequestSubmitting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                Gửi yêu cầu tiêu huỷ
              </button>
            </div>
          </div>
        </div>
      )}

      {showConsumableDecisionModal && selectedConsumableRequest && (
        <div className="fixed inset-0 z-[58] flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h4 className="text-base font-semibold text-slate-800">
                  {consumableDecisionAction === 'APPROVE' ? 'Duyệt cấp phát phiếu yêu cầu' : 'Từ chối phiếu yêu cầu'}
                </h4>
                <p className="text-sm text-slate-500">
                  Phiếu #{selectedConsumableRequest.id} • {selectedConsumableRequest.assetName} • {selectedConsumableRequest.locationName}
                </p>
              </div>
              <button
                type="button"
                onClick={closeConsumableDecisionModal}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Đóng
              </button>
            </div>

            <div className="grid gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                <p>Số lượng yêu cầu: {selectedConsumableRequest.quantityRequested} {selectedConsumableRequest.unit || ''}</p>
                <p>Người tạo phiếu: {selectedConsumableRequest.requestedByFullName || selectedConsumableRequest.requestedByUsername}</p>
                <p>Lý do: {selectedConsumableRequest.reason}</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  {consumableDecisionAction === 'APPROVE' ? 'Ghi chú duyệt' : 'Lý do từ chối'}
                </label>
                <textarea
                  rows={4}
                  value={consumableDecisionNote}
                  onChange={(e) => setConsumableDecisionNote(e.target.value)}
                  className={getFieldClass(false)}
                  placeholder={
                    consumableDecisionAction === 'APPROVE'
                      ? 'Ví dụ: duyệt cấp phát theo nhu cầu thực tế, ưu tiên sử dụng trong tuần này'
                      : 'Nhập lý do từ chối để nhân viên quản lý cấp phát nhận được kết quả rõ ràng'
                  }
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleSubmitConsumableDecision}
                disabled={consumableDecisionSubmitting}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
                  consumableDecisionAction === 'APPROVE' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {consumableDecisionAction === 'APPROVE' ? 'Xác nhận duyệt cấp phát' : 'Xác nhận từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDisposalDecisionModal && selectedDisposalRequest && (
        <div className="fixed inset-0 z-[59] flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-xl rounded-xl bg-white p-4 shadow-xl dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h4 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                  {disposalDecisionAction === 'APPROVE' ? 'Duyệt tiêu huỷ vật tư hết hạn' : 'Từ chối yêu cầu tiêu huỷ'}
                </h4>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Phiếu #{selectedDisposalRequest.id} • {selectedDisposalRequest.assetName} • {selectedDisposalRequest.itemCount || selectedDisposalRequest.items?.length || 1} lô
                </p>
              </div>
              <button
                type="button"
                onClick={closeDisposalDecisionModal}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Đóng
              </button>
            </div>

            <div className="grid gap-3">
              <div className="rounded-xl border border-red-200 bg-red-50/70 p-3 text-sm text-slate-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-slate-200">
                <p>Số lượng tiêu huỷ: {selectedDisposalRequest.quantityRequested} {selectedDisposalRequest.unit || ''}</p>
                <p>Người đề nghị: {selectedDisposalRequest.requestedByFullName || selectedDisposalRequest.requestedByUsername}</p>
                <p>Lý do: {selectedDisposalRequest.reason}</p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="border-b border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:text-slate-200">
                  Danh sách lô trong phiếu
                </div>
                <div className="max-h-52 overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900/70">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">Lô</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">HSD</th>
                        <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-200">Số lượng huỷ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedDisposalRequest.items || []).map((item) => (
                        <tr key={item.id || item.receiptLotId} className="border-t border-slate-200 dark:border-slate-800">
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{item.lotCode || `Lô #${item.receiptLotId}`}</td>
                          <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{formatDate(item.expirationDate)}</td>
                          <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-200">{item.quantityRequested}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {disposalDecisionAction === 'APPROVE' && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                  Bạn có chắc chắn muốn tiêu huỷ các sản phẩm trên?
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  {disposalDecisionAction === 'APPROVE' ? 'Ghi chú duyệt' : 'Lý do từ chối'}
                </label>
                <textarea
                  rows={4}
                  value={disposalDecisionNote}
                  onChange={(e) => setDisposalDecisionNote(e.target.value)}
                  className={getFieldClass(false)}
                  placeholder={
                    disposalDecisionAction === 'APPROVE'
                      ? 'Ví dụ: tiêu huỷ theo biên bản do lô đã quá hạn sử dụng.'
                      : 'Nhập lý do từ chối để người đề nghị biết cách xử lý tiếp.'
                  }
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleSubmitDisposalDecision}
                disabled={disposalDecisionSubmitting}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
                  disposalDecisionAction === 'APPROVE' ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-700 hover:bg-slate-800'
                }`}
              >
                {disposalDecisionAction === 'APPROVE' ? 'Có, chắc chắn' : 'Xác nhận từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedDisposalHistoryRequest && (
        <div className="fixed inset-0 z-[58] flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-4xl rounded-xl bg-white p-4 shadow-xl dark:bg-slate-900">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h4 className="text-base font-semibold text-slate-800 dark:text-slate-100">Chi tiết phiếu tiêu huỷ #{selectedDisposalHistoryRequest.id}</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {selectedDisposalHistoryRequest.assetName} • {selectedDisposalHistoryRequest.quantityRequested} {selectedDisposalHistoryRequest.unit || ''} • {selectedDisposalHistoryRequest.itemCount || selectedDisposalHistoryRequest.items?.length || 1} lô
                </p>
              </div>
              <button
                type="button"
                onClick={closeDisposalHistoryDetailModal}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Đóng
              </button>
            </div>

            <div className="grid gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                <p><span className="font-semibold">Người đề nghị:</span> {selectedDisposalHistoryRequest.requestedByFullName || selectedDisposalHistoryRequest.requestedByUsername}</p>
                <p><span className="font-semibold">Thời gian tạo:</span> {formatDateTime(selectedDisposalHistoryRequest.createdAt)}</p>
                <p><span className="font-semibold">Lý do:</span> {selectedDisposalHistoryRequest.reason}</p>
                {selectedDisposalHistoryRequest.resolvedAt && (
                  <p>
                    <span className="font-semibold">Xử lý:</span> {formatDateTime(selectedDisposalHistoryRequest.resolvedAt)} bởi {selectedDisposalHistoryRequest.resolvedByFullName || selectedDisposalHistoryRequest.resolvedByUsername}
                  </p>
                )}
                {selectedDisposalHistoryRequest.decisionNote && (
                  <p><span className="font-semibold">Ghi chú xử lý:</span> {selectedDisposalHistoryRequest.decisionNote}</p>
                )}
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-900/70">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">Lô</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">Ngày nhập</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">HSD</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-200">Số lượng huỷ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedDisposalHistoryRequest.items || []).map((lotItem) => (
                      <tr key={lotItem.id || lotItem.receiptLotId} className="border-t border-slate-200 dark:border-slate-800">
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{lotItem.lotCode || `Lô #${lotItem.receiptLotId}`}</td>
                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{formatDate(lotItem.receivedDate)}</td>
                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{formatDate(lotItem.expirationDate)}</td>
                        <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-200">{lotItem.quantityRequested}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {showStockAdjustModal && selectedStockRecord && (
        <div className="fixed inset-0 z-[57] flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h4 className="text-base font-semibold text-slate-800">Cập nhật số lượng còn lại</h4>
                <p className="text-sm text-slate-500">
                  {selectedStockRecord.assetName} tại {selectedStockRecord.locationName}
                </p>
              </div>
              <button
                type="button"
                onClick={closeStockAdjustModal}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Đóng
              </button>
            </div>

            <div className="grid gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                <p>Tổng đã cấp: {selectedStockRecord.quantityIssued} {selectedStockRecord.unit || ''}</p>
                <p>Số lượng còn lại hiện tại: {selectedStockRecord.quantityRemaining} {selectedStockRecord.unit || ''}</p>
                <p>Đã sử dụng: {selectedStockRecord.quantityConsumed} {selectedStockRecord.unit || ''}</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Số lượng còn lại mới</label>
                <input
                  type="number"
                  min="0"
                  value={stockAdjustForm.quantityRemaining}
                  onChange={(e) => setStockAdjustForm((prev) => ({ ...prev, quantityRemaining: e.target.value }))}
                  className={getFieldClass(false)}
                  placeholder={`Ví dụ: 15 ${selectedStockRecord.unit || ''}`}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Ghi chú cập nhật</label>
                <textarea
                  rows={3}
                  value={stockAdjustForm.note}
                  onChange={(e) => setStockAdjustForm((prev) => ({ ...prev, note: e.target.value }))}
                  className={getFieldClass(false)}
                  placeholder="Ví dụ: đã sử dụng trong tháng, còn lại sau kiểm tra thực tế"
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleUpdateStockRemaining}
                disabled={stockAdjustSubmitting}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
              >
                Lưu số lượng còn lại
              </button>
            </div>
          </div>
        </div>
      )}

      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-base font-semibold text-slate-800">Mã QR thiết bị {qrModalQaCode}</h4>
              <button
                type="button"
                onClick={handleCloseQrModal}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Đóng
              </button>
            </div>
            <div className="flex justify-center">
              <img src={qrModalImage} alt={`QR ${qrModalQaCode}`} className="h-[300px] w-[300px] rounded border border-slate-200" />
            </div>
          </div>
        </div>
      )}

      {showSupplierCreateModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-base font-semibold text-slate-800">Thêm mới nhà cung cấp</h4>
              <button
                type="button"
                onClick={closeSupplierCreateModal}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Đóng
              </button>
            </div>

            <div className="grid gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Tên nhà cung cấp</label>
                <input
                  value={supplierForm.name}
                  onChange={(e) => {
                    setSupplierForm((prev) => ({ ...prev, name: e.target.value }))
                    setSupplierFormErrors((prev) => ({ ...prev, name: '' }))
                  }}
                  placeholder="Ví dụ: Công ty thiết bị giáo dục ABC"
                  className={getFieldClass(Boolean(supplierFormErrors.name))}
                />
                {supplierFormErrors.name && <p className="mt-1 text-xs text-red-600">{supplierFormErrors.name}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Số điện thoại</label>
                <input
                  value={supplierForm.phoneNumber}
                  onChange={(e) => {
                    setSupplierForm((prev) => ({ ...prev, phoneNumber: e.target.value }))
                    setSupplierFormErrors((prev) => ({ ...prev, phoneNumber: '' }))
                  }}
                  placeholder="Ví dụ: 0901234567"
                  className={getFieldClass(Boolean(supplierFormErrors.phoneNumber))}
                />
                {supplierFormErrors.phoneNumber && <p className="mt-1 text-xs text-red-600">{supplierFormErrors.phoneNumber}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Địa chỉ</label>
                <textarea
                  value={supplierForm.address}
                  onChange={(e) => {
                    setSupplierForm((prev) => ({ ...prev, address: e.target.value }))
                    setSupplierFormErrors((prev) => ({ ...prev, address: '' }))
                  }}
                  placeholder="Nhập địa chỉ nhà cung cấp"
                  rows={3}
                  className={getFieldClass(Boolean(supplierFormErrors.address))}
                />
                {supplierFormErrors.address && <p className="mt-1 text-xs text-red-600">{supplierFormErrors.address}</p>}
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleCreateSupplierInline}
                disabled={creatingSupplier}
                className="rounded-lg bg-fptOrange px-4 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark disabled:opacity-60"
              >
                Lưu nhà cung cấp
              </button>
            </div>
          </div>
        </div>
      )}

      {showSpecsModal && selectedSpecsAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-xl rounded-xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-base font-semibold text-slate-800">Đặc tính kỹ thuật - {selectedSpecsAsset.name}</h4>
              <button
                type="button"
                onClick={() => {
                  setShowSpecsModal(false)
                  setSelectedSpecsAsset(null)
                }}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Đóng
              </button>
            </div>
            <div className="space-y-2">
              {selectedSpecsEntries.map((entry) => (
                <div key={`${entry.name}-${entry.value}`} className="grid grid-cols-[180px_1fr] gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <p className="font-semibold text-slate-700">{entry.name}</p>
                  <p className="text-slate-600">{entry.value}</p>
                </div>
              ))}
              {selectedSpecsEntries.length === 0 && (
                <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                  Thiết bị này chưa có đặc tính kỹ thuật.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {showOriginModal && selectedOriginAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-base font-semibold text-slate-800">Nguồn gốc tài sản - {selectedOriginAsset.name}</h4>
              <button
                type="button"
                onClick={() => {
                  setShowOriginModal(false)
                  setSelectedOriginAsset(null)
                }}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Đóng
              </button>
            </div>
            <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p><span className="font-semibold">Kiểu theo dõi:</span> {getTrackingModeLabel(selectedOriginAsset.trackingMode)}</p>
              {!isConsumableMode(selectedOriginAsset.trackingMode) && (
                <>
                  <p><span className="font-semibold">Tình trạng kỹ thuật:</span> {getTechnicalStatusLabel(selectedOriginAsset.technicalStatus || selectedOriginAsset.status)}</p>
                  <p><span className="font-semibold">Trạng thái sử dụng:</span> {getUsageStatusLabel(selectedOriginAsset.usageStatus)}</p>
                  <p><span className="font-semibold">Trạng thái hiển thị:</span> {getAssetStatusLabel(selectedOriginAsset.status)}</p>
                </>
              )}
              <p><span className="font-semibold">Ngày mua:</span> {formatDate(selectedOriginAsset.purchaseDate)}</p>
              <p><span className="font-semibold">Giá mua:</span> {formatCurrency(selectedOriginAsset.purchasePrice)}</p>
              {isConsumableMode(selectedOriginAsset.trackingMode) && (
                <>
                  <p><span className="font-semibold">Số lượng tồn:</span> {selectedOriginAsset.quantityOnHand ?? 0}</p>
                  <p><span className="font-semibold">Ngưỡng cảnh báo tồn:</span> {selectedOriginAsset.minimumStock ?? 0}</p>
                  <p><span className="font-semibold">Đơn vị tính:</span> {selectedOriginAsset.unit || 'Chưa cập nhật'}</p>
                  <p><span className="font-semibold">Quản lý hạn sử dụng:</span> {selectedOriginAsset.expiryTrackingEnabled ? 'Có' : 'Không'}</p>
                  <p><span className="font-semibold">Hạn sử dụng:</span> {selectedOriginAsset.expiryTrackingEnabled ? formatDate(selectedOriginAsset.expirationDate) : 'Không áp dụng'}</p>
                </>
              )}
              {!isConsumableMode(selectedOriginAsset.trackingMode) && (
                <p><span className="font-semibold">Hạn bảo hành:</span> {formatDate(selectedOriginAsset.warrantyExpirationDate)}</p>
              )}
              <p><span className="font-semibold">Nhà cung cấp:</span> {selectedOriginAsset.supplierName || 'Chưa cập nhật'}</p>
              <p><span className="font-semibold">Số điện thoại NCC:</span> {selectedOriginAsset.supplierPhoneNumber || 'Chưa cập nhật'}</p>
              <p><span className="font-semibold">Địa chỉ NCC:</span> {selectedOriginAsset.supplierAddress || 'Chưa cập nhật'}</p>
            </div>
            {isConsumableMode(selectedOriginAsset.trackingMode) && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h5 className="text-sm font-semibold text-slate-800">Chi tiết các lô nhập</h5>
                    <p className="text-xs text-slate-500">Hiển thị từng lô để theo dõi số lượng còn lại và hạn sử dụng riêng biệt.</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {(selectedOriginAsset.receiptLots || []).length} lô
                  </span>
                </div>
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {(selectedOriginAsset.receiptLots || []).length === 0 && (
                    <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
                      Chưa có dữ liệu lô nhập cho vật tư này.
                    </p>
                  )}
                  {(selectedOriginAsset.receiptLots || []).map((lot) => (
                    <div key={lot.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-slate-800">{lot.lotCode || `Lô #${lot.id}`}</p>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(getConsumableExpiryState({ ...lot, expiryTrackingEnabled: selectedOriginAsset.expiryTrackingEnabled }).tone)}`}>
                          {getConsumableExpiryState({ ...lot, expiryTrackingEnabled: selectedOriginAsset.expiryTrackingEnabled }).label}
                        </span>
                      </div>
                      <p className="mt-1">Số lượng: {lot.quantityRemaining ?? 0} / {lot.quantityReceived ?? 0} {selectedOriginAsset.unit || ''}</p>
                      <p>Ngày nhập: {formatDate(lot.receivedDate)} | Hạn dùng: {getConsumableExpiryState({ ...lot, expiryTrackingEnabled: selectedOriginAsset.expiryTrackingEnabled }).dateLabel}</p>
                      <p>Đơn giá lô: {formatCurrency(lot.unitPrice)} | NCC: {lot.supplierName || 'Chưa cập nhật'}</p>
                      {lot.note && <p className="mt-1 text-slate-500">{lot.note}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <AssetRepairTimelineModal
        open={showTimelineModal}
        onClose={() => {
          setShowTimelineModal(false)
          setTimelineAsset(null)
        }}
        assetQaCode={timelineAsset?.qaCode}
        assetName={timelineAsset?.name}
      />
    </div>
  )
}

export default AssetManagement
