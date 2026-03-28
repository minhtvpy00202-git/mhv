import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import axiosClient from '../../api/axiosClient'

const PAGE_SIZE = 10
const assetStatusOptions = ['Đang sử dụng', 'Hỏng', 'Sẵn sàng', 'Bảo trì']

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('vi-VN')
}

function MaintenanceHistoryManagement() {
  const [rows, setRows] = useState([])
  const [draftStatus, setDraftStatus] = useState({})
  const [loading, setLoading] = useState(true)
  const [submittingId, setSubmittingId] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)

  const loadData = async () => {
    setLoading(true)
    try {
      const response = await axiosClient.get('/api/maintenance/history')
      const data = response.data || []
      setRows(data)
      setDraftStatus(
        data.reduce((acc, item) => ({ ...acc, [item.id]: item.assetStatus || 'Hỏng' }), {}),
      )
      setCurrentPage(1)
    } catch (error) {
      const message = error?.response?.data?.message || 'Không tải được lịch sử báo hỏng.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return rows.slice(start, start + PAGE_SIZE)
  }, [rows, currentPage])

  const handleUpdate = async (item) => {
    const status = draftStatus[item.id]
    if (!status) return
    setSubmittingId(item.id)
    try {
      await axiosClient.put(`/api/maintenance/${item.id}/asset-status`, {
        assetStatus: status,
      })
      toast.success(`Đã cập nhật trạng thái thiết bị ${item.assetQaCode}.`)
      await loadData()
    } catch (error) {
      const message = error?.response?.data?.message || 'Cập nhật trạng thái thất bại.'
      toast.error(message)
    } finally {
      setSubmittingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800">Lịch sử báo hỏng</h2>
        <p className="mt-1 text-sm text-slate-500">
          Danh sách thiết bị đã được báo hỏng, cho phép cập nhật trạng thái tài sản ngay tại từng dòng.
        </p>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="overflow-auto rounded border border-slate-200">
          <table className="min-w-[1300px] text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left">Mã thiết bị</th>
                <th className="px-3 py-2 text-left">Tên thiết bị</th>
                <th className="px-3 py-2 text-left">Phòng gốc</th>
                <th className="px-3 py-2 text-left">Phòng hiện tại</th>
                <th className="px-3 py-2 text-left">Người báo hỏng</th>
                <th className="px-3 py-2 text-left">Chi tiết hỏng</th>
                <th className="px-3 py-2 text-left">Ngày giờ báo hỏng</th>
                <th className="px-3 py-2 text-left">Trạng thái</th>
                <th className="px-3 py-2 text-left">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {!loading &&
                paginatedRows.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-2">{item.assetQaCode}</td>
                    <td className="px-3 py-2">{item.assetName}</td>
                    <td className="px-3 py-2">{item.homeLocationName}</td>
                    <td className="px-3 py-2">{item.currentLocationName}</td>
                    <td className="px-3 py-2">{item.reporterFullName}</td>
                    <td className="px-3 py-2">{item.description}</td>
                    <td className="px-3 py-2">{formatDateTime(item.reportTime)}</td>
                    <td className="px-3 py-2">
                      <select
                        value={draftStatus[item.id] || item.assetStatus}
                        onChange={(e) =>
                          setDraftStatus((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                        className="rounded border border-slate-300 px-2 py-1 text-sm"
                      >
                        {assetStatusOptions.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => handleUpdate(item)}
                        disabled={submittingId === item.id}
                        className="rounded-md bg-fptOrange px-3 py-1.5 text-xs font-semibold text-white hover:bg-fptOrangeDark disabled:opacity-60"
                      >
                        Cập nhật
                      </button>
                    </td>
                  </tr>
                ))}
              {!loading && paginatedRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-3 text-center text-slate-500">
                    Chưa có dữ liệu báo hỏng.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {loading && <p className="px-3 py-3 text-sm text-slate-500">Đang tải dữ liệu...</p>}
        </div>

        <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
          <p>
            Trang {currentPage} / {totalPages} • Tổng {rows.length} bản ghi
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage <= 1}
              className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
            >
              Đầu
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage <= 1}
              className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
            >
              Trước
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage >= totalPages}
              className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
            >
              Sau
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage >= totalPages}
              className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
            >
              Cuối
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

export default MaintenanceHistoryManagement
