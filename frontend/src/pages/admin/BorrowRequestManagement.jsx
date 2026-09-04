import { IconRefresh as Refresh, IconX as X } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import axiosClient from '../../api/axiosClient'
import ModalOverlay from '../../components/ui/ModalOverlay'
import { formatVietnamDate, formatVietnamDateTime } from '../../utils/datetime'
import { BORROW_STATUS } from '../../utils/inquiry'

const statusFilters = [
  ['', 'Tất cả'],
  ['PENDING', 'Chờ duyệt'],
  ['CHECKED_OUT', 'Đang mượn'],
  ['RETURN_PENDING', 'Chờ xác nhận trả'],
  ['RETURNED', 'Đã trả'],
  ['REJECTED', 'Từ chối'],
]

function getStatusChipClass(status) {
  if (status === 'PENDING') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (status === 'CHECKED_OUT') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (status === 'RETURN_PENDING') return 'border-violet-200 bg-violet-50 text-violet-700'
  if (status === 'RETURNED') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === 'REJECTED') return 'border-red-200 bg-red-50 text-red-700'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

function formatBorrowRangeDate(value, fallback = '—') {
  const formatted = formatVietnamDate(value, fallback)
  if (formatted === fallback || typeof formatted !== 'string') return formatted
  const parts = formatted.split('/')
  if (parts.length !== 3) return formatted
  const [day, month, year] = parts
  return `${day}/${month}/${String(year).slice(-2)}`
}

const detailRows = [
  ['Thiết bị', 'asset'],
  ['Người yêu cầu', 'requester'],
  ['Phòng sử dụng', 'destination'],
  ['Ngày bắt đầu', 'neededFrom'],
  ['Ngày hẹn trả', 'expectedReturnDate'],
  ['Ngày tạo phiếu', 'createdAt'],
  ['Người duyệt', 'approvedBy'],
  ['Thời điểm duyệt', 'approvedAt'],
  ['Thời điểm ghi nhận mượn', 'checkedOutAt'],
  ['Thời điểm trả', 'returnedAt'],
]

