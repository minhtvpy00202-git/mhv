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

const PAGE_SIZE = 10
const techSupportTypeColumnOptions = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Tên loại kỹ thuật viên' },
  { key: 'categoryCount', label: 'Loại thiết bị đang dùng' },
  { key: 'techSupportUserCount', label: 'Tài khoản kỹ thuật viên' },
  { key: 'actions', label: 'Thao tác' },
]
const defaultTechSupportTypeVisibleColumnKeys = ['id', 'name', 'categoryCount', 'techSupportUserCount', 'actions']

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

function normalizeTechSupportTypeForm(form) {
  return {
    name: String(form?.name || '').trim(),
  }
}

function TechSupportTypeManagement() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showFormModal, setShowFormModal] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [confirmDialog, setConfirmDialog] = useState(createDefaultConfirmDialog)
  const [currentPage, setCurrentPage] = useState(1)
  const [filters, setFilters] = useState({
    keyword: '',
  })
  const [form, setForm] = useState({
    name: '',
  })
  const [initialForm, setInitialForm] = useState({
    name: '',
  })
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
    storageKey: 'mhv-admin-tech-support-types-visible-columns',
    columns: techSupportTypeColumnOptions,
    defaultVisibleKeys: defaultTechSupportTypeVisibleColumnKeys,
  })

  const isEditing = Boolean(selectedId)
  const normalizedForm = useMemo(() => normalizeTechSupportTypeForm(form), [form])
  const normalizedInitialForm = useMemo(() => normalizeTechSupportTypeForm(initialForm), [initialForm])
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
          {getSortLabel('name', 'Tên loại kỹ thuật viên')}
        </button>
      ),
      headClassName: 'whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600',
      cellClassName: 'px-3 py-2',
      render: (item) => item.name,
    },
    {
      key: 'categoryCount',
      label: (
        <button type="button" onClick={() => handleSort('categoryCount')} className="whitespace-nowrap hover:text-fptOrange">
          {getSortLabel('categoryCount', 'Loại thiết bị đang dùng')}
        </button>
      ),
      headClassName: 'whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600',
      cellClassName: 'px-3 py-2',
      render: (item) => item.categoryCount,
    },
    {
      key: 'techSupportUserCount',
      label: (
        <button type="button" onClick={() => handleSort('techSupportUserCount')} className="whitespace-nowrap hover:text-fptOrange">
          {getSortLabel('techSupportUserCount', 'Tài khoản kỹ thuật viên')}
        </button>
      ),
      headClassName: 'whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600',
      cellClassName: 'px-3 py-2',
      render: (item) => item.techSupportUserCount,
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

  useDebouncedEffect(() => {
    void loadItems(filters)
  }, [filters.keyword], 300, true)

  const resetForm = () => {
    setSelectedId(null)
    const emptyForm = { name: '' }
    setForm(emptyForm)
    setInitialForm(emptyForm)
  }

  const closeFormModal = () => {
    setShowFormModal(false)
    resetForm()
  }

  const discardFormModal = () => {
    setConfirmDialog(createDefaultConfirmDialog())
    closeFormModal()
  }

  const requestCloseFormModal = () => {
    if (submitting) return
    if (!hasFormChanges) {
      closeFormModal()
      return
    }
    setConfirmDialog({
      open: true,
      title: 'Lưu thay đổi trước khi đóng?',
      message: 'Bạn có thay đổi chưa lưu trong biểu mẫu loại kỹ thuật viên. Bạn có muốn lưu trước khi đóng không?',
      confirmLabel: 'Có',
      cancelLabel: 'Không',
      tone: 'primary',
      busy: false,
      onConfirm: async () => (isEditing ? handleUpdate() : handleCreate()),
      onCancel: () => {
        discardFormModal()
      },
    })
  }

  const openCreateModal = () => {
    resetForm()
    setShowFormModal(true)
  }

  const handleSelect = (item) => {
    setSelectedId(item.id)
    const nextForm = { name: item.name || '' }
    setForm(nextForm)
    setInitialForm(nextForm)
    setShowFormModal(true)
  }

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error('Vui lòng nhập tên loại kỹ thuật viên.')
      return false
    }
    setSubmitting(true)
    try {
      await axiosClient.post('/api/tech-support-types', { name: form.name.trim() })
      toast.success('Thêm loại kỹ thuật viên thành công.')
      closeFormModal()
      await loadItems()
      return true
    } catch (error) {
      const message = error?.response?.data?.message || 'Thêm loại kỹ thuật viên thất bại.'
      toast.error(message)
      return false
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdate = async () => {
    if (!selectedId) return
    if (!hasFormChanges) {
      toast.info('Loại kỹ thuật viên chưa có thay đổi để lưu.')
      return false
    }
    if (!form.name.trim()) {
      toast.error('Vui lòng nhập tên loại kỹ thuật viên.')
      return false
    }
    setSubmitting(true)
    try {
      await axiosClient.put(`/api/tech-support-types/${selectedId}`, { name: form.name.trim() })
      toast.success('Cập nhật loại kỹ thuật viên thành công.')
      closeFormModal()
      await loadItems()
      return true
    } catch (error) {
      const message = error?.response?.data?.message || 'Cập nhật loại kỹ thuật viên thất bại.'
      toast.error(message)
      return false
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id = selectedId) => {
    if (!id) return
    setConfirmDialog({
      open: true,
      title: 'Xóa loại kỹ thuật viên',
      message: 'Bạn có chắc muốn xóa loại kỹ thuật viên này?',
      confirmLabel: 'Xóa',
      cancelLabel: 'Hủy',
      tone: 'danger',
      busy: false,
      onConfirm: async () => {
        setSubmitting(true)
        try {
          await axiosClient.delete(`/api/tech-support-types/${id}`)
          toast.success('Xóa loại kỹ thuật viên thành công.')
          if (id === selectedId) {
            closeFormModal()
          }
          await loadItems()
          return true
        } catch (error) {
          const message = error?.response?.data?.message || 'Xóa loại kỹ thuật viên thất bại.'
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
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-slate-800">Danh sách loại kỹ thuật viên</h3>
          <div className="flex items-center gap-3">
            <p className="text-sm text-slate-500">Tổng: {items.length}</p>
            <ColumnVisibilityDropdown
              columns={techSupportTypeColumnOptions}
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
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center sm:p-6">
          <div className="flex max-h-[92vh] w-full max-w-xl flex-col rounded-xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex shrink-0 items-center justify-between">
              <h4 className="text-base font-semibold text-slate-800">
                {isEditing ? `Chỉnh sửa loại kỹ thuật viên #${selectedId}` : 'Thêm mới loại kỹ thuật viên'}
              </h4>
              <button
                type="button"
                onClick={requestCloseFormModal}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Đóng
              </button>
            </div>

            <div className="grid flex-1 gap-3 overflow-y-auto pr-1">
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

export default TechSupportTypeManagement
