import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import AdminLayout from './layouts/AdminLayout'
import MobileLayout from './layouts/MobileLayout'
import Home from './pages/Home'
import InventoryAuditScanner from './pages/InventoryAuditScanner'
import Login from './pages/Login'
import MaintenanceReport from './pages/MaintenanceReport'
import QRScanner from './pages/QRScanner'
import Register from './pages/Register'
import Unauthorized from './pages/Unauthorized'
import AssetManagement from './pages/admin/AssetManagement'
import Dashboard from './pages/admin/Dashboard'
import InventoryAuditManagement from './pages/admin/InventoryAuditManagement'
import MaintenanceHistoryManagement from './pages/admin/MaintenanceHistoryManagement'
import NotificationDetail from './pages/admin/NotificationDetail'
import UserManagement from './pages/admin/UserManagement'
import UsageHistoryManagement from './pages/admin/UsageHistoryManagement'

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return children
}

function RoleRoute({ allowRole, children }) {
  const { user } = useAuth()
  if (user?.role !== allowRole) {
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
  return <Navigate to="/mobile/home" replace />
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/403" element={<Unauthorized />} />

      <Route
        element={(
          <ProtectedRoute>
            <RoleRoute allowRole="NhanVien">
              <MobileLayout />
            </RoleRoute>
          </ProtectedRoute>
        )}
      >
        <Route path="/mobile/home" element={<Home />} />
        <Route path="/mobile/scan" element={<QRScanner />} />
        <Route path="/mobile/maintenance" element={<MaintenanceReport />} />
        <Route path="/mobile/inventory-audit" element={<InventoryAuditScanner />} />
      </Route>

      <Route
        element={(
          <ProtectedRoute>
            <RoleRoute allowRole="Admin">
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
      </Route>
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  )
}

export default App
