import {
  IconEye as Eye,
  IconEyeOff as EyeOff,
} from '@tabler/icons-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'
import ThemeToggle from '../components/ThemeToggle'
import { useAuth } from '../context/AuthContext'
import { useBranding } from '../context/BrandingContext'
import { getTechSupportHomePath } from '../utils/navigation'
import { validateLoginForm } from '../utils/validation'

// Trả về class input theo trạng thái hợp lệ để đồng bộ giao diện form đăng nhập.
function getFieldClass(hasError) {
  return `w-full rounded-lg border bg-white px-3 py-2 text-slate-900 caret-slate-900 outline-none ring-fptOrange placeholder:text-slate-400 focus:ring-2 dark:bg-slate-950 dark:text-slate-100 dark:caret-slate-100 dark:placeholder:text-slate-500 ${hasError ? 'border-red-400 bg-red-50' : 'border-slate-300'}`
}

// Quản lý form đăng nhập và điều hướng người dùng về đúng màn hình theo vai trò.
function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const navigate = useNavigate()
  const { login } = useAuth()
  const { branding } = useBranding()

  // Gửi thông tin đăng nhập, lưu phiên làm việc và chuyển hướng sau khi xác thực thành công.
  const handleSubmit = async (event) => {
    event.preventDefault()
    const nextErrors = validateLoginForm({ username, password })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      toast.error(Object.values(nextErrors)[0])
      return
    }
    setLoading(true)
    try {
      const response = await axiosClient.post('/api/auth/login', { username: username.trim(), password })
      const data = response.data
      login({
        token: data.token,
        id: data.id,
        role: data.role,
        username: data.username,
        fullName: data.fullName,
        techTypeIds: data.techTypeIds,
      })
      toast.success('Đăng nhập thành công.')
      const normalizedRole = String(data.role || '').trim().toLowerCase()
      if (normalizedRole === 'admin') {
        navigate('/admin/dashboard', { replace: true })
      } else if (normalizedRole === 'consumablemanager' || normalizedRole === 'quanlycapphat') {
        navigate('/supply/consumables/warehouses', { replace: true })
      } else if (normalizedRole === 'techsupport' || normalizedRole === 'techsup') {
        navigate(getTechSupportHomePath(), { replace: true })
      } else {
        navigate('/mobile/home', { replace: true })
      }
    } catch (error) {
      const data = error?.response?.data
      const status = error?.response?.status
      const ngrokWarning =
        typeof data === 'string' && (data.includes('ERR_NGROK_6024') || data.includes('ngrok-skip-browser-warning'))
      const message =
        (typeof data === 'object' && data?.message) ||
        (ngrokWarning ? 'Ngrok đang chặn request, vui lòng tải lại trang tunnel và thử lại.' : null) ||
        (status ? `Đăng nhập thất bại (HTTP ${status}).` : 'Đăng nhập thất bại.')
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-100 px-4 dark:bg-slate-950">
      <div className="fixed right-4 top-4">
        <ThemeToggle />
      </div>
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow dark:bg-slate-900">
        <h1 className="text-xl font-bold text-fptOrange">Đăng nhập hệ thống</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{`${branding.companyName} ${branding.appName}`}</p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Username</label>
            <input
              value={username}
              onChange={(e) => {
                setUsername(e.target.value)
                setErrors((prev) => ({ ...prev, username: '' }))
              }}
              className={getFieldClass(Boolean(errors.username))}
              autoComplete="username"
              placeholder="Nhập username"
            />
            {errors.username && <p className="mt-1 text-xs text-red-600">{errors.username}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setErrors((prev) => ({ ...prev, password: '' }))
                }}
                className={`${getFieldClass(Boolean(errors.password))} pr-11`}
                autoComplete="current-password"
                placeholder="Nhập password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 inline-flex items-center justify-center px-3 text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <button
            disabled={loading}
            className="w-full rounded-lg bg-fptOrange px-4 py-2 font-semibold text-white hover:bg-fptOrangeDark disabled:opacity-60"
          >
            Đăng nhập
          </button>
          <p className="text-center text-sm text-slate-500 dark:text-slate-400">
            Tài khoản được cấp bởi quản trị viên hệ thống.
          </p>
        </div>
      </form>
    </div>
  )
}

export default Login
