import {
  IconAlertTriangle as TriangleAlert,
  IconArrowUpRight as ArrowUpRight,
  IconBolt as Bolt,
  IconChevronDown as ChevronDown,
  IconChevronLeft as ChevronLeft,
  IconChevronRight as ChevronRight,
  IconHistory as History,
  IconLayoutGrid as LayoutGrid,
  IconMessageCircle as MessageCircle,
  IconQrcode as QrCode,
  IconStars as Stars,
  IconTool as Wrench,
} from '@tabler/icons-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'
import { getAssetStatusLabel } from '../utils/assetStatus'
import { formatVietnamDateTime } from '../utils/datetime'
import { resolveBackendMediaUrl } from '../utils/mediaUrl'

const quickActions = [
  {
    to: '/mobile/scan',
    label: 'Quét QR',
    hint: 'Mượn hoặc trả thiết bị',
    icon: QrCode,
    tone: 'border-orange-200 bg-orange-50/70 text-slate-900 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-slate-100',
    iconTone: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  },
  {
    to: '/mobile/maintenance',
    label: 'Báo hỏng',
    hint: 'Tạo ticket sự cố',
    icon: Wrench,
    tone: 'border-slate-200 bg-white text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100',
    iconTone: 'bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  },
  {
    to: '/mobile/chats',
    label: 'Trao đổi',
    hint: 'Chat với kỹ thuật viên',
    icon: MessageCircle,
    tone: 'border-slate-200 bg-white text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100',
    iconTone: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  },
]

function StatCard({ label, value, hint, tone }) {
  return (
    <div className={`rounded-[28px] border p-4 shadow-sm ${tone}`}>
      <div className="h-1.5 w-10 rounded-full bg-fptOrange/80 dark:bg-orange-300/80" />
      <p className="mt-4 text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">{value}</p>
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{hint}</p>
    </div>
  )
}

function EmptyState({ children }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400">
      {children}
    </div>
  )
}

function CollapsibleSection({ title, subtitle, icon: Icon, iconClassName, open, onToggle, children }) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left"
      >
        <div className="flex min-w-0 items-start gap-3">
          <div className={`rounded-2xl p-2.5 ${iconClassName}`}>
            <Icon size={18} />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400">
          {open ? 'Thu gọn' : 'Mở'}
          {open ? <ChevronDown size={16} className="text-slate-400 dark:text-slate-500" /> : <ChevronRight size={16} className="text-slate-400 dark:text-slate-500" />}
        </span>
      </button>
      {open && <div className="border-t border-slate-200 bg-slate-50/70 px-4 py-4 dark:border-slate-800 dark:bg-slate-900/50">{children}</div>}
    </section>
  )
}

