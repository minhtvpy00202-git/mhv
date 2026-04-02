import { createContext, useContext, useMemo, useState } from 'react'

const AuthContext = createContext(null)

const normalizeRole = (role) => {
  if (!role) return role
  const value = String(role).trim().toLowerCase()
  if (value === 'admin') return 'Admin'
  if (value === 'nhanvien') return 'NhanVien'
  if (value === 'techsupport' || value === 'techsup') return 'TechSupport'
  return role
}

const getStoredUser = () => ({
  userId: Number(localStorage.getItem('auth_user_id')) || null,
  role: normalizeRole(localStorage.getItem('auth_role')),
  username: localStorage.getItem('auth_username'),
})

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('auth_token'))
  const [user, setUser] = useState(getStoredUser())

  const login = ({ token: nextToken, id, role, username }) => {
    const normalizedRole = normalizeRole(role)
    const nextUser = {
      userId: id,
      role: normalizedRole,
      username,
    }
    setToken(nextToken)
    setUser(nextUser)
    localStorage.setItem('auth_token', nextToken)
    localStorage.setItem('auth_user_id', String(id))
    localStorage.setItem('auth_role', normalizedRole)
    localStorage.setItem('auth_username', username)
  }

  const logout = () => {
    setToken(null)
    setUser({ userId: null, role: null, username: null })
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user_id')
    localStorage.removeItem('auth_role')
    localStorage.removeItem('auth_username')
  }

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token),
      login,
      logout,
    }),
    [token, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
