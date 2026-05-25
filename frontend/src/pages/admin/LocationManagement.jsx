import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import axiosClient from '../../api/axiosClient'
import { useTableSort } from '../../hooks/useTableSort'

const PAGE_SIZE = 10

function LocationManagement() {
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showFormModal, setShowFormModal] = useState(false)
  const [selectedLocationId, setSelectedLocationId] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [filters, setFilters] = useState({
    keyword: '',
  })
  const [form, setForm] = useState({
    roomName: '',
  })
  const { sortedItems: sortedLocations, handleSort, getSortLabel } = useTableSort(locations, {
    initialKey: 'id',
    initialDirection: 'asc',
    onSortChange: () => setCurrentPage(1),
  })

  const isEditing = Boolean(selectedLocationId)
  const totalPages = Math.max(1, Math.ceil(sortedLocations.length / PAGE_SIZE))
  const paginatedLocations = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return sortedLocations.slice(start, start + PAGE_SIZE)
  }, [sortedLocations, currentPage])

  const loadLocations = async (nextFilters = filters) => {
    setLoading(true)
    try {
      const params = {}
      if (nextFilters.keyword.trim()) params.keyword = nextFilters.keyword.trim()
      const response = await axiosClient.get('/api/locations', { params })
      setLocations(response.data || [])
      setCurrentPage(1)
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể tải danh sách phòng.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLocations()
  }, [])

  const resetForm = () => {
    setSelectedLocationId(null)
    setForm({ roomName: '' })
  }

  const closeFormModal = () => {
    setShowFormModal(false)
    resetForm()
  }

  const openCreateModal = () => {
    resetForm()
    setShowFormModal(true)
  }

  const handleSelectLocation = (location) => {
    setSelectedLocationId(location.id)
    setForm({
      roomName: location.roomName || '',
    })
    setShowFormModal(true)
  }

  const handleCreate = async () => {
    if (!form.roomName.trim()) {
      toast.error('Vui lòng nhập tên phòng hoặc khu vực.')
      return
    }
    setSubmitting(true)
    try {
      await axiosClient.post('/api/locations', {
        roomName: form.roomName.trim(),
      })
      toast.success('Thêm phòng thành công.')
      closeFormModal()
      await loadLocations()
    } catch (error) {
      const message = error?.response?.data?.message || 'Thêm phòng thất bại.'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdate = async () => {
    if (!selectedLocationId) return
    if (!form.roomName.trim()) {
      toast.error('Vui lòng nhập tên phòng hoặc khu vực.')
      return
    }
    setSubmitting(true)
    try {
      await axiosClient.put(`/api/locations/${selectedLocationId}`, {
        roomName: form.roomName.trim(),
      })
      toast.success('Cập nhật phòng thành công.')
      closeFormModal()
      await loadLocations()
    } catch (error) {
      const message = error?.response?.data?.message || 'Cập nhật phòng thất bại.'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id = selectedLocationId) => {
    if (!id) return
    const confirmed = window.confirm('Bạn có chắc muốn xóa phòng hoặc khu vực này?')
    if (!confirmed) return
    setSubmitting(true)
    try {
      await axiosClient.delete(`/api/locations/${id}`)
      toast.success('Xóa phòng thành công.')
      if (id === selectedLocationId) {
        closeFormModal()
      }
      await loadLocations()
    } catch (error) {
      const message = error?.response?.data?.message || 'Xóa phòng thất bại.'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleResetFilters = async () => {
    const nextFilters = { keyword: '' }
    setFilters(nextFilters)
    await loadLocations(nextFilters)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Quản lý phòng</h2>
            <p className="text-sm text-slate-500">Theo dõi phòng học hoặc khu vực lưu trữ thiết bị trong hệ thống.</p>
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
              onClick={() => loadLocations()}
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
            placeholder="Tìm theo tên phòng hoặc khu vực"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
          />
          <button
            type="button"
            onClick={() => loadLocations()}
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
          <h3 className="text-lg font-semibold text-slate-800">Danh sách phòng</h3>
          <p className="text-sm text-slate-500">Tổng: {locations.length}</p>
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
                  <button type="button" onClick={() => handleSort('roomName')} className="hover:text-fptOrange">
                    {getSortLabel('roomName', 'Tên phòng / khu vực')}
                  </button>
                </th>
                <th className="px-3 py-2 text-right font-semibold text-slate-600">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading &&
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={`location-skeleton-${index}`} className="animate-pulse">
                    <td className="px-3 py-2">
                      <div className="h-4 w-12 rounded bg-slate-200" />
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
                paginatedLocations.map((location) => (
                  <tr key={location.id}>
                    <td className="px-3 py-2">{location.id}</td>
                    <td className="px-3 py-2">{location.roomName}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleSelectLocation(location)}
                          className="rounded-md border border-blue-300 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(location.id)}
                          className="rounded-md border border-red-300 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              {!loading && locations.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-sm text-slate-500">
                    Chưa có phòng hoặc khu vực phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {!loading && locations.length > 0 && (
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
                {isEditing ? `Chỉnh sửa phòng #${selectedLocationId}` : 'Thêm mới phòng'}
              </h4>
              <button
                type="button"
                onClick={closeFormModal}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Đóng
              </button>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Tên phòng / khu vực</label>
              <input
                value={form.roomName}
                onChange={(e) => setForm({ roomName: e.target.value })}
                placeholder="Ví dụ: P.201 hoặc Kho thiết bị A"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
              />
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

export default LocationManagement
