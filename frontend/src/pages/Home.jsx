import {
  IconArrowUpRight as ArrowUpRight,
  IconMessageCircle as MessageCircle,
  IconPhoto as Photo,
  IconQrcode as QrCode,
  IconStars as Stars,
  IconStar as Star,
  IconTool as Wrench,
  IconX as X,
} from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'
import AuthenticatedImage from '../components/AuthenticatedImage'
import ModalOverlay from '../components/ui/ModalOverlay'
import { formatVietnamDateTime } from '../utils/datetime'
import { getTicketStatusMeta } from '../utils/ticketStatus'

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

function EmptyState({ children }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400">
      {children}
    </div>
  )
}

function SummaryStatButton({
  label,
  value,
  onClick,
  emphasis = false,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`overflow-hidden rounded-[28px] border p-4 shadow-sm transition ${
        emphasis
          ? 'border-orange-200 bg-orange-50/70 text-orange-800 hover:bg-orange-100/70 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300 dark:hover:bg-orange-500/15'
          : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900'
      }`}
      aria-label={`Mở danh sách ${label.toLowerCase()}`}
    >
      <div className="flex min-h-[7.5rem] flex-col items-center justify-center text-center">
        <span className="text-4xl font-bold tracking-tight">{value}</span>
        <span className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">{label}</span>
      </div>
    </button>
  )
}

