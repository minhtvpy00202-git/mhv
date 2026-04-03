import { Navigate, Route, Routes } from 'react-router-dom'
import GlobalNotification from './components/GlobalNotification'
import { useAuth } from './context/AuthContext'
import AdminLayout from './layouts/AdminLayout'
import MobileLayout from './layouts/MobileLayout'
import TechSupportLayout from './layouts/TechSupportLayout'
import Home from './pages/Home'
import InventoryAuditScanner from './pages/InventoryAuditScanner'
import Login from './pages/Login'
import MaintenanceReport from './pages/MaintenanceReport'
import MobileChats from './pages/MobileChats'
import QRScanner from './pages/QRScanner'
import Register from './pages/Register'
import TicketDetail from './pages/TicketDetail'
import Unauthorized from './pages/Unauthorized'
import AssetManagement from './pages/admin/AssetManagement'
import Dashboard from './pages/admin/Dashboard'
import InventoryAuditManagement from './pages/admin/InventoryAuditManagement'
import MaintenanceHistoryManagement from './pages/admin/MaintenanceHistoryManagement'
import NotificationDetail from './pages/admin/NotificationDetail'
import TicketManagement from './pages/admin/TicketManagement'
import UserManagement from './pages/admin/UserManagement'
import UsageHistoryManagement from './pages/admin/UsageHistoryManagement'
import TechSupportChats from './pages/tech/TechSupportChats'
import TechSupportTickets from './pages/tech/TechSupportTickets'

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
    return <Navigate to="/tech/tickets" replace />
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
          <Route path="/mobile/maintenance" element={<MaintenanceReport />} />
          <Route path="/mobile/inventory-audit" element={<InventoryAuditScanner />} />
          <Route path="/mobile/tickets/:ticketId" element={<TicketDetail />} />
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
          <Route path="/tech/tickets/:ticketId" element={<TicketDetail />} />
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
          <Route path="/admin/usage-history" element={<UsageHistoryManagement />} />
          <Route path="/admin/maintenance-history" element={<MaintenanceHistoryManagement />} />
          <Route path="/admin/inventory-audits" element={<InventoryAuditManagement />} />
          <Route path="/admin/users" element={<UserManagement />} />
          <Route path="/admin/notifications/:id" element={<NotificationDetail />} />
          <Route path="/admin/tickets" element={<TicketManagement />} />
          <Route path="/admin/tickets/:ticketId" element={<TicketDetail />} />
        </Route>
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </>
  )
}

export default App
