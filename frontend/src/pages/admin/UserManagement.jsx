import { IconTool as Wrench } from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import axiosClient from '../../api/axiosClient'
import { fetchTechSupportTypeOptions } from '../../api/techSupportTypeApi'
import ActionIconButton from '../../components/ui/ActionIconButton'
import ColumnVisibilityDropdown from '../../components/ui/ColumnVisibilityDropdown'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import useColumnVisibility from '../../hooks/useColumnVisibility'
import useDebouncedEffect from '../../hooks/useDebouncedEffect'
import { useTableSort } from '../../hooks/useTableSort'
import { formatVietnamDate } from '../../utils/datetime'

const roleOptions = ['Admin', 'NhanVien', 'ConsumableManager', 'TechSupport']

function toRoleLabel(role) {
  if (role === 'Admin') return 'Quản trị viên'
  if (role === 'NhanVien') return 'Nhân viên'
  if (role === 'ConsumableManager') return 'Nhân viên quản lý cấp phát vật tư'
  if (role === 'TechSupport') return 'Kỹ thuật viên'
  return role || '-'
}

function getUserSortValue(user, key) {
  if (key === 'roleLabel') return toRoleLabel(user.role)
  if (key === 'techTypeDisplay') {
    return user.role === 'TechSupport' ? (user.techTypeNames?.join(', ') || 'Kỹ thuật viên') : '-'
  }
  return user?.[key]
}

const statusOptions = ['Hoạt động', 'Khóa']
const PAGE_SIZE = 10
const userColumnOptions = [
  { key: 'username', label: 'Username' },
  { key: 'fullName', label: 'Họ tên' },
  { key: 'email', label: 'Email' },
  { key: 'birthday', label: 'Ngày sinh' },
  { key: 'phone', label: 'Số điện thoại' },
  { key: 'role', label: 'Vai trò' },
  { key: 'techTypeDisplay', label: 'Chuyên môn kỹ thuật' },
  { key: 'status', label: 'Trạng thái' },
  { key: 'actions', label: 'Thao tác' },
]
const defaultUserVisibleColumnKeys = ['username', 'fullName', 'email', 'phone', 'role', 'status', 'actions']

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

