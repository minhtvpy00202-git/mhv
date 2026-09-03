import { IconFileDescription as Detail, IconTool as Wrench, IconTrash as Trash2 } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import axiosClient from '../../api/axiosClient'
import { fetchTechSupportTypeOptions } from '../../api/techSupportTypeApi'
import ActionIconButton from '../../components/ui/ActionIconButton'
import ColumnVisibilityDropdown from '../../components/ui/ColumnVisibilityDropdown'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import SearchableSelect from '../../components/ui/SearchableSelect'
import useColumnVisibility from '../../hooks/useColumnVisibility'
import useDebouncedEffect from '../../hooks/useDebouncedEffect'
import { useTableSort } from '../../hooks/useTableSort'
import { normalizeSpecTemplates } from '../../utils/assetSpecs'
import { validateCategoryForm } from '../../utils/validation'

const PAGE_SIZE = 10
const CATEGORY_KIND_ITEMIZED = 'ITEMIZED'
const CATEGORY_KIND_CONSUMABLE = 'CONSUMABLE'
const categoryKindOptions = [
  { value: CATEGORY_KIND_ITEMIZED, label: 'Tài sản cố định' },
  { value: CATEGORY_KIND_CONSUMABLE, label: 'Vật tư tiêu hao (quản lý theo số lượng)' },
]

function getFieldClass(hasError) {
  return `w-full rounded-lg border px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2 ${hasError ? 'border-red-400 bg-red-50' : 'border-slate-300'}`
}

function getCategorySortValue(category, key) {
  if (key === 'specTemplateCount') return category.specTemplateCount || 0
  return category?.[key]
}

function getCategoryKindLabel(value) {
  return String(value || CATEGORY_KIND_ITEMIZED).trim().toUpperCase() === CATEGORY_KIND_CONSUMABLE
      ? 'Vật tư tiêu hao'
      : 'Tài sản cố định'
}

function isConsumableCategory(value) {
  return String(value || CATEGORY_KIND_ITEMIZED).trim().toUpperCase() === CATEGORY_KIND_CONSUMABLE
}

function normalizeCategoryKind(value) {
  const normalized = String(value || '').trim().toUpperCase()
  if (normalized === CATEGORY_KIND_CONSUMABLE) return CATEGORY_KIND_CONSUMABLE
  if (normalized === CATEGORY_KIND_ITEMIZED) return CATEGORY_KIND_ITEMIZED
  return ''
}

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
    onCancel: null,
  }
}

function normalizeCategoryForm(form) {
  const categoryKind = String(form?.categoryKind || CATEGORY_KIND_ITEMIZED).trim().toUpperCase()
  return {
    name: String(form?.name || '').trim(),
    categoryKind,
    techTypeId: categoryKind === CATEGORY_KIND_CONSUMABLE ? '' : String(form?.techTypeId || '').trim(),
    specTemplates: normalizeSpecTemplates(form?.specTemplates),
  }
}

function createEmptyCategoryForm(categoryKind = CATEGORY_KIND_ITEMIZED) {
  return {
    name: '',
    categoryKind,
    techTypeId: '',
    specTemplates: [],
  }
}

