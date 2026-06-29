import { IconCheck as Check, IconPlus as Plus, IconTool as Wrench, IconTrash as Trash2, IconX as X } from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import ActionIconButton from '../../../components/ui/ActionIconButton'
import ModalOverlay from '../../../components/ui/ModalOverlay'
import { useTableSort } from '../../../hooks/useTableSort'
import { buildAreaGroupOptions } from './areaTypes'

const PAGE_SIZE = 8

function createDefaultForm() {
  return {
    label: '',
    areaGroupLabel: '',
    description: '',
    isStorageWarehouse: false,
  }
}

export default function AreaTypeCatalogModal({
  areaTypes,
  onCreate,
  onUpdate,
  onDelete,
}) {
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [warehouseFilter, setWarehouseFilter] = useState('ALL')
  const [form, setForm] = useState(createDefaultForm)

  const getSortValue = (item, key) => {
    if (key === 'warehouse') return Boolean(item?.isStorageWarehouse ?? item?.storageWarehouse)
    if (key === 'usageCount') return Number(item?.usageCount || 0)
    return item?.[key]
  }

  const { sortedItems, handleSort, getSortLabel } = useTableSort(areaTypes || [], {
    initialKey: 'label',
    initialDirection: 'asc',
    getSortValue,
    onSortChange: () => setCurrentPage(1),
  })

  const editingItem = useMemo(
    () => (areaTypes || []).find((item) => Number(item.id) === Number(editingId)) || null,
    [areaTypes, editingId],
  )

  const areaGroupOptions = useMemo(() => buildAreaGroupOptions(areaTypes), [areaTypes])

  const filteredAreaTypes = useMemo(() => {
    const normalizedKeyword = searchKeyword.trim().toLowerCase()
    return sortedItems.filter((item) => {
      const matchesKeyword = !normalizedKeyword || [
        item?.label,
        item?.areaGroupLabel,
        item?.description,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedKeyword))
      if (!matchesKeyword) return false
      const isStorageWarehouse = Boolean(item?.isStorageWarehouse ?? item?.storageWarehouse)
      if (warehouseFilter === 'WAREHOUSE') return isStorageWarehouse
      if (warehouseFilter === 'NON_WAREHOUSE') return !isStorageWarehouse
      return true
    })
  }, [searchKeyword, sortedItems, warehouseFilter])

  const totalPages = Math.max(1, Math.ceil(filteredAreaTypes.length / PAGE_SIZE))

  const paginatedAreaTypes = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredAreaTypes.slice(start, start + PAGE_SIZE)
  }, [currentPage, filteredAreaTypes])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchKeyword, warehouseFilter])

  useEffect(() => {
    setCurrentPage((previous) => Math.min(previous, totalPages))
  }, [totalPages])

  const resetForm = () => {
    setEditingId(null)
    setForm(createDefaultForm())
  }

  const closeEditor = () => {
    if (submitting) return
    setEditorOpen(false)
    resetForm()
  }

  const handleCreate = () => {
    resetForm()
    setEditorOpen(true)
  }

  const handleEdit = (item) => {
    setEditingId(item.id)
    setForm({
      label: item.label || '',
      areaGroupLabel: item.areaGroupLabel || '',
      description: item.description || '',
      isStorageWarehouse: Boolean(item.isStorageWarehouse ?? item.storageWarehouse),
    })
    setEditorOpen(true)
  }

  const handleSubmit = async () => {
    if (!form.label.trim()) return
    setSubmitting(true)
    try {
      if (editingId) {
        await onUpdate(editingId, form)
      } else {
        await onCreate(form)
      }
      closeEditor()
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (item) => {
    if (submitting) return
    setSubmitting(true)
    try {
      await onDelete(item)
      if (Number(editingId) === Number(item.id) && editorOpen) {
        closeEditor()
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid flex-1 gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
              <input
                value={searchKeyword}
                onChange={(event) => setSearchKeyword(event.target.value)}
                placeholder="Tìm theo tên loại, nhóm hoặc mô tả"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              <select
                value={warehouseFilter}
                onChange={(event) => setWarehouseFilter(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="ALL">Tất cả loại khu vực</option>
                <option value="WAREHOUSE">Chỉ loại là kho</option>
                <option value="NON_WAREHOUSE">Chỉ loại không phải kho</option>
              </select>
            </div>
            <button
              type="button"
              onClick={handleCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-fptOrange px-3 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark"
            >
              <Plus size={16} />
              Thêm loại mới
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-800/70">
              <tr>
                <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">
                  <button type="button" onClick={() => handleSort('label')} className="whitespace-nowrap hover:text-fptOrange">
                    {getSortLabel('label', 'Loại khu vực')}
                  </button>
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">
                  <button type="button" onClick={() => handleSort('areaGroupLabel')} className="whitespace-nowrap hover:text-fptOrange">
                    {getSortLabel('areaGroupLabel', 'Nhóm')}
                  </button>
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-center font-semibold text-slate-600 dark:text-slate-300">
                  <button type="button" onClick={() => handleSort('warehouse')} className="whitespace-nowrap hover:text-fptOrange">
                    {getSortLabel('warehouse', 'Kho')}
                  </button>
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">
                  <button type="button" onClick={() => handleSort('usageCount')} className="whitespace-nowrap hover:text-fptOrange">
                    {getSortLabel('usageCount', 'Đang dùng')}
                  </button>
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-slate-600 dark:text-slate-300">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedAreaTypes.map((item) => {
                const isWarehouse = Boolean(item.isStorageWarehouse ?? item.storageWarehouse)
                return (
                  <tr key={item.id}>
                    <td className="px-3 py-3">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{item.label}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {item.description || 'Chưa có mô tả cho loại khu vực này.'}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{item.areaGroupLabel || 'Chưa phân nhóm'}</td>
                    <td className="px-3 py-3 text-center">
                      {isWarehouse ? (
                        <span className="inline-flex items-center justify-center text-emerald-600 dark:text-emerald-300" title="Có">
                          <Check className="h-4 w-4" />
                          <span className="sr-only">Có</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center text-red-500 dark:text-red-300" title="Không">
                          <X className="h-4 w-4" />
                          <span className="sr-only">Không</span>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{item.usageCount || 0}</td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-2">
                        <ActionIconButton
                          icon={Wrench}
                          label="Sửa loại khu vực"
                          variant="primary"
                          onClick={() => handleEdit(item)}
                        />
                        {!item.builtIn && (
                          <ActionIconButton
                            icon={Trash2}
                            label="Xóa loại khu vực"
                            variant="danger"
                            disabled={submitting}
                            onClick={() => { void handleDelete(item) }}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filteredAreaTypes.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                    Không có loại khu vực nào khớp với bộ lọc hiện tại.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filteredAreaTypes.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
            <p className="text-slate-500 dark:text-slate-400">
              Hiển thị {paginatedAreaTypes.length} / {filteredAreaTypes.length} loại khu vực
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((previous) => Math.max(1, previous - 1))}
                disabled={currentPage === 1}
                className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Trang trước
              </button>
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                Trang {currentPage}/{totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((previous) => Math.min(totalPages, previous + 1))}
                disabled={currentPage === totalPages}
                className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Trang tiếp
              </button>
            </div>
          </div>
        )}
      </div>

      {editorOpen && (
        <ModalOverlay zIndex={110}>
          <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {editingItem ? `Sửa loại: ${editingItem.label}` : 'Thêm loại khu vực'}
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {editingItem
                    ? 'Cập nhật tên hiển thị, nhóm khu vực và mô tả.'
                    : 'Tạo loại mới để dùng trong danh sách chọn khi thêm hoặc sửa khu vực.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                aria-label="Đóng"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Tên loại khu vực</label>
                <input
                  value={form.label}
                  onChange={(event) => setForm((previous) => ({ ...previous, label: event.target.value }))}
                  placeholder="Ví dụ: Sảnh, Khu chờ, Đường nội bộ"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Nhóm khu vực</label>
                <select
                  value={form.areaGroupLabel}
                  onChange={(event) => setForm((previous) => ({ ...previous, areaGroupLabel: event.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="">Chọn nhóm khu vực</option>
                  {areaGroupOptions.map((option) => (
                    <option key={option.key} value={option.label}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={Boolean(form.isStorageWarehouse)}
                  onChange={(event) => setForm((previous) => ({ ...previous, isStorageWarehouse: event.target.checked }))}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-fptOrange focus:ring-fptOrange dark:border-slate-700 dark:bg-slate-950"
                />
                <span>
                  Đánh dấu đây là loại khu vực kho lưu trữ để hệ thống cho phép chọn khi nhập hàng vật tư.
                </span>
              </label>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Mô tả</label>
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))}
                  placeholder="Mô tả ngắn để người dùng hiểu vai trò của loại khu vực này."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEditor}
                disabled={submitting}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => { void handleSubmit() }}
                disabled={submitting || !form.label.trim() || !form.areaGroupLabel.trim()}
                className="rounded-lg bg-fptOrange px-4 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark disabled:opacity-50"
              >
                {submitting ? 'Đang lưu...' : (editingItem ? 'Lưu thay đổi' : 'Thêm loại')}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </>
  )
}
