import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'
import { useAuth } from '../context/AuthContext'

function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { login } = useAuth()

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!username || !password) {
      toast.error('Vui lòng nhập đầy đủ username và password.')
      return
    }
    setLoading(true)
    try {
      const response = await axiosClient.post('/api/auth/login', { username, password })
      const data = response.data
      login({
        token: data.token,
        id: data.id,
        role: data.role,
        username: data.username,
      })
      toast.success('Đăng nhập thành công.')
      const normalizedRole = String(data.role || '').trim().toLowerCase()
      if (normalizedRole === 'admin') {
        navigate('/admin/dashboard', { replace: true })
      } else if (normalizedRole === 'techsupport' || normalizedRole === 'techsup') {
        navigate('/tech/tickets', { replace: true })
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
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow">
        <h1 className="text-xl font-bold text-fptOrange">Đăng nhập hệ thống</h1>
        <p className="mt-1 text-sm text-slate-500">Infrastructure Management</p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-fptOrange focus:ring-2"
              placeholder="Nhập username"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-fptOrange focus:ring-2"
              placeholder="Nhập password"
            />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Link
            to="/register"
            className="rounded-lg border border-slate-300 px-4 py-2 text-center font-semibold text-slate-700 hover:bg-slate-50"
          >
            Đăng ký
          </Link>
          <button
            disabled={loading}
            className="rounded-lg bg-fptOrange px-4 py-2 font-semibold text-white hover:bg-fptOrangeDark disabled:opacity-60"
          >
            Đăng nhập
          </button>
        </div>
      </form>
    </div>
  )
}

export default Login
