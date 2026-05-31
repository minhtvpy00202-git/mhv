import { Suspense, lazy, useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import GlobalNotification from './components/GlobalNotification'
import { useAuth } from './context/AuthContext'
import { useBranding } from './context/BrandingContext'
import AdminLayout from './layouts/AdminLayout'
import ConsumableManagerLayout from './layouts/ConsumableManagerLayout'
import MobileLayout from './layouts/MobileLayout'
import MobileTechSupportLayout from './layouts/MobileTechSupportLayout'
import TechSupportLayout from './layouts/TechSupportLayout'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import TicketDetail from './pages/TicketDetail'
import Unauthorized from './pages/Unauthorized'
import MobileTechSupportTickets from './pages/tech/MobileTechSupportTickets'
import TechSupportInventoryAuditHistory from './pages/tech/TechSupportInventoryAuditHistory'
import TechSupportTickets from './pages/tech/TechSupportTickets'
import { getTechSupportHomePath } from './utils/navigation'

const QRScanner = lazy(() => import('./pages/QRScanner'))
const MaintenanceReport = lazy(() => import('./pages/MaintenanceReport'))
const InventoryAuditScanner = lazy(() => import('./pages/InventoryAuditScanner'))
const MobileChats = lazy(() => import('./pages/MobileChats'))
const MobileChatDetail = lazy(() => import('./pages/MobileChatDetail'))
const TechSupportChats = lazy(() => import('./pages/tech/TechSupportChats'))
const MobileTechSupportChats = lazy(() => import('./pages/tech/MobileTechSupportChats'))
const TicketSatisfactionReview = lazy(() => import('./pages/TicketSatisfactionReview'))
const Dashboard = lazy(() => import('./pages/admin/Dashboard'))
const AssetManagement = lazy(() => import('./pages/admin/AssetManagement'))
const SupplierManagement = lazy(() => import('./pages/admin/SupplierManagement'))
const CategoryManagement = lazy(() => import('./pages/admin/CategoryManagement'))
const LocationManagement = lazy(() => import('./pages/admin/LocationManagement'))
const TechSupportTypeManagement = lazy(() => import('./pages/admin/TechSupportTypeManagement'))
const UsageHistoryManagement = lazy(() => import('./pages/admin/UsageHistoryManagement'))
const InventoryAuditManagement = lazy(() => import('./pages/admin/InventoryAuditManagement'))
const UserManagement = lazy(() => import('./pages/admin/UserManagement'))
const NotificationDetail = lazy(() => import('./pages/admin/NotificationDetail'))
const TicketManagement = lazy(() => import('./pages/admin/TicketManagement'))
const BrandingSettings = lazy(() => import('./pages/admin/BrandingSettings'))

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return children
}

function RoleRoute({ allowRoles, children }) {
  const { user } = useAuth()
  if (!allowRoles.includes(user?.role)) {
    return <Navigate to="/403" replace />
  }
  return children
}

function RootRedirect() {
  const { isAuthenticated, user } = useAuth()
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  if (user?.role === 'Admin') {
    return <Navigate to="/admin/dashboard" replace />
  }
  if (user?.role === 'TechSupport') {
    return <Navigate to={getTechSupportHomePath()} replace />
  }
  if (user?.role === 'ConsumableManager') {
    return <Navigate to="/supply/consumables" replace />
  }
  return <Navigate to="/mobile/home" replace />
}

function RouteFallback() {
  return (
    <div className="p-4">
      <div className="rounded-2xl bg-white px-4 py-6 text-center text-sm text-slate-500 shadow-sm">
        Đang tải màn hình...
      </div>
    </div>
  )
}

function withSuspense(element) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>
}

