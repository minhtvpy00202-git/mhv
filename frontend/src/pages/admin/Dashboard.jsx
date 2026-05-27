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

function DashboardSection({ title, subtitle, children, action }) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-800">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function EmptyChartState({ text }) {
  return (
    <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 text-sm text-slate-500">
      {text}
    </div>
  )
}

function Dashboard() {
  const cachedSummary = getSessionCache(SUMMARY_CACHE_KEY)
  const cachedSuggestions = getSessionCache(SUGGESTIONS_CACHE_KEY)
  const cachedHelpdeskKpis = getSessionCache(HELPDESK_CACHE_KEY)
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

    const fetchDashboard = async () => {
      try {
        const response = await axiosClient.get('/api/dashboard/bootstrap')
        if (!mounted) return
        const nextSummary = response.data?.summary || {
          totalAssets: 0,
          inUseAssets: 0,
          brokenAssets: 0,
          maintenanceAssets: 0,
          availableAssets: 0,
        }
        const nextSuggestions = response.data?.smartSuggestions?.suggestions || []
        const nextHelpdeskKpis = response.data?.helpdeskKpis || null

        setSummary(nextSummary)
        setSuggestions(nextSuggestions)
        setHelpdeskKpis(nextHelpdeskKpis)
        setSessionCache(SUMMARY_CACHE_KEY, nextSummary, DASHBOARD_CACHE_TTL_MS)
        setSessionCache(SUGGESTIONS_CACHE_KEY, nextSuggestions, DASHBOARD_CACHE_TTL_MS)
        setSessionCache(HELPDESK_CACHE_KEY, nextHelpdeskKpis, DASHBOARD_CACHE_TTL_MS)
      } catch (error) {
        if (!cachedSummary && !cachedSuggestions && !cachedHelpdeskKpis) {
          const message = error?.response?.data?.message || 'Không thể tải dữ liệu dashboard.'
          toast.error(message)
        }
      } finally {
        if (mounted) {
          setSummaryLoading(false)
          setSuggestionsLoading(false)
          setHelpdeskLoading(false)
        }
      }
    }

    fetchDashboard()
    return () => {
      mounted = false
    }
  }, [cachedHelpdeskKpis, cachedSuggestions, cachedSummary])

  const assetStatusData = useMemo(
    () => [
      { name: 'Sẵn sàng', value: summary.availableAssets, fill: '#22c55e' },
      { name: 'Đang sử dụng', value: summary.inUseAssets, fill: '#3b82f6' },
      { name: 'Hỏng', value: summary.brokenAssets, fill: '#ef4444' },
      { name: 'Bảo trì', value: summary.maintenanceAssets, fill: '#f59e0b' },
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
  const availabilityRate = buildRate(summary.availableAssets, summary.totalAssets)
  const issueRate = buildRate(totalIssueAssets, summary.totalAssets)

  const cards = [
    { label: 'Tổng thiết bị', value: summary.totalAssets },
    { label: 'Sẵn sàng', value: summary.availableAssets },
    { label: 'Đang sử dụng', value: summary.inUseAssets },
    { label: 'Hỏng', value: summary.brokenAssets },
    { label: 'Bảo trì', value: summary.maintenanceAssets },
  ]

  if (summaryLoading && suggestionsLoading && helpdeskLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="animate-pulse rounded-xl bg-white p-4 shadow-sm">
              <div className="h-3 w-20 rounded bg-slate-200" />
              <div className="mt-3 h-7 w-14 rounded bg-slate-200" />
            </div>
          ))}
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="h-4 w-44 animate-pulse rounded bg-slate-200" />
          <div className="mt-4 h-64 animate-pulse rounded-xl bg-slate-100" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-800">{formatCompactNumber(card.value)}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <DashboardSection
          title="Phân bố trạng thái thiết bị"
          subtitle="Theo dõi nhanh sức khỏe tài sản toàn hệ thống."
        >
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
                    <Tooltip formatter={(value) => formatCompactNumber(value)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartState text="Chưa có dữ liệu trạng thái thiết bị." />
              )}
            </div>

            <div className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs font-medium text-emerald-700">Tỷ lệ sẵn sàng</p>
                  <p className="mt-2 text-2xl font-semibold text-emerald-800">{formatPercentage(availabilityRate)}</p>
                  <p className="mt-1 text-sm text-emerald-700">
                    {formatCompactNumber(summary.availableAssets)} / {formatCompactNumber(summary.totalAssets)} thiết bị
                  </p>
                </div>
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                  <p className="text-xs font-medium text-rose-700">Tỷ lệ cần xử lý</p>
                  <p className="mt-2 text-2xl font-semibold text-rose-800">{formatPercentage(issueRate)}</p>
                  <p className="mt-1 text-sm text-rose-700">
                    {formatCompactNumber(totalIssueAssets)} thiết bị hỏng/bảo trì
                  </p>
                </div>
              </div>

              <div className="h-52 rounded-xl border border-slate-200 p-3">
                <p className="mb-2 text-sm font-semibold text-slate-700">Số lượng tuyệt đối theo trạng thái</p>
                {assetStatusData.some((item) => item.value > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={assetStatusData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value) => formatCompactNumber(value)} />
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
        </DashboardSection>

        <DashboardSection
          title="Gợi ý quản trị"
          subtitle="Những điểm cần ưu tiên theo dõi trong kỳ hiện tại."
          action={(
            <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
              {suggestions.length} gợi ý
            </span>
          )}
        >
          <div className="space-y-3">
            {suggestionsLoading && suggestions.length === 0 && (
              <p className="text-sm text-slate-500">Đang tải gợi ý...</p>
            )}
            {suggestions.map((text, index) => (
              <div key={`${index}-${text}`} className="rounded-xl border border-orange-100 bg-orange-50 px-4 py-3">
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
                  <Tooltip formatter={(value) => formatCompactNumber(value)} />
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
        </DashboardSection>

        <DashboardSection
          title="Kỹ thuật viên nổi bật"
          subtitle="Top kỹ thuật viên có nhiều ticket được giao nhất."
        >
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
                  <Tooltip formatter={(value) => formatCompactNumber(value)} />
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
        </DashboardSection>
      </div>

      <HelpdeskKpiPanel
        title="Helpdesk KPI Chi Tiết"
        subtitle="Các KPI chi tiết cho hệ thống ticket hỗ trợ và bảo trì."
        summary={helpdeskKpis}
        loading={helpdeskLoading}
      />
    </div>
  )
}

export default Dashboard
