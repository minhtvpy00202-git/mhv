import { IconBell as Bell, IconBoxMultiple as Boxes, IconLogout as LogOut } from '@tabler/icons-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'
import ThemeToggle from '../components/ThemeToggle'
import { useAuth } from '../context/AuthContext'
import { useBranding } from '../context/BrandingContext'
import { normalizeHexColor, toRgba } from '../utils/brandingTheme'

function ConsumableManagerLayout() {
  const { user, logout } = useAuth()
  const { branding } = useBranding()
  const primaryColor = normalizeHexColor(branding.primaryColor)
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false)
  const readingNotificationIdsRef = useRef(new Set())

  const loadFeed = useCallback(async (suppressError = false) => {
    try {
      const response = await axiosClient.get('/api/notifications')
      setNotifications(response.data?.items || [])
      setUnreadCount(response.data?.unreadCount || 0)
    } catch (error) {
      if (suppressError) return
      const message = error?.response?.data?.message || 'Không tải được thông báo.'
      toast.error(message)
    }
  }, [])

  useEffect(() => {
    const bootstrapTimer = window.setTimeout(() => {
      void loadFeed(true)
    }, 0)
    const handleRefresh = () => loadFeed(true)
    window.addEventListener('mhv-notification-feed-refresh', handleRefresh)
    return () => {
      window.clearTimeout(bootstrapTimer)
      window.removeEventListener('mhv-notification-feed-refresh', handleRefresh)
    }
  }, [loadFeed])

  const handleOpenNotification = async (notification) => {
    await markNotificationAsRead(notification)
    setShowNotificationDropdown(false)
    navigate(`/supply/notifications/${notification.id}`)
  }

  const markNotificationAsRead = useCallback(async (notification) => {
    if (!notification?.id || notification.isRead) return
    if (readingNotificationIdsRef.current.has(notification.id)) return
    readingNotificationIdsRef.current.add(notification.id)
    try {
      await axiosClient.post(`/api/notifications/${notification.id}/read`)
      setUnreadCount((prev) => (prev > 0 ? prev - 1 : 0))
      setNotifications((prev) => prev.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item)))
      window.dispatchEvent(new CustomEvent('mhv-notification-feed-refresh'))
    } catch {
      // Ignore hover mark-as-read failures and keep the dropdown usable.
    } finally {
      readingNotificationIdsRef.current.delete(notification.id)
    }
  }, [])

  const handleMarkAllRead = async () => {
    try {
      await axiosClient.post('/api/notifications/read-all')
    } catch {
      // Ignore mark-all-read failures and keep local UI responsive.
    }
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })))
    setUnreadCount(0)
  }

  return (
    <div className="brand-theme flex min-h-[100dvh] bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <aside className="hidden w-72 flex-col border-r border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/80 md:flex">
        <div
          className="rounded-2xl px-4 py-4 text-white shadow-sm ring-1"
          style={{ backgroundColor: primaryColor, boxShadow: `0 0 0 1px ${toRgba(primaryColor, 0.22)}` }}
        >
          <h1 className="text-lg font-semibold">{branding.supplyTitle}</h1>
          <p className="mt-1 text-sm text-white/85">Vật tư tiêu hao</p>
        </div>
        <nav className="mt-4 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <NavLink
            to="/supply/consumables"
            className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-medium text-slate-600 transition hover:bg-orange-50 hover:text-fptOrangeDark dark:text-slate-300 dark:hover:bg-orange-500/10 dark:hover:text-orange-300"
            style={({ isActive }) => ({
              backgroundColor: isActive ? toRgba(primaryColor, 0.1) : 'transparent',
              color: isActive ? primaryColor : undefined,
            })}
          >
            <Boxes size={18} />
            <span>Quản lý vật tư tiêu hao</span>
          </NavLink>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 md:px-6">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Nhân viên quản lý cấp phát vật tư</p>
            <p className="font-semibold text-slate-800 dark:text-slate-100">{user?.fullName || user?.username || 'Consumable Manager'}</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle compact />
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  const nextValue = !showNotificationDropdown
                  setShowNotificationDropdown(nextValue)
                  if (nextValue) loadFeed(true)
                }}
                className="relative inline-flex items-center rounded-lg border border-slate-300 p-2 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1 text-center text-xs font-semibold text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
              {showNotificationDropdown && (
                <div className="absolute right-0 z-20 mt-2 w-80 rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-slate-800">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">Thông báo</p>
                    <button type="button" onClick={handleMarkAllRead} className="text-xs font-semibold" style={{ color: primaryColor }}>
                      Đánh dấu tất cả là đã đọc
                    </button>
                  </div>
                  <div className="max-h-96 overflow-auto">
                    {notifications.length === 0 && <p className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">Chưa có thông báo.</p>}
                    {notifications.map((notification) => (
                      <button
                        key={notification.id}
                        type="button"
                        onMouseEnter={() => {
                          void markNotificationAsRead(notification)
                        }}
                        onClick={() => handleOpenNotification(notification)}
                        className={`block w-full border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-orange-50 dark:border-slate-800 dark:hover:bg-orange-500/10 ${
                          notification.isRead ? 'text-slate-600 dark:text-slate-300' : 'font-semibold text-slate-800 dark:text-slate-100'
                        }`}
                      >
                        <p>{notification.title}</p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{notification.message}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <LogOut size={16} />
              Đăng xuất
            </button>
          </div>
        </header>
        <main className="theme-surface-zone min-w-0 p-5 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default ConsumableManagerLayout