function App() {
  const { branding } = useBranding()

  useEffect(() => {
    document.title = `${branding.companyName} ${branding.appName}`.trim()
  }, [branding.appName, branding.companyName])

  return (
    <>
      <GlobalNotification />
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/403" element={<Unauthorized />} />

        <Route
          element={(
            <ProtectedRoute>
              <RoleRoute allowRoles={['NhanVien']}>
                <MobileLayout />
              </RoleRoute>
            </ProtectedRoute>
          )}
        >
          <Route path="/mobile/home" element={<Home />} />
          <Route path="/mobile/scan" element={withSuspense(<QRScanner />)} />
          <Route path="/mobile/chats" element={withSuspense(<MobileChats />)} />
          <Route path="/mobile/chats/:ticketId" element={withSuspense(<MobileChatDetail />)} />
          <Route path="/mobile/maintenance" element={withSuspense(<MaintenanceReport />)} />
          <Route path="/mobile/tickets/:ticketId" element={<TicketDetail />} />
          <Route path="/mobile/tickets/:ticketId/review" element={withSuspense(<TicketSatisfactionReview />)} />
        </Route>

        <Route
          element={(
            <ProtectedRoute>
              <RoleRoute allowRoles={['TechSupport']}>
                <TechSupportLayout />
              </RoleRoute>
            </ProtectedRoute>
          )}
        >
          <Route path="/tech/tickets" element={<TechSupportTickets />} />
          <Route path="/tech/chats" element={withSuspense(<TechSupportChats />)} />
          <Route path="/tech/inventory-audits" element={withSuspense(<InventoryAuditScanner />)} />
          <Route path="/tech/inventory-audits/history" element={<TechSupportInventoryAuditHistory />} />
          <Route path="/tech/tickets/:ticketId" element={<TicketDetail />} />
        </Route>

        <Route
          element={(
            <ProtectedRoute>
              <RoleRoute allowRoles={['TechSupport']}>
                <MobileTechSupportLayout />
              </RoleRoute>
            </ProtectedRoute>
          )}
        >
          <Route path="/tech-mobile/tickets" element={<MobileTechSupportTickets />} />
          <Route path="/tech-mobile/chats" element={withSuspense(<MobileTechSupportChats />)} />
          <Route path="/tech-mobile/inventory-audits" element={withSuspense(<InventoryAuditScanner />)} />
          <Route path="/tech-mobile/inventory-audits/history" element={<TechSupportInventoryAuditHistory />} />
          <Route path="/tech-mobile/tickets/:ticketId" element={<TicketDetail />} />
        </Route>

        <Route
          element={(
            <ProtectedRoute>
              <RoleRoute allowRoles={['Admin']}>
                <AdminLayout />
              </RoleRoute>
            </ProtectedRoute>
          )}
        >
          <Route path="/admin/dashboard" element={withSuspense(<Dashboard />)} />
          <Route path="/admin/assets" element={withSuspense(<AssetManagement />)} />
          <Route path="/admin/suppliers" element={withSuspense(<SupplierManagement />)} />
          <Route path="/admin/categories" element={withSuspense(<CategoryManagement />)} />
          <Route path="/admin/locations" element={withSuspense(<LocationManagement />)} />
          <Route path="/admin/tech-support-types" element={withSuspense(<TechSupportTypeManagement />)} />
          <Route path="/admin/usage-history" element={withSuspense(<UsageHistoryManagement />)} />
          <Route path="/admin/maintenance-history" element={<Navigate to="/admin/tickets" replace />} />
          <Route path="/admin/inventory-audits" element={withSuspense(<InventoryAuditManagement />)} />
          <Route path="/admin/users" element={withSuspense(<UserManagement />)} />
          <Route path="/admin/branding" element={withSuspense(<BrandingSettings />)} />
          <Route path="/admin/notifications/:id" element={withSuspense(<NotificationDetail />)} />
          <Route path="/admin/tickets" element={withSuspense(<TicketManagement />)} />
          <Route path="/admin/tickets/:ticketId" element={<TicketDetail />} />
          <Route path="/admin/tickets/:ticketId/review" element={withSuspense(<TicketSatisfactionReview />)} />
        </Route>

        <Route
          element={(
            <ProtectedRoute>
              <RoleRoute allowRoles={['ConsumableManager']}>
                <ConsumableManagerLayout />
              </RoleRoute>
            </ProtectedRoute>
          )}
        >
          <Route path="/supply/consumables" element={withSuspense(<AssetManagement restrictToConsumable />)} />
          <Route path="/supply/notifications/:id" element={withSuspense(<NotificationDetail />)} />
        </Route>
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </>
  )
}

export default App
