import { IconInfoCircle as InfoCircle, IconLayersIntersect as Layers, IconTool as Wrench, IconTrash as Trash2 } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../../api/axiosClient'
import ActionIconButton from '../../components/ui/ActionIconButton'
import { useTableSort } from '../../hooks/useTableSort'

const PAGE_SIZE = 10

function LocationManagement() {
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showFormModal, setShowFormModal] = useState(false)
  const [showFloorModal, setShowFloorModal] = useState(false)
  const [selectedLocationId, setSelectedLocationId] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [floors, setFloors] = useState([])
  const [filters, setFilters] = useState({
    keyword: '',
  })
  const [form, setForm] = useState({
    roomName: '',
    floorId: '',
    hasAsset: true,
  })
  const [floorForm, setFloorForm] = useState({
    name: '',
    gridRows: 12,
    gridCols: 20,
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

  const loadLocations = useCallback(async (nextFilters = filters) => {
    setLoading(true)
    try {
      const params = { hasAsset: true }
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
  }, [filters])

  const loadFloors = useCallback(async () => {
    try {
      const response = await axiosClient.get('/api/asset-map/floors')
      setFloors(response.data || [])
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể tải danh sách tầng.'
      toast.error(message)
    }
  }, [])

  useEffect(() => {
    const bootstrapTimer = window.setTimeout(() => {
      void loadLocations()
      void loadFloors()
    }, 0)

    return () => {
      window.clearTimeout(bootstrapTimer)
    }
  }, [loadFloors, loadLocations])

  const resetForm = () => {
    setSelectedLocationId(null)
    setForm({ roomName: '', floorId: '', hasAsset: true })
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
      floorId: location.floorId != null ? String(location.floorId) : '',
      hasAsset: location.hasAsset !== false,
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
        floorId: form.floorId ? Number(form.floorId) : null,
        hasAsset: Boolean(form.hasAsset),
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
        floorId: form.floorId ? Number(form.floorId) : null,
        hasAsset: Boolean(form.hasAsset),
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

  const handleCreateFloor = async () => {
    if (!floorForm.name.trim()) {
      toast.error('Vui lòng nhập tên tầng.')
      return
    }
    setSubmitting(true)
    try {
      await axiosClient.post('/api/asset-map/floors', {
        name: floorForm.name.trim(),
        gridRows: Number(floorForm.gridRows) || 12,
        gridCols: Number(floorForm.gridCols) || 20,
      })
      toast.success('Thêm tầng thành công.')
      setShowFloorModal(false)
      setFloorForm({ name: '', gridRows: 12, gridCols: 20 })
      await loadFloors()
    } catch (error) {
      const message = error?.response?.data?.message || 'Thêm tầng thất bại.'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Quản lý phòng - khu vực</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Theo dõi phòng học hoặc khu vực lưu trữ thiết bị trong hệ thống, đồng thời gán tầng cho sơ đồ định vị.</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowFloorModal(true)}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Layers size={16} />
              Thêm tầng
            </button>
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

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Danh sách phòng</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Tổng: {locations.length}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/70">
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
                <th className="px-3 py-2 text-left font-semibold text-slate-600">Tầng</th>
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
                      <div className="h-4 w-24 rounded bg-slate-200" />
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
                      {location.floorName ? (
                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          {location.floorName}
                        </span>
                      ) : (
                        <span className="text-slate-400">Chưa gán</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <ActionIconButton
                          icon={Wrench}
                          label="Sửa phòng"
                          variant="primary"
                          onClick={() => handleSelectLocation(location)}
                        />
                        <ActionIconButton
                          icon={Trash2}
                          label="Xóa phòng"
                          variant="danger"
                          onClick={() => handleDelete(location.id)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              {!loading && locations.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-sm text-slate-500">
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
        <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Danh sách tầng</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Tầng có thể để trống ở phòng cũ để tránh ảnh hưởng dữ liệu hiện tại.</p>
            </div>
            <span className="text-sm text-slate-500 dark:text-slate-400">Tổng: {floors.length}</span>
          </div>
          <div className="space-y-3">
            {floors.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                Chưa có tầng nào. Hãy thêm tầng để bắt đầu dựng sơ đồ.
              </div>
            )}
            {floors.map((floor) => (
              <div key={floor.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-950/60">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{floor.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Grid {floor.gridRows} x {floor.gridCols}
                    </p>
                  </div>
                  <Link
                    to="/admin/asset-map"
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Mở sơ đồ
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
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
                onChange={(e) => setForm((prev) => ({ ...prev, roomName: e.target.value }))}
                placeholder="Ví dụ: P.201 hoặc Kho thiết bị A"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
              />
            </div>

            <div className="mt-3">
              <label className="mb-1 block text-sm font-medium text-slate-700">Tầng</label>
              <select
                value={form.floorId}
                onChange={(e) => setForm((prev) => ({ ...prev, floorId: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
              >
                <option value="">Chưa gán tầng</option>
                {floors.map((floor) => (
                  <option key={floor.id} value={floor.id}>
                    {floor.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-start gap-3">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(form.hasAsset)}
                    onChange={(e) => setForm((prev) => ({ ...prev, hasAsset: e.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300 text-fptOrange focus:ring-fptOrange"
                  />
                  Khu vực chứa tài sản
                </label>
                <div className="group relative mt-0.5">
                  <button
                    type="button"
                    className="text-slate-400 transition hover:text-slate-600"
                    aria-label="Giải thích khu vực chứa tài sản"
                  >
                    <InfoCircle size={16} />
                  </button>
                  <div className="pointer-events-none absolute left-1/2 top-7 z-10 hidden w-64 -translate-x-1/2 rounded-xl bg-slate-900 px-3 py-2 text-xs leading-5 text-white shadow-xl group-hover:block group-focus-within:block">
                    Bật tùy chọn này nếu khu vực được phép dùng làm vị trí đặt hoặc lưu trữ tài sản. Nếu bỏ chọn, khu vực chỉ dùng để hiển thị trên sơ đồ như hành lang, sân hoặc cổng.
                  </div>
                </div>
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

      {showFloorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-4 shadow-xl dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-base font-semibold text-slate-800 dark:text-slate-100">Thêm tầng mới</h4>
              <button
                type="button"
                onClick={() => setShowFloorModal(false)}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Đóng
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Tên tầng</label>
                <input
                  value={floorForm.name}
                  onChange={(e) => setFloorForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Ví dụ: Tầng 1"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Số hàng grid</label>
                <input
                  type="number"
                  min="4"
                  max="100"
                  value={floorForm.gridRows}
                  onChange={(e) => setFloorForm((prev) => ({ ...prev, gridRows: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Số cột grid</label>
                <input
                  type="number"
                  min="4"
                  max="100"
                  value={floorForm.gridCols}
                  onChange={(e) => setFloorForm((prev) => ({ ...prev, gridCols: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleCreateFloor}
                disabled={submitting}
                className="rounded-lg bg-fptOrange px-4 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark disabled:opacity-60"
              >
                Tạo tầng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default LocationManagement
