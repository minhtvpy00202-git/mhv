import { useEffect, useMemo, useState } from 'react'
import {
  IconCalendar as Calendar,
  IconFilter as Filter,
  IconRefresh as RotateCcw,
  IconSearch as Search,
  IconFileSpreadsheet as Sheet,
} from '@tabler/icons-react'
import { toast } from 'react-toastify'
import axiosClient from '../../api/axiosClient'
import ColumnVisibilityDropdown from '../../components/ui/ColumnVisibilityDropdown'
import SearchableSelect from '../../components/ui/SearchableSelect'
import useColumnVisibility from '../../hooks/useColumnVisibility'
import useDebouncedEffect from '../../hooks/useDebouncedEffect'
import { getTechnicalStatusLabel } from '../../utils/assetStatus'
import { formatVietnamDateTime } from '../../utils/datetime'
const PAGE_SIZE = 10
const defaultPageInfo = {
  page: 0,
  size: PAGE_SIZE,
  totalPages: 1,
  totalItems: 0,
}
const defaultSortState = {
  key: 'startTime',
  direction: 'desc',
}
const usageHistoryColumnOptions = [
  { key: 'index', label: 'STT' },
  { key: 'assetQaCode', label: 'Mã thiết bị' },
  { key: 'assetName', label: 'Tên thiết bị' },
  { key: 'homeLocationName', label: 'Vị trí gốc' },
  { key: 'borrowedLocationName', label: 'Phòng mượn' },
  { key: 'startTime', label: 'Ngày mượn' },
  { key: 'endTime', label: 'Ngày trả' },
  { key: 'assetTechnicalStatus', label: 'Tình trạng kỹ thuật' },
  { key: 'borrowerFullName', label: 'Người mượn' },
]
const defaultUsageHistoryVisibleColumnKeys = ['index', 'assetQaCode', 'assetName', 'borrowedLocationName', 'startTime', 'endTime', 'borrowerFullName']
const returnStatusOptions = [
  { value: '', label: 'Tất cả trạng thái trả' },
  { value: 'NOT_RETURNED', label: 'Chưa trả' },
  { value: 'RETURNED', label: 'Đã trả' },
]
const filterInputClassName = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm outline-none ring-fptOrange transition focus:border-orange-300 focus:ring-2'
const filterSelectClassName = 'rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm outline-none ring-fptOrange transition focus:border-orange-300 focus:ring-2'

