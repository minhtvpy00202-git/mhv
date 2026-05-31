import { IconMoon, IconSun } from '@tabler/icons-react'
import { useTheme } from '../context/ThemeContext'

function ThemeToggle({ className = '', compact = false }) {
  const { isDark, toggleTheme } = useTheme()

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
      className={`inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 ${className}`.trim()}
    >
      {isDark ? <IconSun size={16} stroke={1.75} /> : <IconMoon size={16} stroke={1.75} />}
      {!compact && <span>{isDark ? 'Giao diện sáng' : 'Giao diện tối'}</span>}
    </button>
  )
}

export default ThemeToggle