function UserManagement() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [showFormModal, setShowFormModal] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState(createDefaultConfirmDialog)
  const [techRoleOptions, setTechRoleOptions] = useState([])
  const [pageInfo, setPageInfo] = useState({
    page: 0,
    size: PAGE_SIZE,
    totalPages: 1,
    totalItems: 0,
  })
  const [filters, setFilters] = useState({
    keyword: '',
    role: '',
    status: '',
  })
  const [form, setForm] = useState({
    username: '',
    password: '',
    fullName: '',
    email: '',
    birthday: '',
    phone: '',
    role: 'NhanVien',
    techTypeIds: [],
    status: 'Hoạt động',
  })
  const { sortedItems: sortedRows, handleSort, getSortLabel } = useTableSort(rows, {
    initialKey: 'username',
    initialDirection: 'asc',
    getSortValue: getUserSortValue,
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
    storageKey: 'mhv-admin-users-visible-columns',
    columns: userColumnOptions,
    defaultVisibleKeys: defaultUserVisibleColumnKeys,
  })

  const isEditing = useMemo(() => Boolean(selectedUserId), [selectedUserId])
  const isTechSupportRole = form.role === 'TechSupport'

  const loadUsers = async (page = 0, nextFilters = filters) => {
    setLoading(true)
    try {
      const params = {
        page,
        size: PAGE_SIZE,
      }
      if (nextFilters.keyword.trim()) params.keyword = nextFilters.keyword.trim()
      if (nextFilters.role) params.role = nextFilters.role
      if (nextFilters.status) params.status = nextFilters.status
      const response = await axiosClient.get('/api/users', { params })
      const data = response.data || {}
      setRows(data.items || [])
      setPageInfo({
        page: data.page ?? 0,
        size: data.size ?? PAGE_SIZE,
        totalPages: data.totalPages || 1,
        totalItems: data.totalItems || 0,
      })
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể tải danh sách tài khoản.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const loadTechSupportTypes = async () => {
    try {
      const options = await fetchTechSupportTypeOptions()
      setTechRoleOptions(options)
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể tải danh sách loại kỹ thuật viên.'
      toast.error(message)
    }
  }

  useEffect(() => {
    const bootstrapTimer = window.setTimeout(() => {
      void loadUsers(0)
      void loadTechSupportTypes()
    }, 0)
    return () => window.clearTimeout(bootstrapTimer)
  }, [])

  useDebouncedEffect(() => {
    void loadUsers(0, filters)
  }, [filters.keyword, filters.role, filters.status], 300, true)

  const resetForm = () => {
    setSelectedUserId(null)
    setForm({
      username: '',
      password: '',
      fullName: '',
      email: '',
      birthday: '',
      phone: '',
      role: 'NhanVien',
      techTypeIds: [],
      status: 'Hoạt động',
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

  const handleSelect = (item) => {
    setSelectedUserId(item.id)
    setForm({
      username: item.username || '',
      password: '',
      fullName: item.fullName || '',
      email: item.email || '',
      birthday: item.birthday || '',
      phone: item.phone || '',
      role: item.role || 'NhanVien',
      techTypeIds: item.techTypeIds || [],
      status: item.status || 'Hoạt động',
    })
    setShowFormModal(true)
  }

  const handleCreate = async () => {
    if (!form.username || !form.password || !form.fullName || !form.birthday || !form.phone || !form.role || !form.status) {
      toast.error('Vui lòng nhập đầy đủ tất cả các trường.')
      return
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast.error('Email không đúng định dạng.')
      return
    }
    if (!/^0\d{9}$/.test(form.phone.trim())) {
      toast.error('Số điện thoại phải gồm đúng 10 số và bắt đầu bằng 0.')
      return
    }
    if (new Date(form.birthday) >= new Date()) {
      toast.error('Ngày sinh phải là ngày trong quá khứ.')
      return
    }
    if (isTechSupportRole && form.techTypeIds.length === 0) {
      toast.error('Vui lòng chọn ít nhất một chuyên môn cho tài khoản kỹ thuật viên.')
      return
    }
    setSubmitting(true)
    try {
      await axiosClient.post('/api/users', {
        username: form.username.trim(),
        password: form.password,
        fullName: form.fullName.trim(),
        email: form.email.trim() || null,
        birthday: form.birthday,
        phone: form.phone.trim(),
        role: form.role,
        techTypeIds: isTechSupportRole ? form.techTypeIds.map(Number) : [],
        status: form.status,
      })
      toast.success('Thêm tài khoản thành công.')
      closeFormModal()
      await loadUsers(pageInfo.page)
    } catch (error) {
      const message = error?.response?.data?.message || 'Thêm tài khoản thất bại.'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdate = async () => {
    if (!selectedUserId) return
    if (!form.username || !form.fullName) {
      toast.error('Vui lòng nhập đầy đủ thông tin bắt buộc.')
      return
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast.error('Email không đúng định dạng.')
      return
    }
    if (form.phone && !/^0\d{9}$/.test(form.phone.trim())) {
      toast.error('Số điện thoại phải gồm đúng 10 số và bắt đầu bằng 0.')
      return
    }
    if (form.birthday && new Date(form.birthday) >= new Date()) {
      toast.error('Ngày sinh phải là ngày trong quá khứ.')
      return
    }
    if (isTechSupportRole && form.techTypeIds.length === 0) {
      toast.error('Vui lòng chọn ít nhất một chuyên môn cho tài khoản kỹ thuật viên.')
      return
    }
    setSubmitting(true)
    try {
      await axiosClient.put(`/api/users/${selectedUserId}`, {
        username: form.username.trim(),
        password: form.password || null,
        fullName: form.fullName.trim(),
        email: form.email.trim() || null,
        birthday: form.birthday || null,
        phone: form.phone.trim() || null,
        role: form.role,
        techTypeIds: isTechSupportRole ? form.techTypeIds.map(Number) : [],
        status: form.status,
      })
      toast.success('Cập nhật tài khoản thành công.')
      closeFormModal()
      await loadUsers(pageInfo.page)
    } catch (error) {
      const message = error?.response?.data?.message || 'Cập nhật tài khoản thất bại.'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id = selectedUserId) => {
    if (!id) return
    setConfirmDialog({
      open: true,
      title: 'Xóa tài khoản',
      message: 'Bạn có chắc muốn xóa tài khoản này?',
      confirmLabel: 'Xóa',
      cancelLabel: 'Hủy',
      tone: 'danger',
      busy: false,
      onConfirm: async () => {
        setSubmitting(true)
        try {
          await axiosClient.delete(`/api/users/${id}`)
          toast.success('Xóa tài khoản thành công.')
          if (id === selectedUserId) {
            closeFormModal()
          }
          await loadUsers(pageInfo.page)
          return true
        } catch (error) {
          const message = error?.response?.data?.message || 'Xóa tài khoản thất bại.'
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

  const currentPage = pageInfo.page + 1
  const tableColumns = useMemo(() => ([
    {
      key: 'username',
      label: (
        <button type="button" onClick={() => handleSort('username')} className="whitespace-nowrap hover:text-fptOrange">
          {getSortLabel('username', 'Username')}
        </button>
      ),
      headClassName: 'whitespace-nowrap px-3 py-2 text-left',
      cellClassName: 'px-3 py-2 font-medium',
      render: (row) => row.username,
    },
    {
      key: 'fullName',
      label: (
        <button type="button" onClick={() => handleSort('fullName')} className="whitespace-nowrap hover:text-fptOrange">
          {getSortLabel('fullName', 'Họ tên')}
        </button>
      ),
      headClassName: 'whitespace-nowrap px-3 py-2 text-left',
      cellClassName: 'px-3 py-2',
      render: (row) => row.fullName || '-',
    },
    {
      key: 'email',
      label: (
        <button type="button" onClick={() => handleSort('email')} className="whitespace-nowrap hover:text-fptOrange">
          {getSortLabel('email', 'Email')}
        </button>
      ),
      headClassName: 'whitespace-nowrap px-3 py-2 text-left',
      cellClassName: 'px-3 py-2',
      render: (row) => row.email || '-',
    },
    {
      key: 'birthday',
      label: (
        <button type="button" onClick={() => handleSort('birthday')} className="whitespace-nowrap hover:text-fptOrange">
          {getSortLabel('birthday', 'Ngày sinh')}
        </button>
      ),
      headClassName: 'whitespace-nowrap px-3 py-2 text-left',
      cellClassName: 'px-3 py-2',
      render: (row) => formatVietnamDate(row.birthday),
    },
    {
      key: 'phone',
      label: (
        <button type="button" onClick={() => handleSort('phone')} className="whitespace-nowrap hover:text-fptOrange">
          {getSortLabel('phone', 'Số điện thoại')}
        </button>
      ),
      headClassName: 'whitespace-nowrap px-3 py-2 text-left',
      cellClassName: 'px-3 py-2',
      render: (row) => row.phone || '-',
    },
    {
      key: 'role',
      label: (
        <button type="button" onClick={() => handleSort('roleLabel')} className="whitespace-nowrap hover:text-fptOrange">
          {getSortLabel('roleLabel', 'Vai trò')}
        </button>
      ),
      headClassName: 'whitespace-nowrap px-3 py-2 text-left',
      cellClassName: 'px-3 py-2',
      render: (row) => toRoleLabel(row.role),
    },
    {
      key: 'techTypeDisplay',
      label: (
        <button type="button" onClick={() => handleSort('techTypeDisplay')} className="whitespace-nowrap hover:text-fptOrange">
          {getSortLabel('techTypeDisplay', 'Chuyên môn kỹ thuật')}
        </button>
      ),
      headClassName: 'whitespace-nowrap px-3 py-2 text-left',
      cellClassName: 'px-3 py-2',
      render: (row) => (
        row.role === 'TechSupport'
          ? (row.techTypeNames?.join(', ') || 'Kỹ thuật viên')
          : '-'
      ),
    },
    {
      key: 'status',
      label: (
        <button type="button" onClick={() => handleSort('status')} className="whitespace-nowrap hover:text-fptOrange">
          {getSortLabel('status', 'Trạng thái')}
        </button>
      ),
      headClassName: 'whitespace-nowrap px-3 py-2 text-left',
      cellClassName: 'px-3 py-2',
      render: (row) => row.status,
    },
    {
      key: 'actions',
      label: 'Thao tác',
      headClassName: 'whitespace-nowrap px-3 py-2 text-left',
      cellClassName: 'px-3 py-2',
      render: (row) => (
        <ActionIconButton
          icon={Wrench}
          label="Chọn để chỉnh sửa tài khoản"
          variant="primary"
          onClick={() => handleSelect(row)}
        />
      ),
    },
  ]), [getSortLabel, handleSort])
  const renderedColumns = useMemo(
    () => tableColumns.filter((column) => activeColumns.some((activeColumn) => activeColumn.key === column.key)),
    [activeColumns, tableColumns],
  )

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-800">Quản lý tài khoản</h2>
          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-lg bg-fptOrange px-3 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark"
          >
            Thêm mới
          </button>
        </div>

        <div className="mb-3 grid gap-2 md:grid-cols-5">
          <input
            value={filters.keyword}
            onChange={(e) => setFilters((prev) => ({ ...prev, keyword: e.target.value }))}
            placeholder="Tìm username / họ tên / email"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
          />
          <select
            value={filters.role}
            onChange={(e) => setFilters((prev) => ({ ...prev, role: e.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
          >
            <option value="">Tất cả vai trò</option>
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {toRoleLabel(role)}
              </option>
            ))}
          </select>
          <select
            value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
          >
            <option value="">Tất cả trạng thái</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => loadUsers(0)}
              className="rounded-lg bg-fptOrange px-3 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark"
            >
              Lọc
            </button>
            <button
              type="button"
              onClick={async () => {
                const reset = { keyword: '', role: '', status: '' }
                setFilters(reset)
                await loadUsers(0, reset)
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Đặt lại
            </button>
          </div>
          <ColumnVisibilityDropdown
            columns={userColumnOptions}
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

        <div className="overflow-auto rounded-lg border border-slate-200">
          <table className="min-w-max text-sm">
            <thead className="bg-slate-50">
              <tr>
                {renderedColumns.map((column) => (
                  <th key={column.key} className={column.headClassName}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading &&
                sortedRows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    {renderedColumns.map((column) => (
                      <td key={`${row.id}-${column.key}`} className={column.cellClassName}>
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={Math.max(renderedColumns.length, 1)} className="px-3 py-4 text-center text-slate-500">
                    Không có dữ liệu tài khoản.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {loading && <p className="px-3 py-3 text-sm text-slate-500">Đang tải dữ liệu...</p>}
        </div>

        <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
          <p>
            Trang {currentPage} / {Math.max(1, pageInfo.totalPages)} • Tổng {pageInfo.totalItems} tài khoản
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={currentPage <= 1 || loading}
              onClick={() => loadUsers(0)}
              className="rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-50 disabled:opacity-50"
            >
              Đầu
            </button>
            <button
              type="button"
              disabled={currentPage <= 1 || loading}
              onClick={() => loadUsers(Math.max(0, pageInfo.page - 1))}
              className="rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-50 disabled:opacity-50"
            >
              Trước
            </button>
            <button
              type="button"
              disabled={currentPage >= pageInfo.totalPages || loading}
              onClick={() => loadUsers(Math.min(pageInfo.totalPages - 1, pageInfo.page + 1))}
              className="rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-50 disabled:opacity-50"
            >
              Sau
            </button>
            <button
              type="button"
              disabled={currentPage >= pageInfo.totalPages || loading}
              onClick={() => loadUsers(Math.max(0, pageInfo.totalPages - 1))}
              className="rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-50 disabled:opacity-50"
            >
              Cuối
            </button>
          </div>
        </div>
      </div>

      {showFormModal && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 p-4 md:items-center">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-4 shadow-xl md:p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800">{isEditing ? 'Chỉnh sửa tài khoản' : 'Thêm tài khoản mới'}</h3>
              <button
                type="button"
                onClick={closeFormModal}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Đóng
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Username *</label>
                <input
                  value={form.username}
                  onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                  disabled={isEditing}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                  placeholder={isEditing ? 'Username không được phép thay đổi' : 'Nhập username'}
                />
                {isEditing && <p className="mt-1 text-xs text-slate-500">Username đã bị khóa ở chế độ chỉnh sửa.</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  {isEditing ? 'Mật khẩu mới (để trống nếu giữ nguyên)' : 'Mật khẩu *'}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
                  placeholder="Nhập mật khẩu"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Họ và tên *</label>
                <input
                  value={form.fullName}
                  onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
                  placeholder="Nhập họ và tên"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
                  placeholder="Nhập email"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Ngày sinh *</label>
                <input
                  type="date"
                  value={form.birthday || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, birthday: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Số điện thoại *</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
                  placeholder="Nhập số điện thoại"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Vai trò</label>
                <select
                  value={form.role}
                  onChange={(e) => {
                    const value = e.target.value
                    if (value === 'TechSupport') {
                      setForm((prev) => ({ ...prev, role: 'TechSupport', techTypeIds: prev.techTypeIds || [] }))
                    } else {
                      setForm((prev) => ({ ...prev, role: value, techTypeIds: [] }))
                    }
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {toRoleLabel(role)}
                    </option>
                  ))}
                </select>
              </div>
              {isTechSupportRole && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Chuyên môn kỹ thuật *</label>
                  <div className="space-y-2 rounded-lg border border-slate-300 px-3 py-2">
                    {techRoleOptions.map((item) => {
                      const checked = form.techTypeIds.includes(item.techTypeId)
                      return (
                        <label key={item.techTypeId} className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setForm((prev) => ({
                                ...prev,
                                techTypeIds: e.target.checked
                                  ? [...prev.techTypeIds, item.techTypeId]
                                  : prev.techTypeIds.filter((id) => id !== item.techTypeId),
                              }))
                            }}
                            className="h-4 w-4 rounded border-slate-300 text-fptOrange focus:ring-fptOrange"
                          />
                          <span>{item.label}</span>
                        </label>
                      )
                    })}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Có thể chọn nhiều chuyên môn cho một kỹ thuật viên.</p>
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Trạng thái</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-4">
              <button
                type="button"
                onClick={handleCreate}
                disabled={submitting || isEditing}
                className="rounded-lg bg-fptOrange px-3 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark disabled:opacity-60"
              >
                Thêm mới
              </button>
              <button
                type="button"
                onClick={handleUpdate}
                disabled={submitting || !isEditing}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                Cập nhật
              </button>
              <button
                type="button"
                onClick={() => handleDelete(selectedUserId)}
                disabled={submitting || !isEditing}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                Xóa
              </button>
              <button
                type="button"
                onClick={closeFormModal}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Hủy
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

export default UserManagement
