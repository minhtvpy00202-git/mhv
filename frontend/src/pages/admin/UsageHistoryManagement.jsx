import { useEffect, useMemo, useRef, useState } from 'react'
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

function UsageHistoryManagement() {
  const locationFilterRef = useRef(null)
  const [histories, setHistories] = useState([])
  const [locations, setLocations] = useState([])
  const [users, setUsers] = useState([])
  const [filters, setFilters] = useState({
    assetName: '',
    borrowedLocationId: '',
    borrowedLocationKeyword: '',
    userId: '',
    startDate: '',
    endDate: '',
  })
  const [showLocationOptions, setShowLocationOptions] = useState(false)
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

  const filteredLocations = locations.filter((location) =>
    location.roomName.toLowerCase().includes(filters.borrowedLocationKeyword.trim().toLowerCase()),
  )

  useEffect(() => {
    const handlePointerDownOutside = (event) => {
      const target = event.target
      if (showLocationOptions && locationFilterRef.current && !locationFilterRef.current.contains(target)) {
        setShowLocationOptions(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDownOutside)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDownOutside)
    }
  }, [showLocationOptions])

  useDebouncedEffect(() => {
    void loadHistories(0, filters)
  }, [filters.assetName, filters.borrowedLocationId, filters.userId, filters.startDate, filters.endDate], 300, true)

  const tableColumns = useMemo(() => ([
    { key: 'index', label: 'STT', headClassName: 'whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600', cellClassName: 'px-3 py-2', render: (_history, index) => pageInfo.page * pageInfo.size + index + 1 },
    { key: 'assetQaCode', label: <button type="button" onClick={() => handleSort('assetQaCode')} className="whitespace-nowrap hover:text-fptOrange">{getSortLabel('assetQaCode', 'Mã thiết bị')}</button>, headClassName: 'whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600', cellClassName: 'px-3 py-2', render: (history) => history.assetQaCode },
    { key: 'assetName', label: <button type="button" onClick={() => handleSort('assetName')} className="whitespace-nowrap hover:text-fptOrange">{getSortLabel('assetName', 'Tên thiết bị')}</button>, headClassName: 'whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600', cellClassName: 'px-3 py-2', render: (history) => history.assetName },
    { key: 'homeLocationName', label: <button type="button" onClick={() => handleSort('homeLocationName')} className="whitespace-nowrap hover:text-fptOrange">{getSortLabel('homeLocationName', 'Vị trí gốc')}</button>, headClassName: 'whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600', cellClassName: 'px-3 py-2', render: (history) => history.homeLocationName },
    { key: 'borrowedLocationName', label: <button type="button" onClick={() => handleSort('borrowedLocationName')} className="whitespace-nowrap hover:text-fptOrange">{getSortLabel('borrowedLocationName', 'Phòng mượn')}</button>, headClassName: 'whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600', cellClassName: 'px-3 py-2', render: (history) => history.borrowedLocationName },
    { key: 'startTime', label: <button type="button" onClick={() => handleSort('startTime')} className="whitespace-nowrap hover:text-fptOrange">{getSortLabel('startTime', 'Ngày mượn')}</button>, headClassName: 'whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600', cellClassName: 'px-3 py-2', render: (history) => formatVietnamDateTime(history.startTime, '') },
    { key: 'endTime', label: <button type="button" onClick={() => handleSort('endTime')} className="whitespace-nowrap hover:text-fptOrange">{getSortLabel('endTime', 'Ngày trả')}</button>, headClassName: 'whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600', cellClassName: 'px-3 py-2', render: (history) => (history.endTime ? formatVietnamDateTime(history.endTime, '') : '') },
    { key: 'assetTechnicalStatus', label: 'Tình trạng kỹ thuật', headClassName: 'whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600', cellClassName: 'px-3 py-2', render: (history) => getTechnicalStatusLabel(history.assetTechnicalStatus) },
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
    if (nextFilters.borrowedLocationId) params.borrowedLocationId = Number(nextFilters.borrowedLocationId)
    if (nextFilters.userId) params.userId = Number(nextFilters.userId)
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
      borrowedLocationId: '',
      borrowedLocationKeyword: '',
      userId: '',
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
      if (filters.borrowedLocationId) params.borrowedLocationId = Number(filters.borrowedLocationId)
      if (filters.userId) params.userId = Number(filters.userId)
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

  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800">Lịch sử mượn thiết bị</h2>
        <p className="mt-1 text-sm text-slate-500">
          Bảng dưới hiển thị ngắn gọn các lần mượn/trả theo đúng thông tin nghiệp vụ cần theo dõi.
        </p>
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <input
          value={filters.assetName}
          onChange={(e) => setFilters((prev) => ({ ...prev, assetName: e.target.value }))}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
          placeholder="Tên thiết bị"
        />
        <div ref={locationFilterRef} className="relative">
          <input
            value={filters.borrowedLocationKeyword}
            onFocus={() => setShowLocationOptions(true)}
            onChange={(e) => {
              setFilters((prev) => ({
                ...prev,
                borrowedLocationKeyword: e.target.value,
                borrowedLocationId: '',
              }))
              setShowLocationOptions(true)
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
            placeholder="Phòng mượn (gõ để lọc)"
          />
          {showLocationOptions && (
            <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setFilters((prev) => ({ ...prev, borrowedLocationId: '', borrowedLocationKeyword: '' }))
                  setShowLocationOptions(false)
                }}
                className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-orange-50"
              >
                Tất cả phòng
              </button>
              {filteredLocations.map((location) => (
                <button
                  key={location.id}
                  type="button"
                  onClick={() => {
                    setFilters((prev) => ({
                      ...prev,
                      borrowedLocationId: String(location.id),
                      borrowedLocationKeyword: location.roomName,
                    }))
                    setShowLocationOptions(false)
                  }}
                  className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-orange-50"
                >
                  {location.roomName}
                </button>
              ))}
              {filteredLocations.length === 0 && (
                <p className="px-3 py-2 text-sm text-slate-500">Không có phòng phù hợp.</p>
              )}
            </div>
          )}
        </div>
        <SearchableSelect
          value={filters.userId}
          onChange={(nextValue) => setFilters((prev) => ({ ...prev, userId: String(nextValue || '') }))}
          options={users}
          getOptionValue={(user) => user.id}
          getOptionLabel={(user) => user.fullName || user.username}
          getOptionSearchText={(user) => `${user.fullName || ''} ${user.username || ''}`}
          placeholder="Gõ để tìm người mượn"
          emptyOptionLabel="Tất cả người mượn"
        />
        <input
          type="date"
          value={filters.startDate}
          onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
        />
        <input
          type="date"
          value={filters.endDate}
          onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
        />
      </div>
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => loadHistories(0)}
          disabled={loading}
          className="rounded-lg bg-fptOrange px-3 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark disabled:opacity-60"
        >
          Tìm kiếm
        </button>
        <button
          type="button"
          onClick={handleResetFilters}
          disabled={loading}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
        >
          Xóa bộ lọc
        </button>
        <button
          type="button"
          onClick={handleExportExcel}
          disabled={exporting}
          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          Xuất Excel
        </button>
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
      <div className="overflow-x-auto">
        <table className="min-w-max divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {renderedColumns.map((column) => (
                <th key={column.key} className={column.headClassName}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
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
                <tr key={history.id}>
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
