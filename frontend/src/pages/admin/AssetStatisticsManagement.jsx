import {
  IconDownload,
  IconFilter,
  IconRefresh,
} from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import axiosClient from '../../api/axiosClient'

const chartColors = ['#2563eb', '#16a34a', '#f97316', '#dc2626', '#7c3aed', '#0891b2', '#ca8a04']
const chartCursor = { fill: 'rgba(148, 163, 184, 0.12)' }

function toInputDate(date) {
  const normalized = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return normalized.toISOString().slice(0, 10)
}

function buildDefaultFilters() {
  const toDate = new Date()
  const fromDate = new Date()
  fromDate.setDate(toDate.getDate() - 29)
  return {
    fromDate: toInputDate(fromDate),
    toDate: toInputDate(toDate),
    categoryId: '',
    locationId: '',
  }
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('vi-VN')
}

function formatCurrency(value) {
  const numericValue = Number(value || 0)
  return `${numericValue.toLocaleString('vi-VN')} VND`
}

function formatDate(value) {
  if (!value) return 'Chưa cập nhật'
  return new Date(value).toLocaleDateString('vi-VN')
}

function formatShortDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
}

function buildParams(filters) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== '' && value !== null && value !== undefined),
  )
}

function withColors(items = []) {
  return items.map((item, index) => ({
    ...item,
    fill: chartColors[index % chartColors.length],
  }))
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="min-w-40 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm shadow-xl">
      {label ? <p className="mb-2 font-semibold text-slate-100">{label}</p> : null}
      <div className="space-y-1.5">
        {payload.map((entry) => (
          <div key={`${entry.name}-${entry.dataKey}`} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-slate-300">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color || entry.payload?.fill }} />
              {entry.name}
            </span>
            <span className="font-semibold text-white">{formatNumber(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Section({ title, subtitle, children, action }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function EmptyState({ text = 'Chưa có dữ liệu.' }) {
  return (
    <div className="flex h-full min-h-40 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
      {text}
    </div>
  )
}

function KpiCard({ label, value, helper, tone = 'slate' }) {
  const toneClass = {
    slate: 'border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100',
    blue: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100',
    orange: 'border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-100',
    red: 'border-red-200 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100',
  }[tone]
  return (
    <div className={`min-h-28 rounded-xl border p-4 shadow-sm ${toneClass}`}>
      <p className="text-sm font-medium opacity-75">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      {helper ? <p className="mt-1 text-xs opacity-70">{helper}</p> : null}
    </div>
  )
}

function RankingTable({ rows, valueLabel = 'Lượt', emptyText }) {
  if (!rows?.length) return <EmptyState text={emptyText} />
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
      <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
          <tr>
            <th className="px-3 py-2">Thiết bị</th>
            <th className="px-3 py-2">Loại</th>
            <th className="px-3 py-2">Vị trí</th>
            <th className="px-3 py-2 text-right">{valueLabel}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((item) => (
            <tr key={`${item.qaCode}-${item.name}`} className="bg-white dark:bg-slate-950">
              <td className="px-3 py-3">
                <p className="font-semibold text-slate-900 dark:text-slate-100">{item.name || 'Chưa cập nhật'}</p>
                <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{item.qaCode}</p>
              </td>
              <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{item.categoryName || 'Chưa cập nhật'}</td>
              <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{item.locationName || 'Chưa cập nhật'}</td>
              <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {formatNumber(item.count)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LowStockTable({ rows }) {
  if (!rows?.length) return <EmptyState text="Không có vật tư dưới ngưỡng." />
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
      <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
          <tr>
            <th className="px-3 py-2">Vật tư</th>
            <th className="px-3 py-2">Loại</th>
            <th className="px-3 py-2">Vị trí</th>
            <th className="px-3 py-2 text-right">Tồn</th>
            <th className="px-3 py-2 text-right">Ngưỡng</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((item) => (
            <tr key={`${item.qaCode}-${item.name}`} className="bg-white dark:bg-slate-950">
              <td className="px-3 py-3">
                <p className="font-semibold text-slate-900 dark:text-slate-100">{item.name || 'Chưa cập nhật'}</p>
                <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{item.qaCode}</p>
              </td>
              <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{item.categoryName || 'Chưa cập nhật'}</td>
              <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{item.locationName || 'Chưa cập nhật'}</td>
              <td className="px-3 py-3 text-right font-semibold tabular-nums text-red-700 dark:text-red-300">
                {formatNumber(item.quantityOnHand)} {item.unit || ''}
              </td>
              <td className="px-3 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">
                {formatNumber(item.minimumStock)} {item.unit || ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AuditList({ rows }) {
  if (!rows?.length) return <EmptyState text="Chưa có phiên kiểm kê trong kỳ." />
  return (
    <div className="space-y-3">
      {rows.map((item) => (
        <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-slate-900 dark:text-slate-100">#{item.id} {item.locationName}</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {formatDate(item.startedAt)}{item.completedAt ? ` - ${formatDate(item.completedAt)}` : ''}
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {item.status}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
            <p><span className="font-semibold">{formatNumber(item.expectedCount)}</span> dự kiến</p>
            <p><span className="font-semibold">{formatNumber(item.scannedCount)}</span> đã quét</p>
            <p><span className="font-semibold text-red-600 dark:text-red-300">{formatNumber(item.missingCount)}</span> thiếu</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function AssetStatisticsManagement() {
  const initialFilters = useMemo(() => buildDefaultFilters(), [])
  const [filters, setFilters] = useState(initialFilters)
  const [statistics, setStatistics] = useState(null)
  const [categories, setCategories] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  const loadStatistics = useCallback(async (nextFilters = filters, suppressError = false) => {
    setLoading(true)
    try {
      const response = await axiosClient.get('/api/assets/statistics/bootstrap', {
        params: buildParams(nextFilters),
      })
      setStatistics(response.data || null)
    } catch (error) {
      if (!suppressError) {
        toast.error(error?.response?.data?.message || 'Không tải được dữ liệu thống kê.')
      }
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    let mounted = true
    const bootstrap = async () => {
      setLoading(true)
      try {
        const [statisticsResponse, categoriesResponse, locationsResponse] = await Promise.all([
          axiosClient.get('/api/assets/statistics/bootstrap', { params: buildParams(initialFilters) }),
          axiosClient.get('/api/categories/options'),
          axiosClient.get('/api/locations', { params: { hasAsset: true } }),
        ])
        if (!mounted) return
        setStatistics(statisticsResponse.data || null)
        setCategories(categoriesResponse.data || [])
        setLocations(locationsResponse.data || [])
      } catch (error) {
        if (mounted) {
          toast.error(error?.response?.data?.message || 'Không tải được dữ liệu thống kê.')
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    void bootstrap()
    return () => {
      mounted = false
    }
  }, [initialFilters])

  const summary = statistics?.summary || {}
  const fixedStatusData = useMemo(() => withColors(statistics?.fixedAssetStatus || []), [statistics])
  const consumableStockData = useMemo(() => withColors(statistics?.consumableStockStatus || []), [statistics])
  const expiryData = useMemo(() => withColors(statistics?.expiryBuckets || []), [statistics])
  const trendData = useMemo(() => {
    const ticketsByDate = new Map((statistics?.ticketTrend || []).map((item) => [item.date, item.count]))
    return (statistics?.borrowTrend || []).map((item) => ({
      date: item.date,
      label: formatShortDate(item.date),
      borrow: item.count,
      ticket: ticketsByDate.get(item.date) || 0,
    }))
  }, [statistics])

  const handleFilterSubmit = (event) => {
    event.preventDefault()
    void loadStatistics(filters)
  }

  const handleReset = () => {
    const nextFilters = buildDefaultFilters()
    setFilters(nextFilters)
    void loadStatistics(nextFilters)
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const response = await axiosClient.get('/api/assets/statistics/export', {
        params: buildParams(filters),
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'thong-ke-tai-san.xlsx')
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Không thể xuất thống kê.')
    } finally {
      setExporting(false)
    }
  }

  const tabs = [
    { id: 'overview', label: 'Tổng quan' },
    { id: 'fixed-assets', label: 'Tài sản cố định' },
    { id: 'consumables', label: 'Vật tư' },
    { id: 'operations', label: 'Vận hành' },
  ]

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Quản lý tài sản</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">Thống kê tài sản</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Dữ liệu aggregate từ tài sản, vật tư, mượn trả, ticket và kiểm kê.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || loading}
            className="inline-flex items-center gap-2 rounded-lg border border-orange-200 px-3 py-2 text-sm font-semibold text-fptOrange hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-orange-500/30 dark:hover:bg-orange-500/10"
          >
            <IconDownload size={17} />
            {exporting ? 'Đang xuất...' : 'Xuất Excel'}
          </button>
        </div>

        <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-fptOrange text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleFilterSubmit} className="mt-4 grid gap-3 border-t border-slate-100 pt-4 dark:border-slate-800 md:grid-cols-5">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-600 dark:text-slate-300">Từ ngày</span>
            <input
              type="date"
              value={filters.fromDate}
              onChange={(event) => setFilters((prev) => ({ ...prev, fromDate: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-fptOrange focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-600 dark:text-slate-300">Đến ngày</span>
            <input
              type="date"
              value={filters.toDate}
              onChange={(event) => setFilters((prev) => ({ ...prev, toDate: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-fptOrange focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-600 dark:text-slate-300">Loại</span>
            <select
              value={filters.categoryId}
              onChange={(event) => setFilters((prev) => ({ ...prev, categoryId: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-fptOrange focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="">Tất cả loại</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-600 dark:text-slate-300">Vị trí</span>
            <select
              value={filters.locationId}
              onChange={(event) => setFilters((prev) => ({ ...prev, locationId: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-fptOrange focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="">Tất cả vị trí</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>{location.roomName}</option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-fptOrange px-3 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark disabled:cursor-not-allowed disabled:opacity-60"
            >
              <IconFilter size={17} />
              Lọc
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={loading}
              title="Đặt lại bộ lọc"
              aria-label="Đặt lại bộ lọc"
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <IconRefresh size={17} />
            </button>
          </div>
        </form>
      </section>

      {loading && !statistics ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-xl bg-white shadow-sm dark:bg-slate-950" />
          ))}
        </div>
      ) : (
        <>
          {activeTab === 'overview' && (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <KpiCard label="Tài sản cố định" value={formatNumber(summary.fixedAssetCount)} helper={formatCurrency(summary.fixedAssetValue)} tone="blue" />
                <KpiCard label="Vật tư tiêu hao" value={formatNumber(summary.consumableCount)} helper={formatCurrency(summary.consumableInventoryValue)} tone="green" />
                <KpiCard label="Đang mượn" value={formatNumber(summary.borrowedAssetCount)} helper={`${formatNumber(summary.borrowEventCount)} lượt trong kỳ`} tone="orange" />
                <KpiCard label="Cần xử lý" value={formatNumber((summary.brokenAssetCount || 0) + (summary.repairingAssetCount || 0) + (summary.lostAssetCount || 0))} helper="Hỏng, sửa chữa hoặc thất lạc" tone="red" />
                <KpiCard label="Vật tư cần nhập" value={formatNumber(summary.lowStockConsumableCount)} helper={`${formatNumber(summary.pendingConsumableRequestCount)} phiếu cấp phát chờ duyệt`} />
                <KpiCard label="Lô hết hạn" value={formatNumber(summary.expiredLotCount)} helper={`${formatNumber(summary.expiringSoonLotCount)} lô sắp hết hạn 30 ngày`} tone="red" />
                <KpiCard label="Ticket trong kỳ" value={formatNumber(summary.ticketCount)} helper="Theo ngày tạo ticket" />
                <KpiCard label="Kiểm kê trong kỳ" value={formatNumber(summary.auditCount)} helper={`${formatNumber(summary.auditMissingCount)} thiết bị thiếu`} />
              </div>

              <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                <Section title="Tài sản cố định theo trạng thái" subtitle="Tình trạng kỹ thuật và trạng thái sử dụng đã được backend chuẩn hóa.">
                  <div className="h-80">
                    {fixedStatusData.some((item) => item.count > 0) ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={fixedStatusData} dataKey="count" nameKey="label" innerRadius={56} outerRadius={104} paddingAngle={3}>
                            {fixedStatusData.map((entry) => <Cell key={entry.label} fill={entry.fill} />)}
                          </Pie>
                          <Tooltip content={<ChartTooltip />} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : <EmptyState text="Chưa có dữ liệu tài sản cố định." />}
                  </div>
                </Section>

                <Section title="Xu hướng vận hành" subtitle="Lượt mượn và ticket phát sinh trong khoảng thời gian đang lọc.">
                  <div className="h-80">
                    {trendData.some((item) => item.borrow > 0 || item.ticket > 0) ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trendData} margin={{ top: 12, right: 16, left: -20, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                          <Tooltip content={<ChartTooltip />} />
                          <Legend />
                          <Line type="monotone" dataKey="borrow" name="Lượt mượn" stroke="#f97316" strokeWidth={2.5} dot={false} />
                          <Line type="monotone" dataKey="ticket" name="Ticket" stroke="#2563eb" strokeWidth={2.5} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : <EmptyState text="Chưa có lượt mượn hoặc ticket trong kỳ." />}
                  </div>
                </Section>
              </div>
            </>
          )}

          {activeTab === 'fixed-assets' && (
            <>
              <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                <Section title="Tài sản cố định theo trạng thái" subtitle="Tình trạng kỹ thuật và trạng thái sử dụng đã được backend chuẩn hóa.">
                  <div className="h-80">
                    {fixedStatusData.some((item) => item.count > 0) ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={fixedStatusData} dataKey="count" nameKey="label" innerRadius={56} outerRadius={104} paddingAngle={3}>
                            {fixedStatusData.map((entry) => <Cell key={entry.label} fill={entry.fill} />)}
                          </Pie>
                          <Tooltip content={<ChartTooltip />} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : <EmptyState text="Chưa có dữ liệu tài sản cố định." />}
                  </div>
                </Section>

                <Section title="Top thiết bị được mượn" subtitle="Các thiết bị có lượt mượn cao nhất trong kỳ.">
                  <RankingTable rows={statistics?.topBorrowedAssets || []} emptyText="Chưa có dữ liệu mượn thiết bị." />
                </Section>
              </div>

              <Section title="Tài sản theo loại" subtitle="Phân bổ tài sản cố định.">
                <div className="h-72">
                  {(statistics?.fixedAssetsByCategory || []).some((item) => item.count > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={withColors(statistics.fixedAssetsByCategory)} margin={{ top: 8, right: 16, left: -20, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                        <Tooltip content={<ChartTooltip />} cursor={chartCursor} />
                        <Bar dataKey="count" name="Tài sản" radius={[8, 8, 0, 0]}>
                          {withColors(statistics.fixedAssetsByCategory).map((entry) => <Cell key={entry.label} fill={entry.fill} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <EmptyState text="Chưa có dữ liệu loại tài sản." />}
                </div>
              </Section>
            </>
          )}

          {activeTab === 'consumables' && (
            <>
              <div className="grid gap-4 xl:grid-cols-3">
                <Section title="Tồn kho vật tư" subtitle="Đủ dùng, cần nhập và hết hàng.">
                  <div className="h-72">
                    {consumableStockData.some((item) => item.count > 0) ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={consumableStockData} margin={{ top: 12, right: 12, left: -20, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                          <Tooltip content={<ChartTooltip />} cursor={chartCursor} />
                          <Bar dataKey="count" name="Số vật tư" radius={[8, 8, 0, 0]}>
                            {consumableStockData.map((entry) => <Cell key={entry.label} fill={entry.fill} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <EmptyState text="Chưa có dữ liệu vật tư." />}
                  </div>
                </Section>

                <Section title="Hạn dùng theo lô" subtitle="Tính trên lô còn số lượng tồn.">
                  <div className="h-72">
                    {expiryData.some((item) => item.count > 0) ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={expiryData} layout="vertical" margin={{ top: 8, right: 16, left: 30, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                          <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 12 }} />
                          <Tooltip content={<ChartTooltip />} cursor={chartCursor} />
                          <Bar dataKey="count" name="Số lô" radius={[0, 8, 8, 0]}>
                            {expiryData.map((entry) => <Cell key={entry.label} fill={entry.fill} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <EmptyState text="Chưa có dữ liệu hạn dùng." />}
                  </div>
                </Section>

                <Section title="Vật tư theo loại" subtitle="Phân bổ vật tư tiêu hao.">
                  <div className="h-72">
                    {(statistics?.consumablesByCategory || []).some((item) => item.count > 0) ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={withColors(statistics.consumablesByCategory)} margin={{ top: 8, right: 16, left: -20, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                          <Tooltip content={<ChartTooltip />} cursor={chartCursor} />
                          <Bar dataKey="count" name="Vật tư" radius={[8, 8, 0, 0]}>
                            {withColors(statistics.consumablesByCategory).map((entry) => <Cell key={entry.label} fill={entry.fill} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <EmptyState text="Chưa có dữ liệu loại vật tư." />}
                  </div>
                </Section>
              </div>

              <Section title="Vật tư cần nhập" subtitle="Các vật tư có tồn hiện tại dưới hoặc bằng ngưỡng cảnh báo.">
                <LowStockTable rows={statistics?.topLowStockConsumables || []} />
              </Section>
            </>
          )}

          {activeTab === 'operations' && (
            <>
              <div className="grid gap-4 xl:grid-cols-2">
                <Section title="Top thiết bị phát sinh ticket" subtitle="Các thiết bị có nhiều ticket nhất trong kỳ.">
                  <RankingTable rows={statistics?.topProblemAssets || []} valueLabel="Ticket" emptyText="Chưa có dữ liệu ticket thiết bị." />
                </Section>
                <Section title="Ticket theo trạng thái" subtitle="Theo ticket phát sinh trong kỳ.">
                  <div className="h-72">
                    {(statistics?.ticketStatus || []).some((item) => item.count > 0) ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={withColors(statistics.ticketStatus)} dataKey="count" nameKey="label" outerRadius={96}>
                            {withColors(statistics.ticketStatus).map((entry) => <Cell key={entry.label} fill={entry.fill} />)}
                          </Pie>
                          <Tooltip content={<ChartTooltip />} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : <EmptyState text="Chưa có ticket trong kỳ." />}
                  </div>
                </Section>
              </div>

              <Section title="Kiểm kê gần đây" subtitle="Các phiên kiểm kê trong khoảng thời gian lọc.">
                <AuditList rows={statistics?.recentAudits || []} />
              </Section>
            </>
          )}
        </>
      )}
    </div>
  )
}

export default AssetStatisticsManagement
