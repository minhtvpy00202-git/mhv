import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import axiosClient from '../../api/axiosClient'
import HelpdeskKpiPanel from '../../components/HelpdeskKpiPanel'
import { getSessionCache, setSessionCache } from '../../utils/sessionCache'

const chartColors = ['#22c55e', '#3b82f6', '#ef4444', '#f59e0b']
const DASHBOARD_CACHE_TTL_MS = 30_000
const SUMMARY_CACHE_KEY = 'mhv-admin-dashboard-summary'
const SUGGESTIONS_CACHE_KEY = 'mhv-admin-dashboard-suggestions'
const HELPDESK_CACHE_KEY = 'mhv-admin-dashboard-helpdesk'

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
          setHelpdeskLoading(false)
          setHelpdeskLoading(false)
        }
      }
    }

    fetchDashboard()
    return () => {
      mounted = false
    }
  }, [cachedHelpdeskKpis, cachedSuggestions, cachedSummary])

  const chartData = useMemo(
    () => [
      { name: 'Sẵn sàng', value: summary.availableAssets },
      { name: 'Đang sử dụng', value: summary.inUseAssets },
      { name: 'Hỏng', value: summary.brokenAssets },
      { name: 'Bảo trì', value: summary.maintenanceAssets },
    ],
    [summary],
  )

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
            <p className="mt-1 text-2xl font-semibold text-slate-800">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="h-80 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">Tỷ lệ trạng thái thiết bị</h2>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              labelLine={false}
              label={({ percent }) => (percent >= 0.05 ? `${Math.round(percent * 100)}%` : '')}
            >
              {chartData.map((entry, index) => (
                <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">Gợi ý thông minh</h2>
        <div className="mt-3 space-y-2">
          {suggestionsLoading && suggestions.length === 0 && (
            <p className="text-sm text-slate-500">Đang tải gợi ý...</p>
          )}
          {suggestions.map((text, index) => (
            <p key={`${index}-${text}`} className="rounded-lg border border-orange-100 bg-orange-50 px-3 py-2 text-sm text-slate-700">
              {text}
            </p>
          ))}
        </div>
      </div>

      <HelpdeskKpiPanel
        title="Helpdesk KPI"
        subtitle="Các KPI cho hệ thống ticket hỗ trợ và bảo trì."
        summary={helpdeskKpis}
        loading={helpdeskLoading}
      />
    </div>
  )
}

export default Dashboard
