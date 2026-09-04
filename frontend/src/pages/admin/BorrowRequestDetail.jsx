import { IconArrowLeft as ArrowLeft } from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../../api/axiosClient'
import { formatVietnamDateTime } from '../../utils/datetime'
import { BORROW_STATUS } from '../../utils/inquiry'

function statusChipClass(status) {
  if (status === 'PENDING') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (status === 'CHECKED_OUT') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (status === 'RETURN_PENDING') return 'border-violet-200 bg-violet-50 text-violet-700'
  if (status === 'RETURNED') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === 'REJECTED') return 'border-red-200 bg-red-50 text-red-700'
  return 'border-slate-200 bg-slate-50 text-slate-700'
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

export default function BorrowRequestDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [item, setItem] = useState(null)
  const [decisionNote, setDecisionNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const loadDetail = async () => {
      setLoading(true)
      try {
        const response = await axiosClient.get(`/api/borrow-requests/${id}`)
        const nextItem = response.data
        setItem(nextItem)
        setDecisionNote(nextItem?.decisionNote || '')
      } catch (error) {
        toast.error(error?.response?.data?.message || 'Không tải được chi tiết phiếu mượn.')
      } finally {
        setLoading(false)
      }
    }
    void loadDetail()
  }, [id])

  const rowValues = useMemo(() => ({
    asset: item ? `${item.assetQaCode} - ${item.assetName}` : '—',
    requester: item?.requesterName || '—',
    destination: item?.destinationLocationName || '—',
    neededFrom: item?.neededFrom || '—',
    expectedReturnDate: item?.expectedReturnDate || '—',
    createdAt: formatVietnamDateTime(item?.createdAt, '—'),
    approvedBy: item?.approvedByName || '—',
    approvedAt: formatVietnamDateTime(item?.approvedAt, '—'),
    checkedOutAt: formatVietnamDateTime(item?.checkedOutAt, '—'),
    returnedAt: formatVietnamDateTime(item?.returnedAt, 'Chưa trả'),
  }), [item])

  const handleDecision = async (action) => {
    if (!item) return
    if (action === 'reject' && !decisionNote.trim()) {
      toast.error('Vui lòng nhập lý do từ chối phiếu mượn.')
      return
    }
    setSubmitting(true)
    try {
      const endpoint = action === 'confirm-return' ? `/api/borrow-requests/${item.id}/confirm-return` : `/api/borrow-requests/${item.id}/${action}`
      const response = await axiosClient.post(endpoint, {
        note: decisionNote.trim(),
      })
      setItem(response.data)
      setDecisionNote(response.data?.decisionNote || '')
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

  if (loading) {
    return <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">Đang tải chi tiết phiếu mượn...</div>
  }

  if (!item) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Không tìm thấy phiếu mượn.</p>
        <button type="button" onClick={() => navigate('/admin/borrow-requests')} className="mt-4 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600">
          Quay lại danh sách
        </button>
      </div>
    )
  }

  return (
    <section className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Link to="/admin/borrow-requests" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-orange-600">
          <ArrowLeft size={16} />
          Quay lại danh sách phiếu mượn
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">Phiếu mượn #{item.id}</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{item.assetQaCode} - {item.assetName}</h2>
            <p className="mt-2 text-sm text-slate-500">{item.purpose}</p>
          </div>
          <span className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${statusChipClass(item.status)}`}>
            {BORROW_STATUS[item.status] || item.status}
          </span>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_360px]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Thông tin chi tiết</h3>
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {detailRows.map(([label, key]) => (
                  <tr key={key}>
                    <td className="w-52 bg-slate-50 px-4 py-3 font-semibold text-slate-600 dark:bg-slate-950 dark:text-slate-300">{label}</td>
                    <td className="px-4 py-3 text-slate-800 dark:text-slate-100">{rowValues[key]}</td>
                  </tr>
                ))}
                <tr>
                  <td className="w-52 bg-slate-50 px-4 py-3 font-semibold text-slate-600 dark:bg-slate-950 dark:text-slate-300">Ghi chú xử lý</td>
                  <td className="px-4 py-3 text-slate-800 dark:text-slate-100">{item.decisionNote || 'Chưa có ghi chú xử lý.'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Duyệt phiếu mượn</h3>
          <p className="mt-2 text-sm text-slate-500">
            Admin nhập ghi chú nếu cần. Khi bấm duyệt, hệ thống sẽ bắt đầu ghi nhận lượt mượn vào lịch sử thiết bị.
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

          {item.status === 'PENDING' ? (
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
          ) : item.status === 'RETURN_PENDING' ? (
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
              Phiếu này đã được xử lý. Bạn có thể quay lại danh sách hoặc theo dõi tiếp ở lịch sử mượn thiết bị.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