function buildCategoryPageConfig(lockedCategoryKind) {
  const normalizedLockedKind = normalizeCategoryKind(lockedCategoryKind)
  if (normalizedLockedKind === CATEGORY_KIND_CONSUMABLE) {
    return {
      modeKey: 'consumable',
      lockedCategoryKind: CATEGORY_KIND_CONSUMABLE,
      pageTitle: 'Quản lý loại vật tư',
      pageDescription: 'Khai báo danh mục loại vật tư dùng cho vật tư tiêu hao và tồn kho nhiều kho.',
      listTitle: 'Danh sách loại vật tư',
      singularLabel: 'loại vật tư',
      nameLabel: 'Tên loại vật tư',
      namePlaceholder: 'Ví dụ: Giấy A4, Mực in, Bút viết',
      searchPlaceholder: 'Tìm theo tên loại vật tư',
      createTitle: 'Thêm mới loại vật tư',
      editTitle: (id) => `Chỉnh sửa loại vật tư #${id}`,
      createSuccess: 'Thêm loại vật tư thành công.',
      createError: 'Thêm loại vật tư thất bại.',
      updateSuccess: 'Cập nhật loại vật tư thành công.',
      updateError: 'Cập nhật loại vật tư thất bại.',
      deleteTitle: 'Xóa loại vật tư',
      deleteMessage: 'Bạn có chắc muốn xóa loại vật tư này?',
      deleteSuccess: 'Xóa loại vật tư thành công.',
      deleteError: 'Xóa loại vật tư thất bại.',
      detailError: 'Không thể tải chi tiết loại vật tư.',
      loadError: 'Không thể tải danh sách loại vật tư.',
      closeConfirmMessage: 'Bạn có thay đổi chưa lưu trong biểu mẫu loại vật tư. Bạn có muốn lưu trước khi đóng không?',
      noChangesMessage: 'Loại vật tư chưa có thay đổi để lưu.',
      emptyState: 'Chưa có loại vật tư phù hợp.',
      specPreviewSubject: 'Loại vật tư',
      specTemplateColumnLabel: 'Thông số',
      specTemplateFieldLabel: 'Thông số',
      specTemplatePreviewTitle: 'Thông số',
      specTemplatePreviewButtonLabel: 'Xem thông số',
      specTemplateAddLabel: 'Thêm thông số',
      specTemplateEmptyText: 'Chưa có thông số. Bạn có thể thêm các thuộc tính như đơn vị tính, quy cách, định lượng...',
      specTemplatePlaceholder: 'Ví dụ: Quy cách',
      showCategoryKindField: false,
      showCategoryKindColumn: false,
      showTechTypeField: false,
    }
  }

  if (normalizedLockedKind === CATEGORY_KIND_ITEMIZED) {
    return {
      modeKey: 'itemized',
      lockedCategoryKind: CATEGORY_KIND_ITEMIZED,
      pageTitle: 'Quản lý loại thiết bị',
      pageDescription: 'Khai báo danh mục loại thiết bị dùng cho tài sản cố định và theo dõi kỹ thuật.',
      listTitle: 'Danh sách loại thiết bị',
      singularLabel: 'loại thiết bị',
      nameLabel: 'Tên loại thiết bị',
      namePlaceholder: 'Ví dụ: Máy chiếu',
      searchPlaceholder: 'Tìm theo tên loại thiết bị',
      createTitle: 'Thêm mới loại thiết bị',
      editTitle: (id) => `Chỉnh sửa loại thiết bị #${id}`,
      createSuccess: 'Thêm loại thiết bị thành công.',
      createError: 'Thêm loại thiết bị thất bại.',
      updateSuccess: 'Cập nhật loại thiết bị thành công.',
      updateError: 'Cập nhật loại thiết bị thất bại.',
      deleteTitle: 'Xóa loại thiết bị',
      deleteMessage: 'Bạn có chắc muốn xóa loại thiết bị này?',
      deleteSuccess: 'Xóa loại thiết bị thành công.',
      deleteError: 'Xóa loại thiết bị thất bại.',
      detailError: 'Không thể tải chi tiết loại thiết bị.',
      loadError: 'Không thể tải danh sách loại thiết bị.',
      closeConfirmMessage: 'Bạn có thay đổi chưa lưu trong biểu mẫu loại thiết bị. Bạn có muốn lưu trước khi đóng không?',
      noChangesMessage: 'Loại thiết bị chưa có thay đổi để lưu.',
      emptyState: 'Chưa có loại thiết bị phù hợp.',
      specPreviewSubject: 'Loại thiết bị',
      specTemplateColumnLabel: 'Mẫu thông số kỹ thuật',
      specTemplateFieldLabel: 'Mẫu thông số kỹ thuật',
      specTemplatePreviewTitle: 'Mẫu thông số kỹ thuật',
      specTemplatePreviewButtonLabel: 'Xem mẫu thông số',
      specTemplateAddLabel: 'Thêm mẫu',
      specTemplateEmptyText: 'Chưa có mẫu thông số. Bạn có thể thêm các thuộc tính như RAM, CPU, GPU...',
      specTemplatePlaceholder: 'Ví dụ: RAM',
      showCategoryKindField: false,
      showCategoryKindColumn: false,
      showTechTypeField: true,
    }
  }

  return {
    modeKey: 'all',
    lockedCategoryKind: '',
    pageTitle: 'Quản lý loại danh mục',
    pageDescription: 'Khai báo loại tài sản cho tài sản cố định và vật tư tiêu hao.',
    listTitle: 'Danh sách loại danh mục',
    singularLabel: 'loại danh mục',
    nameLabel: 'Tên loại danh mục',
    namePlaceholder: 'Ví dụ: Máy chiếu',
    searchPlaceholder: 'Tìm theo tên loại danh mục',
    createTitle: 'Thêm mới loại danh mục',
    editTitle: (id) => `Chỉnh sửa loại danh mục #${id}`,
    createSuccess: 'Thêm loại danh mục thành công.',
    createError: 'Thêm loại danh mục thất bại.',
    updateSuccess: 'Cập nhật loại danh mục thành công.',
    updateError: 'Cập nhật loại danh mục thất bại.',
    deleteTitle: 'Xóa loại danh mục',
    deleteMessage: 'Bạn có chắc muốn xóa loại danh mục này?',
    deleteSuccess: 'Xóa loại danh mục thành công.',
    deleteError: 'Xóa loại danh mục thất bại.',
    detailError: 'Không thể tải chi tiết loại danh mục.',
    loadError: 'Không thể tải danh sách loại danh mục.',
    closeConfirmMessage: 'Bạn có thay đổi chưa lưu trong biểu mẫu loại danh mục. Bạn có muốn lưu trước khi đóng không?',
    noChangesMessage: 'Loại danh mục chưa có thay đổi để lưu.',
    emptyState: 'Chưa có loại danh mục phù hợp.',
    specPreviewSubject: 'Loại danh mục',
    specTemplateColumnLabel: 'Mẫu thông số kỹ thuật',
    specTemplateFieldLabel: 'Mẫu thông số kỹ thuật',
    specTemplatePreviewTitle: 'Mẫu thông số kỹ thuật',
    specTemplatePreviewButtonLabel: 'Xem mẫu thông số',
    specTemplateAddLabel: 'Thêm mẫu',
    specTemplateEmptyText: 'Chưa có mẫu thông số. Bạn có thể thêm các thuộc tính kỹ thuật cần dùng cho danh mục này.',
    specTemplatePlaceholder: 'Ví dụ: Thuộc tính',
    showCategoryKindField: true,
    showCategoryKindColumn: true,
    showTechTypeField: true,
  }
}

