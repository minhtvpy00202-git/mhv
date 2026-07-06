import {
  IconBell as Bell,
  IconChecklist as ClipboardCheck,
  IconClipboardList as ClipboardList,
  IconHistory as History,
  IconLogout as LogOut,
  IconMenu2 as Menu2,
  IconMessageCircle as MessageCircle,
} from '@tabler/icons-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'
import ThemeToggle from '../components/ThemeToggle'
import UserTimeClock from '../components/UserTimeClock'
import { useAuth } from '../context/AuthContext'
import { useBranding } from '../context/BrandingContext'
import { normalizeHexColor, toRgba } from '../utils/brandingTheme'
import { formatVietnamDateTime } from '../utils/datetime'
import {
  getTechSupportTicketPath,
  isNarrowViewport,
  toTechSupportDesktopPath,
} from '../utils/navigation'

const navItems = [
  { to: '/tech-mobile/tickets', label: 'Công việc', icon: ClipboardList },
  { to: '/tech-mobile/inventory-audits', label: 'Kiểm kê', icon: ClipboardCheck, end: true },
  { to: '/tech-mobile/inventory-audits/history', label: 'Lịch sử', icon: History, end: true },
  { to: '/tech-mobile/chats', label: 'Tin nhắn', icon: MessageCircle },
]

