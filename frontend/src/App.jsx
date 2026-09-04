import { Suspense, lazy, useEffect } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import GlobalNotification from './components/GlobalNotification'
import ModalOverlay from './components/ui/ModalOverlay'
import { useAuth } from './context/AuthContext'
import { useBranding } from './context/BrandingContext'
import AdminLayout from './layouts/AdminLayout'
import ConsumableManagerLayout from './layouts/ConsumableManagerLayout'
import MobileLayout from './layouts/MobileLayout'
import MobileTechSupportLayout from './layouts/MobileTechSupportLayout'
import TechSupportLayout from './layouts/TechSupportLayout'
import Home from './pages/Home'
import Login from './pages/Login'
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
const MobileConsumableRequests = lazy(() => import('./pages/MobileConsumableRequests'))
const InquiryInbox = lazy(() => import('./pages/InquiryInbox'))
const InquiryDetail = lazy(() => import('./pages/InquiryDetail'))
const InquiryReports = lazy(() => import('./pages/InquiryReports'))
const InquiryWorkflowSettings = lazy(() => import('./pages/admin/InquiryWorkflowSettings'))
const TechSupportChats = lazy(() => import('./pages/tech/TechSupportChats'))
const MobileTechSupportChats = lazy(() => import('./pages/tech/MobileTechSupportChats'))
const TicketSatisfactionReview = lazy(() => import('./pages/TicketSatisfactionReview'))
const Dashboard = lazy(() => import('./pages/admin/Dashboard'))
const AssetManagement = lazy(() => import('./pages/admin/AssetManagement'))
const AssetMapManagement = lazy(() => import('./pages/admin/AssetMapManagement'))
const AreaTypeCatalogManagement = lazy(() => import('./pages/admin/AreaTypeCatalogManagement'))
const SupplierManagement = lazy(() => import('./pages/admin/SupplierManagement'))
const CategoryManagement = lazy(() => import('./pages/admin/CategoryManagement'))
const LocationManagement = lazy(() => import('./pages/admin/LocationManagement'))
const TechSupportTypeManagement = lazy(() => import('./pages/admin/TechSupportTypeManagement'))
const AssetStatisticsManagement = lazy(() => import('./pages/admin/AssetStatisticsManagement'))
const UsageHistoryManagement = lazy(() => import('./pages/admin/UsageHistoryManagement'))
const BorrowRequestManagement = lazy(() => import('./pages/admin/BorrowRequestManagement'))
const BorrowRequestDetail = lazy(() => import('./pages/admin/BorrowRequestDetail'))
const InventoryAuditManagement = lazy(() => import('./pages/admin/InventoryAuditManagement'))
const UserManagement = lazy(() => import('./pages/admin/UserManagement'))
const NotificationDetail = lazy(() => import('./pages/admin/NotificationDetail'))
const TicketManagement = lazy(() => import('./pages/admin/TicketManagement'))
const BrandingSettings = lazy(() => import('./pages/admin/BrandingSettings'))
const SlaExtensionManagement = lazy(() => import('./pages/admin/SlaExtensionManagement'))


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
  const { sessionExpiredNoticeOpen, acknowledgeSessionExpired } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    document.title = `${branding.companyName} ${branding.appName}`.trim()
  }, [branding.appName, branding.companyName])

  return (
    <>
      <GlobalNotification />
      {sessionExpiredNoticeOpen && (
        <ModalOverlay zIndex={130}>
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900">
            <div className="space-y-3">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Phiên đăng nhập đã hết hạn</h3>
              <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                Bạn đã hết thời gian đăng nhập hoặc phiên làm việc không còn hợp lệ. Vui lòng đăng nhập lại để tiếp tục sử dụng hệ thống.
              </p>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  acknowledgeSessionExpired()
                  navigate('/login', { replace: true })
                }}
                className="rounded-xl bg-fptOrange px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-fptOrangeDark"
              >
                OK
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<Login />} />
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
          <Route path="/mobile/inquiries" element={<Navigate to="/mobile/inquiries/consumables" replace />} />
          <Route path="/mobile/inquiries/consumables" element={withSuspense(<MobileConsumableRequests />)} />
          <Route path="/mobile/inquiries/:id" element={withSuspense(<InquiryDetail />)} />
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
          <Route path="/admin/inquiries" element={<Navigate to="/admin/assets/consumables/requests" replace />} />
          <Route path="/admin/inquiries/:id" element={withSuspense(<InquiryDetail />)} />
          <Route path="/admin/inquiry-reports" element={withSuspense(<InquiryReports />)} />
          <Route path="/admin/inquiry-settings" element={withSuspense(<InquiryWorkflowSettings />)} />
          <Route path="/admin/assets" element={withSuspense(<AssetManagement key="assets-root" showTabSwitcher />)} />
          <Route path="/admin/assets/fixed" element={withSuspense(<AssetManagement key="assets-fixed" initialSection="fixed" />)} />
          <Route path="/admin/assets/consumables" element={withSuspense(<AssetManagement key="assets-consumables-overview" initialSection="consumables" initialConsumableWorkspace="OVERVIEW" />)} />
          <Route path="/admin/assets/consumables/warehouses" element={withSuspense(<AssetManagement key="assets-consumables-warehouses" initialSection="consumables" initialConsumableWorkspace="WAREHOUSES" />)} />
          <Route path="/admin/assets/consumables/rooms" element={withSuspense(<AssetManagement key="assets-consumables-rooms" initialSection="consumables" initialConsumableWorkspace="ROOMS" />)} />
          <Route path="/admin/assets/consumables/issues" element={withSuspense(<AssetManagement key="assets-consumables-issues" initialSection="consumables" initialConsumableWorkspace="ISSUES" />)} />
          <Route path="/admin/assets/consumables/requests" element={withSuspense(<AssetManagement key="assets-consumables-requests" initialSection="consumables" initialConsumableWorkspace="REQUESTS" />)} />
          <Route path="/admin/assets/consumables/disposal" element={withSuspense(<AssetManagement key="assets-consumables-disposal" initialSection="consumables" initialConsumableWorkspace="DISPOSAL" />)} />
          <Route path="/admin/asset-map" element={withSuspense(<AssetMapManagement />)} />
          <Route path="/admin/suppliers" element={withSuspense(<SupplierManagement />)} />
          <Route path="/admin/categories" element={<Navigate to="/admin/categories/fixed" replace />} />
          <Route path="/admin/categories/fixed" element={withSuspense(<CategoryManagement lockedCategoryKind="ITEMIZED" />)} />
          <Route path="/admin/categories/consumables" element={withSuspense(<CategoryManagement lockedCategoryKind="CONSUMABLE" />)} />
          <Route path="/admin/locations" element={withSuspense(<LocationManagement />)} />
          <Route path="/admin/locations/area-types" element={withSuspense(<AreaTypeCatalogManagement />)} />
          <Route path="/admin/tech-support-types" element={withSuspense(<TechSupportTypeManagement />)} />
          <Route path="/admin/asset-statistics" element={withSuspense(<AssetStatisticsManagement />)} />
          <Route path="/admin/usage-history" element={withSuspense(<UsageHistoryManagement />)} />
          <Route path="/admin/borrow-requests" element={withSuspense(<BorrowRequestManagement />)} />
          <Route path="/admin/borrow-requests/:id" element={withSuspense(<BorrowRequestDetail />)} />
          <Route path="/admin/maintenance-history" element={<Navigate to="/admin/tickets" replace />} />
          <Route path="/admin/inventory-audits" element={withSuspense(<InventoryAuditManagement />)} />
          <Route path="/admin/users" element={withSuspense(<UserManagement />)} />
          <Route path="/admin/branding" element={withSuspense(<BrandingSettings />)} />
          <Route path="/admin/notifications/:id" element={withSuspense(<NotificationDetail />)} />
          <Route path="/admin/tickets" element={withSuspense(<TicketManagement />)} />
          <Route path="/admin/tickets/:ticketId" element={<TicketDetail />} />
          <Route path="/admin/tickets/:ticketId/review" element={withSuspense(<TicketSatisfactionReview />)} />
          <Route path="/admin/tickets/extensions" element={withSuspense(<SlaExtensionManagement />)} />

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
          <Route path="/supply/inquiries" element={withSuspense(<InquiryInbox />)} />
          <Route path="/supply/inquiries/:id" element={withSuspense(<InquiryDetail />)} />
          <Route path="/supply/inquiry-reports" element={withSuspense(<InquiryReports />)} />
          <Route path="/supply/consumables/warehouses" element={withSuspense(<AssetManagement restrictToConsumable initialConsumableWorkspace="WAREHOUSES" />)} />
          <Route path="/supply/consumables/rooms" element={withSuspense(<AssetManagement restrictToConsumable initialConsumableWorkspace="ROOMS" />)} />
          <Route path="/supply/consumables/issues" element={withSuspense(<AssetManagement restrictToConsumable initialConsumableWorkspace="ISSUES" />)} />
          <Route path="/supply/consumables/disposal" element={withSuspense(<AssetManagement restrictToConsumable initialConsumableWorkspace="DISPOSAL" />)} />
          <Route path="/supply/notifications/:id" element={withSuspense(<NotificationDetail />)} />
        </Route>
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </>
  )
}

export default App