function SwipeCarousel({
  items,
  activeIndex,
  onChange,
  emptyText,
  renderItem,
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Nhập tên thiết bị để tìm kiếm',
}) {
  const touchStartXRef = useRef(null)
  const hasItems = items.length > 0
  const safeIndex = hasItems ? Math.min(Math.max(activeIndex, 0), items.length - 1) : 0
  const activeItem = items[safeIndex]
  const canGoPrev = hasItems && safeIndex > 0
  const canGoNext = hasItems && safeIndex < items.length - 1

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

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[auto,minmax(0,1fr),auto] items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
        <button
          type="button"
          onClick={() => canGoPrev && onChange(safeIndex - 1)}
          disabled={!canGoPrev}
          className="inline-flex h-10 items-center justify-center gap-1 self-start rounded-full border border-slate-300 bg-white px-3 font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
        >
          <ChevronLeft size={14} />
          Trước
        </button>
        <div className="min-w-0 space-y-1">
          <input
            type="search"
            value={searchValue}
            onChange={(event) => onSearchChange?.(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-10 w-full rounded-full border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-fptOrange focus:ring-2 focus:ring-orange-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-orange-500/20"
          />
          <p className="text-center font-medium">
            {hasItems ? `Kết quả ${safeIndex + 1}/${items.length} · Vuốt trái/phải để xem tiếp` : 'Chưa có kết quả phù hợp'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => canGoNext && onChange(safeIndex + 1)}
          disabled={!canGoNext}
          className="inline-flex h-10 items-center justify-center gap-1 self-start rounded-full border border-slate-300 bg-white px-3 font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
        >
          Sau
          <ChevronRight size={14} />
        </button>
      </div>

      {hasItems ? (
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
        >
          {renderItem(activeItem)}
        </div>
      ) : (
        <EmptyState>{emptyText}</EmptyState>
      )}

      {items.length > 1 && (
        <div className="flex justify-center gap-1.5">
          {items.map((item, index) => (
            <button
              key={item.id || index}
              type="button"
              onClick={() => onChange(index)}
              aria-label={`Xem thẻ ${index + 1}`}
              className={`h-2.5 rounded-full transition-all ${
                index === safeIndex ? 'w-6 bg-fptOrange' : 'w-2.5 bg-slate-300 dark:bg-slate-700'
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
  const [usageSearch, setUsageSearch] = useState('')
  const [maintenanceSearch, setMaintenanceSearch] = useState('')
  const [showPendingRatings, setShowPendingRatings] = useState(false)
  const [showUsageHistory, setShowUsageHistory] = useState(false)
  const [showMaintenanceHistory, setShowMaintenanceHistory] = useState(false)

  const normalizedUsageSearch = usageSearch.trim().toLowerCase()
  const normalizedMaintenanceSearch = maintenanceSearch.trim().toLowerCase()

  const filteredUsageHistory = useMemo(() => {
    if (!normalizedUsageSearch) return usageHistory
    return usageHistory.filter((item) => (item.assetName || '').toLowerCase().includes(normalizedUsageSearch))
  }, [usageHistory, normalizedUsageSearch])

  const filteredMaintenanceHistory = useMemo(() => {
    if (!normalizedMaintenanceSearch) return maintenanceHistory
    return maintenanceHistory.filter((item) => (item.assetName || '').toLowerCase().includes(normalizedMaintenanceSearch))
  }, [maintenanceHistory, normalizedMaintenanceSearch])

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
    if (usageIndex >= filteredUsageHistory.length && filteredUsageHistory.length > 0) {
      setUsageIndex(filteredUsageHistory.length - 1)
    }
  }, [filteredUsageHistory, usageIndex])

  useEffect(() => {
    if (maintenanceIndex >= filteredMaintenanceHistory.length && filteredMaintenanceHistory.length > 0) {
      setMaintenanceIndex(filteredMaintenanceHistory.length - 1)
    }
  }, [filteredMaintenanceHistory, maintenanceIndex])

  const primaryAction = quickActions[0]
  const secondaryActions = quickActions.slice(1)

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top_left,rgba(242,112,36,0.18),transparent_65%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(242,112,36,0.22),transparent_65%)]" />
        <div className="relative grid gap-4">
          <div className="grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300">
                <Stars size={14} />
                Trung tâm thao tác
              </span>
              <h2 className="mt-4 max-w-[14ch] text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                Quét, báo hỏng và theo dõi ticket trong một nơi gọn hơn.
              </h2>
              <p className="mt-3 max-w-[34ch] text-sm leading-6 text-slate-600 dark:text-slate-400">
                Các thao tác chính, lịch sử và việc cần xử lý được gom lại để bạn không phải đi qua nhiều màn hình.
              </p>

              <Link
                to={primaryAction.to}
                className={`mt-5 block rounded-[28px] border p-4 shadow-sm transition hover:-translate-y-0.5 ${primaryAction.tone}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex h-12 w-12 items-center justify-center rounded-[20px] ${primaryAction.iconTone}`}>
                      <primaryAction.icon size={20} />
                    </span>
                    <div>
                      <p className="text-base font-semibold">{primaryAction.label}</p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{primaryAction.hint}</p>
                    </div>
                  </div>
                  <ArrowUpRight size={18} className="shrink-0 text-fptOrange dark:text-orange-300" />
                </div>
              </Link>
            </div>

            <div className="space-y-3">
              <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Ưu tiên hôm nay</p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                      {pendingRatings.length}
                    </p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      ticket đã hoàn tất đang chờ bạn đánh giá.
                    </p>
                  </div>
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-[20px] bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">
                    <Bolt size={20} />
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPendingRatings((prev) => !prev)}
                  className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Xem việc cần làm
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[24px] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Mượn / trả</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">{usageHistory.length}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Tổng lượt thao tác</p>
                </div>
                <div className="rounded-[24px] border border-orange-200 bg-orange-50/70 p-4 dark:border-orange-500/30 dark:bg-orange-500/10">
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Báo hỏng</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">{maintenanceHistory.length}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Lần đã tạo ticket</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {secondaryActions.map(({ to, label, hint, icon: Icon, tone, iconTone }) => (
              <Link
                key={to}
                to={to}
                className={`rounded-[28px] border p-4 shadow-sm transition hover:-translate-y-0.5 ${tone}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex h-11 w-11 items-center justify-center rounded-[18px] ${iconTone}`}>
                      <Icon size={18} />
                    </span>
                    <div>
                      <p className="font-semibold">{label}</p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{hint}</p>
                    </div>
                  </div>
                  <ArrowUpRight size={18} className="shrink-0 text-slate-400 dark:text-slate-500" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <StatCard label="Theo dõi phản hồi" value={pendingRatings.length} hint="Ticket hoàn tất đang chờ bạn đánh giá." tone="border-orange-200 bg-orange-50/70 dark:border-orange-500/30 dark:bg-orange-500/10" />
        <StatCard label="Lịch sử sử dụng" value={usageHistory.length} hint="Các lượt mượn và trả thiết bị." tone="border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950" />
        <StatCard label="Sự cố đã gửi" value={maintenanceHistory.length} hint="Các ticket báo hỏng bạn đã tạo." tone="border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950" />
      </section>

      <CollapsibleSection
        title="Đánh giá sau xử lý"
        subtitle="Những ticket đã hoàn tất nhưng bạn chưa gửi phản hồi."
        icon={TriangleAlert}
        iconClassName="bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300"
        open={showPendingRatings}
        onToggle={() => setShowPendingRatings((prev) => !prev)}
      >
        <div className="space-y-3">
          {pendingRatings.slice(0, 3).map((ticket) => (
            <div key={ticket.id} className="rounded-[24px] border border-orange-200 bg-white p-4 dark:border-orange-500/30 dark:bg-slate-950">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{ticket.assetName || 'Thiết bị không xác định'}</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Ticket #{ticket.id} · {ticket.assetQaCode}</p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/mobile/tickets/${ticket.id}/review`)}
                  className="rounded-xl bg-fptOrange px-3 py-2 text-xs font-semibold text-white hover:bg-fptOrangeDark"
                >
                  Đánh giá ngay
                </button>
              </div>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Hoàn tất lúc: {formatVietnamDateTime(ticket.resolvedAt, 'Gần đây')}
              </p>
            </div>
          ))}
          {pendingRatings.length === 0 && (
            <EmptyState>Chưa có ticket nào đang chờ bạn đánh giá.</EmptyState>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Lịch sử mượn và trả"
        subtitle="Tra cứu nhanh thiết bị đã nhận, vị trí sử dụng và thời điểm hoàn trả."
        icon={LayoutGrid}
        iconClassName="bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300"
        open={showUsageHistory}
        onToggle={() => setShowUsageHistory((prev) => !prev)}
      >
        <SwipeCarousel
          items={filteredUsageHistory}
          activeIndex={usageIndex}
          onChange={setUsageIndex}
          searchValue={usageSearch}
          onSearchChange={(value) => {
            setUsageSearch(value)
            setUsageIndex(0)
          }}
          emptyText={usageSearch.trim() ? 'Không tìm thấy lịch sử mượn / trả theo tên thiết bị.' : 'Chưa có dữ liệu mượn / trả.'}
          renderItem={(item) => (
            <div key={item.id} className="p-1">
              <div className="rounded-[24px] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{item.assetName || 'Thiết bị không xác định'}</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{item.assetQaCode}</p>
                </div>
                <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">
                  {item.endTime ? 'Đã trả' : 'Đang mượn'}
                </span>
              </div>
              <div className="mt-3 grid gap-2 text-sm text-slate-600 dark:text-slate-400">
                <p><span className="font-medium text-slate-700 dark:text-slate-200">Phòng gốc:</span> {item.homeLocationName || '-'}</p>
                <p><span className="font-medium text-slate-700 dark:text-slate-200">Phòng đích:</span> {item.borrowedLocationName || '-'}</p>
                <p><span className="font-medium text-slate-700 dark:text-slate-200">Mượn lúc:</span> {formatVietnamDateTime(item.startTime)}</p>
                <p><span className="font-medium text-slate-700 dark:text-slate-200">Trả lúc:</span> {formatVietnamDateTime(item.endTime)}</p>
              </div>
              </div>
            </div>
          )}
        />
      </CollapsibleSection>

      <CollapsibleSection
        title="Lịch sử báo hỏng"
        subtitle="Mở lại ticket cũ, xem ảnh lỗi và tiếp tục theo dõi thiết bị."
        icon={History}
        iconClassName="bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300"
        open={showMaintenanceHistory}
        onToggle={() => setShowMaintenanceHistory((prev) => !prev)}
      >
        <SwipeCarousel
          items={filteredMaintenanceHistory}
          activeIndex={maintenanceIndex}
          onChange={setMaintenanceIndex}
          searchValue={maintenanceSearch}
          onSearchChange={(value) => {
            setMaintenanceSearch(value)
            setMaintenanceIndex(0)
          }}
          emptyText={maintenanceSearch.trim() ? 'Không tìm thấy lịch sử báo hỏng theo tên thiết bị.' : 'Chưa có dữ liệu báo hỏng.'}
          renderItem={(item) => (
            <div key={item.id} className="p-1">
              <div className="rounded-[24px] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{item.assetName || 'Thiết bị không xác định'}</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{item.assetQaCode}</p>
                </div>
                <span className="rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-semibold text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">
                  {getAssetStatusLabel(item.assetStatus, 'Đang theo dõi')}
                </span>
              </div>
              <div className="mt-3 grid gap-2 text-sm text-slate-600 dark:text-slate-400">
                <p><span className="font-medium text-slate-700 dark:text-slate-200">Phòng gốc:</span> {item.homeLocationName || '-'}</p>
                <p><span className="font-medium text-slate-700 dark:text-slate-200">Phòng hiện tại:</span> {item.currentLocationName || '-'}</p>
                <p><span className="font-medium text-slate-700 dark:text-slate-200">Báo lúc:</span> {formatVietnamDateTime(item.reportTime)}</p>
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
                      className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700 hover:bg-orange-100 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300"
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
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                  >
                    Xem ảnh lỗi
                  </button>
                </div>
              </div>
              </div>
            </div>
          )}
        />
      </CollapsibleSection>

      {previewImageUrl && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-4 shadow-xl dark:bg-slate-950">
            <img src={resolveBackendMediaUrl(previewImageUrl)} alt="error-preview" className="h-[300px] w-full rounded-2xl object-cover" />
            <button
              type="button"
              onClick={() => setPreviewImageUrl('')}
              className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
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
