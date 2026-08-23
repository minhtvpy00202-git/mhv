import { IconChartBar as ChartBar, IconRefresh as Refresh } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'
import { useAuth } from '../context/AuthContext'
import { getInquiryStatusMeta } from '../utils/inquiry'

const today = new Date().toISOString().slice(0, 10)
const thirtyDaysAgo = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

function formatNumber(value) {
  return Number(value || 0).toLocaleString('vi-VN')
}

function formatRate(value) {
  return `${Number(value || 0).toFixed(1)}%`
}

function InquiryReports() {
  const { user } = useAuth()
  const [filters, setFilters] = useState({
    fromDate: thirtyDaysAgo,
    toDate: today,
    targetRole: user?.role === 'Admin' ? '' : 'ConsumableManager',
  })
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)

  const loadReport = useCallback(async () => {
    setLoading(true)
    try {
      const response = await axiosClient.get('/api/inquiry-reports', {
        params: {
          fromDate: filters.fromDate,
          toDate: filters.toDate,
          targetRole: filters.targetRole || undefined,
        },
      })
      setReport(response.data)
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Không tải được báo cáo yêu cầu.')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadReport(), 0)
    return () => window.clearTimeout(timer)
  }, [loadReport])

  const cards = useMemo(() => [
    ['Tổng yêu cầu', report?.totalRequests],
    ['Đang mở', report?.openRequests],
    ['Hoàn tất', report?.completedRequests],
    ['Quá hạn phản hồi', report?.activeResponseOverdue],
    ['SLA đạt', formatRate(report?.responseSlaMetRate)],
    ['Tỷ lệ duyệt', formatRate(report?.approvalRate)],
  ], [report])

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-600">Báo cáo yêu cầu</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">SLA phản hồi và nhu cầu sử dụng</h2>
            <p className="mt-2 text-sm text-slate-500">Theo dõi tốc độ phản hồi, tỷ lệ xử lý và vật tư được yêu cầu nhiều.</p>
          </div>
          <ChartBar size={32} className="text-orange-500" />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-semibold text-slate-500">Từ ngày<input type="date" value={filters.fromDate} onChange={(event) => setFilters((current) => ({ ...current, fromDate: event.target.value }))} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label>
          <label className="text-xs font-semibold text-slate-500">Đến ngày<input type="date" value={filters.toDate} onChange={(event) => setFilters((current) => ({ ...current, toDate: event.target.value }))} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label>
          {user?.role === 'Admin' && <label className="text-xs font-semibold text-slate-500">Bộ phận<select value={filters.targetRole} onChange={(event) => setFilters((current) => ({ ...current, targetRole: event.target.value }))} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="">Tất cả</option><option value="Admin">Admin – thiết bị</option><option value="ConsumableManager">Quản lý vật tư</option></select></label>}
          <button type="button" onClick={loadReport} disabled={loading} className="inline-flex items-center justify-center gap-2 self-end rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Refresh size={16} /> {loading ? 'Đang tải...' : 'Làm mới'}</button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{typeof value === 'string' ? value : formatNumber(value)}</p></div>)}
      </section>

      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">Hiệu quả phản hồi</h3>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><span>Đã có phản hồi</span><b>{formatNumber(report?.respondedRequests)}</b></div>
            <div className="flex justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><span>Thời gian phản hồi trung bình</span><b>{Number(report?.averageFirstResponseMinutes || 0).toFixed(1)} phút</b></div>
            <div className="flex justify-between rounded-xl bg-red-50 p-3 text-red-700"><span>Tổng lần vi phạm SLA</span><b>{formatNumber(report?.responseSlaBreaches)}</b></div>
            <div className="flex justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><span>Từ chối / Nhân viên hủy</span><b>{formatNumber(report?.rejectedRequests)} / {formatNumber(report?.cancelledRequests)}</b></div>
          </div>
          <h4 className="mt-5 text-sm font-semibold text-slate-700 dark:text-slate-200">Theo trạng thái</h4>
          <div className="mt-2 flex flex-wrap gap-2">{Object.entries(report?.statusCounts || {}).map(([status, count]) => { const meta = getInquiryStatusMeta(status); return <span key={status} className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.className}`}>{meta.label}: {count}</span> })}</div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 p-5 dark:border-slate-800"><h3 className="font-semibold text-slate-900 dark:text-slate-100">Top nhu cầu vật tư</h3><p className="mt-1 text-sm text-slate-500">Tổng hợp theo số lượng nhân viên yêu cầu trong kỳ.</p></div>
          <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-950"><tr><th className="px-4 py-3">Vật tư</th><th className="px-4 py-3">Số yêu cầu</th><th className="px-4 py-3">Tổng số lượng</th></tr></thead><tbody>{(report?.topConsumableDemand || []).map((item) => <tr key={item.assetQaCode} className="border-t border-slate-100 dark:border-slate-800"><td className="px-4 py-3"><b>{item.assetName}</b><p className="text-xs text-slate-400">{item.assetQaCode}</p></td><td className="px-4 py-3">{formatNumber(item.requestCount)}</td><td className="px-4 py-3 font-semibold">{formatNumber(item.totalQuantityRequested)} {item.unit || ''}</td></tr>)}{!loading && (report?.topConsumableDemand || []).length === 0 && <tr><td colSpan="3" className="px-4 py-8 text-center text-slate-500">Chưa có yêu cầu vật tư trong kỳ.</td></tr>}</tbody></table></div>
        </section>
      </div>
    </div>
  )
}

export default InquiryReports
