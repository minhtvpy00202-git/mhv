import { IconTool as Wrench, IconTrash as Trash2 } from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import axiosClient from '../../api/axiosClient'
import ActionIconButton from '../../components/ui/ActionIconButton'
import ColumnVisibilityDropdown from '../../components/ui/ColumnVisibilityDropdown'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import useColumnVisibility from '../../hooks/useColumnVisibility'
import useDebouncedEffect from '../../hooks/useDebouncedEffect'
import { useTableSort } from '../../hooks/useTableSort'
import { validateSupplierForm } from '../../utils/validation'

const PAGE_SIZE = 10
const supplierColumnOptions = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Tên nhà cung cấp' },
  { key: 'phoneNumber', label: 'Số điện thoại' },
  { key: 'address', label: 'Địa chỉ' },
  { key: 'assetCount', label: 'Thiết bị đang dùng' },
  { key: 'actions', label: 'Thao tác' },
]
const defaultSupplierVisibleColumnKeys = ['id', 'name', 'phoneNumber', 'assetCount', 'actions']

function createDefaultConfirmDialog() {
  return {
    open: false,
    title: '',
    message: '',
    confirmLabel: 'Xóa',
    cancelLabel: 'Hủy',
    tone: 'danger',
    busy: false,
    onConfirm: null,
  }
}

function getFieldClass(hasError) {
  return `w-full rounded-lg border px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2 ${hasError ? 'border-red-400 bg-red-50' : 'border-slate-300'}`
}

function normalizeSupplierForm(form) {
  return {
    name: String(form?.name || '').trim(),
    address: String(form?.address || '').trim(),
    phoneNumber: String(form?.phoneNumber || '').trim(),
  }
}

