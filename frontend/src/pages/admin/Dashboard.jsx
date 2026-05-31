import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import axiosClient from '../../api/axiosClient'
import HelpdeskKpiPanel from '../../components/HelpdeskKpiPanel'
import { getSessionCache, setSessionCache } from '../../utils/sessionCache'

const chartColors = ['#22c55e', '#3b82f6', '#ef4444', '#f59e0b']
const DASHBOARD_CACHE_TTL_MS = 30_000
const SUMMARY_CACHE_KEY = 'mhv-admin-dashboard-summary'
const SUGGESTIONS_CACHE_KEY = 'mhv-admin-dashboard-suggestions'
const HELPDESK_CACHE_KEY = 'mhv-admin-dashboard-helpdesk'
const CHART_CURSOR = { fill: 'rgba(148, 163, 184, 0.12)' }

function formatCompactNumber(value) {
  return Number(value || 0).toLocaleString('vi-VN')
}

function formatPercentage(value) {
  const safeValue = Number(value) || 0
  return `${safeValue.toFixed(1)}%`
}

function buildRate(numerator, denominator) {
  if (!denominator) return 0
  return (numerator / denominator) * 100
}

function DashboardTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="min-w-[11rem] rounded-xl border border-slate-700 bg-slate-950/95 px-3 py-2 shadow-2xl backdrop-blur">
      {label ? <p className="mb-2 text-sm font-semibold text-slate-100">{label}</p> : null}
      <div className="space-y-1.5">
        {payload.map((entry) => (
          <div key={`${entry.dataKey}-${entry.name}`} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-slate-300">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: entry.color || entry.payload?.fill || '#94a3b8' }}
              />
              <span>{entry.name}</span>
            </span>
            <span className="font-semibold text-slate-100">{formatCompactNumber(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function DashboardSection({ title, subtitle, children, action }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function EmptyChartState({ text }) {
  return (
    <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
      {text}
    </div>
  )
}

function Dashboard() {
  const cachedSummary = useMemo(() => getSessionCache(SUMMARY_CACHE_KEY), [])
  const cachedSuggestions = useMemo(() => getSessionCache(SUGGESTIONS_CACHE_KEY), [])
  const cachedHelpdeskKpis = useMemo(() => getSessionCache(HELPDESK_CACHE_KEY), [])
  const [summary, setSummary] = useState({
    totalAssets: cachedSummary?.totalAssets || 0,
    inUseAssets: cachedSummary?.inUseAssets || 0,
    brokenAssets: cachedSummary?.brokenAssets || 0,
    maintenanceAssets: cachedSummary?.maintenanceAssets || 0,
    availableAssets: cachedSummary?.availableAssets || 0,
  })
  const [suggestions, setSuggestions] = useState(cachedSuggestions || [])
  const [helpdeskKpis, setHelpdeskKpis] = useState(cachedHelpdeskKpis || null)
  const [summaryLoading, setSummaryLoading] = useState(!cachedSummary)
  const [suggestionsLoading, setSuggestionsLoading] = useState(!cachedSuggestions)
  const [helpdeskLoading, setHelpdeskLoading] = useState(!cachedHelpdeskKpis)

  useEffect(() => {
    let mounted = true

    const fetchSummary = async () => {
      try {
        const response = await axiosClient.get('/api/dashboard/summary')
        if (!mounted) return
        const nextSummary = response.data || {
          totalAssets: 0,
          inUseAssets: 0,
          brokenAssets: 0,
          maintenanceAssets: 0,
          availableAssets: 0,
        }

        setSummary(nextSummary)
        setSessionCache(SUMMARY_CACHE_KEY, nextSummary, DASHBOARD_CACHE_TTL_MS)
      } catch (error) {
        if (!cachedSummary) {
          const message = error?.response?.data?.message || 'Không thể tải số liệu tài sản.'
          toast.error(message)
        }
      } finally {
        if (mounted) setSummaryLoading(false)
      }
    }

    const fetchSuggestions = async () => {
      try {
        const response = await axiosClient.get('/api/dashboard/smart-suggestions')
        if (!mounted) return
        const nextSuggestions = response.data?.suggestions || []
        setSuggestions(nextSuggestions)
        setSessionCache(SUGGESTIONS_CACHE_KEY, nextSuggestions, DASHBOARD_CACHE_TTL_MS)
      } catch (error) {
        if (!cachedSuggestions) {
          const message = error?.response?.data?.message || 'Không thể tải gợi ý quản trị.'
          toast.error(message)
        }
      } finally {
        if (mounted) setSuggestionsLoading(false)
      }
    }

    const fetchHelpdesk = async () => {
      try {
        const response = await axiosClient.get('/api/dashboard/helpdesk-kpis/admin')
        if (!mounted) return
        const nextHelpdeskKpis = response.data || null
        setHelpdeskKpis(nextHelpdeskKpis)
        setSessionCache(HELPDESK_CACHE_KEY, nextHelpdeskKpis, DASHBOARD_CACHE_TTL_MS)
      } catch (error) {
        if (!cachedHelpdeskKpis) {
          const message = error?.response?.data?.message || 'Không thể tải số liệu helpdesk.'
          toast.error(message)
        }
      } finally {
        if (mounted) setHelpdeskLoading(false)
      }
    }

    void fetchSummary()
    void fetchSuggestions()
    void fetchHelpdesk()
    return () => {
      mounted = false
    }
  }, [cachedHelpdeskKpis, cachedSuggestions, cachedSummary])

  const assetStatusData = useMemo(
    () => [
      { name: 'Hoạt động tốt', value: summary.availableAssets, fill: '#22c55e' },
      { name: 'Đang cho mượn', value: summary.inUseAssets, fill: '#3b82f6' },
      { name: 'Hỏng', value: summary.brokenAssets, fill: '#ef4444' },
      { name: 'Đang sửa chữa', value: summary.maintenanceAssets, fill: '#f59e0b' },
    ],
    [summary],
  )

  const helpdeskStatusChartData = useMemo(
    () => [
      { name: 'Ticket mới', value: helpdeskKpis?.newTicketCount || 0, fill: '#f59e0b' },
      { name: 'Đang xử lý', value: helpdeskKpis?.inProgressTicketCount || 0, fill: '#3b82f6' },
      { name: 'Đã xử lý', value: helpdeskKpis?.resolvedTicketCount || 0, fill: '#22c55e' },
      { name: 'Quá hạn', value: helpdeskKpis?.overdueTicketCount || 0, fill: '#ef4444' },
    ],
    [helpdeskKpis],
  )

  const technicianChartData = useMemo(() => {
    return [...(helpdeskKpis?.ticketsByTechnician || [])]
      .sort((a, b) => (b.assignedTicketCount || 0) - (a.assignedTicketCount || 0))
      .slice(0, 6)
      .map((item) => ({
        name: item.technicianName || item.technicianUsername || `KTV ${item.technicianId}`,
        assigned: item.assignedTicketCount || 0,
        resolved: item.resolvedTicketCount || 0,
        inProgress: item.inProgressTicketCount || 0,
        overdue: item.overdueTicketCount || 0,
      }))
  }, [helpdeskKpis])

  const totalIssueAssets = summary.brokenAssets + summary.maintenanceAssets
  const technicallyHealthyAssets = summary.availableAssets + summary.inUseAssets
  const availabilityRate = buildRate(summary.availableAssets, summary.totalAssets)
  const issueRate = buildRate(totalIssueAssets, summary.totalAssets)

  const cards = [
    { label: 'Tổng thiết bị', value: summary.totalAssets },
    { label: 'Hoạt động tốt', value: technicallyHealthyAssets },
    { label: 'Tại vị trí gốc', value: summary.availableAssets },
    { label: 'Đang cho mượn', value: summary.inUseAssets },
    { label: 'Hỏng', value: summary.brokenAssets },
    { label: 'Đang sửa chữa', value: summary.maintenanceAssets },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {summaryLoading && !cachedSummary
          ? Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="animate-pulse rounded-xl bg-white p-4 shadow-sm">
                <div className="h-3 w-20 rounded bg-slate-200" />
                <div className="mt-3 h-7 w-14 rounded bg-slate-200" />
              </div>
            ))
          : cards.map((card) => (
              <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-medium text-slate-500">{card.label}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCompactNumber(card.value)}</p>
              </div>
            ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <DashboardSection
          title="Phân bố trạng thái thiết bị"
          subtitle="Theo dõi nhanh sức khỏe tài sản toàn hệ thống."
        >
          {summaryLoading && !cachedSummary ? (
            <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="h-80 animate-pulse rounded-xl border border-slate-100 bg-slate-100" />
              <div className="grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="h-28 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
                  <div className="h-28 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
                </div>
                <div className="h-52 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
              </div>
            </div>
          ) : (
          <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="h-80 rounded-xl border border-slate-100 bg-slate-50/50 p-2">
              {assetStatusData.some((item) => item.value > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={assetStatusData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={58}
                      outerRadius={102}
                      paddingAngle={3}
                      labelLine={false}
                      label={({ percent }) => (percent >= 0.05 ? `${Math.round(percent * 100)}%` : '')}
                    >
                      {assetStatusData.map((entry, index) => (
                        <Cell key={entry.name} fill={entry.fill || chartColors[index % chartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<DashboardTooltip />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartState text="Chưa có dữ liệu trạng thái thiết bị." />
              )}
            </div>

            <div className="grid gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-700">Giải thích theo mô hình 2 lớp trạng thái</p>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-sm font-semibold text-slate-700">Tình trạng kỹ thuật</p>
                    <div className="mt-2 space-y-2 text-sm text-slate-700">
                      <p><span className="font-semibold">Hoạt động tốt:</span> {formatCompactNumber(technicallyHealthyAssets)}</p>
                      <p><span className="font-semibold">Hỏng:</span> {formatCompactNumber(summary.brokenAssets)}</p>
                      <p><span className="font-semibold">Đang sửa chữa:</span> {formatCompactNumber(summary.maintenanceAssets)}</p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-sm font-semibold text-slate-700">Vị trí sử dụng</p>
                    <div className="mt-2 space-y-2 text-sm text-slate-700">
                      <p><span className="font-semibold">Tại vị trí gốc:</span> {formatCompactNumber(summary.availableAssets)}</p>
                      <p><span className="font-semibold">Đang cho mượn:</span> {formatCompactNumber(summary.inUseAssets)}</p>
                      <p className="text-xs text-slate-500">Vị trí gốc nghĩa là phòng ban, khu vực sở hữu tài sản. </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Tỷ lệ tại vị trí gốc</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{formatPercentage(availabilityRate)}</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    {formatCompactNumber(summary.availableAssets)} / {formatCompactNumber(summary.totalAssets)} thiết bị
                  </p>
                </div>
                <div className="rounded-xl border border-orange-200 bg-orange-50/70 p-4 dark:border-orange-500/30 dark:bg-orange-500/10">
                  <p className="text-xs font-medium text-orange-700 dark:text-orange-300">Tỷ lệ cần xử lý</p>
                  <p className="mt-2 text-2xl font-semibold text-orange-900 dark:text-orange-200">{formatPercentage(issueRate)}</p>
                  <p className="mt-1 text-sm text-orange-700 dark:text-orange-300">
                    {formatCompactNumber(totalIssueAssets)} thiết bị hỏng/bảo trì
                  </p>
                </div>
              </div>

              <div className="h-52 rounded-xl border border-slate-200 p-3">
                <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Số lượng tuyệt đối theo trạng thái</p>
                {assetStatusData.some((item) => item.value > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={assetStatusData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip content={<DashboardTooltip />} cursor={CHART_CURSOR} />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                        {assetStatusData.map((entry) => (
                          <Cell key={`asset-bar-${entry.name}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChartState text="Chưa có dữ liệu để dựng biểu đồ cột." />
                )}
              </div>
            </div>
          </div>
          )}
        </DashboardSection>

        <DashboardSection
          title="Gợi ý quản trị"
          subtitle="Những điểm cần ưu tiên theo dõi trong kỳ hiện tại."
          action={(
            <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
              {suggestions.length} gợi ý
            </span>
          )}
        >
          <div className="space-y-3">
            {suggestionsLoading && suggestions.length === 0 && (
              <p className="text-sm text-slate-500">Đang tải gợi ý...</p>
            )}
            {suggestions.map((text, index) => (
              <div key={`${index}-${text}`} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700">
                    {index + 1}
                  </span>
                  <p className="text-sm leading-6 text-slate-700">{text}</p>
                </div>
              </div>
            ))}
            {!suggestionsLoading && suggestions.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                Chưa có gợi ý quản trị nổi bật.
              </p>
            )}
          </div>
        </DashboardSection>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <DashboardSection
          title="Tổng quan helpdesk"
          subtitle="So sánh nhanh ticket mới, đang xử lý, đã hoàn tất và quá hạn."
        >
          {helpdeskLoading && !cachedHelpdeskKpis ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="h-24 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
                <div className="h-24 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
              </div>
              <div className="h-72 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
            </div>
          ) : (
          <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium text-slate-500">Ticket đang hoạt động</p>
              <p className="mt-2 text-2xl font-semibold text-slate-800">{formatCompactNumber(helpdeskKpis?.activeTicketCount || 0)}</p>
              <p className="mt-1 text-sm text-slate-500">Bao gồm ticket mới và đang xử lý</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium text-slate-500">Tỷ lệ quá hạn SLA</p>
              <p className="mt-2 text-2xl font-semibold text-slate-800">{formatPercentage(helpdeskKpis?.overdueSlaRate || 0)}</p>
              <p className="mt-1 text-sm text-slate-500">
                {formatCompactNumber(helpdeskKpis?.overdueTicketCount || 0)} ticket đang quá hạn
              </p>
            </div>
          </div>

          <div className="mt-4 h-72 rounded-xl border border-slate-200 p-3">
            {helpdeskStatusChartData.some((item) => item.value > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={helpdeskStatusChartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip content={<DashboardTooltip />} cursor={CHART_CURSOR} />
                  <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                    {helpdeskStatusChartData.map((entry) => (
                      <Cell key={`helpdesk-status-${entry.name}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartState text="Chưa có dữ liệu helpdesk để dựng biểu đồ." />
            )}
          </div>
          </>
          )}
        </DashboardSection>

        <DashboardSection
          title="Kỹ thuật viên nổi bật"
          subtitle="Top kỹ thuật viên có nhiều ticket được giao nhất."
        >
          {helpdeskLoading && !cachedHelpdeskKpis ? (
            <div className="h-[22rem] animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
          ) : (
          <div className="h-[22rem] rounded-xl border border-slate-200 p-3">
            {technicianChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={technicianChartData}
                  layout="vertical"
                  margin={{ top: 8, right: 20, left: 20, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip content={<DashboardTooltip />} cursor={CHART_CURSOR} />
                  <Legend />
                  <Bar dataKey="resolved" stackId="tickets" name="Đã xử lý" fill="#22c55e" />
                  <Bar dataKey="inProgress" stackId="tickets" name="Đang xử lý" fill="#3b82f6" />
                  <Bar dataKey="overdue" stackId="tickets" name="Quá hạn" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartState text="Chưa có dữ liệu kỹ thuật viên để so sánh." />
            )}
          </div>
          )}
        </DashboardSection>
      </div>

      <HelpdeskKpiPanel
        title="KPI vận hành Admin"
        subtitle="Bộ KPI giai đoạn 2 cho dashboard quản trị, dùng ticket SLA, sức khỏe tài sản, vật tư và kiểm kê có hạn hoàn tất."
        summary={helpdeskKpis}
        loading={helpdeskLoading}
      />
    </div>
  )
}

export default Dashboard