function UsageHistoryManagement() {
  const [histories, setHistories] = useState([])
  const [locations, setLocations] = useState([])
  const [users, setUsers] = useState([])
  const [filters, setFilters] = useState({
    assetName: '',
    homeLocationId: '',
    userId: '',
    returnStatus: '',
    startDate: '',
    endDate: '',
  })
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [pageInfo, setPageInfo] = useState(defaultPageInfo)
  const [sortState, setSortState] = useState(defaultSortState)
  const {
    visibleColumns,
    activeColumns,
    selectedCount,
    allSelected,
    toggleColumn,
    selectAllColumns,
    resetDefaultColumns,
  } = useColumnVisibility({
    storageKey: 'mhv-admin-usage-history-visible-columns',
    columns: usageHistoryColumnOptions,
    defaultVisibleKeys: defaultUsageHistoryVisibleColumnKeys,
  })

  useEffect(() => {
    const initializePage = async () => {
      try {
        const [historyRes, locationRes, userRes] = await Promise.all([
          axiosClient.get('/api/usage/history', {
            params: {
              page: 0,
              size: PAGE_SIZE,
              sortKey: defaultSortState.key,
              sortDirection: defaultSortState.direction,
            },
          }),
          axiosClient.get('/api/locations', {
          }),
          axiosClient.get('/api/users/borrowers'),
        ])
        const historyData = historyRes.data || {}
        setHistories(historyData.items || [])
        setPageInfo({
          page: historyData.page ?? 0,
          size: historyData.size ?? PAGE_SIZE,
          totalPages: historyData.totalPages || 1,
          totalItems: historyData.totalItems || 0,
        })
        setLocations(locationRes.data || [])
        setUsers(userRes.data || [])
        setSortState(defaultSortState)
      } catch (error) {
        const message = error?.response?.data?.message || 'Không thể tải dữ liệu lịch sử mượn.'
        toast.error(message)
      } finally {
        setLoading(false)
      }
    }
    initializePage()
  }, [])

  useDebouncedEffect(() => {
    void loadHistories(0, filters)
  }, [filters.assetName, filters.homeLocationId, filters.userId, filters.returnStatus, filters.startDate, filters.endDate], 300, true)

  const tableColumns = useMemo(() => ([
    { key: 'index', label: 'STT', headClassName: 'whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600', cellClassName: 'px-3 py-2', render: (_history, index) => pageInfo.page * pageInfo.size + index + 1 },
    { key: 'assetQaCode', label: <button type="button" onClick={() => handleSort('assetQaCode')} className="whitespace-nowrap hover:text-fptOrange">{getSortLabel('assetQaCode', 'Mã thiết bị')}</button>, headClassName: 'whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600', cellClassName: 'px-3 py-2', render: (history) => history.assetQaCode },
    { key: 'assetName', label: <button type="button" onClick={() => handleSort('assetName')} className="whitespace-nowrap hover:text-fptOrange">{getSortLabel('assetName', 'Tên thiết bị')}</button>, headClassName: 'whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600', cellClassName: 'px-3 py-2', render: (history) => history.assetName },
    { key: 'homeLocationName', label: <button type="button" onClick={() => handleSort('homeLocationName')} className="whitespace-nowrap hover:text-fptOrange">{getSortLabel('homeLocationName', 'Vị trí gốc')}</button>, headClassName: 'whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600', cellClassName: 'px-3 py-2', render: (history) => history.homeLocationName },
    { key: 'borrowedLocationName', label: <button type="button" onClick={() => handleSort('borrowedLocationName')} className="whitespace-nowrap hover:text-fptOrange">{getSortLabel('borrowedLocationName', 'Phòng mượn')}</button>, headClassName: 'whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600', cellClassName: 'px-3 py-2', render: (history) => history.borrowedLocationName },
    { key: 'startTime', label: <button type="button" onClick={() => handleSort('startTime')} className="whitespace-nowrap hover:text-fptOrange">{getSortLabel('startTime', 'Ngày mượn')}</button>, headClassName: 'whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600', cellClassName: 'px-3 py-2', render: (history) => formatVietnamDateTime(history.startTime, '') },
    { key: 'endTime', label: <button type="button" onClick={() => handleSort('endTime')} className="whitespace-nowrap hover:text-fptOrange">{getSortLabel('endTime', 'Ngày trả')}</button>, headClassName: 'whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600', cellClassName: 'px-3 py-2', render: (history) => (history.endTime ? formatVietnamDateTime(history.endTime, '') : 'Chưa trả') },
    { key: 'assetTechnicalStatus', label: <button type="button" onClick={() => handleSort('assetTechnicalStatus')} className="whitespace-nowrap hover:text-fptOrange">{getSortLabel('assetTechnicalStatus', 'Tình trạng kỹ thuật')}</button>, headClassName: 'whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600', cellClassName: 'px-3 py-2', render: (history) => getTechnicalStatusLabel(history.assetTechnicalStatus) },
    { key: 'borrowerFullName', label: <button type="button" onClick={() => handleSort('borrowerFullName')} className="whitespace-nowrap hover:text-fptOrange">{getSortLabel('borrowerFullName', 'Người mượn')}</button>, headClassName: 'whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600', cellClassName: 'px-3 py-2', render: (history) => history.borrowerFullName },
  ]), [getSortLabel, handleSort, pageInfo.page, pageInfo.size])
  const renderedColumns = useMemo(
    () => tableColumns.filter((column) => activeColumns.some((activeColumn) => activeColumn.key === column.key)),
    [activeColumns, tableColumns],
  )

  function buildHistoryQueryParams(page = pageInfo.page, nextFilters = filters, nextSort = sortState) {
    const params = {
      page,
      size: pageInfo.size || PAGE_SIZE,
      sortKey: nextSort.key,
      sortDirection: nextSort.direction,
    }
    if (nextFilters.assetName.trim()) params.assetName = nextFilters.assetName.trim()
    if (nextFilters.homeLocationId) params.homeLocationId = Number(nextFilters.homeLocationId)
    if (nextFilters.userId) params.userId = Number(nextFilters.userId)
    if (nextFilters.returnStatus) params.returnStatus = nextFilters.returnStatus
    if (nextFilters.startDate) params.startDate = nextFilters.startDate
    if (nextFilters.endDate) params.endDate = nextFilters.endDate
    return params
  }

  async function loadHistories(page = pageInfo.page, nextFilters = filters, nextSort = sortState) {
    setLoading(true)
    try {
      const response = await axiosClient.get('/api/usage/history', {
        params: buildHistoryQueryParams(page, nextFilters, nextSort),
      })
      const data = response.data || {}
      setHistories(data.items || [])
      setPageInfo({
        page: data.page ?? 0,
        size: data.size ?? pageInfo.size ?? PAGE_SIZE,
        totalPages: data.totalPages || 1,
        totalItems: data.totalItems || 0,
      })
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể lọc lịch sử mượn thiết bị.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const handleResetFilters = async () => {
    const reset = {
      assetName: '',
      homeLocationId: '',
      userId: '',
      returnStatus: '',
      startDate: '',
      endDate: '',
    }
    setFilters(reset)
    await loadHistories(0, reset)
  }

  async function handleSort(key) {
    const nextSort = {
      key,
      direction: sortState.key === key && sortState.direction === 'asc' ? 'desc' : 'asc',
    }
    setSortState(nextSort)
    await loadHistories(0, filters, nextSort)
  }

  function getSortLabel(key, label) {
    if (sortState.key !== key) return label
    return `${label} ${sortState.direction === 'asc' ? '▲' : '▼'}`
  }

  const currentPage = pageInfo.page + 1
  const totalPages = Math.max(1, pageInfo.totalPages)
  const goToFirstPage = async () => loadHistories(0)
  const goToPrevPage = async () => loadHistories(Math.max(0, pageInfo.page - 1))
  const goToNextPage = async () => loadHistories(Math.min(totalPages - 1, pageInfo.page + 1))
  const goToLastPage = async () => loadHistories(Math.max(0, totalPages - 1))

  const handleExportExcel = async () => {
    setExporting(true)
    try {
      const params = {}
      if (filters.assetName.trim()) params.assetName = filters.assetName.trim()
      if (filters.homeLocationId) params.homeLocationId = Number(filters.homeLocationId)
      if (filters.userId) params.userId = Number(filters.userId)
      if (filters.returnStatus) params.returnStatus = filters.returnStatus
      if (filters.startDate) params.startDate = filters.startDate
      if (filters.endDate) params.endDate = filters.endDate
      const response = await axiosClient.get('/api/reports/export-usage-history', {
        params,
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'lich-su-muon-thiet-bi.xlsx')
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Đang tải file Excel lịch sử mượn.')
    } catch (error) {
      const message = error?.response?.data?.message || 'Xuất Excel lịch sử mượn thất bại.'
      toast.error(message)
    } finally {
      setExporting(false)
    }
  }

  const activeFilterCount = [
    filters.assetName,
    filters.homeLocationId,
    filters.userId,
    filters.returnStatus,
    filters.startDate,
    filters.endDate,
  ].filter(Boolean).length

  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800">Lịch sử mượn thiết bị</h2>
        <p className="mt-1 text-sm text-slate-500">
          Bảng dưới hiển thị ngắn gọn các lần mượn/trả theo đúng thông tin nghiệp vụ cần theo dõi.
        </p>
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-orange-100 p-2 text-fptOrange">
                <Filter size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Bộ lọc lịch sử</p>
                <p className="text-xs text-slate-500">Tìm nhanh theo thiết bị, phòng gốc, người mượn, trạng thái trả và khoảng thời gian.</p>
              </div>
            </div>
            <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500">
              Đang bật {activeFilterCount} bộ lọc
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Tên thiết bị</label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                  <Search size={16} />
                </span>
                <input
                  value={filters.assetName}
                  onChange={(e) => setFilters((prev) => ({ ...prev, assetName: e.target.value }))}
                  className={`${filterInputClassName} pl-10`}
                  placeholder="Nhập tên hoặc mã thiết bị"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Phòng gốc</label>
              <SearchableSelect
                value={filters.homeLocationId}
                onChange={(nextValue) => setFilters((prev) => ({ ...prev, homeLocationId: String(nextValue || '') }))}
                options={locations}
                getOptionValue={(location) => location.id}
                getOptionLabel={(location) => location.roomName}
                placeholder="Gõ để lọc theo phòng gốc"
                emptyOptionLabel="Tất cả phòng gốc"
                inputClassName={filterInputClassName}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Người mượn</label>
              <SearchableSelect
                value={filters.userId}
                onChange={(nextValue) => setFilters((prev) => ({ ...prev, userId: String(nextValue || '') }))}
                options={users}
                getOptionValue={(user) => user.id}
                getOptionLabel={(user) => user.fullName || user.username}
                getOptionSearchText={(user) => `${user.fullName || ''} ${user.username || ''}`}
                placeholder="Gõ để tìm người mượn"
                emptyOptionLabel="Tất cả người mượn"
                inputClassName={filterInputClassName}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Trạng thái trả</label>
              <select
                value={filters.returnStatus}
                onChange={(e) => setFilters((prev) => ({ ...prev, returnStatus: e.target.value }))}
                className={`${filterSelectClassName} w-full`}
              >
                {returnStatusOptions.map((option) => (
                  <option key={option.value || 'all'} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Từ ngày mượn</label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                  <Calendar size={16} />
                </span>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
                  className={`${filterInputClassName} pl-10`}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Đến ngày mượn</label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                  <Calendar size={16} />
                </span>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
                  className={`${filterInputClassName} pl-10`}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <button
              type="button"
              onClick={() => loadHistories(0)}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-fptOrange px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-fptOrangeDark disabled:opacity-60"
            >
              <Search size={16} />
              Tìm kiếm
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:opacity-60"
            >
              <RotateCcw size={16} />
              Xóa bộ lọc
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={exporting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
            >
              <Sheet size={16} />
              {exporting ? 'Đang xuất...' : 'Xuất Excel'}
            </button>
            <div className="min-w-[180px]">
              <ColumnVisibilityDropdown
                columns={usageHistoryColumnOptions}
                visibleColumns={visibleColumns}
                selectedCount={selectedCount}
                allSelected={allSelected}
                onToggleColumn={(columnKey) => {
                  if (visibleColumns[columnKey] && selectedCount === 1) {
                    toast.info('Cần giữ lại ít nhất 1 cột hiển thị.')
                    return
                  }
                  toggleColumn(columnKey)
                }}
                onSelectAll={selectAllColumns}
                onResetDefault={resetDefaultColumns}
              />
            </div>
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200">
        <div className="overflow-x-auto">
        <table className="min-w-max divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50/90">
            <tr>
              {renderedColumns.map((column) => (
                <th key={column.key} className={column.headClassName}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {loading &&
              Array.from({ length: 9 }).map((_, index) => (
                <tr key={`history-loading-${index}`} className="animate-pulse">
                  <td className="px-3 py-2" colSpan={Math.max(renderedColumns.length, 1)}>
                    <div className="h-4 w-full rounded bg-slate-200" />
                  </td>
                </tr>
              ))}
            {!loading &&
              histories.map((history, index) => (
                <tr key={history.id} className="hover:bg-orange-50/40">
                  {renderedColumns.map((column) => (
                    <td key={`${history.id}-${column.key}`} className={column.cellClassName}>
                      {column.render(history, index)}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
        </div>
        </div>
      {!loading && pageInfo.totalItems > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
          {currentPage >= 3 && (
            <button type="button" onClick={goToFirstPage} className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100">
              Trang đầu
            </button>
          )}
          {currentPage >= 2 && (
            <button type="button" onClick={goToPrevPage} className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100">
              Trang trước
            </button>
          )}
          <span className="font-semibold text-slate-700">Trang {currentPage}</span>
          {currentPage < totalPages && (
            <button type="button" onClick={goToNextPage} className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100">
              Trang tiếp
            </button>
          )}
          {currentPage < totalPages && (
            <button type="button" onClick={goToLastPage} className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100">
              Trang cuối
            </button>
          )}
        </div>
      )}
      </section>
    </div>
  )
}

export default UsageHistoryManagement
