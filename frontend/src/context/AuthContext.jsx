/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { resetAuthExpiredNoticeFlag } from '../api/axiosClient'

const AuthContext = createContext(null)
const NOTIFICATION_SESSION_STARTED_AT_KEY = 'mhv_notification_session_started_at'

// Chuẩn hóa tên vai trò để frontend chỉ xử lý một tập giá trị thống nhất.
const normalizeRole = (role) => {
  if (!role) return role
  const value = String(role).trim().toLowerCase()
  if (value === 'admin') return 'Admin'
  if (value === 'nhanvien') return 'NhanVien'
  if (value === 'consumablemanager' || value === 'quanlycapphat') return 'ConsumableManager'
  if (value === 'techsupport' || value === 'techsup') return 'TechSupport'
  return role
}

// Khôi phục thông tin người dùng đã lưu từ localStorage khi tải lại trang.
const getStoredUser = () => ({
  userId: Number(localStorage.getItem('auth_user_id')) || null,
  role: normalizeRole(localStorage.getItem('auth_role')),
  username: localStorage.getItem('auth_username'),
  fullName: localStorage.getItem('auth_full_name'),
  techTypeIds: JSON.parse(localStorage.getItem('auth_tech_type_ids') || '[]'),
})

// Cung cấp trạng thái xác thực, phiên đăng nhập và thông báo hết hạn cho toàn ứng dụng.
export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('auth_token'))
  const [user, setUser] = useState(getStoredUser())
  const [sessionExpiredNoticeOpen, setSessionExpiredNoticeOpen] = useState(false)

  // Lưu token và hồ sơ người dùng sau khi đăng nhập thành công.
  const login = ({ token: nextToken, id, role, username, fullName, techTypeIds }) => {
    const normalizedRole = normalizeRole(role)
    const normalizedTechTypeIds = Array.isArray(techTypeIds)
      ? techTypeIds.map(Number).filter((value) => value > 0)
      : []
    const nextUser = {
      userId: id,
      role: normalizedRole,
      username,
      fullName,
      techTypeIds: normalizedTechTypeIds,
    }
    setToken(nextToken)
    setUser(nextUser)
    localStorage.setItem('auth_token', nextToken)
    localStorage.setItem('auth_user_id', String(id))
    localStorage.setItem('auth_role', normalizedRole)
    localStorage.setItem('auth_username', username)
    localStorage.setItem('auth_full_name', fullName || '')
    localStorage.setItem('auth_tech_type_ids', JSON.stringify(normalizedTechTypeIds))
    sessionStorage.setItem(NOTIFICATION_SESSION_STARTED_AT_KEY, String(Date.now()))
    resetAuthExpiredNoticeFlag()
  }

  // Xóa toàn bộ dữ liệu phiên khi người dùng đăng xuất hoặc token không còn hợp lệ.
  const logout = useCallback(() => {
    setToken(null)
    setUser({ userId: null, role: null, username: null, fullName: null, techTypeIds: [] })
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user_id')
    localStorage.removeItem('auth_role')
    localStorage.removeItem('auth_username')
    localStorage.removeItem('auth_full_name')
    localStorage.removeItem('auth_tech_type_ids')
    sessionStorage.removeItem(NOTIFICATION_SESSION_STARTED_AT_KEY)
    resetAuthExpiredNoticeFlag()
  }, [])

  // Đóng thông báo hết phiên sau khi người dùng đã xác nhận.
  const acknowledgeSessionExpired = useCallback(() => {
    setSessionExpiredNoticeOpen(false)
    resetAuthExpiredNoticeFlag()
  }, [])

  // Lắng nghe sự kiện hết hạn phiên do axios phát ra để đồng bộ trạng thái toàn app.
  useEffect(() => {
    const handleSessionExpired = () => {
      logout()
      setSessionExpiredNoticeOpen(true)
    }
    window.addEventListener('mhv-auth-session-expired', handleSessionExpired)
    return () => window.removeEventListener('mhv-auth-session-expired', handleSessionExpired)
  }, [logout])

  useEffect(() => {
    if (!token) {
      sessionStorage.removeItem(NOTIFICATION_SESSION_STARTED_AT_KEY)
      return
    }
    if (!sessionStorage.getItem(NOTIFICATION_SESSION_STARTED_AT_KEY)) {
      sessionStorage.setItem(NOTIFICATION_SESSION_STARTED_AT_KEY, String(Date.now()))
    }
  }, [token])

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token),
      login,
      logout,
      sessionExpiredNoticeOpen,
      acknowledgeSessionExpired,
    }),
    [acknowledgeSessionExpired, login, logout, sessionExpiredNoticeOpen, token, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Trả về context xác thực và chặn việc dùng hook ngoài AuthProvider.
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
