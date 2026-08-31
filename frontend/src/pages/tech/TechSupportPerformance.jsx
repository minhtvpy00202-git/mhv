import {
  IconChartBar as ChartBar,
  IconRefresh as Refresh,
  IconSparkles as Sparkles,
} from '@tabler/icons-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import axiosClient from '../../api/axiosClient'
import HelpdeskKpiPanel from '../../components/HelpdeskKpiPanel'

function TechSupportPerformance() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)

  const loadPerformance = useCallback(async () => {
    setLoading(true)
    try {
      const response = await axiosClient.get('/api/dashboard/helpdesk-kpis/me')
      setSummary(response.data)
    } catch (error) {
      const message = error?.response?.data?.message || 'Không tải được KPI cá nhân.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPerformance()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadPerformance])

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[28px] border border-violet-100 bg-gradient-to-br from-white via-violet-50/70 to-blue-50 p-5 shadow-sm dark:border-violet-500/20 dark:from-slate-950 dark:via-slate-950 dark:to-violet-950/30 sm:p-6">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-violet-200/40 blur-3xl dark:bg-violet-500/10" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-violet-600 dark:text-violet-300">
              <Sparkles size={15} /> Báo cáo kỹ thuật viên
            </p>
            <h2 className="mt-2 flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-200 dark:shadow-none">
                <ChartBar size={23} />
              </span>
              Hiệu suất cá nhân
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              KPI tiếp nhận, hoàn tất đúng hạn, tỷ lệ tái lỗi và mức hài lòng của người dùng.
            </p>
          </div>
          <button
            type="button"
            onClick={loadPerformance}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/80 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <Refresh size={17} className={loading ? 'animate-spin' : ''} />
            Làm mới KPI
          </button>
        </div>
      </section>

      <HelpdeskKpiPanel
        title="Tổng quan KPI"
        subtitle="Các chỉ số được tổng hợp từ những ticket bạn đã tiếp nhận và xử lý."
        summary={summary}
        loading={loading}
        tableTitle="Chi tiết xếp loại của bạn"
        emptyText="Chưa có dữ liệu KPI cá nhân."
      />
    </div>
  )
}

export default TechSupportPerformance
