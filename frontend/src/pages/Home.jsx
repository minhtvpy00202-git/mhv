import { ChevronDown, ChevronLeft, ChevronRight, History, MessageCircle, QrCode, TriangleAlert, Wrench } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'
import { getAssetStatusLabel } from '../utils/assetStatus'
import { formatVietnamDateTime } from '../utils/datetime'
import { resolveBackendMediaUrl } from '../utils/mediaUrl'

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

function CollapsibleSection({ title, subtitle, icon: Icon, iconClassName, open, onToggle, children }) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div className="flex min-w-0 items-start gap-3">
          <div className={`rounded-xl p-2 ${iconClassName}`}>
            <Icon size={18} />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-800">
              {open ? '▼' : '►'}{title}
            </h3>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          </div>
        </div>
        {open ? <ChevronDown size={18} className="mt-1 text-slate-400" /> : <ChevronRight size={18} className="mt-1 text-slate-400" />}
      </button>
      {open && <div className="mt-3 space-y-3">{children}</div>}
    </section>
  )
}

function SwipeCarousel({ items, activeIndex, onChange, emptyText, renderItem }) {
  const touchStartXRef = useRef(null)
  const safeIndex = items.length === 0 ? 0 : Math.min(Math.max(activeIndex, 0), items.length - 1)
  const activeItem = items[safeIndex]
  const canGoPrev = safeIndex > 0
  const canGoNext = safeIndex < items.length - 1

  const handleTouchStart = (event) => {
    touchStartXRef.current = event.changedTouches?.[0]?.clientX ?? null
  }

  const handleTouchEnd = (event) => {
    const endX = event.changedTouches?.[0]?.clientX
    const startX = touchStartXRef.current
    touchStartXRef.current = null
    if (!Number.isFinite(startX) || !Number.isFinite(endX)) return
    const deltaX = endX - startX
    if (Math.abs(deltaX) < 45) return
    if (deltaX < 0 && canGoNext) {
      onChange(safeIndex + 1)
    }
    if (deltaX > 0 && canGoPrev) {
      onChange(safeIndex - 1)
    }
  }

  if (items.length === 0) {
    return <EmptyState>{emptyText}</EmptyState>
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
        <button
          type="button"
          onClick={() => canGoPrev && onChange(safeIndex - 1)}
          disabled={!canGoPrev}
          className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 disabled:opacity-40"
        >
          <ChevronLeft size={14} />
          Trước
        </button>
        <p className="text-center font-medium">
          Thẻ {safeIndex + 1}/{items.length} · Vuốt trái/phải để xem tiếp
        </p>
        <button
          type="button"
          onClick={() => canGoNext && onChange(safeIndex + 1)}
          disabled={!canGoNext}
          className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 disabled:opacity-40"
        >
          Sau
          <ChevronRight size={14} />
        </button>
      </div>

      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="rounded-2xl border border-slate-200 bg-slate-50"
      >
        {renderItem(activeItem)}
      </div>

      {items.length > 1 && (
        <div className="flex justify-center gap-1.5">
          {items.map((item, index) => (
            <button
              key={item.id || index}
              type="button"
              onClick={() => onChange(index)}
              aria-label={`Xem thẻ ${index + 1}`}
              className={`h-2.5 rounded-full transition-all ${
                index === safeIndex ? 'w-6 bg-fptOrange' : 'w-2.5 bg-slate-300'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function Home() {
  const navigate = useNavigate()
  const [usageHistory, setUsageHistory] = useState([])
  const [maintenanceHistory, setMaintenanceHistory] = useState([])
  const [pendingRatings, setPendingRatings] = useState([])
  const [previewImageUrl, setPreviewImageUrl] = useState('')
  const [usageIndex, setUsageIndex] = useState(0)
  const [maintenanceIndex, setMaintenanceIndex] = useState(0)
  const [showPendingRatings, setShowPendingRatings] = useState(false)
  const [showUsageHistory, setShowUsageHistory] = useState(false)
  const [showMaintenanceHistory, setShowMaintenanceHistory] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      try {
        const [usageRes, maintenanceRes, pendingRatingsRes] = await Promise.all([
          axiosClient.get('/api/usage/history/me'),
          axiosClient.get('/api/maintenance/history/me'),
          axiosClient.get('/api/tickets/pending-satisfaction/me'),
        ])
        setUsageHistory(usageRes.data || [])
        setMaintenanceHistory(maintenanceRes.data || [])
        setPendingRatings(pendingRatingsRes.data || [])
        setUsageIndex(0)
        setMaintenanceIndex(0)
      } catch (error) {
        const message = error?.response?.data?.message || 'Không tải được lịch sử trang chủ.'
        toast.error(message)
      }
    }
    loadData()
    const handleRefresh = () => {
      loadData()
    }
    window.addEventListener('mhv-notification-feed-refresh', handleRefresh)
    return () => window.removeEventListener('mhv-notification-feed-refresh', handleRefresh)
  }, [])

  useEffect(() => {
    if (usageIndex >= usageHistory.length && usageHistory.length > 0) {
      setUsageIndex(usageHistory.length - 1)
    }
  }, [usageHistory, usageIndex])

  useEffect(() => {
    if (maintenanceIndex >= maintenanceHistory.length && maintenanceHistory.length > 0) {
      setMaintenanceIndex(maintenanceHistory.length - 1)
    }
  }, [maintenanceHistory, maintenanceIndex])

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
        <StatCard label="Chờ đánh giá" value={pendingRatings.length} hint="Ticket đã hoàn tất cần phản hồi" tone="border-violet-200 bg-violet-50 text-violet-800" />
      </section>

      <CollapsibleSection
        title="Đánh giá sau xử lý"
        subtitle="Những ticket đã hoàn tất nhưng bạn chưa chấm điểm và nhận xét."
        icon={TriangleAlert}
        iconClassName="bg-violet-50 text-violet-500"
        open={showPendingRatings}
        onToggle={() => setShowPendingRatings((prev) => !prev)}
      >
          {pendingRatings.slice(0, 3).map((ticket) => (
            <div key={ticket.id} className="rounded-2xl border border-violet-200 bg-violet-50 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{ticket.assetName || 'Thiết bị không xác định'}</p>
                  <p className="mt-0.5 text-xs text-slate-500">Ticket #{ticket.id} · {ticket.assetQaCode}</p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/mobile/tickets/${ticket.id}/review`)}
                  className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700"
                >
                  Đánh giá ngay
                </button>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                Hoàn tất lúc: {formatVietnamDateTime(ticket.resolvedAt, 'Gần đây')}
              </p>
            </div>
          ))}
          {pendingRatings.length === 0 && (
            <EmptyState>Chưa có ticket nào đang chờ bạn đánh giá.</EmptyState>
          )}
      </CollapsibleSection>

      <CollapsibleSection
        title="Lịch sử mượn / trả"
        subtitle="Các lần bạn đã mượn và hoàn trả thiết bị."
        icon={History}
        iconClassName="bg-sky-50 text-sky-500"
        open={showUsageHistory}
        onToggle={() => setShowUsageHistory((prev) => !prev)}
      >
        <SwipeCarousel
          items={usageHistory}
          activeIndex={usageIndex}
          onChange={setUsageIndex}
          emptyText="Chưa có dữ liệu mượn / trả."
          renderItem={(item) => (
            <div key={item.id} className="p-3">
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
          )}
        />
      </CollapsibleSection>

      <CollapsibleSection
        title="Lịch sử báo hỏng"
        subtitle="Các lần bạn đã báo lỗi và theo dõi trạng thái thiết bị."
        icon={TriangleAlert}
        iconClassName="bg-orange-50 text-orange-500"
        open={showMaintenanceHistory}
        onToggle={() => setShowMaintenanceHistory((prev) => !prev)}
      >
        <SwipeCarousel
          items={maintenanceHistory}
          activeIndex={maintenanceIndex}
          onChange={setMaintenanceIndex}
          emptyText="Chưa có dữ liệu báo hỏng."
          renderItem={(item) => (
            <div key={item.id} className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{item.assetName || 'Thiết bị không xác định'}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{item.assetQaCode}</p>
                </div>
                <span className="rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-semibold text-orange-700">
                  {getAssetStatusLabel(item.assetStatus, 'Đang theo dõi')}
                </span>
              </div>
              <div className="mt-3 grid gap-2 text-sm text-slate-600">
                <p><span className="font-medium text-slate-700">Phòng gốc:</span> {item.homeLocationName || '-'}</p>
                <p><span className="font-medium text-slate-700">Phòng hiện tại:</span> {item.currentLocationName || '-'}</p>
                <p><span className="font-medium text-slate-700">Báo lúc:</span> {formatVietnamDateTime(item.reportTime)}</p>
              </div>
              <div className="mt-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/mobile/tickets/${item.id}`)}
                    className="rounded-lg bg-fptOrange px-3 py-2 text-xs font-semibold text-white hover:bg-fptOrangeDark"
                  >
                    Mở ticket
                  </button>
                  {pendingRatings.some((ticket) => Number(ticket.id) === Number(item.id)) && (
                    <button
                      type="button"
                      onClick={() => navigate(`/mobile/tickets/${item.id}/review`)}
                      className="rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100"
                    >
                      Đánh giá
                    </button>
                  )}
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
            </div>
          )}
        />
      </CollapsibleSection>

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
