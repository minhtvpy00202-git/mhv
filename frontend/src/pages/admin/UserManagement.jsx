import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import axiosClient from '../../api/axiosClient'

const roleOptions = ['Admin', 'NhanVien', 'TechSupport']
const statusOptions = ['Hoạt động', 'Khóa']
const PAGE_SIZE = 10

function UserManagement() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [showFormModal, setShowFormModal] = useState(false)
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
    birthday: '',
    phone: '',
    role: 'NhanVien',
    status: 'Hoạt động',
  })

  const isEditing = useMemo(() => Boolean(selectedUserId), [selectedUserId])

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

  useEffect(() => {
    loadUsers(0)
  }, [])

  const resetForm = () => {
    setSelectedUserId(null)
    setForm({
      username: '',
      password: '',
      fullName: '',
      birthday: '',
      phone: '',
      role: 'NhanVien',
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
      birthday: item.birthday || '',
      phone: item.phone || '',
      role: item.role || 'NhanVien',
      status: item.status || 'Hoạt động',
    })
    setShowFormModal(true)
  }

  const handleCreate = async () => {
    if (!form.username || !form.password || !form.fullName || !form.birthday || !form.phone || !form.role || !form.status) {
      toast.error('Vui lòng nhập đầy đủ tất cả các trường.')
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
    setSubmitting(true)
    try {
      await axiosClient.post('/api/users', {
        username: form.username.trim(),
        password: form.password,
        fullName: form.fullName.trim(),
        birthday: form.birthday,
        phone: form.phone.trim(),
        role: form.role,
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
    setSubmitting(true)
    try {
      await axiosClient.put(`/api/users/${selectedUserId}`, {
        username: form.username.trim(),
        password: form.password || null,
        fullName: form.fullName.trim(),
        birthday: form.birthday || null,
        phone: form.phone.trim() || null,
        role: form.role,
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
    const confirmed = window.confirm('Bạn có chắc muốn xóa tài khoản này?')
    if (!confirmed) return
    setSubmitting(true)
    try {
      await axiosClient.delete(`/api/users/${id}`)
      toast.success('Xóa tài khoản thành công.')
      if (id === selectedUserId) {
        closeFormModal()
      }
      await loadUsers(pageInfo.page)
    } catch (error) {
      const message = error?.response?.data?.message || 'Xóa tài khoản thất bại.'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const currentPage = pageInfo.page + 1

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

        <div className="mb-3 grid gap-2 md:grid-cols-4">
          <input
            value={filters.keyword}
            onChange={(e) => setFilters((prev) => ({ ...prev, keyword: e.target.value }))}
            placeholder="Tìm username / họ tên"
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
                {role}
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
        </div>

        <div className="overflow-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left">Username</th>
                <th className="px-3 py-2 text-left">Họ tên</th>
                <th className="px-3 py-2 text-left">Ngày sinh</th>
                <th className="px-3 py-2 text-left">Số điện thoại</th>
                <th className="px-3 py-2 text-left">Vai trò</th>
                <th className="px-3 py-2 text-left">Trạng thái</th>
                <th className="px-3 py-2 text-left">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {!loading &&
                rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium">{row.username}</td>
                    <td className="px-3 py-2">{row.fullName || '-'}</td>
                    <td className="px-3 py-2">{row.birthday || '-'}</td>
                    <td className="px-3 py-2">{row.phone || '-'}</td>
                    <td className="px-3 py-2">{row.role}</td>
                    <td className="px-3 py-2">{row.status}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => handleSelect(row)}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Chọn
                      </button>
                    </td>
                  </tr>
                ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center text-slate-500">
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
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
                  placeholder="Nhập username"
                />
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
                  onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>
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
    </div>
  )
}

export default UserManagement
