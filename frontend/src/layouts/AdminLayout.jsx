import {
  IconBell as Bell,
  IconBoxMultiple as Boxes,
  IconChartBar as BarChart3,
  IconChevronDown as ChevronDown,
  IconChevronRight as ChevronRight,
  IconChecklist as ClipboardCheck,
  IconHistory as History,
  IconKey as Key,
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
  IconClock as Clock,
} from '@tabler/icons-react'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'
import ChangePasswordModal from '../components/ChangePasswordModal'
import ThemeToggle from '../components/ThemeToggle'
import UserTimeClock from '../components/UserTimeClock'
import { useAuth } from '../context/AuthContext'
import { useBranding } from '../context/BrandingContext'
import { normalizeHexColor, toRgba } from '../utils/brandingTheme'
import { formatVietnamDateTime } from '../utils/datetime'

const menuItems = [
  { to: '/admin/dashboard', label: 'Tổng quan', icon: BarChart3 },
  { to: '/admin/inquiry-reports', label: 'Báo cáo yêu cầu', icon: BarChart3 },
  {
    id: 'assets-root',
    label: 'Tài sản',
    icon: Boxes,
    children: [
      {
        id: 'fixed-assets',
        label: 'Tài sản cố định',
        icon: PackageSearch,
        children: [
          { to: '/admin/assets/fixed', label: 'Danh sách tài sản', icon: PackageSearch },
          { to: '/admin/categories/fixed', label: 'Loại thiết bị', icon: Tags },
          { to: '/admin/borrow-requests', label: 'Duyệt phiếu mượn', icon: Clock },
          { to: '/admin/usage-history', label: 'Lịch sử mượn thiết bị', icon: History },
        ],
      },
      {
        id: 'consumable-assets',
        label: 'Vật tư tiêu hao',
        icon: Boxes,
        children: [
          { to: '/admin/assets/consumables/warehouses', label: 'Kho vật tư', icon: PackageSearch },
          { to: '/admin/categories/consumables', label: 'Loại vật tư', icon: Tags },
          { to: '/admin/assets/consumables/rooms', label: 'Theo dõi theo phòng', icon: MapPin },
          { to: '/admin/assets/consumables/issues', label: 'Lịch sử cấp phát', icon: History },
          { to: '/admin/assets/consumables/requests', label: 'Yêu cầu cấp phát / sử dụng', icon: Clock },
          { to: '/admin/assets/consumables/disposal', label: 'Thanh lý / hủy vật tư', icon: Wrench },
        ],
      },
      { to: '/admin/asset-statistics', label: 'Thống kê tài sản', icon: BarChart3 },
    ],
  },
  {
    id: 'space-root',
    label: 'Không gian & vị trí',
    icon: MapPin,
    children: [
      { to: '/admin/asset-map', label: 'Sơ đồ định vị tài sản', icon: MapPin },
      {
        id: 'locations-root',
        label: 'Khu vực',
        icon: MapPin,
        children: [
          { to: '/admin/locations', label: 'Danh sách khu vực', icon: MapPin },
          { to: '/admin/locations/area-types', label: 'Loại khu vực', icon: Tags },
        ],
      },
    ],
  },
  {
    id: 'operations-root',
    label: 'Vận hành kỹ thuật',
    icon: Ticket,
    children: [
      {
        id: 'tickets-root',
        label: 'Ticket sửa chữa',
        icon: Ticket,
        children: [
          { to: '/admin/tickets', label: 'Danh sách ticket', icon: Ticket },
          { to: '/admin/tickets/extensions', label: 'Duyệt yêu cầu gia hạn / SLA', icon: Clock },
        ],
      },
      { to: '/admin/inventory-audits', label: 'Kiểm kê định kỳ', icon: ClipboardCheck },
    ],
  },
  {
    id: 'partners-root',
    label: 'Đối tác & người dùng',
    icon: Users,
    children: [
      { to: '/admin/suppliers', label: 'Nhà cung cấp', icon: PackageSearch },
      { to: '/admin/users', label: 'Tài khoản người dùng', icon: Users },
      { to: '/admin/tech-support-types', label: 'Loại kỹ thuật viên', icon: Wrench },
    ],
  },
  {
    id: 'settings-root',
    label: 'Cài đặt hệ thống',
    icon: Settings,
    children: [
      { to: '/admin/inquiry-settings', label: 'SLA & duyệt yêu cầu', icon: Clock },
      { to: '/admin/branding', label: 'Cài đặt thương hiệu', icon: Settings },
    ],
  },
]

