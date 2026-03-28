import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'

function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    birthday: '',
    phone: '',
  })
  const [loading, setLoading] = useState(false)
  const [checkingUsername, setCheckingUsername] = useState(false)

  const handleCheckUsername = async () => {
    if (!form.username.trim()) {
      toast.error('Vui lòng nhập tên đăng nhập trước khi kiểm tra.')
      return
    }
    setCheckingUsername(true)
    try {
      const response = await axiosClient.get('/api/auth/check-username', {
        params: { username: form.username.trim() },
      })
      if (response.data?.exists) {
        toast.error('Tên đăng nhập đã tồn tại, vui lòng chọn tên đăng nhập khác')
      } else {
        toast.success('Tên đăng nhập có thể sử dụng.')
      }
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể kiểm tra tên đăng nhập.'
      toast.error(message)
    } finally {
      setCheckingUsername(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!form.username || !form.password || !form.confirmPassword || !form.fullName || !form.birthday || !form.phone) {
      toast.error('Vui lòng nhập đầy đủ tất cả các trường.')
      return
    }
    if (!/^[a-zA-Z0-9_]{4,50}$/.test(form.username.trim())) {
      toast.error('Tên đăng nhập chỉ gồm chữ, số, dấu gạch dưới và dài 4-50 ký tự.')
      return
    }
    if (form.password.length < 6) {
      toast.error('Mật khẩu phải có ít nhất 6 ký tự.')
      return
    }
    if (form.password !== form.confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp.')
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
    setLoading(true)
    try {
      await axiosClient.post('/api/auth/register', {
        username: form.username.trim(),
        password: form.password,
        fullName: form.fullName.trim(),
        birthday: form.birthday,
        phone: form.phone.trim(),
      })
      toast.success('Đăng ký thành công. Vui lòng đăng nhập.')
      navigate('/login', { replace: true })
    } catch (error) {
      const message = error?.response?.data?.message || 'Đăng ký thất bại.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow">
        <h1 className="text-xl font-bold text-fptOrange">Đăng ký tài khoản</h1>
        <p className="mt-1 text-sm text-slate-500">Infrastructure Management</p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Tên đăng nhập *</label>
            <div className="flex gap-2">
              <input
                value={form.username}
                onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-fptOrange focus:ring-2"
                placeholder="Nhập tên đăng nhập"
                required
              />
              <button
                type="button"
                onClick={handleCheckUsername}
                disabled={checkingUsername}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Kiểm tra
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Mật khẩu *</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-fptOrange focus:ring-2"
              placeholder="Nhập mật khẩu"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Xác nhận mật khẩu *</label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(e) => setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-fptOrange focus:ring-2"
              placeholder="Nhập lại mật khẩu"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Họ và tên *</label>
            <input
              value={form.fullName}
              onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-fptOrange focus:ring-2"
              placeholder="Nhập họ và tên"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Ngày sinh</label>
            <input
              type="date"
              value={form.birthday}
              onChange={(e) => setForm((prev) => ({ ...prev, birthday: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-fptOrange focus:ring-2"
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Số điện thoại</label>
            <input
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-fptOrange focus:ring-2"
              placeholder="Nhập số điện thoại"
              required
            />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Link
            to="/login"
            className="rounded-lg border border-slate-300 px-4 py-2 text-center font-semibold text-slate-700 hover:bg-slate-50"
          >
            Đăng nhập
          </Link>
          <button
            disabled={loading}
            className="rounded-lg bg-fptOrange px-4 py-2 font-semibold text-white hover:bg-fptOrangeDark disabled:opacity-60"
          >
            Đăng ký
          </button>
        </div>
      </form>
    </div>
  )
}

export default Register
