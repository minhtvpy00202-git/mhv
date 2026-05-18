import { History, MessageCircle, QrCode, TriangleAlert, Wrench } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'
import { formatVietnamDateTime } from '../utils/datetime'
import { resolveBackendMediaUrl } from '../utils/mediaUrl'

const PAGE_SIZE = 5

const quickActions = [
  { to: '/mobile/scan', label: 'Quét QR', hint: 'Mượn hoặc trả thiết bị', icon: QrCode, tone: 'bg-sky-50 text-sky-700 border-sky-200' },
  { to: '/mobile/maintenance', label: 'Báo hỏng', hint: 'Tạo ticket sự cố', icon: Wrench, tone: 'bg-orange-50 text-orange-700 border-orange-200' },
  { to: '/mobile/chats', label: 'Trao đổi', hint: 'Chat với kỹ thuật viên', icon: MessageCircle, tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
]

function StatCard({ label, value, hint, tone }) {
  return (
    <div className={`rounded-2xl border p-3 shadow-sm ${tone}`}>
      <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs opacity-80">{hint}</p>
    </div>
  )
}

function EmptyState({ children }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
      {children}
    </div>
  )
}

function Pagination({ page, totalPages, onFirst, onPrev, onNext, onLast }) {
  return (
    <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
      <p>
        Trang {page} / {totalPages}
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={onFirst} disabled={page <= 1} className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50">
          Đầu
        </button>
        <button type="button" onClick={onPrev} disabled={page <= 1} className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50">
          Trước
        </button>
        <button type="button" onClick={onNext} disabled={page >= totalPages} className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50">
          Sau
        </button>
        <button type="button" onClick={onLast} disabled={page >= totalPages} className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50">
          Cuối
        </button>
      </div>
    </div>
  )
}

