import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import axiosClient from '../../api/axiosClient'
import { fetchTechSupportTypeOptions } from '../../api/techSupportTypeApi'
import { useTableSort } from '../../hooks/useTableSort'
import { normalizeSpecTemplates } from '../../utils/assetSpecs'
import { validateCategoryForm } from '../../utils/validation'

const PAGE_SIZE = 10

function getFieldClass(hasError) {
  return `w-full rounded-lg border px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2 ${hasError ? 'border-red-400 bg-red-50' : 'border-slate-300'}`
}

function getCategorySortValue(category, key) {
  if (key === 'specTemplatesConfigured') return category.specTemplatesConfigured ? 1 : 0
  return category?.[key]
}

function CategoryManagement() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showFormModal, setShowFormModal] = useState(false)
  const [selectedCategoryId, setSelectedCategoryId] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [techSupportTypeOptions, setTechSupportTypeOptions] = useState([])
  const [filters, setFilters] = useState({
    keyword: '',
    techTypeId: '',
  })
  const [form, setForm] = useState({
    name: '',
    techTypeId: '',
    specTemplates: [],
  })
  const [formErrors, setFormErrors] = useState({})
  const { sortedItems: sortedCategories, handleSort, getSortLabel } = useTableSort(categories, {
    initialKey: 'id',
    initialDirection: 'asc',
    getSortValue: getCategorySortValue,
    onSortChange: () => setCurrentPage(1),
  })

  const isEditing = Boolean(selectedCategoryId)
  const totalPages = Math.max(1, Math.ceil(sortedCategories.length / PAGE_SIZE))
  const paginatedCategories = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return sortedCategories.slice(start, start + PAGE_SIZE)
  }, [sortedCategories, currentPage])

  const loadCategories = async (nextFilters = filters) => {
    setLoading(true)
    try {
      const params = {}
      if (nextFilters.keyword.trim()) params.keyword = nextFilters.keyword.trim()
      if (nextFilters.techTypeId) params.techTypeId = Number(nextFilters.techTypeId)
      const response = await axiosClient.get('/api/categories', { params })
      setCategories(response.data || [])
      setCurrentPage(1)
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể tải danh sách loại thiết bị.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCategories()
    loadTechSupportTypes()
  }, [])

  const loadTechSupportTypes = async () => {
    try {
      const options = await fetchTechSupportTypeOptions()
      setTechSupportTypeOptions(options)
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể tải danh sách loại kỹ thuật viên.'
      toast.error(message)
    }
  }

  const resetForm = () => {
    setSelectedCategoryId(null)
    setFormErrors({})
    setForm({
      name: '',
      techTypeId: '',
      specTemplates: [],
    })
  }

  const closeFormModal = () => {
    setShowFormModal(false)
    resetForm()
  }

  const openCreateModal = () => {
    resetForm()
    setShowFormModal(true)
  }

  const handleSelectCategory = async (category) => {
    try {
      const response = await axiosClient.get(`/api/categories/${category.id}`)
      const detail = response.data || {}
      setSelectedCategoryId(category.id)
      setForm({
        name: detail.name || category.name || '',
        techTypeId: String(detail.techTypeId || category.techTypeId || ''),
        specTemplates: normalizeSpecTemplates(detail.specTemplates),
      })
      setShowFormModal(true)
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể tải chi tiết loại thiết bị.'
      toast.error(message)
    }
  }

  const handleCreate = async () => {
    const nextErrors = validateCategoryForm(form)
    setFormErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      toast.error(Object.values(nextErrors)[0])
      return
    }
    setSubmitting(true)
    try {
      const response = await axiosClient.post('/api/categories', {
        name: form.name.trim(),
        techTypeId: Number(form.techTypeId),
        specTemplates: normalizeSpecTemplates(form.specTemplates),
      })
      toast.success(`Thêm loại thiết bị thành công. Prefix: ${response.data?.codePrefix || 'đã tự sinh'}.`)
      closeFormModal()
      await loadCategories()
    } catch (error) {
      const message = error?.response?.data?.message || 'Thêm loại thiết bị thất bại.'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdate = async () => {
    if (!selectedCategoryId) return
    const nextErrors = validateCategoryForm(form)
    setFormErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      toast.error(Object.values(nextErrors)[0])
      return
    }
    setSubmitting(true)
    try {
      await axiosClient.put(`/api/categories/${selectedCategoryId}`, {
        name: form.name.trim(),
        techTypeId: Number(form.techTypeId),
        specTemplates: normalizeSpecTemplates(form.specTemplates),
      })
      toast.success('Cập nhật loại thiết bị thành công.')
      closeFormModal()
      await loadCategories()
    } catch (error) {
      const message = error?.response?.data?.message || 'Cập nhật loại thiết bị thất bại.'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id = selectedCategoryId) => {
    if (!id) return
    const confirmed = window.confirm('Bạn có chắc muốn xóa loại thiết bị này?')
    if (!confirmed) return
    setSubmitting(true)
    try {
      await axiosClient.delete(`/api/categories/${id}`)
      toast.success('Xóa loại thiết bị thành công.')
      if (id === selectedCategoryId) {
        closeFormModal()
      }
      await loadCategories()
    } catch (error) {
      const message = error?.response?.data?.message || 'Xóa loại thiết bị thất bại.'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleResetFilters = async () => {
    const nextFilters = {
      keyword: '',
      techTypeId: '',
    }
    setFilters(nextFilters)
    await loadCategories(nextFilters)
  }

  const updateSpecTemplate = (index, value) => {
    setForm((prev) => ({
      ...prev,
      specTemplates: prev.specTemplates.map((item, itemIndex) => (itemIndex === index ? value : item)),
    }))
    setFormErrors((prev) => ({ ...prev, specTemplates: '' }))
  }

  const addSpecTemplate = () => {
    setForm((prev) => ({
      ...prev,
      specTemplates: [...prev.specTemplates, ''],
    }))
    setFormErrors((prev) => ({ ...prev, specTemplates: '' }))
  }

  const removeSpecTemplate = (index) => {
    setForm((prev) => ({
      ...prev,
      specTemplates: prev.specTemplates.filter((_, itemIndex) => itemIndex !== index),
    }))
    setFormErrors((prev) => ({ ...prev, specTemplates: '' }))
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Quản lý loại thiết bị</h2>
            <p className="text-sm text-slate-500">Khai báo nhóm loại để phân luồng kỹ thuật và gán cho thiết bị.</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={openCreateModal}
              disabled={submitting}
              className="rounded-lg bg-fptOrange px-3 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark disabled:opacity-60"
            >
              Thêm mới
            </button>
            <button
              type="button"
              onClick={() => loadCategories()}
              disabled={loading}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            >
              Tải lại
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <input
            value={filters.keyword}
            onChange={(e) => setFilters((prev) => ({ ...prev, keyword: e.target.value }))}
            placeholder="Tìm theo tên loại thiết bị"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
          />
          <select
            value={filters.techTypeId}
            onChange={(e) => setFilters((prev) => ({ ...prev, techTypeId: e.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
          >
            <option value="">Tất cả nhóm kỹ thuật</option>
            {techSupportTypeOptions.map((item) => (
              <option key={item.techTypeId} value={item.techTypeId}>
                {item.label}
              </option>
            ))}
          </select>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => loadCategories()}
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
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">Danh sách loại thiết bị</h3>
          <p className="text-sm text-slate-500">Tổng: {categories.length}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">
                  <button type="button" onClick={() => handleSort('id')} className="hover:text-fptOrange">
                    {getSortLabel('id', 'ID')}
                  </button>
                </th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">
                  <button type="button" onClick={() => handleSort('name')} className="hover:text-fptOrange">
                    {getSortLabel('name', 'Tên loại thiết bị')}
                  </button>
                </th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">
                  <button type="button" onClick={() => handleSort('codePrefix')} className="hover:text-fptOrange">
                    {getSortLabel('codePrefix', 'Code Prefix')}
                  </button>
                </th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">
                  <button type="button" onClick={() => handleSort('techTypeName')} className="hover:text-fptOrange">
                    {getSortLabel('techTypeName', 'Nhóm kỹ thuật phụ trách')}
                  </button>
                </th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">
                  <button type="button" onClick={() => handleSort('specTemplatesConfigured')} className="hover:text-fptOrange">
                    {getSortLabel('specTemplatesConfigured', 'Mẫu thông số kỹ thuật')}
                  </button>
                </th>
                <th className="px-3 py-2 text-right font-semibold text-slate-600">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading &&
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={`category-skeleton-${index}`} className="animate-pulse">
                    <td className="px-3 py-2">
                      <div className="h-4 w-12 rounded bg-slate-200" />
                    </td>
                    <td className="px-3 py-2">
                      <div className="h-4 w-48 rounded bg-slate-200" />
                    </td>
                    <td className="px-3 py-2">
                      <div className="h-4 w-20 rounded bg-slate-200" />
                    </td>
                    <td className="px-3 py-2">
                      <div className="h-4 w-56 rounded bg-slate-200" />
                    </td>
                    <td className="px-3 py-2">
                      <div className="h-4 w-32 rounded bg-slate-200" />
                    </td>
                    <td className="px-3 py-2">
                      <div className="ml-auto h-4 w-24 rounded bg-slate-200" />
                    </td>
                  </tr>
                ))}
              {!loading &&
                paginatedCategories.map((category) => (
                  <tr key={category.id}>
                    <td className="px-3 py-2">{category.id}</td>
                    <td className="px-3 py-2">{category.name}</td>
                    <td className="px-3 py-2">
                      <span className="rounded bg-slate-100 px-2 py-1 font-semibold text-slate-700">{category.codePrefix || '-'}</span>
                    </td>
                    <td className="px-3 py-2">{category.techTypeName || '-'}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">Mở sửa để xem chi tiết</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleSelectCategory(category)}
                          className="rounded-md border border-blue-300 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(category.id)}
                          className="rounded-md border border-red-300 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              {!loading && categories.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-500">
                    Chưa có loại thiết bị phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {!loading && categories.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Trang trước
            </button>
            <span className="font-semibold text-slate-700">
              Trang {currentPage}/{totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Trang tiếp
            </button>
          </div>
        )}
      </div>

      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-xl rounded-xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-base font-semibold text-slate-800">
                {isEditing ? `Chỉnh sửa loại thiết bị #${selectedCategoryId}` : 'Thêm mới loại thiết bị'}
              </h4>
              <button
                type="button"
                onClick={closeFormModal}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Đóng
              </button>
            </div>

            <div className="grid gap-3">
              {!isEditing && (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                  Code prefix sẽ được backend tự sinh khi bạn lưu loại thiết bị mới.
                </div>
              )}
              {isEditing && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Code Prefix</label>
                  <input
                    value={categories.find((item) => item.id === selectedCategoryId)?.codePrefix || ''}
                    disabled
                    className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-600"
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Tên loại thiết bị</label>
                <input
                  value={form.name}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                    setFormErrors((prev) => ({ ...prev, name: '' }))
                  }}
                  placeholder="Ví dụ: Máy chiếu"
                  className={getFieldClass(Boolean(formErrors.name))}
                />
                {formErrors.name && <p className="mt-1 text-xs text-red-600">{formErrors.name}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Nhóm kỹ thuật phụ trách</label>
                <select
                  value={form.techTypeId}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, techTypeId: e.target.value }))
                    setFormErrors((prev) => ({ ...prev, techTypeId: '' }))
                  }}
                  className={getFieldClass(Boolean(formErrors.techTypeId))}
                >
                  <option value="">Chọn nhóm kỹ thuật</option>
                  {techSupportTypeOptions.map((item) => (
                    <option key={item.techTypeId} value={item.techTypeId}>
                      {item.label}
                    </option>
                  ))}
                </select>
                {formErrors.techTypeId && <p className="mt-1 text-xs text-red-600">{formErrors.techTypeId}</p>}
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label className="block text-sm font-medium text-slate-700">Template đặc tính kỹ thuật</label>
                  <button
                    type="button"
                    onClick={addSpecTemplate}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Thêm template
                  </button>
                </div>
                <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  {form.specTemplates.map((template, index) => (
                    <div key={`template-${index}`} className="grid gap-2 md:grid-cols-[1fr_auto]">
                      <input
                        value={template}
                        onChange={(e) => updateSpecTemplate(index, e.target.value)}
                        placeholder="Ví dụ: RAM"
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
                      />
                      <button
                        type="button"
                        onClick={() => removeSpecTemplate(index)}
                        className="rounded-lg border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                      >
                        Xóa
                      </button>
                    </div>
                  ))}
                  {form.specTemplates.length === 0 && (
                    <p className="text-sm text-slate-500">Chưa có template. Bạn có thể thêm các đặc tính như RAM, CPU, GPU...</p>
                  )}
                </div>
                {formErrors.specTemplates && <p className="mt-1 text-xs text-red-600">{formErrors.specTemplates}</p>}
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={isEditing ? handleUpdate : handleCreate}
                disabled={submitting}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
                  isEditing ? 'bg-blue-600 hover:bg-blue-700' : 'bg-fptOrange hover:bg-fptOrangeDark'
                }`}
              >
                {isEditing ? 'Lưu chỉnh sửa' : 'Thêm mới'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CategoryManagement
