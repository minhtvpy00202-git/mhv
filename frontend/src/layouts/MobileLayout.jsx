import { ClipboardCheck, Home, LogOut, QrCode, Wrench } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { to: '/mobile/home', label: 'Home', icon: Home },
  { to: '/mobile/scan', label: 'Quét QR', icon: QrCode },
  { to: '/mobile/maintenance', label: 'Báo hỏng', icon: Wrench },
  { to: '/mobile/inventory-audit', label: 'Kiểm kê', icon: ClipboardCheck },
]

function MobileLayout() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)

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

  return (
    <div className="mx-auto min-h-screen w-full max-w-md bg-slate-50">
      <header className="sticky top-0 z-10 flex items-center justify-between bg-fptOrange px-4 py-3 text-white shadow">
        <h1 className="text-lg font-semibold">FPT Infrastructure</h1>
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center gap-1 rounded-md bg-white/15 px-2 py-1 text-xs font-semibold hover:bg-white/25"
        >
          <LogOut size={14} />
          Đăng xuất
        </button>
      </header>

      <main className="px-4 pb-24 pt-4">
        {showInstallPrompt && (
          <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 p-3">
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

      <nav className="fixed bottom-0 left-0 right-0 mx-auto flex w-full max-w-md border-t border-slate-200 bg-white">
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
