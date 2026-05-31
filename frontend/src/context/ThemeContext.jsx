import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'mhv-theme'
const ThemeContext = createContext(null)

function getSystemTheme() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light'
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyThemeToDocument(theme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.dataset.theme = theme
}

export function initializeTheme() {
  if (typeof window === 'undefined') return 'light'
  const storedTheme = window.localStorage.getItem(STORAGE_KEY)
  const theme = storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : getSystemTheme()
  applyThemeToDocument(theme)
  return theme
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => initializeTheme())

  useEffect(() => {
    applyThemeToDocument(theme)
    window.localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined
    }
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      const storedTheme = window.localStorage.getItem(STORAGE_KEY)
      if (storedTheme !== 'light' && storedTheme !== 'dark') {
        setTheme(getSystemTheme())
      }
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  const value = useMemo(() => ({
    theme,
    setTheme,
    toggleTheme: () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark')),
    isDark: theme === 'dark',
  }), [theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
