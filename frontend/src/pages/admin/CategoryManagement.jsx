import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import axiosClient from '../../api/axiosClient'
import { fetchTechSupportTypeOptions } from '../../api/techSupportTypeApi'

const PAGE_SIZE = 10

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
  })

  const isEditing = Boolean(selectedCategoryId)
  const totalPages = Math.max(1, Math.ceil(categories.length / PAGE_SIZE))
  const paginatedCategories = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return categories.slice(start, start + PAGE_SIZE)
  }, [categories, currentPage])

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
    setForm({
      name: '',
      techTypeId: '',
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

  const handleSelectCategory = (category) => {
    setSelectedCategoryId(category.id)
    setForm({
      name: category.name || '',
      techTypeId: String(category.techTypeId || ''),
    })
    setShowFormModal(true)
  }

  const handleCreate = async () => {
    if (!form.name.trim() || !form.techTypeId) {
      toast.error('Vui lòng nhập tên loại và chọn nhóm kỹ thuật.')
      return
    }
    setSubmitting(true)
    try {
      const response = await axiosClient.post('/api/categories', {
        name: form.name.trim(),
        techTypeId: Number(form.techTypeId),
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
    if (!form.name.trim() || !form.techTypeId) {
      toast.error('Vui lòng nhập đầy đủ thông tin loại thiết bị.')
      return
    }
    setSubmitting(true)
    try {
      await axiosClient.put(`/api/categories/${selectedCategoryId}`, {
        name: form.name.trim(),
        techTypeId: Number(form.techTypeId),
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
                <th className="px-3 py-2 text-left font-semibold text-slate-600">ID</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">Tên loại thiết bị</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">Code Prefix</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">Nhóm kỹ thuật phụ trách</th>
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
                  <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-500">
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
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Ví dụ: Máy chiếu"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Nhóm kỹ thuật phụ trách</label>
                <select
                  value={form.techTypeId}
                  onChange={(e) => setForm((prev) => ({ ...prev, techTypeId: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
                >
                  <option value="">Chọn nhóm kỹ thuật</option>
                  {techSupportTypeOptions.map((item) => (
                    <option key={item.techTypeId} value={item.techTypeId}>
                      {item.label}
                    </option>
                  ))}
                </select>
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
