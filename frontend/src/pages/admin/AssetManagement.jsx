import { useEffect, useMemo, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'react-toastify'
import axiosClient from '../../api/axiosClient'
import AssetRepairTimelineModal from '../../components/AssetRepairTimelineModal'
import { mergeSpecEntries, normalizeSpecTemplates, parseSpecsToEntries, stringifySpecs } from '../../utils/assetSpecs'
import { validateAssetForm, validateSupplierForm } from '../../utils/validation'

const statusOptions = ['Sẵn sàng', 'Đang sử dụng', 'Hỏng', 'Bảo trì', 'Thất lạc']
const PAGE_SIZE = 10
const defaultPageInfo = {
  page: 0,
  size: PAGE_SIZE,
  totalPages: 1,
  totalItems: 0,
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

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function getFieldClass(hasError) {
  return `w-full rounded-lg border px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2 ${hasError ? 'border-red-400 bg-red-50' : 'border-slate-300'}`
}

function AssetManagement() {
  const specEntryIdRef = useRef(0)
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
  const [formMode, setFormMode] = useState('create')
  const [selectedQaCode, setSelectedQaCode] = useState(null)
  const [showCategoryFilterOptions, setShowCategoryFilterOptions] = useState(false)
  const [showSupplierOptions, setShowSupplierOptions] = useState(false)
  const [supplierKeyword, setSupplierKeyword] = useState('')
  const [showSupplierCreateModal, setShowSupplierCreateModal] = useState(false)
  const [creatingSupplier, setCreatingSupplier] = useState(false)
  const [supplierForm, setSupplierForm] = useState({ name: '', address: '', phoneNumber: '' })
  const [supplierFormErrors, setSupplierFormErrors] = useState({})
  const [pageInfo, setPageInfo] = useState(defaultPageInfo)
  const [sortState, setSortState] = useState(defaultSortState)
  const [filters, setFilters] = useState({
    name: '',
    status: '',
    categoryId: '',
    locationId: '',
    categoryKeyword: '',
  })
  const [form, setForm] = useState({
    name: '',
    categoryId: '',
    locationId: '',
    supplierId: '',
    purchasePrice: '',
    purchaseDate: '',
    warrantyExpirationDate: '',
    specEntries: [],
  })
  const [formErrors, setFormErrors] = useState({})
  const [assetDetailsByQaCode, setAssetDetailsByQaCode] = useState({})

  const filteredCategoryOptions = useMemo(() => {
    const keyword = filters.categoryKeyword.trim().toLowerCase()
    if (!keyword) return categories
    return categories.filter((category) => getCategoryLabel(category).toLowerCase().includes(keyword))
  }, [categories, filters.categoryKeyword])

  const filteredSupplierOptions = useMemo(() => {
    const keyword = supplierKeyword.trim().toLowerCase()
    if (!keyword) return suppliers
    return suppliers.filter((supplier) => getSupplierLabel(supplier).toLowerCase().includes(keyword))
  }, [supplierKeyword, suppliers])

  const selectedSpecsEntries = useMemo(() => parseSpecsToEntries(selectedSpecsAsset?.specs), [selectedSpecsAsset])
  const isEditing = formMode === 'update' && Boolean(selectedQaCode)

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

  useEffect(() => {
    const initializePage = async () => {
      try {
        const response = await axiosClient.get('/api/assets/bootstrap', {
          params: {
            page: 0,
            size: PAGE_SIZE,
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
      } catch (error) {
        const message = error?.response?.data?.message || 'Không thể tải dữ liệu trang thiết bị.'
        toast.error(message)
      } finally {
        setLoading(false)
      }
    }
    initializePage()
  }, [])

  const buildAssetQueryParams = (page = pageInfo.page, nextFilters = filters, nextSort = sortState) => {
    const params = {
      page,
      size: pageInfo.size || PAGE_SIZE,
      sortKey: nextSort.key,
      sortDirection: nextSort.direction,
    }
    if (nextFilters.name.trim()) params.name = nextFilters.name.trim()
    if (nextFilters.status) params.status = nextFilters.status
    if (nextFilters.categoryId) params.categoryId = Number(nextFilters.categoryId)
    if (nextFilters.locationId) params.locationId = Number(nextFilters.locationId)
    return params
  }

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
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể tải danh sách thiết bị.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setSelectedQaCode(null)
    setSupplierKeyword('')
    setShowSupplierOptions(false)
    setFormErrors({})
    setForm({
      name: '',
      categoryId: '',
      locationId: '',
      supplierId: '',
      purchasePrice: '',
      purchaseDate: '',
      warrantyExpirationDate: '',
      specEntries: [],
    })
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
        name: form.name.trim(),
        categoryId: Number(form.categoryId),
        locationId: Number(form.locationId),
        status: 'Sẵn sàng',
        specs: stringifySpecs(form.specEntries),
        purchasePrice: Number(form.purchasePrice),
        purchaseDate: form.purchaseDate,
        warrantyExpirationDate: form.warrantyExpirationDate,
        supplierId: Number(form.supplierId),
      })
      if (response.data?.qrCodeBase64) {
        setQrImage(`data:image/png;base64,${response.data.qrCodeBase64}`)
      } else {
        setQrImage('')
      }
      toast.success(`Thêm thiết bị thành công. Mã mới: ${response.data?.qaCode || 'đã tự sinh'}.`)
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
        name: form.name.trim(),
        categoryId: Number(form.categoryId),
        locationId: Number(form.locationId),
        specs: stringifySpecs(form.specEntries),
        purchasePrice: Number(form.purchasePrice),
        purchaseDate: form.purchaseDate,
        warrantyExpirationDate: form.warrantyExpirationDate,
        supplierId: Number(form.supplierId),
      })
      toast.success('Cập nhật thiết bị thành công.')
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
        name: detail.name || asset.name,
        categoryId: String(detail.categoryId || asset.categoryId),
        locationId: String(detail.homeLocationId || detail.locationId || asset.homeLocationId || asset.locationId),
        supplierId: detail.supplierId ? String(detail.supplierId) : '',
        purchasePrice: detail.purchasePrice ?? asset.purchasePrice ?? '',
        purchaseDate: detail.purchaseDate || asset.purchaseDate || '',
        warrantyExpirationDate: detail.warrantyExpirationDate || asset.warrantyExpirationDate || '',
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
    const reset = { name: '', status: '', categoryId: '', locationId: '', categoryKeyword: '' }
    setFilters(reset)
    await loadAssets(0, reset)
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
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-800">Quản lý thiết bị</h2>
          <p className="text-sm text-slate-500">Theo dõi danh sách thiết bị, QR, đặc tính kỹ thuật và nguồn gốc tài sản.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              resetForm()
              setFormMode('create')
              setShowFormModal(true)
            }}
            disabled={submitting}
            className="rounded-lg bg-fptOrange px-3 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark disabled:opacity-60"
          >
            Thêm mới
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

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-base font-semibold text-slate-800">Lọc và tìm kiếm thiết bị</h3>
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
            {statusOptions.map((status) => (
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
          <h2 className="text-lg font-semibold text-slate-800">Danh sách thiết bị</h2>
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
                    Chưa có thiết bị phù hợp.
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

      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[95vh] w-full max-w-4xl overflow-auto rounded-xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-base font-semibold text-slate-800">
                {isEditing ? `Chỉnh sửa thiết bị ${selectedQaCode}` : 'Thêm mới thiết bị'}
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
                <label className="mb-1 block text-sm font-medium text-slate-700">Tên thiết bị</label>
                <input
                  value={form.name}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                    setFormErrors((prev) => ({ ...prev, name: '' }))
                  }}
                  className={getFieldClass(Boolean(formErrors.name))}
                  placeholder="Nhập tên thiết bị"
                />
                {formErrors.name && <p className="mt-1 text-xs text-red-600">{formErrors.name}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Loại thiết bị</label>
                <select
                  value={form.categoryId}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className={getFieldClass(Boolean(formErrors.categoryId))}
                >
                  <option value="">Chọn loại</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {getCategoryLabel(category)}
                    </option>
                  ))}
                </select>
                {formErrors.categoryId && <p className="mt-1 text-xs text-red-600">{formErrors.categoryId}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Phòng gốc</label>
                <select
                  value={form.locationId}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, locationId: e.target.value }))
                    setFormErrors((prev) => ({ ...prev, locationId: '' }))
                  }}
                  className={getFieldClass(Boolean(formErrors.locationId))}
                >
                  <option value="">Chọn phòng</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.roomName}
                    </option>
                  ))}
                </select>
                {formErrors.locationId && <p className="mt-1 text-xs text-red-600">{formErrors.locationId}</p>}
              </div>
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
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Giá mua</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatPurchasePriceInput(form.purchasePrice)}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, purchasePrice: normalizePurchasePriceInput(e.target.value) }))
                    setFormErrors((prev) => ({ ...prev, purchasePrice: '' }))
                  }}
                  className={getFieldClass(Boolean(formErrors.purchasePrice))}
                  placeholder="Nhập giá mua, ví dụ 4.590.000"
                />
                {formErrors.purchasePrice && <p className="mt-1 text-xs text-red-600">{formErrors.purchasePrice}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Ngày mua</label>
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
              <p><span className="font-semibold">Ngày mua:</span> {formatDate(selectedOriginAsset.purchaseDate)}</p>
              <p><span className="font-semibold">Giá mua:</span> {formatCurrency(selectedOriginAsset.purchasePrice)}</p>
              <p><span className="font-semibold">Hạn bảo hành:</span> {formatDate(selectedOriginAsset.warrantyExpirationDate)}</p>
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
