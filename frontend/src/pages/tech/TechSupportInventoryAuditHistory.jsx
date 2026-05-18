import { ClipboardList, RefreshCcw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import axiosClient from '../../api/axiosClient'
import { formatVietnamDateTime } from '../../utils/datetime'

function TechSupportInventoryAuditHistory() {
  const [auditHistory, setAuditHistory] = useState([])
  const [loading, setLoading] = useState(true)

  const loadAuditHistory = async () => {
    setLoading(true)
    try {
      const response = await axiosClient.get('/api/inventory-audits/history/me')
      setAuditHistory(response.data || [])
    } catch (error) {
      const message = error?.response?.data?.message || 'Không tải được lịch sử kiểm kê của bạn.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAuditHistory()
  }, [])

  const completedCount = useMemo(
    () => auditHistory.filter((audit) => audit.status === 'COMPLETED').length,
    [auditHistory],
  )

  const totalMissingCount = useMemo(
    () => auditHistory.reduce((sum, audit) => sum + Number(audit.missingCount || 0), 0),
    [auditHistory],
  )

  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-gradient-to-br from-indigo-700 via-blue-700 to-cyan-600 p-5 text-white shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-white/80">Lịch sử thực hiện của kỹ thuật viên</p>
            <h2 className="mt-1 text-2xl font-bold">Lịch sử kiểm kê</h2>
            <p className="mt-2 text-sm text-white/90">
              Theo dõi các phiên kiểm kê bạn đã tham gia, số lượng đã quét và kết quả thất lạc của từng đợt.
            </p>
          </div>
          <button
            type="button"
            onClick={loadAuditHistory}
            className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-white/15 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
          >
            <RefreshCcw size={16} />
            Tải lại lịch sử
          </button>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Tổng phiên đã tham gia</p>
          <p className="mt-2 text-2xl font-bold text-slate-800">{auditHistory.length}</p>
          <p className="mt-1 text-xs text-slate-500">Bao gồm cả phiên đang mở và đã hoàn tất.</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Phiên đã hoàn tất</p>
          <p className="mt-2 text-2xl font-bold text-slate-800">{completedCount}</p>
          <p className="mt-1 text-xs text-slate-500">Các phiên đã được chốt kết quả kiểm kê.</p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Tổng số thất lạc</p>
          <p className="mt-2 text-2xl font-bold text-slate-800">{totalMissingCount}</p>
          <p className="mt-1 text-xs text-slate-500">Tổng hợp từ các phiên bạn đã tham gia.</p>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Danh sách phiên kiểm kê</h3>
            <p className="mt-1 text-sm text-slate-500">Xem nhanh phòng kiểm kê, thời điểm thực hiện và kết quả từng phiên.</p>
          </div>
          <ClipboardList className="text-blue-600" size={20} />
        </div>

        <div className="space-y-3">
          {loading && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              Đang tải lịch sử kiểm kê...
            </div>
          )}

          {!loading && auditHistory.map((audit) => (
            <div key={audit.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Phiên #{audit.id}</p>
                  <p className="mt-1 text-sm text-slate-600">{audit.locationName || 'Không rõ phòng kiểm kê'}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  audit.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}
                >
                  {audit.status || 'Đang theo dõi'}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-xl bg-white px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Bắt đầu</p>
                  <p className="mt-1 text-sm text-slate-700">{formatVietnamDateTime(audit.startedAt, '')}</p>
                </div>
                <div className="rounded-xl bg-white px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Hoàn thành</p>
                  <p className="mt-1 text-sm text-slate-700">{formatVietnamDateTime(audit.completedAt, '')}</p>
                </div>
                <div className="rounded-xl bg-white px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Dự kiến</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">{audit.expectedCount ?? 0}</p>
                </div>
                <div className="rounded-xl bg-white px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Đã quét</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">{audit.scannedCount ?? 0}</p>
                </div>
                <div className="rounded-xl bg-white px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Thất lạc</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">{audit.missingCount ?? 0}</p>
                </div>
              </div>
            </div>
          ))}

          {!loading && auditHistory.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              Bạn chưa tham gia phiên kiểm kê nào.
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default TechSupportInventoryAuditHistory
