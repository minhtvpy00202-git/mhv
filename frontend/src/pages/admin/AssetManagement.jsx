import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import axiosClient from '../../api/axiosClient'

const statusOptions = ['Sẵn sàng', 'Đang sử dụng', 'Hỏng', 'Bảo trì', 'Thất lạc']
const PAGE_SIZE = 10

function AssetManagement() {
  const [assets, setAssets] = useState([])
  const [locations, setLocations] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [qrImage, setQrImage] = useState('')
  const [qrModalImage, setQrModalImage] = useState('')
  const [qrModalQaCode, setQrModalQaCode] = useState('')
  const [showQrModal, setShowQrModal] = useState(false)
  const [qrModalLoading, setQrModalLoading] = useState(false)
  const [selectedQaCode, setSelectedQaCode] = useState(null)
  const [showCategoryFilterOptions, setShowCategoryFilterOptions] = useState(false)
  const [sortConfig, setSortConfig] = useState({ key: 'qaCode', direction: 'asc' })
  const [currentPage, setCurrentPage] = useState(1)
  const [filters, setFilters] = useState({
    name: '',
    status: '',
    categoryId: '',
    locationId: '',
    categoryKeyword: '',
  })
  const [form, setForm] = useState({
    qaCode: '',
    name: '',
    categoryId: '',
    locationId: '',
    status: 'Sẵn sàng',
  })

  const filteredCategoryOptions = useMemo(() => {
    const keyword = filters.categoryKeyword.trim().toLowerCase()
    if (!keyword) return categories
    return categories.filter((category) => category.name.toLowerCase().includes(keyword))
  }, [categories, filters.categoryKeyword])

  const sortedAssets = useMemo(() => {
    const list = [...assets]
    const { key, direction } = sortConfig
    list.sort((a, b) => {
      const av = String(a[key] ?? '').toLowerCase()
      const bv = String(b[key] ?? '').toLowerCase()
      if (av < bv) return direction === 'asc' ? -1 : 1
      if (av > bv) return direction === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [assets, sortConfig])

  const totalPages = Math.max(1, Math.ceil(sortedAssets.length / PAGE_SIZE))
  const paginatedAssets = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return sortedAssets.slice(start, start + PAGE_SIZE)
  }, [sortedAssets, currentPage])

  useEffect(() => {
    const initializePage = async () => {
      try {
        const [assetRes, locationRes, categoryRes] = await Promise.all([
          axiosClient.get('/api/assets'),
          axiosClient.get('/api/locations'),
          axiosClient.get('/api/categories'),
        ])
        setAssets(assetRes.data || [])
        setCurrentPage(1)
        setLocations(locationRes.data || [])
        setCategories(categoryRes.data || [])
      } catch (error) {
        const message = error?.response?.data?.message || 'Không thể tải dữ liệu trang thiết bị.'
        toast.error(message)
      } finally {
        setLoading(false)
      }
    }
    initializePage()
  }, [])

  const loadAssets = async (nextFilters = filters) => {
    setLoading(true)
    try {
      const params = {}
      if (nextFilters.name.trim()) params.name = nextFilters.name.trim()
      if (nextFilters.status) params.status = nextFilters.status
      if (nextFilters.categoryId) params.categoryId = Number(nextFilters.categoryId)
      if (nextFilters.locationId) params.locationId = Number(nextFilters.locationId)
      const response = await axiosClient.get('/api/assets', { params })
      setAssets(response.data || [])
      setCurrentPage(1)
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể tải danh sách thiết bị.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setSelectedQaCode(null)
    setForm({
      qaCode: '',
      name: '',
      categoryId: '',
      locationId: '',
      status: 'Sẵn sàng',
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
    if (!form.qaCode || !form.name || !form.categoryId || !form.locationId || !form.status) {
      toast.error('Vui lòng nhập đầy đủ thông tin thiết bị.')
      return
    }
    setSubmitting(true)
    try {
      const response = await axiosClient.post('/api/assets', {
        qaCode: form.qaCode.trim(),
        name: form.name.trim(),
        categoryId: Number(form.categoryId),
        locationId: Number(form.locationId),
        status: form.status,
      })
      if (response.data?.qrCodeBase64) {
        setQrImage(`data:image/png;base64,${response.data.qrCodeBase64}`)
      } else {
        setQrImage('')
      }
      toast.success('Thêm thiết bị thành công.')
      resetForm()
      await loadAssets()
    } catch (error) {
      const message = error?.response?.data?.message || 'Thêm thiết bị thất bại.'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateAsset = async () => {
    if (!selectedQaCode) return
    if (!form.name || !form.categoryId || !form.locationId || !form.status) {
      toast.error('Vui lòng nhập đầy đủ thông tin để cập nhật.')
      return
    }
    setSubmitting(true)
    try {
      await axiosClient.put(`/api/assets/${selectedQaCode}`, {
        name: form.name.trim(),
        categoryId: Number(form.categoryId),
        locationId: Number(form.locationId),
        status: form.status,
      })
      toast.success('Cập nhật thiết bị thành công.')
      resetForm()
      await loadAssets()
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
      await loadAssets()
    } catch (error) {
      const message = error?.response?.data?.message || 'Xóa thiết bị thất bại.'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSelectAsset = (asset) => {
    setSelectedQaCode(asset.qaCode)
    setQrImage('')
    setForm({
      qaCode: asset.qaCode,
      name: asset.name,
      categoryId: String(asset.categoryId),
      locationId: String(asset.homeLocationId || asset.locationId),
      status: asset.status,
    })
  }

  const handleSearch = async () => {
    await loadAssets()
  }

  const handleResetFilters = async () => {
    const reset = { name: '', status: '', categoryId: '', locationId: '', categoryKeyword: '' }
    setFilters(reset)
    await loadAssets(reset)
  }

  const handleOpenQrModal = async (qaCode) => {
    setQrModalLoading(true)
    try {
      const response = await axiosClient.get(`/api/assets/${qaCode}`)
      const qrCodeBase64 = response.data?.qrCodeBase64
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

  const isEditing = Boolean(selectedQaCode)

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
    setCurrentPage(1)
  }

  const getSortLabel = (key, label) => {
    if (sortConfig.key !== key) return label
    return `${label} ${sortConfig.direction === 'asc' ? '▲' : '▼'}`
  }

  const goToFirstPage = () => setCurrentPage(1)
  const goToPrevPage = () => setCurrentPage((prev) => Math.max(1, prev - 1))
  const goToNextPage = () => setCurrentPage((prev) => Math.min(totalPages, prev + 1))
  const goToLastPage = () => setCurrentPage(totalPages)

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">Thiết bị hiện có</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Mã QA</label>
            <input
              value={form.qaCode}
              onChange={(e) => setForm((prev) => ({ ...prev, qaCode: e.target.value }))}
              disabled={isEditing}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2 disabled:bg-slate-100"
              placeholder="Ví dụ: QA001"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Tên thiết bị</label>
            <input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
              placeholder="Nhập tên thiết bị"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Loại thiết bị</label>
            <select
              value={form.categoryId}
              onChange={(e) => setForm((prev) => ({ ...prev, categoryId: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
            >
              <option value="">Chọn loại</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Phòng gốc</label>
            <select
              value={form.locationId}
              onChange={(e) => setForm((prev) => ({ ...prev, locationId: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
            >
              <option value="">Chọn phòng</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.roomName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Trạng thái</label>
            <select
              value={form.status}
              onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <button
            type="button"
            onClick={handleCreateAsset}
            disabled={submitting || isEditing}
            className="rounded-lg bg-fptOrange px-3 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark disabled:opacity-60"
          >
            Thêm mới
          </button>
          <button
            type="button"
            onClick={handleUpdateAsset}
            disabled={submitting || !isEditing}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            Cập nhật
          </button>
          <button
            type="button"
            onClick={() => handleDeleteAsset(selectedQaCode)}
            disabled={submitting || !isEditing}
            className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            Xóa
          </button>
          <button
            type="button"
            onClick={resetForm}
            disabled={submitting}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            Reset form
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
        <h3 className="mb-3 text-base font-semibold text-slate-800">Lọc và tìm thiết bị</h3>
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
                        categoryKeyword: category.name,
                      }))
                      setShowCategoryFilterOptions(false)
                    }}
                    className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-orange-50"
                  >
                    {category.name}
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
        <p className="text-sm text-slate-500">Tổng: {assets.length}</p>
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
                  {getSortLabel('homeLocationName', 'Phòng học')}
                </button>
              </th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">
                <button type="button" onClick={() => handleSort('status')} className="hover:text-fptOrange">
                  {getSortLabel('status', 'Trạng thái')}
                </button>
              </th>
              <th className="px-3 py-2 text-right font-semibold text-slate-600">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading &&
              Array.from({ length: 6 }).map((_, index) => (
                <tr key={`skeleton-${index}`} className="animate-pulse">
                  <td className="px-3 py-2">
                    <div className="h-4 w-16 rounded bg-slate-200" />
                  </td>
                  <td className="px-3 py-2">
                    <div className="h-4 w-40 rounded bg-slate-200" />
                  </td>
                  <td className="px-3 py-2">
                    <div className="h-4 w-24 rounded bg-slate-200" />
                  </td>
                  <td className="px-3 py-2">
                    <div className="h-4 w-28 rounded bg-slate-200" />
                  </td>
                  <td className="px-3 py-2">
                    <div className="h-4 w-20 rounded bg-slate-200" />
                  </td>
                  <td className="px-3 py-2">
                    <div className="h-4 w-24 rounded bg-slate-200" />
                  </td>
                </tr>
              ))}
            {!loading &&
              paginatedAssets.map((asset) => (
                <tr key={asset.qaCode}>
                  <td className="px-3 py-2">{asset.qaCode}</td>
                  <td className="px-3 py-2">{asset.name}</td>
                  <td className="px-3 py-2">{asset.category}</td>
                  <td className="px-3 py-2">{asset.homeLocationName || asset.homeLocationId}</td>
                  <td className="px-3 py-2">{asset.status}</td>
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
          </tbody>
        </table>
      </div>
      {!loading && (
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
    </div>
  )
}

export default AssetManagement