function getMenuPath(item) {
  if (!item?.to) return ''
  return typeof item.to === 'string' ? item.to.split('?')[0] : item.to.pathname || ''
}

function collectMenuPaths(items, bucket = []) {
  ;(items || []).forEach((item) => {
    const itemPath = getMenuPath(item)
    if (itemPath) {
      bucket.push(itemPath)
    }
    if (item?.children?.length) {
      collectMenuPaths(item.children, bucket)
    }
  })
  return bucket
}

const menuPaths = collectMenuPaths(menuItems)

function getAdminInquiryBadgeCount(items) {
  return (items || []).filter((item) => {
    if (item?.inquiryType !== 'CONSUMABLE_REQUEST') return false
    const unreadCount = Number(item?.unreadCount || 0)
    const awaitingApproval = item?.status === 'WAITING_APPROVAL'
    const isNewRequest = item?.status === 'NEW'
    return unreadCount > 0 || awaitingApproval || isNewRequest
  }).length
}

function getBorrowRequestBadgeCount(items) {
  return (items || []).filter((item) => ['PENDING', 'RETURN_PENDING'].includes(item?.status)).length
}

function isMenuActiveForPath(item, pathname) {
  if (item.children?.length) return item.children.some((child) => isMenuActiveForPath(child, pathname))
  const itemPath = getMenuPath(item)
  if (!itemPath) return false
  if (itemPath === '/admin/assets/fixed' && pathname === '/admin/assets') return true
  if (pathname === itemPath) return true
  const hasMoreSpecificMatch = menuPaths.some(
    (path) =>
      path !== itemPath
      && path.startsWith(`${itemPath}/`)
      && (pathname === path || pathname.startsWith(`${path}/`)),
  )
  if (hasMoreSpecificMatch) return false
  return pathname.startsWith(`${itemPath}/`)
}

function collectExpandedMenuState(items, pathname, bucket = {}) {
  ;(items || []).forEach((item) => {
    if (!item?.children?.length) return
    if (item.id && item.children.some((child) => isMenuActiveForPath(child, pathname))) {
      bucket[item.id] = true
    }
    collectExpandedMenuState(item.children, pathname, bucket)
  })
  return bucket
}

function getNotificationSubjectLabel(notification) {
  const eventType = String(notification?.eventType || '').toUpperCase()
  const title = String(notification?.title || '').toLowerCase()

  if (eventType.startsWith('USER_')) return null
  if (eventType.startsWith('CATEGORY_')) return null
  if (eventType.startsWith('SUPPLIER_')) return null
  if (eventType.startsWith('LOCATION_')) return null
  if (eventType.startsWith('TECH_SUPPORT_TYPE_')) return null
  if (eventType.startsWith('ASSET_')) return title.includes('vật tư') ? 'Vật tư' : 'Thiết bị'
  if (eventType.startsWith('TICKET_')) return 'Thiết bị'
  return 'Đối tượng'
}

