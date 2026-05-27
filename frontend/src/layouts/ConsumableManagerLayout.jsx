import { Bell, Boxes, LogOut } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'
import { useAuth } from '../context/AuthContext'

function ConsumableManagerLayout() {
  const { user, logout } = useAuth()
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
    <div className="flex min-h-screen bg-slate-100">
      <aside className="hidden w-72 flex-col border-r border-slate-200 bg-slate-50/80 p-4 md:flex">
        <div className="rounded-2xl bg-emerald-600 px-4 py-4 text-white shadow-sm ring-1 ring-emerald-200">
          <h1 className="text-lg font-semibold">Quản lý cấp phát</h1>
          <p className="mt-1 text-sm text-emerald-50">Vật tư tiêu hao</p>
        </div>
        <nav className="mt-4 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          <NavLink
            to="/supply/consumables"
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-medium transition ${
                isActive ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
              }`
            }
          >
            <Boxes size={18} />
            <span>Quản lý vật tư tiêu hao</span>
          </NavLink>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-4 shadow-sm backdrop-blur md:px-6">
          <div>
            <p className="text-sm text-slate-500">Nhân viên quản lý cấp phát vật tư</p>
            <p className="font-semibold text-slate-800">{user?.fullName || user?.username || 'Consumable Manager'}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  const nextValue = !showNotificationDropdown
                  setShowNotificationDropdown(nextValue)
                  if (nextValue) loadFeed(true)
                }}
                className="relative inline-flex items-center rounded-lg border border-slate-300 p-2 text-slate-700 hover:bg-slate-50"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1 text-center text-xs font-semibold text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
              {showNotificationDropdown && (
                <div className="absolute right-0 z-20 mt-2 w-80 rounded-2xl border border-slate-200 bg-white shadow-lg">
                  <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                    <p className="text-sm font-semibold text-slate-700">Thông báo</p>
                    <button type="button" onClick={handleMarkAllRead} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
                      Đánh dấu tất cả là đã đọc
                    </button>
                  </div>
                  <div className="max-h-96 overflow-auto">
                    {notifications.length === 0 && <p className="px-3 py-2 text-sm text-slate-500">Chưa có thông báo.</p>}
                    {notifications.map((notification) => (
                      <button
                        key={notification.id}
                        type="button"
                        onMouseEnter={() => {
                          void markNotificationAsRead(notification)
                        }}
                        onClick={() => handleOpenNotification(notification)}
                        className={`block w-full border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-emerald-50 ${
                          notification.isRead ? 'text-slate-600' : 'font-semibold text-slate-800'
                        }`}
                      >
                        <p>{notification.title}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{notification.message}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <LogOut size={16} />
              Đăng xuất
            </button>
          </div>
        </header>
        <main className="min-w-0 p-5 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default ConsumableManagerLayout
