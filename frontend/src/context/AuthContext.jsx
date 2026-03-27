import { createContext, useContext, useMemo, useState } from 'react'

const AuthContext = createContext(null)

const getStoredUser = () => ({
  userId: Number(localStorage.getItem('auth_user_id')) || null,
  role: localStorage.getItem('auth_role'),
  username: localStorage.getItem('auth_username'),
})

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('auth_token'))
  const [user, setUser] = useState(getStoredUser())

  const login = ({ token: nextToken, id, role, username }) => {
    const nextUser = {
      userId: id,
      role,
      username,
    }
    setToken(nextToken)
    setUser(nextUser)
    localStorage.setItem('auth_token', nextToken)
    localStorage.setItem('auth_user_id', String(id))
    localStorage.setItem('auth_role', role)
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
