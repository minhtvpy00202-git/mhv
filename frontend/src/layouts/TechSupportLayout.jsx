import { Bell, ClipboardList, LogOut, MessageCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { to: '/tech/tickets', label: 'Ticket hỗ trợ', icon: ClipboardList },
  { to: '/tech/chats', label: 'Trao đổi sự cố', icon: MessageCircle },
]

function TechSupportLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [chatNotifications, setChatNotifications] = useState([])
  const [unreadChatCount, setUnreadChatCount] = useState(0)
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false)

  useEffect(() => {
    const loadFeed = async () => {
      try {
        const response = await axiosClient.get('/api/notifications')
        setNotifications(response.data?.items || [])
        setUnreadCount(response.data?.unreadCount || 0)
      } catch (error) {
        const message = error?.response?.data?.message || 'Không tải được thông báo.'
        toast.error(message)
      }
    }
    loadFeed()
    const timer = setInterval(loadFeed, 20000)
    return () => clearInterval(timer)
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
    try {
      await axiosClient.post(`/api/notifications/${notification.id}/read`)
      setUnreadCount((prev) => (prev > 0 ? prev - 1 : 0))
      setNotifications((prev) =>
        prev.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item)),
      )
    } catch {}
    setShowNotificationDropdown(false)
    navigate(notification.linkPath)
  }

  const handleOpenChatNotification = (notification) => {
    setChatNotifications((prev) =>
      prev.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item)),
    )
    setUnreadChatCount((prev) => (prev > 0 ? prev - 1 : 0))
    setShowNotificationDropdown(false)
    navigate(notification.ticketPath)
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="hidden w-64 flex-col bg-white p-4 shadow md:flex">
        <div className="rounded-lg bg-blue-600 px-4 py-3 text-white">
          <h1 className="text-lg font-semibold">Tech Support</h1>
        </div>
        <nav className="mt-4 space-y-2">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
                }`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between bg-white px-4 py-3 shadow-sm md:px-6">
          <div>
            <p className="text-sm text-slate-500">Kỹ thuật viên hỗ trợ</p>
            <p className="font-semibold text-slate-800">{user?.username || 'TechSupport'}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotificationDropdown((prev) => !prev)}
                className="relative inline-flex items-center rounded-lg border border-slate-300 p-2 text-slate-700 hover:bg-slate-50"
              >
                <Bell size={18} />
                {unreadCount + unreadChatCount > 0 && (
                  <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1 text-center text-xs font-semibold text-white">
                    {unreadCount + unreadChatCount > 99 ? '99+' : unreadCount + unreadChatCount}
                  </span>
                )}
              </button>
              {showNotificationDropdown && (
                <div className="absolute right-0 z-20 mt-2 w-80 rounded-lg border border-slate-200 bg-white shadow-lg">
                  <div className="border-b border-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
                    Thông báo
                  </div>
                  <div className="max-h-96 overflow-auto">
                    {chatNotifications.map((notification) => (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() => handleOpenChatNotification(notification)}
                        className={`block w-full border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-emerald-50 ${
                          notification.isRead ? 'text-slate-600' : 'font-semibold text-slate-800'
                        }`}
                      >
                        <p>💬 Tin nhắn mới từ {notification.senderName}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{notification.messagePreview}</p>
                      </button>
                    ))}
                    {notifications.length === 0 && chatNotifications.length === 0 && (
                      <p className="px-3 py-2 text-sm text-slate-500">Chưa có thông báo.</p>
                    )}
                    {notifications.map((notification) => (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() => handleOpenNotification(notification)}
                        className={`block w-full border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-blue-50 ${
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
              onClick={handleLogout}
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

export default TechSupportLayout
