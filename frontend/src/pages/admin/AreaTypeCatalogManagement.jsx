import { useCallback, useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import axiosClient from '../../api/axiosClient'
import AreaTypeCatalogModal from './asset-map/AreaTypeCatalogModal'

export default function AreaTypeCatalogManagement() {
  const [areaTypes, setAreaTypes] = useState([])
  const [loading, setLoading] = useState(true)

  const loadAreaTypes = useCallback(async () => {
    try {
      const response = await axiosClient.get('/api/asset-map/area-types')
      setAreaTypes(response.data || [])
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể tải danh mục loại khu vực.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAreaTypes()
  }, [loadAreaTypes])

  const handleCreateAreaType = useCallback(async (form) => {
    try {
      const response = await axiosClient.post('/api/asset-map/area-types', {
        label: String(form?.label || '').trim(),
        areaGroupLabel: String(form?.areaGroupLabel || '').trim(),
        description: String(form?.description || '').trim(),
        isStorageWarehouse: Boolean(form?.isStorageWarehouse),
      })
      const created = response.data
      setAreaTypes((previous) => [...previous, created].sort((left, right) => {
        const leftOrder = Number(left?.sortOrder || 0)
        const rightOrder = Number(right?.sortOrder || 0)
        if (leftOrder !== rightOrder) return leftOrder - rightOrder
        return String(left?.label || '').localeCompare(String(right?.label || ''), 'vi')
      }))
      toast.success('Đã thêm loại khu vực.')
      return created
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể thêm loại khu vực.'
      toast.error(message)
      throw error
    }
  }, [])

  const handleUpdateAreaType = useCallback(async (areaTypeId, form) => {
    try {
      const response = await axiosClient.put(`/api/asset-map/area-types/${areaTypeId}`, {
        label: String(form?.label || '').trim(),
        areaGroupLabel: String(form?.areaGroupLabel || '').trim(),
        description: String(form?.description || '').trim(),
        isStorageWarehouse: Boolean(form?.isStorageWarehouse),
      })
      const updated = response.data
      setAreaTypes((previous) => previous
        .map((item) => (Number(item.id) === Number(areaTypeId) ? updated : item))
        .sort((left, right) => {
          const leftOrder = Number(left?.sortOrder || 0)
          const rightOrder = Number(right?.sortOrder || 0)
          if (leftOrder !== rightOrder) return leftOrder - rightOrder
          return String(left?.label || '').localeCompare(String(right?.label || ''), 'vi')
        }))
      toast.success('Đã cập nhật loại khu vực.')
      return updated
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể cập nhật loại khu vực.'
      toast.error(message)
      throw error
    }
  }, [])

  const handleDeleteAreaType = useCallback(async (areaType) => {
    if (!areaType?.id) return
    const confirmed = window.confirm(`Bạn có chắc muốn xóa loại khu vực "${areaType.label}" không?`)
    if (!confirmed) return
    try {
      await axiosClient.delete(`/api/asset-map/area-types/${areaType.id}`)
      setAreaTypes((previous) => previous.filter((item) => Number(item.id) !== Number(areaType.id)))
      toast.success('Đã xóa loại khu vực.')
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể xóa loại khu vực.'
      toast.error(message)
      throw error
    }
  }, [])

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Quản lý loại khu vực</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Tách riêng danh mục loại khu vực để quản lý nhóm không gian, đánh dấu loại nào là kho lưu trữ và dùng chung cho sơ đồ, khu vực và vật tư tiêu hao.
        </p>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          Đang tải danh mục loại khu vực...
        </div>
      ) : (
        <AreaTypeCatalogModal
          areaTypes={areaTypes}
          onCreate={handleCreateAreaType}
          onUpdate={handleUpdateAreaType}
          onDelete={handleDeleteAreaType}
        />
      )}
    </div>
  )
}