function MobileTechSupportLayout() {
  const { user, logout } = useAuth()
  const { branding } = useBranding()
  const primaryColor = normalizeHexColor(branding.primaryColor)
  const navigate = useNavigate()
  const location = useLocation()
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [chatNotifications, setChatNotifications] = useState([])
  const [unreadChatCount, setUnreadChatCount] = useState(0)
  const [notifications, setNotifications] = useState([])
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)
  const [showActionMenu, setShowActionMenu] = useState(false)
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false)
  const readingNotificationIdsRef = useRef(new Set())
  const actionMenuRef = useRef(null)

  const loadFeed = useCallback(async (suppressError = false) => {
    try {
      const response = await axiosClient.get('/api/notifications')
      setNotifications(response.data?.items || [])
      setUnreadNotificationCount(response.data?.unreadCount || 0)
    } catch (error) {
      if (suppressError) return
      const message = error?.response?.data?.message || 'Không tải được thông báo.'
      toast.error(message)
    }
  }, [])

  useEffect(() => {
    const syncViewportRoute = () => {
      if (isNarrowViewport()) return
      const targetPath = toTechSupportDesktopPath(location.pathname)
      if (targetPath !== location.pathname) {
        navigate(targetPath, { replace: true })
      }
    }

    syncViewportRoute()
    const mediaQuery = window.matchMedia('(max-width: 768px)')
    const handleChange = () => syncViewportRoute()
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [location.pathname, navigate])

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault()
      setDeferredPrompt(event)
      setShowInstallPrompt(true)
    }

    const handleAppInstalled = () => {
      setDeferredPrompt(null)
      setShowInstallPrompt(false)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  useEffect(() => {
    const handleChatNotification = (event) => {
      const payload = event.detail
      if (!payload?.ticketId) return
      setChatNotifications((prev) => {
        const next = [
          {
            id: `${payload.ticketId}-${payload.createdAt || Date.now()}`,
            senderName: payload.senderName || 'Người dùng',
            messagePreview: payload.messagePreview || 'Bạn có tin nhắn mới.',
            ticketPath: payload.ticketPath || getTechSupportTicketPath(payload.ticketId),
            isRead: false,
          },
          ...prev,
        ]
        return next.slice(0, 20)
      })
      setUnreadChatCount((prev) => prev + 1)
    }

    window.addEventListener('mhv-chat-notification', handleChatNotification)
    return () => window.removeEventListener('mhv-chat-notification', handleChatNotification)
  }, [])

  useEffect(() => {
    void loadFeed(true)
    const handleRefresh = () => {
      void loadFeed(true)
    }
    window.addEventListener('mhv-notification-feed-refresh', handleRefresh)
    return () => window.removeEventListener('mhv-notification-feed-refresh', handleRefresh)
  }, [loadFeed])

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!actionMenuRef.current?.contains(event.target)) {
        setShowActionMenu(false)
        setShowNotificationDropdown(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    return () => window.removeEventListener('mousedown', handlePointerDown)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const handleInstallPwa = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    if (choice?.outcome === 'accepted') {
      setShowInstallPrompt(false)
      setDeferredPrompt(null)
    }
  }

  const markNotificationAsRead = useCallback(async (notification) => {
    if (!notification?.id || notification.isRead) return
    if (readingNotificationIdsRef.current.has(notification.id)) return
    readingNotificationIdsRef.current.add(notification.id)
    try {
      await axiosClient.post(`/api/notifications/${notification.id}/read`)
      setUnreadNotificationCount((prev) => (prev > 0 ? prev - 1 : 0))
      setNotifications((prev) =>
        prev.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item)),
      )
    } finally {
      readingNotificationIdsRef.current.delete(notification.id)
    }
  }, [])

  return (
    <div className="brand-theme mx-auto min-h-[100dvh] w-full max-w-md bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header
        className="sticky top-0 z-30 border-b px-4 py-3 text-white shadow"
        style={{ backgroundColor: primaryColor, borderColor: toRgba(primaryColor, 0.28) }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 pt-1">
            <h1 className="text-[13px] font-medium uppercase tracking-[0.08em] text-white/75">Kỹ thuật viên hiện trường</h1>
            <p className="mt-1 truncate text-[1.7rem] font-semibold leading-none">{user?.fullName || user?.username || 'TechSupport'}</p>
            <UserTimeClock
              compact
              minimal
              light
              showTimeZone={false}
              className="mt-3 inline-flex shrink-0 border-white/15 bg-white/12"
            />
          </div>
          <div ref={actionMenuRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => {
                setShowActionMenu((prev) => {
                  const next = !prev
                  if (!next) {
                    setShowNotificationDropdown(false)
                  }
                  return next
                })
              }}
              aria-label="Mở menu tác vụ"
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/12 p-2 hover:bg-white/25"
            >
              <Menu2 size={18} />
              {unreadChatCount + unreadNotificationCount > 0 && (
                <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1 text-center text-[10px] font-semibold text-white">
                  {unreadChatCount + unreadNotificationCount > 99 ? '99+' : unreadChatCount + unreadNotificationCount}
                </span>
              )}
            </button>
            {showActionMenu && (
              <div className="absolute right-0 top-full z-[125] mt-2 w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border border-blue-100 bg-white p-2 text-slate-700 shadow-xl dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
                <ThemeToggle className="w-full justify-start rounded-xl border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700" />
                <button
                  type="button"
                  onClick={() => {
                    const nextValue = !showNotificationDropdown
                    setShowNotificationDropdown(nextValue)
                    if (nextValue) {
                      void loadFeed(true)
                    }
                  }}
                  className="relative mt-2 flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                >
                  <span className="inline-flex items-center gap-2">
                    <Bell size={16} />
                    Thông báo
                  </span>
                  {unreadChatCount + unreadNotificationCount > 0 && (
                    <span className="min-w-5 rounded-full bg-red-600 px-1.5 text-center text-[10px] font-semibold text-white">
                      {unreadChatCount + unreadNotificationCount > 99 ? '99+' : unreadChatCount + unreadNotificationCount}
                    </span>
                  )}
                </button>
                {showNotificationDropdown && (
                  <div className="mt-2 overflow-hidden rounded-xl border border-blue-100 bg-white dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex items-center justify-between border-b border-blue-100 px-3 py-2 dark:border-slate-800">
                      <p className="text-sm font-semibold">Thông báo</p>
                      <button
                        type="button"
                        onClick={() => {
                          setChatNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })))
                          setUnreadChatCount(0)
                          setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })))
                          setUnreadNotificationCount(0)
                          void axiosClient.post('/api/notifications/read-all')
                        }}
                        className="text-[11px] font-semibold"
                        style={{ color: primaryColor }}
                      >
                        Đánh dấu tất cả
                      </button>
                    </div>
                    <div className="max-h-[min(24rem,calc(100dvh-8rem))] overflow-auto">
                      {chatNotifications.length === 0 && notifications.length === 0 && (
                        <p className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">Chưa có thông báo.</p>
                      )}
                      {notifications.length > 0 && (
                        <div className="border-b border-blue-100 px-3 py-2 dark:border-slate-800">
                          <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">Thông báo hệ thống</p>
                        </div>
                      )}
                      {notifications.map((notification) => (
                        <button
                          key={notification.id}
                          type="button"
                          onMouseEnter={() => {
                            void markNotificationAsRead(notification)
                          }}
                          onClick={async () => {
                            await markNotificationAsRead(notification)
                            setShowNotificationDropdown(false)
                            setShowActionMenu(false)
                            navigate(notification.linkPath || '/tech-mobile/tickets')
                          }}
                          className={`block w-full border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-orange-50 dark:border-slate-800 dark:hover:bg-orange-500/10 ${
                            notification.isRead ? 'text-slate-600 dark:text-slate-300' : 'font-semibold text-slate-800 dark:text-slate-100'
                          }`}
                        >
                          <p>{notification.title}</p>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{notification.message}</p>
                          <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                            {formatVietnamDateTime(notification.occurredAt, 'Vừa xong')}
                          </p>
                        </button>
                      ))}
                      {chatNotifications.length > 0 && (
                        <div className="border-b border-blue-100 px-3 py-2 dark:border-slate-800">
                          <p className="text-xs font-semibold text-orange-700 dark:text-orange-300">Tin nhắn mới</p>
                        </div>
                      )}
                      {chatNotifications.map((notification) => (
                        <button
                          key={notification.id}
                          type="button"
                          onClick={() => {
                            setChatNotifications((prev) =>
                              prev.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item)),
                            )
                            setUnreadChatCount((prev) => (prev > 0 ? prev - 1 : 0))
                            setShowNotificationDropdown(false)
                            setShowActionMenu(false)
                            navigate(notification.ticketPath)
                          }}
                          className={`block w-full border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-orange-50 dark:border-slate-800 dark:hover:bg-orange-500/10 ${
                            notification.isRead ? 'text-slate-600 dark:text-slate-300' : 'font-semibold text-slate-800 dark:text-slate-100'
                          }`}
                        >
                          <p>Tin nhắn từ {notification.senderName}</p>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{notification.messagePreview}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-2 inline-flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                >
                  <LogOut size={16} />
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="px-4 pb-24 pt-5">
        {showInstallPrompt && (
          <div className="mb-4 rounded-2xl border border-blue-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-100">Cài app lên màn hình chính để nhận việc và chat nhanh hơn.</p>
            <button
              type="button"
              onClick={handleInstallPwa}
              className="mt-2 rounded-md px-3 py-2 text-xs font-semibold text-white"
              style={{ backgroundColor: primaryColor }}
            >
              Thêm vào màn hình chính
            </button>
          </div>
        )}
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 mx-auto flex w-full max-w-md border-t border-slate-200 bg-white shadow-[0_-8px_24px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium transition ${
                isActive ? 'dark:text-slate-100' : 'text-slate-500 hover:bg-orange-50 hover:text-fptOrangeDark dark:text-slate-400 dark:hover:bg-orange-500/10 dark:hover:text-orange-300'
              }`
            }
            style={({ isActive }) => (isActive ? { backgroundColor: toRgba(primaryColor, 0.1), color: primaryColor } : undefined)}
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export default MobileTechSupportLayout