function Home() {
  const [usageHistory, setUsageHistory] = useState([])
  const [maintenanceHistory, setMaintenanceHistory] = useState([])
  const [previewImageUrl, setPreviewImageUrl] = useState('')
  const [usagePage, setUsagePage] = useState(1)
  const [maintenancePage, setMaintenancePage] = useState(1)

  useEffect(() => {
    const loadData = async () => {
      try {
        const [usageRes, maintenanceRes] = await Promise.all([
          axiosClient.get('/api/usage/history/me'),
          axiosClient.get('/api/maintenance/history/me'),
        ])
        setUsageHistory(usageRes.data || [])
        setMaintenanceHistory(maintenanceRes.data || [])
        setUsagePage(1)
        setMaintenancePage(1)
      } catch (error) {
        const message = error?.response?.data?.message || 'Không tải được lịch sử trang chủ.'
        toast.error(message)
      }
    }
    loadData()
  }, [])

  const usageTotalPages = Math.max(1, Math.ceil(usageHistory.length / PAGE_SIZE))
  const maintenanceTotalPages = Math.max(1, Math.ceil(maintenanceHistory.length / PAGE_SIZE))

  const usageRows = useMemo(() => {
    const start = (usagePage - 1) * PAGE_SIZE
    return usageHistory.slice(start, start + PAGE_SIZE)
  }, [usageHistory, usagePage])

  const maintenanceRows = useMemo(() => {
    const start = (maintenancePage - 1) * PAGE_SIZE
    return maintenanceHistory.slice(start, start + PAGE_SIZE)
  }, [maintenanceHistory, maintenancePage])

  const openMaintenanceCount = useMemo(
    () => maintenanceHistory.filter((item) => item.assetStatus && item.assetStatus !== 'Sẵn sàng').length,
    [maintenanceHistory],
  )

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-fptOrange to-orange-500 p-5 text-white shadow-sm">
        <p className="text-sm font-medium text-white/85">Khu vực nhân viên</p>
        <h2 className="mt-1 text-2xl font-bold">Theo dõi thiết bị và gửi yêu cầu hỗ trợ</h2>
        <p className="mt-2 max-w-xl text-sm text-white/90">
          Quét QR để mượn trả, báo hỏng nhanh và trao đổi trực tiếp với kỹ thuật viên ngay trên ticket.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {quickActions.map(({ to, label, hint, icon: Icon, tone }) => (
            <Link
              key={to}
              to={to}
              className={`rounded-2xl border px-3 py-3 backdrop-blur transition hover:translate-y-[-1px] ${tone}`}
            >
              <div className="flex items-center gap-2">
                <Icon size={18} />
                <span className="font-semibold">{label}</span>
              </div>
              <p className="mt-1 text-xs opacity-80">{hint}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Mượn / trả" value={usageHistory.length} hint="Tổng lượt thao tác của bạn" tone="border-sky-200 bg-sky-50 text-sky-800" />
        <StatCard label="Báo hỏng" value={maintenanceHistory.length} hint="Số lần đã tạo ticket" tone="border-orange-200 bg-orange-50 text-orange-800" />
        <StatCard label="Đang chờ xử lý" value={openMaintenanceCount} hint="Thiết bị chưa về trạng thái sẵn sàng" tone="border-rose-200 bg-rose-50 text-rose-800" />
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-800">Lịch sử mượn / trả</h3>
            <p className="mt-1 text-sm text-slate-500">Các lần bạn đã mượn và hoàn trả thiết bị.</p>
          </div>
          <History className="text-sky-500" size={20} />
        </div>
        <div className="mt-3 space-y-3">
          {usageRows.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{item.assetName || 'Thiết bị không xác định'}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{item.assetQaCode}</p>
                </div>
                <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
                  {item.endTime ? 'Đã trả' : 'Đang mượn'}
                </span>
              </div>
              <div className="mt-3 grid gap-2 text-sm text-slate-600">
                <p><span className="font-medium text-slate-700">Phòng gốc:</span> {item.homeLocationName || '-'}</p>
                <p><span className="font-medium text-slate-700">Phòng đích:</span> {item.borrowedLocationName || '-'}</p>
                <p><span className="font-medium text-slate-700">Mượn lúc:</span> {formatVietnamDateTime(item.startTime)}</p>
                <p><span className="font-medium text-slate-700">Trả lúc:</span> {formatVietnamDateTime(item.endTime)}</p>
              </div>
            </div>
          ))}
          {usageRows.length === 0 && <EmptyState>Chưa có dữ liệu mượn / trả.</EmptyState>}
        </div>
        <Pagination page={usagePage} totalPages={usageTotalPages} onFirst={() => setUsagePage(1)} onPrev={() => setUsagePage((prev) => Math.max(1, prev - 1))} onNext={() => setUsagePage((prev) => Math.min(usageTotalPages, prev + 1))} onLast={() => setUsagePage(usageTotalPages)} />
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-800">Lịch sử báo hỏng</h3>
            <p className="mt-1 text-sm text-slate-500">Các lần bạn đã báo lỗi và theo dõi trạng thái thiết bị.</p>
          </div>
          <TriangleAlert className="text-orange-500" size={20} />
        </div>
        <div className="mt-3 space-y-3">
          {maintenanceRows.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{item.assetName || 'Thiết bị không xác định'}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{item.assetQaCode}</p>
                </div>
                <span className="rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-semibold text-orange-700">
                  {item.assetStatus || 'Đang theo dõi'}
                </span>
              </div>
              <div className="mt-3 grid gap-2 text-sm text-slate-600">
                <p><span className="font-medium text-slate-700">Phòng gốc:</span> {item.homeLocationName || '-'}</p>
                <p><span className="font-medium text-slate-700">Phòng hiện tại:</span> {item.currentLocationName || '-'}</p>
                <p><span className="font-medium text-slate-700">Báo lúc:</span> {formatVietnamDateTime(item.reportTime)}</p>
              </div>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => {
                    if (!item.imageUrl) {
                      toast.info('Bản ghi này chưa có ảnh lỗi.')
                      return
                    }
                    setPreviewImageUrl(item.imageUrl)
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Xem ảnh lỗi
                </button>
              </div>
            </div>
          ))}
          {maintenanceRows.length === 0 && <EmptyState>Chưa có dữ liệu báo hỏng.</EmptyState>}
        </div>
        <Pagination page={maintenancePage} totalPages={maintenanceTotalPages} onFirst={() => setMaintenancePage(1)} onPrev={() => setMaintenancePage((prev) => Math.max(1, prev - 1))} onNext={() => setMaintenancePage((prev) => Math.min(maintenanceTotalPages, prev + 1))} onLast={() => setMaintenancePage(maintenanceTotalPages)} />
      </section>

      {previewImageUrl && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-4 shadow-xl">
            <img src={resolveBackendMediaUrl(previewImageUrl)} alt="error-preview" className="h-[300px] w-full rounded-2xl object-cover" />
            <button
              type="button"
              onClick={() => setPreviewImageUrl('')}
              className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Home