function CategoryManagement({ lockedCategoryKind = '' }) {
  const pageConfig = useMemo(() => buildCategoryPageConfig(lockedCategoryKind), [lockedCategoryKind])
  const defaultCategoryKind = pageConfig.lockedCategoryKind || CATEGORY_KIND_ITEMIZED
  const categoryColumnOptions = useMemo(() => {
    const columns = [
      { key: 'id', label: 'ID' },
      { key: 'name', label: pageConfig.nameLabel },
    ]
    if (pageConfig.showCategoryKindColumn) {
      columns.push({ key: 'categoryKind', label: 'Cách quản lý' })
    }
    if (pageConfig.showTechTypeField) {
      columns.push({ key: 'techTypeName', label: 'Nhóm kỹ thuật phụ trách' })
    }
    columns.push(
      { key: 'specTemplateCount', label: 'Mẫu thông số kỹ thuật' },
      { key: 'actions', label: 'Thao tác' },
    )
    return columns
  }, [pageConfig.nameLabel, pageConfig.showCategoryKindColumn, pageConfig.showTechTypeField])
  const defaultCategoryVisibleColumnKeys = useMemo(
    () => categoryColumnOptions.map((column) => column.key),
    [categoryColumnOptions],
  )
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showFormModal, setShowFormModal] = useState(false)
  const [showSpecsPreviewModal, setShowSpecsPreviewModal] = useState(false)
  const [selectedCategoryForSpecs, setSelectedCategoryForSpecs] = useState(null)
  const [confirmDialog, setConfirmDialog] = useState(createDefaultConfirmDialog)
  const [selectedCategoryId, setSelectedCategoryId] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [techSupportTypeOptions, setTechSupportTypeOptions] = useState([])
  const [filters, setFilters] = useState({
    keyword: '',
    techTypeId: '',
  })
  const [form, setForm] = useState(() => createEmptyCategoryForm(defaultCategoryKind))
  const [initialForm, setInitialForm] = useState(() => createEmptyCategoryForm(defaultCategoryKind))
  const [formErrors, setFormErrors] = useState({})
  const { sortedItems: sortedCategories, handleSort, getSortLabel } = useTableSort(categories, {
    initialKey: 'id',
    initialDirection: 'asc',
    getSortValue: getCategorySortValue,
    onSortChange: () => setCurrentPage(1),
  })

  const isEditing = Boolean(selectedCategoryId)
  const normalizedForm = useMemo(() => normalizeCategoryForm(form), [form])
  const normalizedInitialForm = useMemo(() => normalizeCategoryForm(initialForm), [initialForm])
  const hasFormChanges = useMemo(
    () => JSON.stringify(normalizedForm) !== JSON.stringify(normalizedInitialForm),
    [normalizedForm, normalizedInitialForm],
  )
  const totalPages = Math.max(1, Math.ceil(sortedCategories.length / PAGE_SIZE))
  const {
    visibleColumns,
    activeColumns,
    selectedCount,
    allSelected,
    toggleColumn,
    selectAllColumns,
    resetDefaultColumns,
  } = useColumnVisibility({
    storageKey: `mhv-admin-categories-visible-columns-${pageConfig.modeKey}`,
    columns: categoryColumnOptions,
    defaultVisibleKeys: defaultCategoryVisibleColumnKeys,
  })
  const paginatedCategories = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return sortedCategories.slice(start, start + PAGE_SIZE)
  }, [sortedCategories, currentPage])

  const tableColumns = useMemo(() => {
    const columns = [
      {
        key: 'id',
        label: <button type="button" onClick={() => handleSort('id')} className="whitespace-nowrap hover:text-fptOrange">{getSortLabel('id', 'ID')}</button>,
        headClassName: 'whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600',
        cellClassName: 'px-3 py-2',
        render: (category) => category.id,
      },
      {
        key: 'name',
        label: <button type="button" onClick={() => handleSort('name')} className="whitespace-nowrap hover:text-fptOrange">{getSortLabel('name', pageConfig.nameLabel)}</button>,
        headClassName: 'whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600',
        cellClassName: 'px-3 py-2',
        render: (category) => category.name,
      },
    ]
    if (pageConfig.showCategoryKindColumn) {
      columns.push({
        key: 'categoryKind',
        label: <button type="button" onClick={() => handleSort('categoryKind')} className="whitespace-nowrap hover:text-fptOrange">{getSortLabel('categoryKind', 'Cách quản lý')}</button>,
        headClassName: 'whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600',
        cellClassName: 'px-3 py-2',
        render: (category) => getCategoryKindLabel(category.categoryKind),
      })
    }
    if (pageConfig.showTechTypeField) {
      columns.push({
        key: 'techTypeName',
        label: <button type="button" onClick={() => handleSort('techTypeName')} className="whitespace-nowrap hover:text-fptOrange">{getSortLabel('techTypeName', 'Nhóm kỹ thuật phụ trách')}</button>,
        headClassName: 'whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600',
        cellClassName: 'px-3 py-2',
        render: (category) => category.techTypeName || '-',
      })
    }
    columns.push(
      {
        key: 'specTemplateCount',
        label: <button type="button" onClick={() => handleSort('specTemplateCount')} className="whitespace-nowrap hover:text-fptOrange">{getSortLabel('specTemplateCount', pageConfig.specTemplateColumnLabel)}</button>,
        headClassName: 'whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600',
        cellClassName: 'px-3 py-2',
        render: (category) => (
          category.specTemplateCount > 0 ? (
            <div className="flex items-center gap-2">
              <ActionIconButton
                icon={Detail}
                label={pageConfig.specTemplatePreviewButtonLabel}
                variant="violet"
                className="h-7 w-7"
                onClick={() => {
                  setSelectedCategoryForSpecs(category)
                  setShowSpecsPreviewModal(true)
                }}
              />
              <span className="text-xs text-slate-500">
                ({category.specTemplateCount} thông số)
              </span>
            </div>
          ) : (
            <span className="text-xs text-slate-500">Chưa cấu hình</span>
          )
        ),
      },
      {
        key: 'actions',
        label: 'Thao tác',
        headClassName: 'whitespace-nowrap px-3 py-2 text-right font-semibold text-slate-600',
        cellClassName: 'px-3 py-2',
        render: (category) => (
          <div className="flex justify-end gap-2">
            <ActionIconButton icon={Wrench} label={`Sửa ${pageConfig.singularLabel}`} variant="primary" onClick={() => handleSelectCategory(category)} />
            <ActionIconButton icon={Trash2} label={`Xóa ${pageConfig.singularLabel}`} variant="danger" onClick={() => handleDelete(category.id)} />
          </div>
        ),
      },
    )
    return columns
  }, [getSortLabel, handleSort, pageConfig])

  const renderedColumns = useMemo(
      () => tableColumns.filter((column) => activeColumns.some((activeColumn) => activeColumn.key === column.key)),
      [activeColumns, tableColumns],
  )

  const loadCategories = useCallback(async (nextFilters = filters) => {
    setLoading(true)
    try {
      const params = {}
      if (nextFilters.keyword.trim()) params.keyword = nextFilters.keyword.trim()
      if (pageConfig.showTechTypeField && nextFilters.techTypeId) params.techTypeId = Number(nextFilters.techTypeId)
      if (pageConfig.lockedCategoryKind) params.categoryKind = pageConfig.lockedCategoryKind
      const response = await axiosClient.get('/api/categories', { params })
      setCategories(response.data || [])
      setCurrentPage(1)
    } catch (error) {
      const message = error?.response?.data?.message || pageConfig.loadError
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [filters, pageConfig.loadError, pageConfig.lockedCategoryKind, pageConfig.showTechTypeField])

  const loadTechSupportTypes = useCallback(async () => {
    try {
      const options = await fetchTechSupportTypeOptions()
      setTechSupportTypeOptions(options)
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể tải danh sách loại kỹ thuật viên.'
      toast.error(message)
    }
  }, [])

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadCategories()
      if (pageConfig.showTechTypeField) {
        void loadTechSupportTypes()
      }
    }, 0)
    return () => window.clearTimeout(timerId)
  }, [loadCategories, loadTechSupportTypes, pageConfig.showTechTypeField])

  useDebouncedEffect(() => {
    void loadCategories(filters)
  }, [filters.keyword, filters.techTypeId, pageConfig.lockedCategoryKind], 300, true)

  const resetForm = () => {
    setSelectedCategoryId(null)
    setFormErrors({})
    const emptyForm = createEmptyCategoryForm(defaultCategoryKind)
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
      message: pageConfig.closeConfirmMessage,
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

  const closeSpecsPreviewModal = () => {
    setShowSpecsPreviewModal(false)
    setSelectedCategoryForSpecs(null)
  }

  const openCreateModal = () => {
    resetForm()
    setShowFormModal(true)
  }

  const handleSelectCategory = async (category) => {
    try {
      const response = await axiosClient.get(`/api/categories/${category.id}`)
      const detail = response.data || {}
      const nextForm = {
        name: detail.name || category.name || '',
        categoryKind: pageConfig.lockedCategoryKind || detail.categoryKind || category.categoryKind || defaultCategoryKind,
        techTypeId: String(detail.techTypeId || category.techTypeId || ''),
        specTemplates: normalizeSpecTemplates(detail.specTemplates),
      }
      setSelectedCategoryId(category.id)
      setForm(nextForm)
      setInitialForm(nextForm)
      setShowFormModal(true)
    } catch (error) {
      const message = error?.response?.data?.message || pageConfig.detailError
      toast.error(message)
    }
  }

  const handleCreate = async () => {
    const nextErrors = validateCategoryForm(form, { itemLabel: pageConfig.singularLabel })
    setFormErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      toast.error(Object.values(nextErrors)[0])
      return false
    }
    setSubmitting(true)
    try {
      await axiosClient.post('/api/categories', {
        name: form.name.trim(),
        categoryKind: pageConfig.lockedCategoryKind || form.categoryKind,
        techTypeId: isConsumableCategory(form.categoryKind) ? null : Number(form.techTypeId),
        specTemplates: normalizeSpecTemplates(form.specTemplates),
      })
      toast.success(pageConfig.createSuccess)
      closeFormModal()
      await loadCategories()
      return true
    } catch (error) {
      const message = error?.response?.data?.message || pageConfig.createError
      toast.error(message)
      return false
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdate = async () => {
    if (!selectedCategoryId) return
    if (!hasFormChanges) {
      toast.info(pageConfig.noChangesMessage)
      return false
    }
    const nextErrors = validateCategoryForm(form, { itemLabel: pageConfig.singularLabel })
    setFormErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      toast.error(Object.values(nextErrors)[0])
      return false
    }
    setSubmitting(true)
    try {
      await axiosClient.put(`/api/categories/${selectedCategoryId}`, {
        name: form.name.trim(),
        categoryKind: pageConfig.lockedCategoryKind || form.categoryKind,
        techTypeId: isConsumableCategory(form.categoryKind) ? null : Number(form.techTypeId),
        specTemplates: normalizeSpecTemplates(form.specTemplates),
      })
      toast.success(pageConfig.updateSuccess)
      closeFormModal()
      await loadCategories()
      return true
    } catch (error) {
      const message = error?.response?.data?.message || pageConfig.updateError
      toast.error(message)
      return false
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id = selectedCategoryId) => {
    if (!id) return
    setConfirmDialog({
      open: true,
      title: pageConfig.deleteTitle,
      message: pageConfig.deleteMessage,
      confirmLabel: 'Xóa',
      cancelLabel: 'Hủy',
      tone: 'danger',
      busy: false,
      onConfirm: async () => {
        setSubmitting(true)
        try {
          await axiosClient.delete(`/api/categories/${id}`)
          toast.success(pageConfig.deleteSuccess)
          if (id === selectedCategoryId) {
            closeFormModal()
          }
          await loadCategories()
          return true
        } catch (error) {
          const message = error?.response?.data?.message || pageConfig.deleteError
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
              <h2 className="text-lg font-semibold text-slate-800">{pageConfig.pageTitle}</h2>
              <p className="text-sm text-slate-500">{pageConfig.pageDescription}</p>
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
                placeholder={pageConfig.searchPlaceholder}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
            />
            {pageConfig.showTechTypeField && (
              <SearchableSelect
                value={filters.techTypeId}
                onChange={(nextValue) => setFilters((prev) => ({ ...prev, techTypeId: String(nextValue || '') }))}
                options={techSupportTypeOptions}
                getOptionValue={(item) => item.techTypeId}
                getOptionLabel={(item) => item.label}
                placeholder="Gõ để tìm nhóm kỹ thuật"
                emptyOptionLabel="Tất cả nhóm kỹ thuật"
              />
            )}
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
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-slate-800">{pageConfig.listTitle}</h3>
            <div className="flex items-center gap-3">
              <p className="text-sm text-slate-500">Tổng: {categories.length}</p>
              <ColumnVisibilityDropdown
                  columns={categoryColumnOptions}
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
                      <tr key={`category-skeleton-${index}`} className="animate-pulse">
                        {renderedColumns.map((column) => (
                          <td key={`category-skeleton-${index}-${column.key}`} className="px-3 py-2">
                            <div className={`h-4 rounded bg-slate-200 ${column.key === 'actions' ? 'ml-auto w-24' : column.key === 'id' ? 'w-12' : 'w-40'}`} />
                          </td>
                        ))}
                      </tr>
                  ))}
              {!loading &&
                  paginatedCategories.map((category) => (
                      <tr key={category.id}>
                        {renderedColumns.map((column) => (
                            <td key={`${category.id}-${column.key}`} className={column.cellClassName}>
                              {column.render(category)}
                            </td>
                        ))}
                      </tr>
                  ))}
              {!loading && categories.length === 0 && (
                  <tr>
                    <td colSpan={Math.max(renderedColumns.length, 1)} className="px-3 py-6 text-center text-sm text-slate-500">
                      {pageConfig.emptyState}
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
            <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center sm:p-6">
              <div className="flex max-h-[92vh] w-full max-w-xl flex-col rounded-xl bg-white p-4 shadow-xl">
                <div className="mb-3 flex shrink-0 items-center justify-between">
                  <h4 className="text-base font-semibold text-slate-800">
                    {isEditing ? pageConfig.editTitle(selectedCategoryId) : pageConfig.createTitle}
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
                    <label className="mb-1 block text-sm font-medium text-slate-700">{pageConfig.nameLabel}</label>
                    <input
                        value={form.name}
                        onChange={(e) => {
                          setForm((prev) => ({ ...prev, name: e.target.value }))
                          setFormErrors((prev) => ({ ...prev, name: '' }))
                        }}
                        placeholder={pageConfig.namePlaceholder}
                        className={getFieldClass(Boolean(formErrors.name))}
                    />
                    {formErrors.name && <p className="mt-1 text-xs text-red-600">{formErrors.name}</p>}
                  </div>
                  {pageConfig.showCategoryKindField && (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Cách quản lý</label>
                      <select
                          value={form.categoryKind}
                          onChange={(e) => {
                            const nextCategoryKind = e.target.value
                            setForm((prev) => ({
                              ...prev,
                              categoryKind: nextCategoryKind,
                              techTypeId: nextCategoryKind === CATEGORY_KIND_CONSUMABLE ? '' : prev.techTypeId,
                            }))
                            setFormErrors((prev) => ({ ...prev, categoryKind: '', techTypeId: '' }))
                          }}
                          className={getFieldClass(Boolean(formErrors.categoryKind))}
                      >
                        {categoryKindOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                        ))}
                      </select>
                      {formErrors.categoryKind && <p className="mt-1 text-xs text-red-600">{formErrors.categoryKind}</p>}
                    </div>
                  )}
                  {pageConfig.showTechTypeField && (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Nhóm kỹ thuật phụ trách</label>
                      <SearchableSelect
                        value={form.techTypeId}
                        onChange={(nextValue) => {
                          setForm((prev) => ({ ...prev, techTypeId: String(nextValue || '') }))
                          setFormErrors((prev) => ({ ...prev, techTypeId: '' }))
                        }}
                        options={techSupportTypeOptions}
                        getOptionValue={(item) => item.techTypeId}
                        getOptionLabel={(item) => item.label}
                        placeholder="Gõ để tìm nhóm kỹ thuật"
                        emptyOptionLabel={isConsumableCategory(form.categoryKind) ? 'Không áp dụng cho vật tư tiêu hao' : 'Chọn nhóm kỹ thuật'}
                        disabled={isConsumableCategory(form.categoryKind)}
                        inputClassName={getFieldClass(Boolean(formErrors.techTypeId))}
                      />
                      {isConsumableCategory(form.categoryKind) && (
                          <p className="mt-1 text-xs text-slate-500">Category tiêu hao không cần gán nhóm kỹ thuật viên.</p>
                      )}
                      {formErrors.techTypeId && <p className="mt-1 text-xs text-red-600">{formErrors.techTypeId}</p>}
                    </div>
                  )}
                  <div className="shrink-0">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <label className="block text-sm font-medium text-slate-700">{pageConfig.specTemplateFieldLabel}</label>
                      <button
                          type="button"
                          onClick={addSpecTemplate}
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        {pageConfig.specTemplateAddLabel}
                      </button>
                    </div>
                    <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      {form.specTemplates.map((template, index) => (
                          <div key={`template-${index}`} className="grid gap-2 md:grid-cols-[1fr_auto]">
                            <input
                                value={template}
                                onChange={(e) => updateSpecTemplate(index, e.target.value)}
                                placeholder={pageConfig.specTemplatePlaceholder}
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
                          <p className="text-sm text-slate-500">{pageConfig.specTemplateEmptyText}</p>
                      )}
                    </div>
                    {formErrors.specTemplates && <p className="mt-1 text-xs text-red-600">{formErrors.specTemplates}</p>}
                  </div>
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

        {showSpecsPreviewModal && selectedCategoryForSpecs && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 animate-fade-in">
              <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl border border-slate-100">
                <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="text-base font-semibold text-slate-800">
                      {pageConfig.specTemplatePreviewTitle}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">{pageConfig.specPreviewSubject}: {selectedCategoryForSpecs.name}</p>
                  </div>
                  <button
                      type="button"
                      onClick={closeSpecsPreviewModal}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Đóng
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto py-1">
                  {selectedCategoryForSpecs.specTemplates.map((template, idx) => (
                      <span
                          key={`${selectedCategoryForSpecs.id}-${template}-${idx}`}
                          className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-sm font-medium text-slate-700 shadow-sm"
                      >
                  {template}
                </span>
                  ))}
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
            onCancel={confirmDialog.onCancel}
            onClose={closeConfirmDialog}
        />
      </div>
  )
}

export default CategoryManagement
