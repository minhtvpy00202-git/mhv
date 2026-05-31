import {
  IconBell as Bell,
  IconChecklist as ClipboardCheck,
  IconClipboardList as ClipboardList,
  IconHistory as History,
  IconLogout as LogOut,
  IconSearch as Search,
} from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'
import ThemeToggle from '../components/ThemeToggle'
import { useAuth } from '../context/AuthContext'
import { useBranding } from '../context/BrandingContext'
import { normalizeHexColor, toRgba } from '../utils/brandingTheme'
import { isNarrowViewport, toTechSupportMobilePath } from '../utils/navigation'

const navItems = [
  { to: '/tech/tickets', label: 'Danh sách Ticket', icon: ClipboardList },
  { to: '/tech/inventory-audits', label: 'Kiểm kê thiết bị', icon: ClipboardCheck, end: true },
  { to: '/tech/inventory-audits/history', label: 'Lịch sử kiểm kê', icon: History, end: true },
]

function isDeviceFailureNotification(notification) {
  return notification?.eventType === 'TICKET_CREATED'
}

function extractTicketIdFromLink(linkPath) {
  if (!linkPath) return null
  const match = String(linkPath).match(/\/tickets\/(\d+)/)
  return match?.[1] ? Number(match[1]) : null
}

function TechSupportLayout() {
  const { user, logout } = useAuth()
  const { branding } = useBranding()
  const primaryColor = normalizeHexColor(branding.primaryColor)
  const navigate = useNavigate()
  const location = useLocation()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [chatNotifications, setChatNotifications] = useState([])
  const [unreadChatCount, setUnreadChatCount] = useState(0)
  const [contactTickets, setContactTickets] = useState([])
  const [chatKeyword, setChatKeyword] = useState('')
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false)
  const readingNotificationIdsRef = useRef(new Set())

  useEffect(() => {
    const syncViewportRoute = () => {
      if (!isNarrowViewport()) return
      const targetPath = toTechSupportMobilePath(location.pathname)
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
    if (!contactTickets.length) return
    const allowedTicketIds = new Set((contactTickets || []).map((item) => Number(item.id)))
    const loadFeed = async () => {
      if (document.hidden) return
      try {
        const response = await axiosClient.get('/api/notifications')
        const filteredItems = (response.data?.items || [])
          .filter(isDeviceFailureNotification)
          .filter((item) => {
            const ticketId = extractTicketIdFromLink(item.linkPath)
            return ticketId != null && allowedTicketIds.has(ticketId)
          })
        setNotifications(filteredItems)
        setUnreadCount(filteredItems.filter((item) => !item.isRead).length)
      } catch (error) {
        const message = error?.response?.data?.message || 'Không tải được thông báo.'
        toast.error(message)
      }
    }
    loadFeed()
    const timer = setInterval(loadFeed, 20000)
    return () => clearInterval(timer)
  }, [contactTickets])

  useEffect(() => {
    const loadContactTickets = async () => {
      if (document.hidden) return
      try {
        const response = await axiosClient.get('/api/tickets', {
          params: { assignee_id: user?.userId },
        })
        const items = response.data || []
        setContactTickets(items)
      } catch {
        // Ignore transient polling failures for assigned tickets.
      }
    }
    loadContactTickets()
    const timer = setInterval(loadContactTickets, 15000)
    return () => clearInterval(timer)
  }, [user?.userId])

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
            ticketPath: payload.ticketPath || `/tech/tickets/${payload.ticketId}`,
            ticketId: payload.ticketId,
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

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const handleOpenNotification = async (notification) => {
    await markNotificationAsRead(notification)
    setShowNotificationDropdown(false)
    navigate(notification.linkPath)
  }

  const markNotificationAsRead = async (notification) => {
    if (!notification?.id || notification.isRead) return
    if (readingNotificationIdsRef.current.has(notification.id)) return
    readingNotificationIdsRef.current.add(notification.id)
    try {
      await axiosClient.post(`/api/notifications/${notification.id}/read`)
      setUnreadCount((prev) => (prev > 0 ? prev - 1 : 0))
      setNotifications((prev) =>
        prev.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item)),
      )
    } catch {
      // Ignore hover mark-as-read failures and keep the dropdown usable.
    } finally {
      readingNotificationIdsRef.current.delete(notification.id)
    }
  }

  const handleOpenChatNotification = (notification) => {
    setChatNotifications((prev) =>
      prev.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item)),
    )
    setUnreadChatCount((prev) => (prev > 0 ? prev - 1 : 0))
    setShowNotificationDropdown(false)
    navigate(notification.ticketPath)
  }

  const handleMarkAllRead = async () => {
    const unreadNotificationIds = notifications.filter((item) => !item.isRead).map((item) => item.id)
    try {
      await Promise.all(unreadNotificationIds.map((id) => axiosClient.post(`/api/notifications/${id}/read`)))
    } catch {
      // Ignore mark-all-read failures and keep local UI responsive.
    }
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })))
    setUnreadCount(0)
    setChatNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })))
    setUnreadChatCount(0)
  }

  return (
    <div className="brand-theme flex min-h-[100dvh] bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <aside className="hidden w-72 flex-col border-r border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/80 md:flex">
        <div
          className="rounded-2xl px-4 py-4 text-white shadow-sm ring-1"
          style={{ backgroundColor: primaryColor, boxShadow: `0 0 0 1px ${toRgba(primaryColor, 0.22)}` }}
        >
          <h1 className="text-lg font-semibold">{branding.techTitle}</h1>
        </div>
        <nav className="mt-4 space-y-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {navItems.map((item) => {
            const NavIcon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive ? 'text-slate-900 dark:text-slate-100' : 'text-slate-600 hover:bg-orange-50 hover:text-fptOrangeDark dark:text-slate-300 dark:hover:bg-orange-500/10 dark:hover:text-orange-300'
                  }`
                }
                style={({ isActive }) => (isActive ? { backgroundColor: toRgba(primaryColor, 0.1), color: primaryColor } : undefined)}
              >
                <NavIcon size={18} />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>
        <div className="mt-5 min-h-0 flex-1 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 border-b border-slate-200 px-1 pb-3 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:text-slate-100">Danh sách chat</h3>
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 dark:border-slate-700 dark:bg-slate-800">
            <Search size={14} className="text-slate-500 dark:text-slate-400" />
            <input
              value={chatKeyword}
              onChange={(event) => setChatKeyword(event.target.value)}
              placeholder="Tìm ticket/thiết bị..."
              className="w-full bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>
          <div className="max-h-[calc(100dvh-280px)] space-y-1 overflow-auto">
            {contactTickets
              .filter((ticket) => {
                const keyword = chatKeyword.trim().toLowerCase()
                if (!keyword) return true
                const searchable = `${ticket.id} ${ticket.assetName || ''} ${ticket.assetQaCode || ''} ${ticket.reporterName || ''}`.toLowerCase()
                return searchable.includes(keyword)
              })
              .map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => navigate(`/tech/tickets/${ticket.id}`)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-orange-50 dark:hover:bg-orange-500/10"
                >
                  <div
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                    style={{ backgroundColor: toRgba(primaryColor, 0.12), color: primaryColor }}
                  >
                    {(ticket.reporterName || 'U').slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{ticket.reporterName || `User #${ticket.reporterId}`}</p>
                    <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">#{ticket.id} - {ticket.assetName || ticket.assetQaCode}</p>
                  </div>
                </button>
              ))}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 md:px-6">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Kỹ thuật viên hỗ trợ</p>
            <p className="font-semibold text-slate-800 dark:text-slate-100">{user?.fullName || user?.username || 'TechSupport'}</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle compact />
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotificationDropdown((prev) => !prev)}
                className="relative inline-flex items-center rounded-lg border border-slate-300 p-2 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Bell size={18} />
                {unreadCount + unreadChatCount > 0 && (
                  <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1 text-center text-xs font-semibold text-white">
                    {unreadCount + unreadChatCount > 99 ? '99+' : unreadCount + unreadChatCount}
                  </span>
                )}
              </button>
              {showNotificationDropdown && (
                <div className="absolute right-0 z-20 mt-2 w-80 rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-slate-800">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">Thông báo</p>
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="text-xs font-semibold hover:opacity-80"
                      style={{ color: primaryColor }}
                    >
                      Đánh dấu tất cả là đã đọc
                    </button>
                  </div>
                  <div className="max-h-96 overflow-auto">
                    {chatNotifications.map((notification) => (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() => handleOpenChatNotification(notification)}
                        className={`block w-full border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-orange-50 dark:border-slate-800 dark:hover:bg-orange-500/10 ${
                          notification.isRead ? 'text-slate-600 dark:text-slate-300' : 'font-semibold text-slate-800 dark:text-slate-100'
                        }`}
                      >
                        <p>Tin nhắn mới từ {notification.senderName}</p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{notification.messagePreview}</p>
                      </button>
                    ))}
                    {notifications.length === 0 && chatNotifications.length === 0 && (
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
              onClick={handleLogout}
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

export default TechSupportLayout
