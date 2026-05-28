import { Bell, Home, LogOut, MessageCircle, QrCode, Star, Wrench } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import axiosClient from '../api/axiosClient'
import { useAuth } from '../context/AuthContext'
import { formatVietnamDateTime } from '../utils/datetime'

const navItems = [
  { to: '/mobile/home', label: 'Home', icon: Home },
  { to: '/mobile/scan', label: 'Quét QR', icon: QrCode },
  { to: '/mobile/chats', label: 'Chat', icon: MessageCircle },
  { to: '/mobile/maintenance', label: 'Báo hỏng', icon: Wrench },
]

function MobileLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [chatNotifications, setChatNotifications] = useState([])
  const [unreadChatCount, setUnreadChatCount] = useState(0)
  const [pendingRatings, setPendingRatings] = useState([])
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false)

  const loadPendingRatings = useCallback(async () => {
    if (user?.role !== 'NhanVien') return
    try {
      const response = await axiosClient.get('/api/tickets/pending-satisfaction/me')
      setPendingRatings(response.data || [])
    } catch {
      setPendingRatings([])
    }
  }, [user?.role])

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
            ticketPath: payload.ticketPath || `/mobile/tickets/${payload.ticketId}`,
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
    void loadPendingRatings()
    const handleRefresh = () => {
      void loadPendingRatings()
    }
    window.addEventListener('mhv-notification-feed-refresh', handleRefresh)
    return () => window.removeEventListener('mhv-notification-feed-refresh', handleRefresh)
  }, [loadPendingRatings])

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

  const totalAttentionCount = unreadChatCount + pendingRatings.length
  const hasNotifications = pendingRatings.length > 0 || chatNotifications.length > 0
  const latestChatNotifications = useMemo(() => chatNotifications.slice(0, 8), [chatNotifications])

  return (
    <div className="mx-auto min-h-screen w-full max-w-md bg-slate-100">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-orange-200 bg-fptOrange px-4 py-3 text-white shadow">
        <div>
          <h1 className="text-sm font-medium text-white/90">Nhân viên</h1>
          <p className="text-base font-semibold">{user?.fullName || user?.username || 'FPT Infrastructure'}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                const nextValue = !showNotificationDropdown
                setShowNotificationDropdown(nextValue)
                if (nextValue) {
                  void loadPendingRatings()
                }
              }}
              className="relative inline-flex items-center rounded-md bg-white/15 p-2 hover:bg-white/25"
            >
              <Bell size={14} />
              {totalAttentionCount > 0 && (
                <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1 text-center text-[10px] font-semibold text-white">
                  {totalAttentionCount > 99 ? '99+' : totalAttentionCount}
                </span>
              )}
            </button>
            {showNotificationDropdown && (
              <div className="absolute right-0 z-20 mt-2 w-80 rounded-2xl border border-orange-100 bg-white text-slate-700 shadow-lg">
                <div className="flex items-center justify-between border-b border-orange-100 px-3 py-2">
                  <p className="text-sm font-semibold">Việc cần chú ý</p>
                  <button
                    type="button"
                    onClick={() => {
                      setChatNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })))
                      setUnreadChatCount(0)
                    }}
                    className="text-[11px] font-semibold text-blue-600"
                  >
                    Đã đọc chat
                  </button>
                </div>
                <div className="max-h-80 overflow-auto">
                  {!hasNotifications && (
                    <p className="px-3 py-4 text-sm text-slate-500">Chưa có thông báo mới.</p>
                  )}
                  {pendingRatings.length > 0 && (
                    <div className="border-b border-orange-100 px-3 py-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">Cần đánh giá sau xử lý</p>
                    </div>
                  )}
                  {pendingRatings.map((ticket) => (
                    <button
                      key={`review-${ticket.id}`}
                      type="button"
                      onClick={() => {
                        setShowNotificationDropdown(false)
                        navigate(`/mobile/tickets/${ticket.id}/review`)
                      }}
                      className="block w-full border-b border-slate-100 px-3 py-3 text-left text-sm hover:bg-violet-50"
                    >
                      <div className="flex items-start gap-3">
                        <div className="rounded-xl bg-violet-100 p-2 text-violet-700">
                          <Star size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-800">Đánh giá ticket #{ticket.id}</p>
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {ticket.assetName || 'Thiết bị không xác định'} · {ticket.assetQaCode || '-'}
                          </p>
                          <p className="mt-1 text-xs text-slate-600">
                            Ticket đã hoàn tất lúc {formatVietnamDateTime(ticket.resolvedAt, 'gần đây')}.
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                  {latestChatNotifications.length > 0 && (
                    <div className="border-b border-orange-100 px-3 py-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">Tin nhắn mới</p>
                    </div>
                  )}
                  {latestChatNotifications.map((notification) => (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => {
                        setChatNotifications((prev) =>
                          prev.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item)),
                        )
                        setUnreadChatCount((prev) => (prev > 0 ? prev - 1 : 0))
                        setShowNotificationDropdown(false)
                        navigate(notification.ticketPath)
                      }}
                      className={`block w-full border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-orange-50 ${
                        notification.isRead ? 'text-slate-600' : 'font-semibold text-slate-800'
                      }`}
                    >
                      <p>💬 {notification.senderName}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{notification.messagePreview}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1 rounded-md bg-white/15 px-2 py-1 text-xs font-semibold hover:bg-white/25"
          >
            <LogOut size={14} />
            Đăng xuất
          </button>
        </div>
      </header>

      <main className="px-4 pb-24 pt-5">
        {showInstallPrompt && (
          <div className="mb-4 rounded-2xl border border-orange-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-slate-700">Cài app lên màn hình chính để quét QR nhanh hơn.</p>
            <button
              type="button"
              onClick={handleInstallPwa}
              className="mt-2 rounded-md bg-fptOrange px-3 py-2 text-xs font-semibold text-white hover:bg-fptOrangeDark"
            >
              Thêm vào màn hình chính
            </button>
          </div>
        )}
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 mx-auto flex w-full max-w-md border-t border-slate-200 bg-white shadow-[0_-8px_24px_rgba(15,23,42,0.06)]">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium transition ${
                isActive ? 'bg-orange-50 text-fptOrangeDark' : 'text-slate-500 hover:bg-orange-50 hover:text-fptOrange'
              }`
            }
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export default MobileLayout
