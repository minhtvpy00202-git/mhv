import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../../api/axiosClient'

const PAGE_SIZE = 10

function getRowKey(item) {
  return `${item.id}-${item.assetQaCode}-${item.reportTime}`
}

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('vi-VN')
}

function MaintenanceHistoryManagement() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [previewImageUrl, setPreviewImageUrl] = useState('')

  const loadData = async () => {
    setLoading(true)
    try {
      const response = await axiosClient.get('/api/maintenance/history')
      const data = response.data || []
      setRows(data)
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

  const handleOpenTicketChat = async (item) => {
    try {
      const response = await axiosClient.get('/api/tickets')
      const matchedTickets = (response.data || []).filter((ticket) => ticket.assetQaCode === item.assetQaCode)
      if (matchedTickets.length === 0) {
        toast.info(`Chưa có ticket sự cố cho thiết bị ${item.assetQaCode}.`)
        return
      }
      const ticketToOpen = [...matchedTickets].sort((a, b) => {
        const aOpen = a.status !== 'RESOLVED' ? 1 : 0
        const bOpen = b.status !== 'RESOLVED' ? 1 : 0
        if (aOpen !== bOpen) return bOpen - aOpen
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })[0]
      navigate(`/admin/tickets/${ticketToOpen.id}`)
    } catch (error) {
      const message = error?.response?.data?.message || 'Không mở được ticket/chat.'
      toast.error(message)
    }
  }

  return (
    <div className="min-w-0 space-y-4">
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800">Lịch sử báo hỏng</h2>
        <p className="mt-1 text-sm text-slate-500">
          Luồng maintenance cũ đã đồng bộ theo ticket. Admin theo dõi lịch sử và mở ticket/chat để điều phối xử lý.
        </p>
      </section>

      <section className="min-w-0 rounded-2xl bg-white p-4 shadow-sm">
        <div className="w-full max-w-full overflow-x-auto overflow-y-hidden rounded border border-slate-200">
          <table className="w-max min-w-[1300px] text-sm">
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
                <th className="px-3 py-2 text-left">Ảnh lỗi</th>
                <th className="px-3 py-2 text-left">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {!loading &&
                paginatedRows.map((item) => {
                  const rowKey = getRowKey(item)
                  return (
                  <tr key={rowKey} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-2">{item.assetQaCode}</td>
                    <td className="px-3 py-2">{item.assetName}</td>
                    <td className="px-3 py-2">{item.homeLocationName}</td>
                    <td className="px-3 py-2">{item.currentLocationName}</td>
                    <td className="px-3 py-2">{item.reporterFullName}</td>
                    <td className="px-3 py-2">{item.description}</td>
                    <td className="px-3 py-2">{formatDateTime(item.reportTime)}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        item.assetStatus === 'Sẵn sàng'
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.assetStatus === 'Bảo trì'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                      }`}
                      >
                        {item.assetStatus}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!item.imageUrl) {
                            toast.info('Bản ghi này chưa có ảnh lỗi.')
                            return
                          }
                          setPreviewImageUrl(item.imageUrl)
                        }}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Lỗi
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => handleOpenTicketChat(item)}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Mở ticket/chat
                      </button>
                    </td>
                  </tr>
                )})}
              {!loading && paginatedRows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-3 text-center text-slate-500">
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
      {previewImageUrl && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4">
          <div className="rounded-2xl bg-white p-4 shadow-xl">
            <img src={previewImageUrl} alt="error-preview" className="h-[300px] w-[300px] rounded-lg object-cover" />
            <button
              type="button"
              onClick={() => setPreviewImageUrl('')}
              className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default MaintenanceHistoryManagement