function AdminLayout() {
  const { user, logout } = useAuth()
  const { branding } = useBranding()
  const primaryColor = normalizeHexColor(branding.primaryColor)
  const navigate = useNavigate()
  const location = useLocation()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [menuBadgeCounts, setMenuBadgeCounts] = useState({})
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false)
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false)
  const [expandedMenus, setExpandedMenus] = useState({
    'assets-root': true,
    'fixed-assets': true,
    'consumable-assets': true,
  })
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

  const loadMenuBadgeCounts = useCallback(async (suppressError = false) => {
    try {
      const [inquiryResponse, borrowResponse] = await Promise.all([
        axiosClient.get('/api/inquiries/inbox'),
        axiosClient.get('/api/borrow-requests/inbox'),
      ])
      setMenuBadgeCounts({
        '/admin/assets/consumables/requests': getAdminInquiryBadgeCount(inquiryResponse.data || []),
        '/admin/borrow-requests': getBorrowRequestBadgeCount(borrowResponse.data || []),
      })
    } catch (error) {
      if (suppressError) return
      toast.error(error?.response?.data?.message || 'Không tải được số lượng yêu cầu chờ xử lý.')
    }
  }, [])

  useEffect(() => {
    const syncMenuTimer = window.setTimeout(() => {
      setExpandedMenus((prev) => ({
        ...prev,
        ...collectExpandedMenuState(menuItems, location.pathname),
      }))
    }, 0)
    return () => window.clearTimeout(syncMenuTimer)
  }, [location.pathname])

  useEffect(() => {
    const bootstrapTimer = window.setTimeout(() => {
      void loadFeed()
      void loadMenuBadgeCounts(true)
    }, 0)
    const interval = window.setInterval(() => {
      void loadMenuBadgeCounts(true)
    }, 15000)
    const handleRefresh = () => {
      void loadFeed(true)
      void loadMenuBadgeCounts(true)
    }
    window.addEventListener('mhv-notification-feed-refresh', handleRefresh)
    return () => {
      window.clearTimeout(bootstrapTimer)
      window.clearInterval(interval)
      window.removeEventListener('mhv-notification-feed-refresh', handleRefresh)
    }
  }, [loadFeed, loadMenuBadgeCounts])

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

  const isMenuItemActive = (item) => {
    return isMenuActiveForPath(item, location.pathname)
  }

  const getMenuItemClass = (active, depth, parent = false) => {
    const depthClass = depth >= 2 ? 'px-2.5 py-1.5 text-[13px]' : 'px-3 py-2 text-sm'
    const weightClass = parent || depth === 0 ? 'font-medium' : active ? 'font-semibold' : ''
    const activeClass = active
      ? 'bg-orange-50 text-fptOrangeDark dark:bg-orange-500/10 dark:text-orange-300'
      : 'text-slate-600 hover:bg-orange-50 hover:text-fptOrange dark:text-slate-300 dark:hover:bg-orange-500/10 dark:hover:text-orange-300'
    return `flex items-center gap-2 rounded-lg ${depthClass} ${weightClass} transition ${activeClass}`
  }

  const renderMenuItem = (item, depth = 0) => {
    const Icon = item.icon || Boxes
    const active = isMenuItemActive(item)
    const key = item.id || item.to
    const badgeCount = Number(menuBadgeCounts[item.to] || 0)

    if (!item.children?.length) {
      return (
        <Link key={key} to={item.to} className={getMenuItemClass(active, depth)}>
          <Icon size={depth >= 2 ? 15 : depth === 1 ? 16 : 18} />
          <span className="flex min-w-0 items-center gap-2">
            <span>{item.label}</span>
            {badgeCount > 0 && (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white">
                {badgeCount > 99 ? '99+' : badgeCount}
              </span>
            )}
          </span>
        </Link>
      )
    }

    const isExpanded = expandedMenus[item.id]
    const buttonActive = Boolean(item.to) && active
    return (
      <div key={key} className="space-y-1">
        <button
          type="button"
          onClick={() => setExpandedMenus((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
          className={`${getMenuItemClass(buttonActive, depth, true)} w-full justify-between`}
        >
          <span className="flex items-center gap-2">
            <Icon size={depth >= 2 ? 15 : depth === 1 ? 16 : 18} />
            <span>{item.label}</span>
          </span>
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        {isExpanded && (
          <div className={`space-y-1 border-l border-slate-200 dark:border-slate-700 ${depth === 0 ? 'pl-4' : 'ml-2 pl-3'}`}>
            {item.children.map((child) => renderMenuItem(child, depth + 1))}
          </div>
        )}
      </div>
    )
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
          {menuItems.map((item) => renderMenuItem(item))}
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
        <header className="relative z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 md:px-6">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Quản trị viên</p>
            <p className="font-semibold text-slate-800 dark:text-slate-100">{user?.fullName || user?.username || 'Admin'}</p>
          </div>
          <div className="flex items-center gap-2">
            <UserTimeClock compact className="hidden lg:block" />
            <ThemeToggle compact />
            <div className="relative z-[120]">
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
                <div className="absolute right-0 z-[120] mt-2 w-[26rem] max-w-[calc(100vw-2rem)] rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
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
                    {notifications.map((notification) => {
                      const subjectLabel = getNotificationSubjectLabel(notification)
                      return (
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
                        {notification.assetName && subjectLabel && (
                          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                            {subjectLabel}: {notification.assetName}
                          </p>
                        )}
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{notification.message}</p>
                        <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                          {formatVietnamDateTime(notification.occurredAt, 'Vừa xong')}
                        </p>
                      </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowChangePasswordModal(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Key size={16} />
              Đổi mật khẩu
            </button>
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
      <ChangePasswordModal open={showChangePasswordModal} onClose={() => setShowChangePasswordModal(false)} />
    </div>
  )
}

export default AdminLayout