function SupplierManagement() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showFormModal, setShowFormModal] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [confirmDialog, setConfirmDialog] = useState(createDefaultConfirmDialog)
  const [currentPage, setCurrentPage] = useState(1)
  const [filters, setFilters] = useState({ keyword: '' })
  const [form, setForm] = useState({ name: '', address: '', phoneNumber: '' })
  const [initialForm, setInitialForm] = useState({ name: '', address: '', phoneNumber: '' })
  const [formErrors, setFormErrors] = useState({})
  const { sortedItems, handleSort, getSortLabel } = useTableSort(items, {
    initialKey: 'id',
    initialDirection: 'asc',
    onSortChange: () => setCurrentPage(1),
  })
  const {
    visibleColumns,
    activeColumns,
    selectedCount,
    allSelected,
    toggleColumn,
    selectAllColumns,
    resetDefaultColumns,
  } = useColumnVisibility({
    storageKey: 'mhv-admin-suppliers-visible-columns',
    columns: supplierColumnOptions,
    defaultVisibleKeys: defaultSupplierVisibleColumnKeys,
  })

  const isEditing = Boolean(selectedId)
  const normalizedForm = useMemo(() => normalizeSupplierForm(form), [form])
  const normalizedInitialForm = useMemo(() => normalizeSupplierForm(initialForm), [initialForm])
  const hasFormChanges = useMemo(
    () => JSON.stringify(normalizedForm) !== JSON.stringify(normalizedInitialForm),
    [normalizedForm, normalizedInitialForm],
  )
  const totalPages = Math.max(1, Math.ceil(sortedItems.length / PAGE_SIZE))
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return sortedItems.slice(start, start + PAGE_SIZE)
  }, [sortedItems, currentPage])
  const tableColumns = useMemo(() => ([
    {
      key: 'id',
      label: (
        <button type="button" onClick={() => handleSort('id')} className="whitespace-nowrap hover:text-fptOrange">
          {getSortLabel('id', 'ID')}
        </button>
      ),
      headClassName: 'whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600',
      cellClassName: 'px-3 py-2',
      render: (item) => item.id,
    },
    {
      key: 'name',
      label: (
        <button type="button" onClick={() => handleSort('name')} className="whitespace-nowrap hover:text-fptOrange">
          {getSortLabel('name', 'Tên nhà cung cấp')}
        </button>
      ),
      headClassName: 'whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600',
      cellClassName: 'px-3 py-2',
      render: (item) => item.name,
    },
    {
      key: 'phoneNumber',
      label: (
        <button type="button" onClick={() => handleSort('phoneNumber')} className="whitespace-nowrap hover:text-fptOrange">
          {getSortLabel('phoneNumber', 'Số điện thoại')}
        </button>
      ),
      headClassName: 'whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600',
      cellClassName: 'px-3 py-2',
      render: (item) => item.phoneNumber || '-',
    },
    {
      key: 'address',
      label: (
        <button type="button" onClick={() => handleSort('address')} className="whitespace-nowrap hover:text-fptOrange">
          {getSortLabel('address', 'Địa chỉ')}
        </button>
      ),
      headClassName: 'whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600',
      cellClassName: 'px-3 py-2',
      render: (item) => item.address || '-',
    },
    {
      key: 'assetCount',
      label: (
        <button type="button" onClick={() => handleSort('assetCount')} className="whitespace-nowrap hover:text-fptOrange">
          {getSortLabel('assetCount', 'Thiết bị đang dùng')}
        </button>
      ),
      headClassName: 'whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600',
      cellClassName: 'px-3 py-2',
      render: (item) => item.assetCount,
    },
    {
      key: 'actions',
      label: 'Thao tác',
      headClassName: 'whitespace-nowrap px-3 py-2 text-right font-semibold text-slate-600',
      cellClassName: 'px-3 py-2',
      render: (item) => (
        <div className="flex justify-end gap-2">
          <ActionIconButton
            icon={Wrench}
            label="Sửa nhà cung cấp"
            variant="primary"
            onClick={() => handleSelect(item)}
          />
          <ActionIconButton
            icon={Trash2}
            label="Xóa nhà cung cấp"
            variant="danger"
            onClick={() => handleDelete(item.id)}
          />
        </div>
      ),
    },
  ]), [getSortLabel, handleSort])
  const renderedColumns = useMemo(
    () => tableColumns.filter((column) => activeColumns.some((activeColumn) => activeColumn.key === column.key)),
    [activeColumns, tableColumns],
  )

  const loadItems = async (nextFilters = filters) => {
    setLoading(true)
    try {
      const params = {}
      if (nextFilters.keyword.trim()) params.keyword = nextFilters.keyword.trim()
      const response = await axiosClient.get('/api/suppliers', { params })
      setItems(response.data || [])
      setCurrentPage(1)
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể tải danh sách nhà cung cấp.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadItems()
  }, [])

  useDebouncedEffect(() => {
    void loadItems(filters)
  }, [filters.keyword], 300, true)

  const resetForm = () => {
    setSelectedId(null)
    setForm({ name: '', address: '', phoneNumber: '' })
    setInitialForm({ name: '', address: '', phoneNumber: '' })
    setFormErrors({})
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
    const nextForm = {
      name: item.name || '',
      address: item.address || '',
      phoneNumber: item.phoneNumber || '',
    }
    setSelectedId(item.id)
    setForm(nextForm)
    setInitialForm(nextForm)
    setShowFormModal(true)
  }

  const handleCreate = async () => {
    const nextErrors = validateSupplierForm(form)
    setFormErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      toast.error(Object.values(nextErrors)[0])
      return
    }
    setSubmitting(true)
    try {
      await axiosClient.post('/api/suppliers', {
        name: form.name.trim(),
        address: form.address.trim(),
        phoneNumber: form.phoneNumber.trim(),
      })
      toast.success('Thêm nhà cung cấp thành công.')
      closeFormModal()
      await loadItems()
    } catch (error) {
      const message = error?.response?.data?.message || 'Thêm nhà cung cấp thất bại.'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdate = async () => {
    if (!selectedId) return
    if (!hasFormChanges) {
      toast.info('Nhà cung cấp chưa có thay đổi để lưu.')
      return
    }
    const nextErrors = validateSupplierForm(form)
    setFormErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      toast.error(Object.values(nextErrors)[0])
      return
    }
    setSubmitting(true)
    try {
      await axiosClient.put(`/api/suppliers/${selectedId}`, normalizedForm)
      toast.success('Cập nhật nhà cung cấp thành công.')
      closeFormModal()
      await loadItems()
    } catch (error) {
      const message = error?.response?.data?.message || 'Cập nhật nhà cung cấp thất bại.'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id = selectedId) => {
    if (!id) return
    setConfirmDialog({
      open: true,
      title: 'Xóa nhà cung cấp',
      message: 'Bạn có chắc muốn xóa nhà cung cấp này?',
      confirmLabel: 'Xóa',
      cancelLabel: 'Hủy',
      tone: 'danger',
      busy: false,
      onConfirm: async () => {
        setSubmitting(true)
        try {
          await axiosClient.delete(`/api/suppliers/${id}`)
          toast.success('Xóa nhà cung cấp thành công.')
          if (id === selectedId) {
            closeFormModal()
          }
          await loadItems()
          return true
        } catch (error) {
          const message = error?.response?.data?.message || 'Xóa nhà cung cấp thất bại.'
          toast.error(message)
          return false
        } finally {
          setSubmitting(false)
        }
      },
    })
  }

  const closeConfirmDialog = () => {
    setConfirmDialog((previous) => (previous.busy ? previous : createDefaultConfirmDialog()))
  }

  const handleConfirmDialogAccept = async () => {
    if (!confirmDialog.onConfirm || confirmDialog.busy) return
    setConfirmDialog((previous) => ({ ...previous, busy: true }))
    const shouldClose = await confirmDialog.onConfirm()
    if (shouldClose === false) {
      setConfirmDialog((previous) => ({ ...previous, busy: false }))
      return
    }
    setConfirmDialog(createDefaultConfirmDialog())
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
            <h2 className="text-lg font-semibold text-slate-800">Quản lý nhà cung cấp</h2>
            <p className="text-sm text-slate-500">Khai báo danh sách nhà cung cấp để gán cho thiết bị khi nhập mới.</p>
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
            placeholder="Tìm theo tên nhà cung cấp"
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
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-slate-800">Danh sách nhà cung cấp</h3>
          <div className="flex items-center gap-3">
            <p className="text-sm text-slate-500">Tổng: {items.length}</p>
            <ColumnVisibilityDropdown
              columns={supplierColumnOptions}
              visibleColumns={visibleColumns}
              selectedCount={selectedCount}
              allSelected={allSelected}
              onToggleColumn={(columnKey) => {
                if (visibleColumns[columnKey] && selectedCount === 1) {
                  toast.info('Cần giữ lại ít nhất 1 cột hiển thị.')
                  return
                }
                toggleColumn(columnKey)
              }}
              onSelectAll={selectAllColumns}
              onResetDefault={resetDefaultColumns}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-max divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {renderedColumns.map((column) => (
                  <th key={column.key} className={column.headClassName}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading &&
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={`supplier-skeleton-${index}`} className="animate-pulse">
                    <td className="px-3 py-2"><div className="h-4 w-12 rounded bg-slate-200" /></td>
                    <td className="px-3 py-2"><div className="h-4 w-56 rounded bg-slate-200" /></td>
                    <td className="px-3 py-2"><div className="h-4 w-28 rounded bg-slate-200" /></td>
                    <td className="px-3 py-2"><div className="h-4 w-44 rounded bg-slate-200" /></td>
                    <td className="px-3 py-2"><div className="h-4 w-16 rounded bg-slate-200" /></td>
                    <td className="px-3 py-2"><div className="ml-auto h-4 w-24 rounded bg-slate-200" /></td>
                  </tr>
                ))}
              {!loading &&
                paginatedItems.map((item) => (
                  <tr key={item.id}>
                    {renderedColumns.map((column) => (
                      <td key={`${item.id}-${column.key}`} className={column.cellClassName}>
                        {column.render(item)}
                      </td>
                    ))}
                  </tr>
                ))}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={Math.max(renderedColumns.length, 1)} className="px-3 py-6 text-center text-sm text-slate-500">
                    Chưa có nhà cung cấp phù hợp.
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
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center sm:p-6">
          <div className="flex max-h-[92vh] w-full max-w-xl flex-col rounded-xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex shrink-0 items-center justify-between">
              <h4 className="text-base font-semibold text-slate-800">
                {isEditing ? `Chỉnh sửa nhà cung cấp #${selectedId}` : 'Thêm mới nhà cung cấp'}
              </h4>
              <button
                type="button"
                onClick={closeFormModal}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Đóng
              </button>
            </div>

            <div className="grid flex-1 gap-3 overflow-y-auto pr-1">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Tên nhà cung cấp</label>
                <input
                  value={form.name}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                    setFormErrors((prev) => ({ ...prev, name: '' }))
                  }}
                  placeholder="Ví dụ: Công ty thiết bị giáo dục ABC"
                  className={getFieldClass(Boolean(formErrors.name))}
                />
                {formErrors.name && <p className="mt-1 text-xs text-red-600">{formErrors.name}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Số điện thoại</label>
                <input
                  value={form.phoneNumber}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, phoneNumber: e.target.value }))
                    setFormErrors((prev) => ({ ...prev, phoneNumber: '' }))
                  }}
                  placeholder="Ví dụ: 0901234567"
                  className={getFieldClass(Boolean(formErrors.phoneNumber))}
                />
                {formErrors.phoneNumber && <p className="mt-1 text-xs text-red-600">{formErrors.phoneNumber}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Địa chỉ</label>
                <textarea
                  value={form.address}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, address: e.target.value }))
                    setFormErrors((prev) => ({ ...prev, address: '' }))
                  }}
                  placeholder="Nhập địa chỉ nhà cung cấp"
                  rows={3}
                  className={getFieldClass(Boolean(formErrors.address))}
                />
                {formErrors.address && <p className="mt-1 text-xs text-red-600">{formErrors.address}</p>}
              </div>
              {isEditing && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                  Thiết bị đang dùng nhà cung cấp này: {items.find((item) => item.id === selectedId)?.assetCount || 0}
                </div>
              )}
            </div>

            <div className="mt-4 flex shrink-0 gap-2">
              <button
                type="button"
                onClick={isEditing ? handleUpdate : handleCreate}
                disabled={submitting || (isEditing && !hasFormChanges)}
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

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        cancelLabel={confirmDialog.cancelLabel}
        tone={confirmDialog.tone}
        busy={confirmDialog.busy}
        onConfirm={handleConfirmDialogAccept}
        onClose={closeConfirmDialog}
      />
    </div>
  )
}

export default SupplierManagement
