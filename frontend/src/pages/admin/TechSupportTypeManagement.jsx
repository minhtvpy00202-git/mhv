import { useEffect, useMemo, useState } from 'react'
import { Trash2, Wrench } from 'lucide-react'
import { toast } from 'react-toastify'
import axiosClient from '../../api/axiosClient'
import ActionIconButton from '../../components/ui/ActionIconButton'
import { useTableSort } from '../../hooks/useTableSort'

const PAGE_SIZE = 10

function TechSupportTypeManagement() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showFormModal, setShowFormModal] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [filters, setFilters] = useState({
    keyword: '',
  })
  const [form, setForm] = useState({
    name: '',
  })
  const { sortedItems, handleSort, getSortLabel } = useTableSort(items, {
    initialKey: 'id',
    initialDirection: 'asc',
    onSortChange: () => setCurrentPage(1),
  })

  const isEditing = Boolean(selectedId)
  const totalPages = Math.max(1, Math.ceil(sortedItems.length / PAGE_SIZE))
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return sortedItems.slice(start, start + PAGE_SIZE)
  }, [sortedItems, currentPage])

  const loadItems = async (nextFilters = filters) => {
    setLoading(true)
    try {
      const params = {}
      if (nextFilters.keyword.trim()) params.keyword = nextFilters.keyword.trim()
      const response = await axiosClient.get('/api/tech-support-types', { params })
      setItems(response.data || [])
      setCurrentPage(1)
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể tải danh sách loại kỹ thuật viên.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadItems()
  }, [])

  const resetForm = () => {
    setSelectedId(null)
    setForm({ name: '' })
  }

  const closeFormModal = () => {
    setShowFormModal(false)
    resetForm()
  }

  const openCreateModal = () => {
    resetForm()
    setShowFormModal(true)
  }

  const handleSelect = (item) => {
    setSelectedId(item.id)
    setForm({ name: item.name || '' })
    setShowFormModal(true)
  }

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error('Vui lòng nhập tên loại kỹ thuật viên.')
      return
    }
    setSubmitting(true)
    try {
      await axiosClient.post('/api/tech-support-types', { name: form.name.trim() })
      toast.success('Thêm loại kỹ thuật viên thành công.')
      closeFormModal()
      await loadItems()
    } catch (error) {
      const message = error?.response?.data?.message || 'Thêm loại kỹ thuật viên thất bại.'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdate = async () => {
    if (!selectedId) return
    if (!form.name.trim()) {
      toast.error('Vui lòng nhập tên loại kỹ thuật viên.')
      return
    }
    setSubmitting(true)
    try {
      await axiosClient.put(`/api/tech-support-types/${selectedId}`, { name: form.name.trim() })
      toast.success('Cập nhật loại kỹ thuật viên thành công.')
      closeFormModal()
      await loadItems()
    } catch (error) {
      const message = error?.response?.data?.message || 'Cập nhật loại kỹ thuật viên thất bại.'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id = selectedId) => {
    if (!id) return
    const confirmed = window.confirm('Bạn có chắc muốn xóa loại kỹ thuật viên này?')
    if (!confirmed) return
    setSubmitting(true)
    try {
      await axiosClient.delete(`/api/tech-support-types/${id}`)
      toast.success('Xóa loại kỹ thuật viên thành công.')
      if (id === selectedId) {
        closeFormModal()
      }
      await loadItems()
    } catch (error) {
      const message = error?.response?.data?.message || 'Xóa loại kỹ thuật viên thất bại.'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleResetFilters = async () => {
    const nextFilters = { keyword: '' }
    setFilters(nextFilters)
    await loadItems(nextFilters)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Quản lý loại kỹ thuật viên</h2>
            <p className="text-sm text-slate-500">Khai báo các nhóm chuyên môn để gán cho loại thiết bị và tài khoản kỹ thuật viên.</p>
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
              onClick={() => loadItems()}
              disabled={loading}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            >
              Tải lại
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
          <input
            value={filters.keyword}
            onChange={(e) => setFilters((prev) => ({ ...prev, keyword: e.target.value }))}
            placeholder="Tìm theo tên loại kỹ thuật viên"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
          />
          <button
            type="button"
            onClick={() => loadItems()}
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

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">Danh sách loại kỹ thuật viên</h3>
          <p className="text-sm text-slate-500">Tổng: {items.length}</p>
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
                    {getSortLabel('name', 'Tên loại kỹ thuật viên')}
                  </button>
                </th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">
                  <button type="button" onClick={() => handleSort('categoryCount')} className="hover:text-fptOrange">
                    {getSortLabel('categoryCount', 'Loại thiết bị đang dùng')}
                  </button>
                </th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">
                  <button type="button" onClick={() => handleSort('techSupportUserCount')} className="hover:text-fptOrange">
                    {getSortLabel('techSupportUserCount', 'Tài khoản kỹ thuật viên')}
                  </button>
                </th>
                <th className="px-3 py-2 text-right font-semibold text-slate-600">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading &&
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={`tech-type-skeleton-${index}`} className="animate-pulse">
                    <td className="px-3 py-2"><div className="h-4 w-12 rounded bg-slate-200" /></td>
                    <td className="px-3 py-2"><div className="h-4 w-56 rounded bg-slate-200" /></td>
                    <td className="px-3 py-2"><div className="h-4 w-16 rounded bg-slate-200" /></td>
                    <td className="px-3 py-2"><div className="h-4 w-16 rounded bg-slate-200" /></td>
                    <td className="px-3 py-2"><div className="ml-auto h-4 w-24 rounded bg-slate-200" /></td>
                  </tr>
                ))}
              {!loading &&
                paginatedItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2">{item.id}</td>
                    <td className="px-3 py-2">{item.name}</td>
                    <td className="px-3 py-2">{item.categoryCount}</td>
                    <td className="px-3 py-2">{item.techSupportUserCount}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <ActionIconButton
                          icon={Wrench}
                          label="Sửa loại kỹ thuật viên"
                          variant="primary"
                          onClick={() => handleSelect(item)}
                        />
                        <ActionIconButton
                          icon={Trash2}
                          label="Xóa loại kỹ thuật viên"
                          variant="danger"
                          onClick={() => handleDelete(item.id)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-500">
                    Chưa có loại kỹ thuật viên phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {!loading && items.length > 0 && (
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
                {isEditing ? `Chỉnh sửa loại kỹ thuật viên #${selectedId}` : 'Thêm mới loại kỹ thuật viên'}
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
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Tên loại kỹ thuật viên</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Ví dụ: Kỹ thuật viên thiết bị công nghệ cao"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
                />
              </div>
              {isEditing && (
                <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600 md:grid-cols-2">
                  <p>Loại thiết bị đang dùng: {items.find((item) => item.id === selectedId)?.categoryCount || 0}</p>
                  <p>Tài khoản kỹ thuật viên: {items.find((item) => item.id === selectedId)?.techSupportUserCount || 0}</p>
                </div>
              )}
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

export default TechSupportTypeManagement
