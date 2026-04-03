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
  fullName: localStorage.getItem('auth_full_name'),
  techTypeId: Number(localStorage.getItem('auth_tech_type_id')) || 0,
})

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('auth_token'))
  const [user, setUser] = useState(getStoredUser())

  const login = ({ token: nextToken, id, role, username, fullName, techTypeId }) => {
    const normalizedRole = normalizeRole(role)
    const nextUser = {
      userId: id,
      role: normalizedRole,
      username,
      fullName,
      techTypeId: Number(techTypeId) || 0,
    }
    setToken(nextToken)
    setUser(nextUser)
    localStorage.setItem('auth_token', nextToken)
    localStorage.setItem('auth_user_id', String(id))
    localStorage.setItem('auth_role', normalizedRole)
    localStorage.setItem('auth_username', username)
    localStorage.setItem('auth_full_name', fullName || '')
    localStorage.setItem('auth_tech_type_id', String(Number(techTypeId) || 0))
  }

  const logout = () => {
    setToken(null)
    setUser({ userId: null, role: null, username: null, fullName: null, techTypeId: 0 })
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user_id')
    localStorage.removeItem('auth_role')
    localStorage.removeItem('auth_username')
    localStorage.removeItem('auth_full_name')
    localStorage.removeItem('auth_tech_type_id')
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
