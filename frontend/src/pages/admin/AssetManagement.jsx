import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Boxes, Check, History, Package, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react'
import { toast } from 'react-toastify'
import axiosClient from '../../api/axiosClient'
import AssetRepairTimelineModal from '../../components/AssetRepairTimelineModal'
import { useAuth } from '../../context/AuthContext'
import { mergeSpecEntries, normalizeSpecTemplates, parseSpecsToEntries, stringifySpecs } from '../../utils/assetSpecs'
import { formatVietnamDateTime } from '../../utils/datetime'
import { validateAssetForm, validateSupplierForm } from '../../utils/validation'

const itemizedStatusOptions = ['Sẵn sàng', 'Đang sử dụng', 'Hỏng', 'Bảo trì', 'Thất lạc']
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
  if (!value) return 'Chưa cập nhật'
  return value
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
  if (tone === 'red') return 'bg-red-100 text-red-700 ring-1 ring-red-200'
  if (tone === 'amber') return 'bg-amber-100 text-amber-700 ring-1 ring-amber-200'
  return 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200'
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
    supplierId: '',
    purchasePrice: '',
    purchaseDate: '',
    warrantyExpirationDate: '',
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

  const resetForm = () => {
    setSelectedQaCode(null)
    setSupplierKeyword('')
    setShowSupplierOptions(false)
    setFormErrors({})
    setForm({
      trackingMode: activeTrackingMode,
      name: '',
      categoryId: '',
      locationId: '',
      supplierId: '',
      purchasePrice: '',
      purchaseDate: '',
      warrantyExpirationDate: '',
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
        locationId: Number(form.locationId),
        status: isConsumableMode(form.trackingMode) ? 'Còn hàng' : 'Sẵn sàng',
        specs: isConsumableMode(form.trackingMode) ? '{}' : stringifySpecs(form.specEntries),
        purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : null,
        purchaseDate: form.purchaseDate || null,
        warrantyExpirationDate: isConsumableMode(form.trackingMode) ? null : (form.warrantyExpirationDate || null),
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
        locationId: Number(form.locationId),
        specs: isConsumableMode(form.trackingMode) ? '{}' : stringifySpecs(form.specEntries),
        purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : null,
        purchaseDate: form.purchaseDate || null,
        warrantyExpirationDate: isConsumableMode(form.trackingMode) ? null : (form.warrantyExpirationDate || null),
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
        locationId: String(detail.homeLocationId || detail.locationId || asset.homeLocationId || asset.locationId),
        supplierId: detail.supplierId ? String(detail.supplierId) : '',
        purchasePrice: detail.purchasePrice ?? asset.purchasePrice ?? '',
        purchaseDate: detail.purchaseDate || asset.purchaseDate || '',
        warrantyExpirationDate: detail.warrantyExpirationDate || asset.warrantyExpirationDate || '',
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
    setReceiveSubmitting(true)
    try {
      const response = await axiosClient.post(`/api/assets/${selectedReceiveAsset.qaCode}/receipts`, {
        quantity,
        unitPrice,
        supplierId: Number(receiveForm.supplierId),
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
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-800">{restrictToConsumable ? 'Quản lý cấp phát vật tư' : 'Quản lý tài sản'}</h2>
          <p className="text-sm text-slate-500">
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
                    ? 'border-fptOrange bg-orange-50 text-fptOrangeDark'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-orange-200 hover:bg-orange-50/50'
                }`}
              >
                <p className="text-sm font-semibold">{tab.label}</p>
                <p className="mt-1 text-xs text-slate-500">{tab.description}</p>
              </button>
            )
          })}
        </div>
        )}
        <div className="grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-2">
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
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
                  <button
                    type="button"
                    onClick={() => handleSwitchConsumableWorkspace('OVERVIEW')}
                    className={`border-b-2 px-1 pb-2 text-sm font-semibold ${
                      consumableWorkspace === 'OVERVIEW'
                        ? 'border-fptOrange text-fptOrangeDark'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Tổng quan kho
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchConsumableWorkspace('ROOMS')}
                    className={`border-b-2 px-1 pb-2 text-sm font-semibold ${
                      consumableWorkspace === 'ROOMS'
                        ? 'border-fptOrange text-fptOrangeDark'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Theo dõi theo phòng
                  </button>
                </div>
                <p className="mt-3 text-sm text-slate-500">
                  {consumableWorkspace === 'OVERVIEW'
                    ? 'Theo dõi tồn kho, các mặt hàng cần nhập và giá trị tồn của toàn kho.'
                    : 'Theo dõi lượng vật tư đã cấp cho từng phòng và cập nhật số lượng còn lại.'}
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
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                >
                  <RefreshCw size={16} />
                  Tải lại
                </button>
                <button
                  type="button"
                  onClick={handleDownloadExcel}
                  disabled={downloading}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                >
                  <Package size={16} />
                  Xuất Excel
                </button>
              </div>
            </div>
          </div>

          {consumableWorkspace === 'OVERVIEW' ? (
            <>
              <div className="grid gap-4 xl:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Tổng giá trị tồn</p>
                      <h3 className="mt-2 text-3xl font-bold text-slate-900">{formatCurrency(consumableSummary.totalInventoryValue)}</h3>
                    </div>
                    <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
                      <Boxes size={20} />
                    </div>
                  </div>
                  <p className="text-sm text-slate-500">
                    {consumableSummary.trackedCount} vật tư đang được theo dõi trong kho hiện tại.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Mặt hàng đang đủ dùng</p>
                      <h3 className="mt-2 text-3xl font-bold text-slate-900">{consumableSummary.healthyCount} loại</h3>
                    </div>
                    <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600">
                      <Package size={20} />
                    </div>
                  </div>
                  <p className="text-sm text-slate-500">Các vật tư đang còn trên ngưỡng cảnh báo và đủ để phục vụ cấp phát.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Cần nhập thêm</p>
                      <h3 className="mt-2 text-3xl font-bold text-slate-900">{consumableSummary.restockCount} loại</h3>
                    </div>
                    <div className="rounded-xl bg-red-50 p-3 text-red-600">
                      <History size={20} />
                    </div>
                  </div>
                  <p className="text-sm text-slate-500">Các vật tư đã chạm hoặc thấp hơn ngưỡng cảnh báo và cần nhập thêm.</p>
                </div>
              </div>

              {isAdmin && (
                <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-4 flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Workflow cấp phát</p>
                      <h3 className="text-lg font-semibold text-slate-800">Phiếu yêu cầu chờ duyệt</h3>
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
                            <button
                              type="button"
                              onClick={() => handleOpenConsumableDecisionModal(item, 'APPROVE')}
                              className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
                            >
                              <Check size={16} />
                              Duyệt cấp phát
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenConsumableDecisionModal(item, 'REJECT')}
                              className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                            >
                              <X size={16} />
                              Từ chối
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {!pendingConsumableRequestsLoading && pendingConsumableRequests.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                        Hiện không có phiếu yêu cầu nào đang chờ Admin duyệt.
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                  <div className="mb-4 border-b border-slate-200 pb-3">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Trạng thái</h3>
                  </div>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={async () => {
                        const reset = { ...filters, status: '' }
                        setFilters(reset)
                        await loadAssets(0, reset)
                      }}
                      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm ${
                        !filters.status ? 'border-fptOrange bg-orange-50 text-fptOrangeDark' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span>Tất cả vật tư</span>
                      <span className="text-xs text-slate-400">{consumableStatusCounts.all}</span>
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
                        className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm ${
                          filters.status === status
                            ? 'border-fptOrange bg-orange-50 text-fptOrangeDark'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span>{status === 'Còn hàng' ? 'Đủ dùng' : 'Cần nhập'}</span>
                        <span className="text-xs text-slate-400">
                          {status === 'Còn hàng' ? consumableStatusCounts.healthy : consumableStatusCounts.restock}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white/80 p-3 text-sm text-slate-500">
                    Mẹo: dùng bộ lọc nhanh để xem ngay mặt hàng đang đủ dùng hoặc các vật tư cần nhập thêm.
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-4 flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Danh sách quản lý</p>
                      <h3 className="text-lg font-semibold text-slate-800">Tổng quan kho</h3>
                      <p className="text-sm text-slate-500">Danh sách vật tư đang được quản lý trong kho với đơn giá trung bình hiện tại.</p>
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
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                      >
                        Xóa bộ lọc
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <div className="xl:col-span-2">
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Tìm vật tư</label>
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
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Chọn loại</label>
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
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Chọn kho</label>
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
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Trạng thái</label>
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
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-100/80">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-slate-600">
                            <button type="button" onClick={() => handleSort('name')} className="hover:text-fptOrange">
                              {getSortLabel('name', 'Tên vật tư')}
                            </button>
                          </th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-600">
                            <button type="button" onClick={() => handleSort('category')} className="hover:text-fptOrange">
                              {getSortLabel('category', 'Loại')}
                            </button>
                          </th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-600">
                            <button type="button" onClick={() => handleSort('quantityOnHand')} className="hover:text-fptOrange">
                              Tồn tổng
                            </button>
                          </th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-600">Ngưỡng báo</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-600">Đơn giá</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-600">Trạng thái</th>
                          <th className="px-3 py-2 text-right font-semibold text-slate-600">Hành động</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {loading &&
                          Array.from({ length: 6 }).map((_, index) => (
                            <tr key={`skeleton-consumable-${index}`} className="animate-pulse">
                              {Array.from({ length: 7 }).map((__, cellIndex) => (
                                <td key={`cell-consumable-${cellIndex}`} className="px-3 py-2">
                                  <div className="h-4 w-24 rounded bg-slate-200" />
                                </td>
                              ))}
                            </tr>
                          ))}
                        {!loading &&
                          assets.map((asset) => {
                            const stockState = getConsumableInventoryState(asset)
                            return (
                              <tr key={asset.qaCode} className="hover:bg-slate-50/70">
                                <td className="px-3 py-3">
                                  <div className="font-medium text-slate-700">{asset.name}</div>
                                  <div className="text-xs text-slate-500">{asset.qaCode}</div>
                                </td>
                                <td className="px-3 py-3">{asset.category}</td>
                                <td className="px-3 py-3">{`${asset.quantityOnHand ?? 0} ${asset.unit || ''}`.trim()}</td>
                                <td className="px-3 py-3">{`${asset.minimumStock ?? 0} ${asset.unit || ''}`.trim()}</td>
                                <td className="px-3 py-3">{formatCurrency(asset.purchasePrice)}</td>
                                <td className="px-3 py-3">
                                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(stockState.tone)}`}>
                                    {stockState.label}
                                  </span>
                                </td>
                                <td className="px-3 py-3">
                                  <div className="flex justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenReceiveModal(asset)}
                                      className="rounded-md border border-sky-300 px-2 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-50"
                                    >
                                      Nhập hàng
                                    </button>
                                    {!isConsumableManager && (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenIssueModal(asset)}
                                        className="rounded-md border border-emerald-300 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                                      >
                                        Cấp phát
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleSelectAsset(asset)}
                                      className="rounded-md border border-blue-300 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                                    >
                                      Sửa
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteAsset(asset.qaCode)}
                                      className="rounded-md border border-red-300 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                                    >
                                      Xóa
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        {!loading && assets.length === 0 && (
                          <tr>
                            <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500">
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
          ) : (
            <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                <div className="mb-4 border-b border-slate-200 pb-3">
                  <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Tìm phòng</label>
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
                        className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm ${
                          active ? 'border-fptOrange bg-orange-50 text-fptOrangeDark' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span>{location.roomName}</span>
                        <span className="text-xs text-slate-400">{active ? 'Đang xem' : ''}</span>
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
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Không gian theo phòng</p>
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
                            <th className="px-3 py-2 text-left font-semibold text-slate-600">Hành động</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {locationOverviewLoading &&
                            Array.from({ length: 5 }).map((_, index) => (
                              <tr key={`room-stock-skeleton-${index}`} className="animate-pulse">
                                {Array.from({ length: 7 }).map((__, cellIndex) => (
                                  <td key={`room-stock-cell-${cellIndex}`} className="px-3 py-3">
                                    <div className="h-4 w-24 rounded bg-slate-200" />
                                  </td>
                                ))}
                              </tr>
                            ))}
                          {!locationOverviewLoading &&
                            (locationOverview?.stocks || []).map((stock) => (
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
                                <td className="px-3 py-3">
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenConsumableRequestModal(stock.assetQaCode)}
                                      className="rounded-md border border-blue-300 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                                    >
                                      Yêu cầu cấp phát
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenStockAdjustModal(stock)}
                                      className="rounded-md border border-amber-300 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50"
                                    >
                                      Cập nhật còn lại
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          {!locationOverviewLoading && selectedOverviewLocationId && (locationOverview?.stocks || []).length === 0 && (
                            <tr>
                              <td colSpan={7} className="px-3 py-10 text-center text-sm text-slate-500">
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
                              <button
                                type="button"
                                onClick={() => handleOpenConsumableDecisionModal(item, 'APPROVE')}
                                className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                              >
                                <Check size={14} />
                                Duyệt cấp phát
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenConsumableDecisionModal(item, 'REJECT')}
                                className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                              >
                                <X size={14} />
                                Từ chối
                              </button>
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
                  <option key={status} value={status}>
                    {status}
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
                      {getSortLabel('status', 'Trạng thái')}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Thuộc tính</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Nguồn gốc tài sản</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-600">Thao tác</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading &&
                    Array.from({ length: 6 }).map((_, index) => (
                      <tr key={`skeleton-${index}`} className="animate-pulse">
                        {Array.from({ length: 8 }).map((__, cellIndex) => (
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
                        <td className="px-3 py-2">{asset.status}</td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
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
                            className="rounded-md border border-indigo-300 px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                          >
                            Xem
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
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
                            className="rounded-md border border-amber-300 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50"
                          >
                            Xem
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenQrModal(asset.qaCode)}
                              disabled={qrModalLoading}
                              className="rounded-md border border-emerald-300 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                            >
                              QR
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setTimelineAsset(asset)
                                setShowTimelineModal(true)
                              }}
                              className="rounded-md border border-violet-300 px-2 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-50"
                            >
                              Timeline
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSelectAsset(asset)}
                              className="rounded-md border border-blue-300 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAsset(asset.qaCode)}
                              className="rounded-md border border-red-300 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                            >
                              Xóa
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  {!loading && assets.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-6 text-center text-sm text-slate-500">
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
                    setForm((prev) => ({ ...prev, locationId: e.target.value }))
                    setFormErrors((prev) => ({ ...prev, locationId: '' }))
                  }}
                  className={getFieldClass(Boolean(formErrors.locationId))}
                >
                  <option value="">{isConsumableForm ? 'Chọn kho' : 'Chọn phòng'}</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.roomName}
                    </option>
                  ))}
                </select>
                {formErrors.locationId && <p className="mt-1 text-xs text-red-600">{formErrors.locationId}</p>}
                {isConsumableForm && <p className="mt-1 text-xs text-slate-500">Vật tư mới nhập luôn được ghi nhận về kho này trước khi cấp phát cho các phòng.</p>}
              </div>
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
                      className={getFieldClass(Boolean(formErrors.quantityOnHand))}
                      placeholder="Ví dụ: 500"
                    />
                    {formErrors.quantityOnHand && <p className="mt-1 text-xs text-red-600">{formErrors.quantityOnHand}</p>}
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
                  className={getFieldClass(Boolean(formErrors.purchasePrice))}
                  placeholder={isConsumableForm ? 'Nhập đơn giá 1 đơn vị, ví dụ 12.000' : 'Nhập giá mua, ví dụ 4.590.000'}
                />
                {formErrors.purchasePrice && <p className="mt-1 text-xs text-red-600">{formErrors.purchasePrice}</p>}
                {isConsumableForm && <p className="mt-1 text-xs text-slate-500">Đây là đơn giá của 1 đơn vị sản phẩm.</p>}
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
                  className={getFieldClass(Boolean(formErrors.purchaseDate))}
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
                              <button
                                type="button"
                                onClick={() => handleOpenStockAdjustModal(stock)}
                                className="rounded-md border border-amber-300 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50"
                              >
                                Cập nhật còn lại
                              </button>
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
          <div className="w-full max-w-lg rounded-xl bg-white p-4 shadow-xl">
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
              </div>
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
          <div className="w-full max-w-lg rounded-xl bg-white p-4 shadow-xl">
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
              <p><span className="font-semibold">Ngày mua:</span> {formatDate(selectedOriginAsset.purchaseDate)}</p>
              <p><span className="font-semibold">Giá mua:</span> {formatCurrency(selectedOriginAsset.purchasePrice)}</p>
              {isConsumableMode(selectedOriginAsset.trackingMode) && (
                <>
                  <p><span className="font-semibold">Số lượng tồn:</span> {selectedOriginAsset.quantityOnHand ?? 0}</p>
                  <p><span className="font-semibold">Ngưỡng cảnh báo tồn:</span> {selectedOriginAsset.minimumStock ?? 0}</p>
                  <p><span className="font-semibold">Đơn vị tính:</span> {selectedOriginAsset.unit || 'Chưa cập nhật'}</p>
                </>
              )}
              {!isConsumableMode(selectedOriginAsset.trackingMode) && (
                <p><span className="font-semibold">Hạn bảo hành:</span> {formatDate(selectedOriginAsset.warrantyExpirationDate)}</p>
              )}
              <p><span className="font-semibold">Nhà cung cấp:</span> {selectedOriginAsset.supplierName || 'Chưa cập nhật'}</p>
              <p><span className="font-semibold">Số điện thoại NCC:</span> {selectedOriginAsset.supplierPhoneNumber || 'Chưa cập nhật'}</p>
              <p><span className="font-semibold">Địa chỉ NCC:</span> {selectedOriginAsset.supplierAddress || 'Chưa cập nhật'}</p>
            </div>
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
