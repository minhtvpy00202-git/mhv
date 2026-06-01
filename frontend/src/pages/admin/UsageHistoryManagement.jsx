import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import axiosClient from '../../api/axiosClient'
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

function UsageHistoryManagement() {
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
            params: { hasAsset: true },
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
        setLocations((locationRes.data || []).filter((location) => location?.hasAsset !== false))
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

  const buildHistoryQueryParams = (page = pageInfo.page, nextFilters = filters, nextSort = sortState) => {
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

  const loadHistories = async (page = pageInfo.page, nextFilters = filters, nextSort = sortState) => {
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

  const handleSort = async (key) => {
    const nextSort = {
      key,
      direction: sortState.key === key && sortState.direction === 'asc' ? 'desc' : 'asc',
    }
    setSortState(nextSort)
    await loadHistories(0, filters, nextSort)
  }

  const getSortLabel = (key, label) => {
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
        <div className="relative">
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
        <select
          value={filters.userId}
          onChange={(e) => setFilters((prev) => ({ ...prev, userId: e.target.value }))}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
        >
          <option value="">Tất cả người mượn</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.username}
            </option>
          ))}
        </select>
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
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">STT</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">
                <button type="button" onClick={() => handleSort('assetQaCode')} className="hover:text-fptOrange">
                  {getSortLabel('assetQaCode', 'Mã thiết bị')}
                </button>
              </th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">
                <button type="button" onClick={() => handleSort('assetName')} className="hover:text-fptOrange">
                  {getSortLabel('assetName', 'Tên thiết bị')}
                </button>
              </th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">
                <button type="button" onClick={() => handleSort('homeLocationName')} className="hover:text-fptOrange">
                  {getSortLabel('homeLocationName', 'Vị trí gốc')}
                </button>
              </th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">
                <button type="button" onClick={() => handleSort('borrowedLocationName')} className="hover:text-fptOrange">
                  {getSortLabel('borrowedLocationName', 'Phòng mượn')}
                </button>
              </th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">
                <button type="button" onClick={() => handleSort('startTime')} className="hover:text-fptOrange">
                  {getSortLabel('startTime', 'Ngày mượn')}
                </button>
              </th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">
                <button type="button" onClick={() => handleSort('endTime')} className="hover:text-fptOrange">
                  {getSortLabel('endTime', 'Ngày trả')}
                </button>
              </th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">Tình trạng kỹ thuật</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">
                <button type="button" onClick={() => handleSort('borrowerFullName')} className="hover:text-fptOrange">
                  {getSortLabel('borrowerFullName', 'Người mượn')}
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading &&
              Array.from({ length: 9 }).map((_, index) => (
                <tr key={`history-loading-${index}`} className="animate-pulse">
                  <td className="px-3 py-2" colSpan={9}>
                    <div className="h-4 w-full rounded bg-slate-200" />
                  </td>
                </tr>
              ))}
            {!loading &&
              histories.map((history, index) => (
                <tr key={history.id}>
                  <td className="px-3 py-2">{pageInfo.page * pageInfo.size + index + 1}</td>
                  <td className="px-3 py-2">{history.assetQaCode}</td>
                  <td className="px-3 py-2">{history.assetName}</td>
                  <td className="px-3 py-2">{history.homeLocationName}</td>
                  <td className="px-3 py-2">{history.borrowedLocationName}</td>
                  <td className="px-3 py-2">{formatVietnamDateTime(history.startTime, '')}</td>
                  <td className="px-3 py-2">{history.endTime ? formatVietnamDateTime(history.endTime, '') : ''}</td>
                  <td className="px-3 py-2">{getTechnicalStatusLabel(history.assetTechnicalStatus)}</td>
                  <td className="px-3 py-2">{history.borrowerFullName}</td>
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
