import {
  IconBell as Bell,
  IconBoxMultiple as Boxes,
  IconChartBar as BarChart3,
  IconChevronDown as ChevronDown,
  IconChevronRight as ChevronRight,
  IconChecklist as ClipboardCheck,
  IconHistory as History,
  IconLogout as LogOut,
  IconMapPin as MapPin,
  IconPhone as Phone,
  IconPackage as PackageSearch,
  IconReceiptTax as ReceiptTax,
  IconSettings as Settings,
  IconTags as Tags,
  IconTicket as Ticket,
  IconTool as Wrench,
  IconUsers as Users,
} from '@tabler/icons-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'
import ThemeToggle from '../components/ThemeToggle'
import { useAuth } from '../context/AuthContext'
import { useBranding } from '../context/BrandingContext'
import { normalizeHexColor, toRgba } from '../utils/brandingTheme'

const menuItems = [
  { to: '/admin/dashboard', label: 'Tổng quan', icon: BarChart3 },
  {
    id: 'shared-management',
    label: 'Quản lý chung',
    icon: Boxes,
    children: [
      { to: '/admin/assets', label: 'Quản lý thiết bị', icon: Boxes },
      { to: '/admin/asset-map', label: 'Sơ đồ định vị tài sản', icon: MapPin },
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
  { to: '/admin/branding', label: 'Cài đặt thương hiệu', icon: Settings },
]

function AdminLayout() {
  const { user, logout } = useAuth()
  const { branding } = useBranding()
  const primaryColor = normalizeHexColor(branding.primaryColor)
  const navigate = useNavigate()
  const location = useLocation()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false)
  const [expandedMenus, setExpandedMenus] = useState({ 'shared-management': true })
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
    if (
      location.pathname.startsWith('/admin/assets')
      || location.pathname.startsWith('/admin/asset-map')
      || location.pathname.startsWith('/admin/suppliers')
      || location.pathname.startsWith('/admin/categories')
      || location.pathname.startsWith('/admin/tech-support-types')
      || location.pathname.startsWith('/admin/locations')
    ) {
      const syncMenuTimer = window.setTimeout(() => {
        setExpandedMenus((prev) => ({ ...prev, 'shared-management': true }))
      }, 0)
      return () => window.clearTimeout(syncMenuTimer)
    }
    return undefined
  }, [location.pathname])

  useEffect(() => {
    const bootstrapTimer = window.setTimeout(() => {
      void loadFeed()
    }, 0)
    const handleRefresh = () => {
      void loadFeed(true)
    }
    window.addEventListener('mhv-notification-feed-refresh', handleRefresh)
    return () => {
      window.clearTimeout(bootstrapTimer)
      window.removeEventListener('mhv-notification-feed-refresh', handleRefresh)
    }
  }, [loadFeed])

  const handleOpenNotification = async (notification) => {
    await markNotificationAsRead(notification)
    setShowNotificationDropdown(false)
    navigate(notification.linkPath)
  }

  const markNotificationAsRead = useCallback(async (notification) => {
    if (!notification?.id || notification.isRead) return
    if (readingNotificationIdsRef.current.has(notification.id)) return
    readingNotificationIdsRef.current.add(notification.id)
    try {
      await axiosClient.post(`/api/notifications/${notification.id}/read`)
      setUnreadCount((prev) => (prev > 0 ? prev - 1 : 0))
      setNotifications((prev) =>
        prev.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item)),
      )
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
    window.dispatchEvent(new CustomEvent('mhv-notification-feed-refresh'))
  }

  return (
    <div className="brand-theme flex min-h-[100dvh] bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <aside className="hidden w-72 flex-col border-r border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/80 md:flex">
        <div
          className="rounded-2xl px-4 py-4 text-white shadow-sm ring-1"
          style={{ backgroundColor: primaryColor, boxShadow: `0 0 0 1px ${toRgba(primaryColor, 0.22)}` }}
        >
          <h1 className="text-lg font-semibold">{branding.adminTitle}</h1>
        </div>
        <nav className="mt-4 space-y-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {menuItems.map((item) => {
            if (!item.children) {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      isActive ? 'bg-orange-50 text-fptOrangeDark dark:bg-orange-500/10 dark:text-orange-300' : 'text-slate-600 hover:bg-orange-50 hover:text-fptOrange dark:text-slate-300 dark:hover:bg-orange-500/10 dark:hover:text-orange-300'
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
                    isParentActive ? 'bg-orange-50 text-fptOrangeDark dark:bg-orange-500/10 dark:text-orange-300' : 'text-slate-600 hover:bg-orange-50 hover:text-fptOrange dark:text-slate-300 dark:hover:bg-orange-500/10 dark:hover:text-orange-300'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <ParentIcon size={18} />
                    <span>{item.label}</span>
                  </span>
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>

                {isExpanded && (
                  <div className="space-y-1 border-l border-slate-200 pl-4 dark:border-slate-700">
                    {item.children.map((child) => {
                      const ChildIcon = child.icon
                      return (
                        <NavLink
                          key={child.to}
                          to={child.to}
                          className={({ isActive }) =>
                            `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                              isActive ? 'bg-orange-50 font-semibold text-fptOrangeDark dark:bg-orange-500/10 dark:text-orange-300' : 'text-slate-600 hover:bg-orange-50 hover:text-fptOrange dark:text-slate-300 dark:hover:bg-orange-500/10 dark:hover:text-orange-300'
                            }`
                          }
                        >
                          <ChildIcon size={16} />
                          <span>{child.label}</span>
                        </NavLink>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div
            className="border-b border-slate-200 px-4 py-3 dark:border-slate-800"
            style={{ background: `linear-gradient(135deg, ${toRgba(primaryColor, 0.14)}, ${toRgba(primaryColor, 0.04)})` }}
          >
            <p className="text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">Thông tin doanh nghiệp</p>
            <p className="mt-2 line-clamp-3 text-center text-base font-semibold leading-6 text-slate-900 dark:text-slate-100">
              {branding.legalEntityName || branding.companyName || 'Chưa cấu hình tên doanh nghiệp'}
            </p>
            <div className="mt-3 flex justify-center">
              <div className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold" style={{ borderColor: toRgba(primaryColor, 0.22), color: primaryColor, backgroundColor: toRgba(primaryColor, 0.08) }}>
                {branding.companyName || 'Chưa có tên viết tắt'}
              </div>
            </div>
          </div>

          <div className="grid gap-3 p-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950/70">
              <div className="flex items-start gap-3">
                <div
                  className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: toRgba(primaryColor, 0.1), color: primaryColor }}
                >
                  <ReceiptTax size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Mã số thuế</p>
                  <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">{branding.taxCode || 'Chưa cấu hình'}</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950/70">
              <div className="flex items-start gap-3">
                <div
                  className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: toRgba(primaryColor, 0.1), color: primaryColor }}
                >
                  <MapPin size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Địa chỉ</p>
                  <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-200">{branding.address || 'Chưa cấu hình'}</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950/70">
              <div className="flex items-start gap-3">
                <div
                  className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: toRgba(primaryColor, 0.1), color: primaryColor }}
                >
                  <Phone size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Số điện thoại</p>
                  <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">{branding.phoneNumber || 'Chưa cấu hình'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 md:px-6">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Quản trị viên</p>
            <p className="font-semibold text-slate-800 dark:text-slate-100">{user?.fullName || user?.username || 'Admin'}</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle compact />
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
                <div className="absolute right-0 z-20 mt-2 w-80 rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-slate-800">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">Thông báo</p>
                    <button type="button" onClick={handleMarkAllRead} className="text-xs font-semibold hover:opacity-80" style={{ color: primaryColor }}>
                      Đánh dấu tất cả là đã đọc
                    </button>
                  </div>
                  <div className="max-h-96 overflow-auto">
                    {notifications.length === 0 && (
                      <p className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">Chưa có thông báo.</p>
                    )}
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
                        {notification.assetName && <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">Thiết bị: {notification.assetName}</p>}
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

export default AdminLayout