export default function BorrowRequestManagement() {
  const [items, setItems] = useState([])
  const [status, setStatus] = useState('')
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [selectedItem, setSelectedItem] = useState(null)
  const [decisionNote, setDecisionNote] = useState('')
  const [detailLoading, setDetailLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const response = await axiosClient.get('/api/borrow-requests/inbox', {
        params: { status: status || undefined },
      })
      setItems(response.data || [])
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Không tải được danh sách phiếu mượn.')
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadItems(), 0)
    const interval = window.setInterval(() => void loadItems(), 15000)
    return () => {
      window.clearTimeout(timer)
      window.clearInterval(interval)
    }
  }, [loadItems])

  const visibleItems = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()
    return items.filter((item) => {
      if (!normalizedKeyword) return true
      return `${item.id} ${item.assetQaCode} ${item.assetName} ${item.requesterName} ${item.destinationLocationName} ${item.purpose}`
        .toLowerCase()
        .includes(normalizedKeyword)
    })
  }, [items, keyword])

  const detailValues = useMemo(() => ({
    asset: selectedItem ? `${selectedItem.assetQaCode} - ${selectedItem.assetName}` : '—',
    requester: selectedItem?.requesterName || '—',
    destination: selectedItem?.destinationLocationName || '—',
    neededFrom: formatBorrowRangeDate(selectedItem?.neededFrom, '—'),
    expectedReturnDate: formatBorrowRangeDate(selectedItem?.expectedReturnDate, '—'),
    createdAt: formatVietnamDateTime(selectedItem?.createdAt, '—'),
    approvedBy: selectedItem?.approvedByName || '—',
    approvedAt: formatVietnamDateTime(selectedItem?.approvedAt, '—'),
    checkedOutAt: formatVietnamDateTime(selectedItem?.checkedOutAt, '—'),
    returnedAt: formatVietnamDateTime(selectedItem?.returnedAt, 'Chưa trả'),
  }), [selectedItem])

  const openDetailModal = async (id) => {
    setSelectedId(id)
    setSelectedItem(null)
    setDecisionNote('')
    setDetailLoading(true)
    try {
      const response = await axiosClient.get(`/api/borrow-requests/${id}`)
      const nextItem = response.data
      setSelectedItem(nextItem)
      setDecisionNote(nextItem?.decisionNote || '')
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Không tải được chi tiết phiếu mượn.')
      setSelectedId(null)
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDetailModal = () => {
    if (submitting) return
    setSelectedId(null)
    setSelectedItem(null)
    setDecisionNote('')
    setDetailLoading(false)
  }

  const handleDecision = async (action) => {
    if (!selectedItem) return
    if (action === 'reject' && !decisionNote.trim()) {
      toast.error('Vui lòng nhập lý do từ chối phiếu mượn.')
      return
    }
    setSubmitting(true)
    try {
      const endpoint = action === 'confirm-return' ? `/api/borrow-requests/${selectedItem.id}/confirm-return` : `/api/borrow-requests/${selectedItem.id}/${action}`
      const response = await axiosClient.post(endpoint, {
        note: decisionNote.trim(),
      })
      const nextItem = response.data
      setSelectedItem(nextItem)
      setDecisionNote(nextItem?.decisionNote || '')
      setItems((prev) => prev.map((item) => (item.id === nextItem.id ? nextItem : item)))
      if (action === 'approve') {
        toast.success('Đã duyệt phiếu mượn.')
      } else if (action === 'confirm-return') {
        toast.success('Đã xác nhận trả thiết bị.')
      } else {
        toast.success('Đã từ chối phiếu mượn.')
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Không xử lý được phiếu mượn.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">Mượn thiết bị</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">Duyệt phiếu mượn thiết bị</h2>
            <p className="mt-2 text-sm text-slate-500">
              Chỉ khi Admin duyệt thì phiếu mượn mới bắt đầu được ghi nhận vào lịch sử mượn thiết bị.
            </p>
          </div>
          <button
            type="button"
            onClick={loadItems}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600"
          >
            <Refresh size={16} />
            Làm mới
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {statusFilters.map(([value, label]) => (
            <button
              key={value || 'all'}
              type="button"
              onClick={() => setStatus(value)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                status === value ? 'border-orange-300 bg-orange-50 text-orange-700' : 'border-slate-200 text-slate-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="Tìm theo mã phiếu, mã QA, tên thiết bị hoặc người yêu cầu..."
          className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {loading && items.length === 0 && <p className="p-4 text-sm text-slate-500">Đang tải phiếu mượn...</p>}
        {!loading && visibleItems.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Chưa có phiếu mượn phù hợp.</p>}
        {visibleItems.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Phiếu mượn</th>
                  <th className="px-4 py-3">Thiết bị</th>
                  <th className="px-4 py-3">Người yêu cầu</th>
                  <th className="px-4 py-3">Phòng sử dụng</th>
                  <th className="px-4 py-3">Khoảng mượn</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Tạo lúc</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {visibleItems.map((item) => (
                  <tr key={item.id} className="align-top">
                    <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">#{item.id}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800 dark:text-slate-100">{item.assetQaCode} · {item.assetName}</p>
                      <p className="mt-1 text-xs text-slate-500 line-clamp-2">{item.purpose}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{item.requesterName}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{item.destinationLocationName}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      <p>{formatBorrowRangeDate(item.neededFrom, '—')}</p>
                      <p className="mt-1 text-xs text-slate-500">đến {formatBorrowRangeDate(item.expectedReturnDate, '—')}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusChipClass(item.status)}`}>
                        {BORROW_STATUS[item.status] || item.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatVietnamDateTime(item.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void openDetailModal(item.id)}
                        className="inline-flex items-center rounded-lg border border-orange-200 px-3 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-50"
                      >
                        Xem phiếu mượn
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedId && (
        <ModalOverlay className="bg-slate-950/70 backdrop-blur-sm" zIndex={130}>
          <div className="w-full max-w-5xl rounded-3xl bg-white p-5 shadow-2xl dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">Phiếu mượn {selectedItem ? `#${selectedItem.id}` : ''}</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">Xem và duyệt phiếu mượn</h3>
                <p className="mt-1 text-sm text-slate-500">Admin có thể xem chi tiết, nhập ghi chú và duyệt hoặc từ chối ngay tại đây.</p>
              </div>
              <button
                type="button"
                onClick={closeDetailModal}
                disabled={submitting}
                className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="Đóng modal phiếu mượn"
              >
                <X size={16} />
              </button>
            </div>

            {detailLoading ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                Đang tải chi tiết phiếu mượn...
              </div>
            ) : selectedItem ? (
              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_360px]">
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{selectedItem.assetQaCode} - {selectedItem.assetName}</h4>
                      <p className="mt-2 text-sm text-slate-500">{selectedItem.purpose}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${getStatusChipClass(selectedItem.status)}`}>
                      {BORROW_STATUS[selectedItem.status] || selectedItem.status}
                    </span>
                  </div>
                  <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {detailRows.map(([label, key]) => (
                          <tr key={key}>
                            <td className="w-52 bg-slate-50 px-4 py-3 font-semibold text-slate-600 dark:bg-slate-950 dark:text-slate-300">{label}</td>
                            <td className="px-4 py-3 text-slate-800 dark:text-slate-100">{detailValues[key]}</td>
                          </tr>
                        ))}
                        <tr>
                          <td className="w-52 bg-slate-50 px-4 py-3 font-semibold text-slate-600 dark:bg-slate-950 dark:text-slate-300">Ghi chú xử lý</td>
                          <td className="px-4 py-3 text-slate-800 dark:text-slate-100">{selectedItem.decisionNote || 'Chưa có ghi chú xử lý.'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Xử lý phiếu mượn</h4>
                  <p className="mt-2 text-sm text-slate-500">
                    Khi bấm duyệt, hệ thống sẽ bắt đầu ghi nhận lượt mượn vào lịch sử thiết bị. Nếu nhân viên đã quét trả, modal này sẽ hiện nút xác nhận đã trả.
                  </p>
                  <label className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Ghi chú
                    <textarea
                      rows={5}
                      value={decisionNote}
                      onChange={(event) => setDecisionNote(event.target.value)}
                      placeholder="Ví dụ: Duyệt cho phòng họp tuần này / Từ chối vì thiết bị đang cần bảo trì."
                      className="mt-2 w-full rounded-2xl border border-slate-300 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-400 dark:border-slate-700 dark:bg-slate-950"
                    />
                  </label>

                  {selectedItem.status === 'PENDING' ? (
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => void handleDecision('approve')}
                        className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {submitting ? 'Đang xử lý...' : 'Duyệt phiếu mượn'}
                      </button>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => void handleDecision('reject')}
                        className="rounded-xl border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-600 disabled:opacity-60"
                      >
                        {submitting ? 'Đang xử lý...' : 'Từ chối phiếu mượn'}
                      </button>
                    </div>
                  ) : selectedItem.status === 'RETURN_PENDING' ? (
                    <div className="mt-4 space-y-3">
                      <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-700">
                        Nhân viên đã quét mã QR để trả thiết bị và đang chờ Admin xác nhận.
                      </div>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => void handleDecision('confirm-return')}
                        className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {submitting ? 'Đang xử lý...' : 'Xác nhận đã trả'}
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                      Phiếu này đã được xử lý. Bạn có thể đóng modal để quay lại danh sách.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                Không tải được dữ liệu phiếu mượn.
              </div>
            )}
          </div>
        </ModalOverlay>
      )}
    </section>
  )
}
