import { Navigate, Route, Routes } from 'react-router-dom'
import GlobalNotification from './components/GlobalNotification'
import { useAuth } from './context/AuthContext'
import AdminLayout from './layouts/AdminLayout'
import ConsumableManagerLayout from './layouts/ConsumableManagerLayout'
import MobileLayout from './layouts/MobileLayout'
import MobileTechSupportLayout from './layouts/MobileTechSupportLayout'
import TechSupportLayout from './layouts/TechSupportLayout'
import Home from './pages/Home'
import InventoryAuditScanner from './pages/InventoryAuditScanner'
import Login from './pages/Login'
import MaintenanceReport from './pages/MaintenanceReport'
import MobileChatDetail from './pages/MobileChatDetail'
import MobileChats from './pages/MobileChats'
import QRScanner from './pages/QRScanner'
import Register from './pages/Register'
import TicketDetail from './pages/TicketDetail'
import TicketSatisfactionReview from './pages/TicketSatisfactionReview'
import Unauthorized from './pages/Unauthorized'
import AssetManagement from './pages/admin/AssetManagement'
import CategoryManagement from './pages/admin/CategoryManagement'
import Dashboard from './pages/admin/Dashboard'
import InventoryAuditManagement from './pages/admin/InventoryAuditManagement'
import LocationManagement from './pages/admin/LocationManagement'
import NotificationDetail from './pages/admin/NotificationDetail'
import SupplierManagement from './pages/admin/SupplierManagement'
import TechSupportTypeManagement from './pages/admin/TechSupportTypeManagement'
import TicketManagement from './pages/admin/TicketManagement'
import UserManagement from './pages/admin/UserManagement'
import UsageHistoryManagement from './pages/admin/UsageHistoryManagement'
import MobileTechSupportChats from './pages/tech/MobileTechSupportChats'
import MobileTechSupportTickets from './pages/tech/MobileTechSupportTickets'
import TechSupportInventoryAuditHistory from './pages/tech/TechSupportInventoryAuditHistory'
import TechSupportChats from './pages/tech/TechSupportChats'
import TechSupportTickets from './pages/tech/TechSupportTickets'
import { getTechSupportHomePath } from './utils/navigation'

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

function App() {
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
          <Route path="/mobile/scan" element={<QRScanner />} />
          <Route path="/mobile/chats" element={<MobileChats />} />
          <Route path="/mobile/chats/:ticketId" element={<MobileChatDetail />} />
          <Route path="/mobile/maintenance" element={<MaintenanceReport />} />
          <Route path="/mobile/tickets/:ticketId" element={<TicketDetail />} />
          <Route path="/mobile/tickets/:ticketId/review" element={<TicketSatisfactionReview />} />
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
          <Route path="/tech/chats" element={<TechSupportChats />} />
          <Route path="/tech/inventory-audits" element={<InventoryAuditScanner />} />
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
          <Route path="/tech-mobile/chats" element={<MobileTechSupportChats />} />
          <Route path="/tech-mobile/inventory-audits" element={<InventoryAuditScanner />} />
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
          <Route path="/admin/dashboard" element={<Dashboard />} />
          <Route path="/admin/assets" element={<AssetManagement />} />
          <Route path="/admin/suppliers" element={<SupplierManagement />} />
          <Route path="/admin/categories" element={<CategoryManagement />} />
          <Route path="/admin/locations" element={<LocationManagement />} />
          <Route path="/admin/tech-support-types" element={<TechSupportTypeManagement />} />
          <Route path="/admin/usage-history" element={<UsageHistoryManagement />} />
          <Route path="/admin/maintenance-history" element={<Navigate to="/admin/tickets" replace />} />
          <Route path="/admin/inventory-audits" element={<InventoryAuditManagement />} />
          <Route path="/admin/users" element={<UserManagement />} />
          <Route path="/admin/notifications/:id" element={<NotificationDetail />} />
          <Route path="/admin/tickets" element={<TicketManagement />} />
          <Route path="/admin/tickets/:ticketId" element={<TicketDetail />} />
          <Route path="/admin/tickets/:ticketId/review" element={<TicketSatisfactionReview />} />
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
          <Route path="/supply/consumables" element={<AssetManagement restrictToConsumable />} />
          <Route path="/supply/notifications/:id" element={<NotificationDetail />} />
        </Route>
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </>
  )
}

export default App
