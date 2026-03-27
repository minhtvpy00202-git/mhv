import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import axiosClient from '../../api/axiosClient'
const PAGE_SIZE = 10

function formatDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('vi-VN')
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
  const [sortConfig, setSortConfig] = useState({ key: 'startTime', direction: 'desc' })
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    const initializePage = async () => {
      try {
        const [historyRes, locationRes, userRes] = await Promise.all([
          axiosClient.get('/api/usage/history'),
          axiosClient.get('/api/locations'),
          axiosClient.get('/api/users/borrowers'),
        ])
        setHistories(historyRes.data || [])
        setLocations(locationRes.data || [])
        setUsers(userRes.data || [])
        setCurrentPage(1)
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

  const sortedHistories = useMemo(() => {
    const list = [...histories]
    const { key, direction } = sortConfig
    list.sort((a, b) => {
      const av = key.includes('Time') ? new Date(a[key] || 0).getTime() : String(a[key] ?? '').toLowerCase()
      const bv = key.includes('Time') ? new Date(b[key] || 0).getTime() : String(b[key] ?? '').toLowerCase()
      if (av < bv) return direction === 'asc' ? -1 : 1
      if (av > bv) return direction === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [histories, sortConfig])

  const totalPages = Math.max(1, Math.ceil(sortedHistories.length / PAGE_SIZE))
  const paginatedHistories = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return sortedHistories.slice(start, start + PAGE_SIZE)
  }, [sortedHistories, currentPage])

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
    setCurrentPage(1)
  }

  const getSortLabel = (key, label) => {
    if (sortConfig.key !== key) return label
    return `${label} ${sortConfig.direction === 'asc' ? '▲' : '▼'}`
  }

  const goToFirstPage = () => setCurrentPage(1)
  const goToPrevPage = () => setCurrentPage((prev) => Math.max(1, prev - 1))
  const goToNextPage = () => setCurrentPage((prev) => Math.min(totalPages, prev + 1))
  const goToLastPage = () => setCurrentPage(totalPages)

  const loadHistories = async (nextFilters = filters) => {
    setLoading(true)
    try {
      const params = {}
      if (nextFilters.assetName.trim()) params.assetName = nextFilters.assetName.trim()
      if (nextFilters.borrowedLocationId) params.borrowedLocationId = Number(nextFilters.borrowedLocationId)
      if (nextFilters.userId) params.userId = Number(nextFilters.userId)
      if (nextFilters.startDate) params.startDate = nextFilters.startDate
      if (nextFilters.endDate) params.endDate = nextFilters.endDate
      const response = await axiosClient.get('/api/usage/history', { params })
      setHistories(response.data || [])
      setCurrentPage(1)
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
    await loadHistories(reset)
  }

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
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-slate-800">Lịch sử mượn thiết bị</h2>
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
          onClick={() => loadHistories()}
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
                  {getSortLabel('homeLocationName', 'Phòng gốc')}
                </button>
              </th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">
                <button type="button" onClick={() => handleSort('startTime')} className="hover:text-fptOrange">
                  {getSortLabel('startTime', 'Ngày mượn')}
                </button>
              </th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">
                <button type="button" onClick={() => handleSort('borrowedLocationName')} className="hover:text-fptOrange">
                  {getSortLabel('borrowedLocationName', 'Phòng mượn')}
                </button>
              </th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">
                <button type="button" onClick={() => handleSort('endTime')} className="hover:text-fptOrange">
                  {getSortLabel('endTime', 'Ngày trả')}
                </button>
              </th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">
                <button type="button" onClick={() => handleSort('username')} className="hover:text-fptOrange">
                  {getSortLabel('username', 'Người mượn')}
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading &&
              Array.from({ length: 8 }).map((_, index) => (
                <tr key={`history-loading-${index}`} className="animate-pulse">
                  <td className="px-3 py-2" colSpan={8}>
                    <div className="h-4 w-full rounded bg-slate-200" />
                  </td>
                </tr>
              ))}
            {!loading &&
              paginatedHistories.map((history, index) => (
                <tr key={history.id}>
                  <td className="px-3 py-2">{(currentPage - 1) * PAGE_SIZE + index + 1}</td>
                  <td className="px-3 py-2">{history.assetQaCode}</td>
                  <td className="px-3 py-2">{history.assetName}</td>
                  <td className="px-3 py-2">{history.homeLocationName}</td>
                  <td className="px-3 py-2">{formatDateTime(history.startTime)}</td>
                  <td className="px-3 py-2">{history.borrowedLocationName}</td>
                  <td className="px-3 py-2">{history.endTime ? formatDateTime(history.endTime) : ''}</td>
                  <td className="px-3 py-2">{history.username}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {!loading && (
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
    </div>
  )
}

export default UsageHistoryManagement
