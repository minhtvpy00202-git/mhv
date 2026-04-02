import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('vi-VN')
}

function formatDurationMinutes(createdAt, resolvedAt) {
  if (!createdAt || !resolvedAt) return 'Đang xử lý'
  const start = new Date(createdAt).getTime()
  const end = new Date(resolvedAt).getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return '-'
  const minutes = Math.floor((end - start) / 60000)
  const hours = Math.floor(minutes / 60)
  const remainMinutes = minutes % 60
  if (hours <= 0) return `${remainMinutes} phút`
  if (remainMinutes === 0) return `${hours} giờ`
  return `${hours} giờ ${remainMinutes} phút`
}

function AssetRepairTimelineModal({ assetQaCode, assetName, open, onClose }) {
  const [loading, setLoading] = useState(false)
  const [timeline, setTimeline] = useState([])

  useEffect(() => {
    if (!open || !assetQaCode) return
    const loadTimeline = async () => {
      setLoading(true)
      try {
        const response = await axiosClient.get('/api/tickets', {
          params: { asset_qa_code: assetQaCode },
        })
        setTimeline(response.data || [])
      } catch (error) {
        const message = error?.response?.data?.message || 'Không tải được timeline sửa chữa.'
        toast.error(message)
      } finally {
        setLoading(false)
      }
    }
    loadTimeline()
  }, [assetQaCode, open])

  const timelineRows = useMemo(
    () =>
      timeline.map((item) => ({
        id: item.id,
        brokenAt: formatDateTime(item.createdAt),
        issue: item.description,
        fixer: item.assigneeName || 'Chưa có kỹ thuật viên',
        fixContent: item.description,
        duration: formatDurationMinutes(item.createdAt, item.resolvedAt),
        status: item.status,
      })),
    [timeline],
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl rounded-2xl bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Timeline sửa chữa thiết bị</h3>
            <p className="text-sm text-slate-600">
              {assetQaCode} {assetName ? `- ${assetName}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Đóng
          </button>
        </div>
        <div className="max-h-[70vh] overflow-auto rounded-lg border border-slate-200">
          <table className="min-w-[1100px] text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left">Ticket</th>
                <th className="px-3 py-2 text-left">Thiết bị hỏng khi nào</th>
                <th className="px-3 py-2 text-left">Lỗi hỏng là gì</th>
                <th className="px-3 py-2 text-left">Ai sửa</th>
                <th className="px-3 py-2 text-left">Sửa cái gì</th>
                <th className="px-3 py-2 text-left">Sửa mất bao lâu</th>
                <th className="px-3 py-2 text-left">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {!loading &&
                timelineRows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-2">#{row.id}</td>
                    <td className="px-3 py-2">{row.brokenAt}</td>
                    <td className="px-3 py-2">{row.issue}</td>
                    <td className="px-3 py-2">{row.fixer}</td>
                    <td className="px-3 py-2">{row.fixContent}</td>
                    <td className="px-3 py-2">{row.duration}</td>
                    <td className="px-3 py-2">{row.status}</td>
                  </tr>
                ))}
              {!loading && timelineRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center text-slate-500">
                    Thiết bị này chưa có lịch sử sửa chữa.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {loading && <p className="px-3 py-3 text-sm text-slate-500">Đang tải timeline...</p>}
        </div>
      </div>
    </div>
  )
}

export default AssetRepairTimelineModal
