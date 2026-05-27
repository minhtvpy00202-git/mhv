import {
  Bell,
  BarChart3,
  Boxes,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  History,
  LogOut,
  MapPin,
  PackageSearch,
  Tags,
  Ticket,
  Users,
  Wrench,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'
import { useAuth } from '../context/AuthContext'

const menuItems = [
  { to: '/admin/dashboard', label: 'Tổng quan', icon: BarChart3 },
  {
    id: 'shared-management',
    label: 'Quản lý chung',
    icon: Boxes,
    children: [
      { to: '/admin/assets', label: 'Quản lý thiết bị', icon: Boxes },
      { to: '/admin/suppliers', label: 'Quản lý nhà cung cấp', icon: PackageSearch },
      { to: '/admin/categories', label: 'Quản lý loại thiết bị', icon: Tags },
      { to: '/admin/tech-support-types', label: 'Quản lý loại kỹ thuật viên', icon: Wrench },
      { to: '/admin/locations', label: 'Quản lý phòng - khu vực', icon: MapPin },
    ],
  },
  { to: '/admin/users', label: 'Quản lý tài khoản', icon: Users },
  { to: '/admin/usage-history', label: 'Lịch sử mượn thiết bị', icon: History },
  { to: '/admin/tickets', label: 'Điều phối ticket sửa chữa', icon: Ticket },
  { to: '/admin/inventory-audits', label: 'Kiểm kê định kỳ', icon: ClipboardCheck },
]

function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false)
  const [expandedMenus, setExpandedMenus] = useState({ 'shared-management': true })

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
    if (
      location.pathname.startsWith('/admin/assets')
      || location.pathname.startsWith('/admin/suppliers')
      || location.pathname.startsWith('/admin/categories')
      || location.pathname.startsWith('/admin/tech-support-types')
      || location.pathname.startsWith('/admin/locations')
    ) {
      setExpandedMenus((prev) => ({ ...prev, 'shared-management': true }))
    }
  }, [location.pathname])

  useEffect(() => {
    const handleRefresh = () => {
      loadFeed(true)
    }
    loadFeed()
    window.addEventListener('mhv-notification-feed-refresh', handleRefresh)
    return () => window.removeEventListener('mhv-notification-feed-refresh', handleRefresh)
  }, [loadFeed])

  const handleOpenNotification = async (notification) => {
    try {
      await axiosClient.post(`/api/notifications/${notification.id}/read`)
      setUnreadCount((prev) => (prev > 0 ? prev - 1 : 0))
      setNotifications((prev) =>
        prev.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item)),
      )
      window.dispatchEvent(new CustomEvent('mhv-notification-feed-refresh'))
    } catch {}
    setShowNotificationDropdown(false)
    navigate(notification.linkPath)
  }

  const handleMarkAllRead = async () => {
    try {
      await axiosClient.post('/api/notifications/read-all')
    } catch {}
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })))
    setUnreadCount(0)
    window.dispatchEvent(new CustomEvent('mhv-notification-feed-refresh'))
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="hidden w-64 flex-col bg-white p-4 shadow md:flex">
        <div className="rounded-lg bg-fptOrange px-4 py-3 text-white">
          <h1 className="text-lg font-semibold">FPT Admin</h1>
        </div>
        <nav className="mt-4 space-y-2">
          {menuItems.map((item) => {
            if (!item.children) {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      isActive ? 'bg-orange-50 text-fptOrangeDark' : 'text-slate-600 hover:bg-orange-50 hover:text-fptOrange'
                    }`
                  }
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </NavLink>
              )
            }

            const isExpanded = expandedMenus[item.id]
            const isParentActive = item.children.some((child) => location.pathname.startsWith(child.to))
            const ParentIcon = item.icon

            return (
              <div key={item.id} className="space-y-2">
                <button
                  type="button"
                  onClick={() => setExpandedMenus((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isParentActive ? 'bg-orange-50 text-fptOrangeDark' : 'text-slate-600 hover:bg-orange-50 hover:text-fptOrange'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <ParentIcon size={18} />
                    <span>{item.label}</span>
                  </span>
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>

                {isExpanded && (
                  <div className="space-y-1 pl-4">
                    {item.children.map(({ to, label, icon: Icon }) => (
                      <NavLink
                        key={to}
                        to={to}
                        className={({ isActive }) =>
                          `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                            isActive ? 'bg-orange-50 font-semibold text-fptOrangeDark' : 'text-slate-600 hover:bg-orange-50 hover:text-fptOrange'
                          }`
                        }
                      >
                        <Icon size={16} />
                        <span>{label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between bg-white px-4 py-3 shadow-sm md:px-6">
          <div>
            <p className="text-sm text-slate-500">Quản trị viên</p>
            <p className="font-semibold text-slate-800">{user?.fullName || user?.username || 'Admin'}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  const nextValue = !showNotificationDropdown
                  setShowNotificationDropdown(nextValue)
                  if (nextValue) {
                    loadFeed(true)
                  }
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
                <div className="absolute right-0 z-20 mt-2 w-80 rounded-lg border border-slate-200 bg-white shadow-lg">
                  <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                    <p className="text-sm font-semibold text-slate-700">Thông báo</p>
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                    >
                      Đánh dấu tất cả là đã đọc
                    </button>
                  </div>
                  <div className="max-h-96 overflow-auto">
                    {notifications.length === 0 && (
                      <p className="px-3 py-2 text-sm text-slate-500">Chưa có thông báo.</p>
                    )}
                    {notifications.map((notification) => (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() => handleOpenNotification(notification)}
                        className={`block w-full border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-orange-50 ${
                          notification.isRead ? 'text-slate-600' : 'font-semibold text-slate-800'
                        }`}
                      >
                        <p>{notification.title}</p>
                        {notification.assetName && <p className="mt-0.5 text-xs text-slate-600">Thiết bị: {notification.assetName}</p>}
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
        <main className="min-w-0 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AdminLayout