function IconActionButton({
  icon: Icon,
  label,
  onClick,
  tone = 'default',
}) {
  const toneClassName = tone === 'accent'
    ? 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300 dark:hover:bg-orange-500/20'
    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900'

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition ${toneClassName}`}
    >
      <Icon size={17} />
    </button>
  )
}

function DataModal({
  open,
  title,
  subtitle,
  total,
  onClose,
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Nhập tên thiết bị để tìm kiếm',
  children,
}) {
  if (!open) return null

  return (
    <ModalOverlay className="bg-slate-950/70 backdrop-blur-sm" zIndex={120}>
      <div className="w-full max-w-[min(100vw-1rem,52rem)] overflow-hidden rounded-[28px] bg-white shadow-2xl dark:bg-slate-950">
        <div className="flex max-h-[min(88dvh,48rem)] flex-col">
          <div className="border-b border-slate-200 px-4 py-4 dark:border-slate-800 sm:px-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng modal"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="inline-flex w-fit items-center rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">
                {total} bản ghi
              </div>
              {typeof onSearchChange === 'function' && (
                <input
                  type="search"
                  value={searchValue}
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-10 w-full rounded-2xl border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-fptOrange focus:ring-2 focus:ring-orange-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-orange-500/20 sm:max-w-xs"
                />
              )}
            </div>
          </div>
          <div className="min-h-0 overflow-auto px-4 py-4 sm:px-5">
            {children}
          </div>
        </div>
      </div>
    </ModalOverlay>
  )
}

function Home() {
  const navigate = useNavigate()
  const [usageHistory, setUsageHistory] = useState([])
  const [maintenanceHistory, setMaintenanceHistory] = useState([])
  const [pendingRatings, setPendingRatings] = useState([])
  const [activeModal, setActiveModal] = useState(null)
  const [previewImageUrl, setPreviewImageUrl] = useState('')
  const [usageSearch, setUsageSearch] = useState('')
  const [maintenanceSearch, setMaintenanceSearch] = useState('')

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

  return (
    <div className="space-y-5">
      {/* 1. Header Control Center Card */}
      <section className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top_left,rgba(242,112,36,0.15),transparent_60%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(242,112,36,0.2),transparent_60%)]" />
        <div className="relative space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                Thao tác nhanh
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Mượn, trả hoặc báo sự cố thiết bị nhanh chóng.
              </p>
            </div>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-fptOrange dark:bg-orange-500/10 dark:text-orange-300">
              <Stars size={18} />
            </span>
          </div>

          {/* 3 columns Quick Action Buttons */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            {quickActions.map(({ to, label, hint, icon: Icon, iconTone }) => (
              <Link
                key={to}
                to={to}
                className="flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-slate-50/50 p-3 text-center transition hover:bg-slate-50 dark:border-slate-800/60 dark:bg-slate-900/30 dark:hover:bg-slate-900/50"
              >
                <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl shadow-sm ${iconTone}`}>
                  <Icon size={20} />
                </span>
                <span className="mt-2 text-xs font-semibold text-slate-800 dark:text-slate-200">{label}</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{hint.split(' ')[0]}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 2. Compact Stats Indicators */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Tổng quan nhanh
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Chạm vào từng ô để xem danh sách chi tiết.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <SummaryStatButton
            label="Mượn/trả"
            value={usageHistory.length}
            onClick={() => setActiveModal('usage')}
          />
          <SummaryStatButton
            label="Báo hỏng"
            value={maintenanceHistory.length}
            onClick={() => setActiveModal('maintenance')}
          />
          <SummaryStatButton
            label="Cần đánh giá"
            value={pendingRatings.length}
            onClick={() => setActiveModal('pending')}
            emphasis={pendingRatings.length > 0}
          />
        </div>
      </section>

      <DataModal
        open={activeModal === 'pending'}
        title="Việc cần chú ý"
        subtitle="Danh sách ticket đang chờ bạn đánh giá sau khi đội kỹ thuật xử lý xong."
        total={pendingRatings.length}
        onClose={() => setActiveModal(null)}
      >
        {pendingRatings.length === 0 ? (
          <EmptyState>Hiện chưa có ticket nào cần đánh giá.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur dark:bg-slate-900/95">
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="w-[44%] px-3 py-3 font-semibold text-slate-700 dark:text-slate-200">Thiết bị</th>
                  <th className="w-[36%] px-3 py-3 font-semibold text-slate-700 dark:text-slate-200">Hoàn tất</th>
                  <th className="w-[20%] px-3 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {pendingRatings.map((ticket) => (
                  <tr key={ticket.id} className="border-b border-slate-100 align-top dark:border-slate-800">
                    <td className="px-3 py-3">
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{ticket.assetName || 'Thiết bị không xác định'}</p>
                      <p className="mt-1 break-words text-[11px] text-slate-500 dark:text-slate-400">
                        Ticket #{ticket.id} · {ticket.assetQaCode || '-'}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-700 dark:text-slate-200">{formatVietnamDateTime(ticket.resolvedAt, 'Gần đây')}</p>
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Sẵn sàng gửi phản hồi</p>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end">
                        <IconActionButton
                          icon={Star}
                          label={`Đánh giá ticket #${ticket.id}`}
                          tone="accent"
                          onClick={() => navigate(`/mobile/tickets/${ticket.id}/review`)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataModal>

      <DataModal
        open={activeModal === 'usage'}
        title="Lịch sử mượn và trả"
        subtitle="Bảng lịch sử được tối ưu cho màn hình dọc, ưu tiên thiết bị, vị trí và mốc thời gian."
        total={filteredUsageHistory.length}
        onClose={() => setActiveModal(null)}
        searchValue={usageSearch}
        onSearchChange={setUsageSearch}
        searchPlaceholder="Tìm theo tên thiết bị"
      >
        {filteredUsageHistory.length === 0 ? (
          <EmptyState>
            {usageSearch.trim() ? 'Không tìm thấy lịch sử mượn/trả phù hợp.' : 'Chưa có dữ liệu mượn/trả.'}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[22rem] w-full table-fixed text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur dark:bg-slate-900/95">
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="w-[31%] px-3 py-3 font-semibold text-slate-700 dark:text-slate-200">Thiết bị</th>
                  <th className="w-[28%] px-3 py-3 font-semibold text-slate-700 dark:text-slate-200">Vị trí</th>
                  <th className="w-[29%] px-3 py-3 font-semibold text-slate-700 dark:text-slate-200">Thời gian</th>
                  <th className="w-[12%] px-3 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsageHistory.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 align-top dark:border-slate-800">
                    <td className="px-3 py-3">
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{item.assetName || 'Thiết bị không xác định'}</p>
                      <p className="mt-1 break-words text-[11px] text-slate-500 dark:text-slate-400">{item.assetQaCode || '-'}</p>
                      <p className="mt-1 inline-flex rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">
                        {item.endTime ? 'Đã trả' : 'Đang mượn'}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-700 dark:text-slate-200">Gốc: {item.homeLocationName || '-'}</p>
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Đích: {item.borrowedLocationName || '-'}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-700 dark:text-slate-200">Mượn: {formatVietnamDateTime(item.startTime, 'Gần đây')}</p>
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Trả: {formatVietnamDateTime(item.endTime, 'Chưa trả')}</p>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end">
                        <IconActionButton
                          icon={ArrowUpRight}
                          label={`Mở quét QR cho ${item.assetName || 'thiết bị'}`}
                          onClick={() => navigate('/mobile/scan')}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataModal>

      <DataModal
        open={activeModal === 'maintenance'}
        title="Lịch sử báo hỏng"
        subtitle="Danh sách ticket báo hỏng gọn theo cột để không kéo ngang quá nhiều trên điện thoại."
        total={filteredMaintenanceHistory.length}
        onClose={() => setActiveModal(null)}
        searchValue={maintenanceSearch}
        onSearchChange={setMaintenanceSearch}
        searchPlaceholder="Tìm theo tên thiết bị"
      >
        {filteredMaintenanceHistory.length === 0 ? (
          <EmptyState>
            {maintenanceSearch.trim() ? 'Không tìm thấy lịch sử báo hỏng phù hợp.' : 'Chưa có dữ liệu báo hỏng.'}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[22rem] w-full table-fixed text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur dark:bg-slate-900/95">
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="w-[34%] px-3 py-3 font-semibold text-slate-700 dark:text-slate-200">Thiết bị</th>
                  <th className="w-[28%] px-3 py-3 font-semibold text-slate-700 dark:text-slate-200">Vị trí / trạng thái</th>
                  <th className="w-[24%] px-3 py-3 font-semibold text-slate-700 dark:text-slate-200">Báo lúc</th>
                  <th className="w-[14%] px-3 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredMaintenanceHistory.map((item) => {
                  const canReview = pendingRatings.some((ticket) => Number(ticket.id) === Number(item.id))
                  const ticketStatusMeta = getTicketStatusMeta(item.status)

                  return (
                    <tr key={item.id} className="border-b border-slate-100 align-top dark:border-slate-800">
                      <td className="px-3 py-3">
                        <p className="font-semibold text-slate-800 dark:text-slate-100">{item.assetName || 'Thiết bị không xác định'}</p>
                        <p className="mt-1 break-words text-[11px] text-slate-500 dark:text-slate-400">{item.assetQaCode || `Ticket #${item.id}`}</p>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium text-slate-700 dark:text-slate-200">{item.currentLocationName || item.homeLocationName || '-'}</p>
                        <p className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${ticketStatusMeta.badgeClassName}`}>
                          {ticketStatusMeta.label}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium text-slate-700 dark:text-slate-200">{formatVietnamDateTime(item.reportTime, 'Gần đây')}</p>
                        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Ticket #{item.id}</p>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-2">
                          <IconActionButton
                            icon={ArrowUpRight}
                            label={`Mở ticket #${item.id}`}
                            onClick={() => navigate(`/mobile/tickets/${item.id}`)}
                          />
                          {item.imageUrl && (
                            <IconActionButton
                              icon={Photo}
                              label={`Xem ảnh lỗi của ticket #${item.id}`}
                              onClick={() => setPreviewImageUrl(item.imageUrl)}
                            />
                          )}
                          {canReview && (
                            <IconActionButton
                              icon={Star}
                              label={`Đánh giá ticket #${item.id}`}
                              tone="accent"
                              onClick={() => navigate(`/mobile/tickets/${item.id}/review`)}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </DataModal>

      {previewImageUrl && (
        <ModalOverlay className="bg-black/70 backdrop-blur-sm" zIndex={130}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-4 shadow-xl dark:bg-slate-950">
            <AuthenticatedImage
              src={previewImageUrl}
              alt="error-preview"
              className="max-h-[70dvh] w-full rounded-2xl object-contain"
            />
            <button
              type="button"
              onClick={() => setPreviewImageUrl('')}
              className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              Đóng
            </button>
          </div>
        </ModalOverlay>
      )}
    </div>
  )
}

export default Home
