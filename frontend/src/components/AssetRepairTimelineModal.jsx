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

function toVietnameseStatus(status) {
  if (status === 'PENDING') return 'Mới báo hỏng'
  if (status === 'IN_PROGRESS') return 'Đang sửa chữa'
  if (status === 'RESOLVED') return 'Đã hoàn tất'
  return status || '-'
}

function splitChunks(array, size) {
  const chunks = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

function AssetRepairTimelineModal({ assetQaCode, assetName, open, onClose }) {
  const [loading, setLoading] = useState(false)
  const [timeline, setTimeline] = useState([])

  useEffect(() => {
    if (!open || !assetQaCode) return
    const loadTimeline = async () => {
      setLoading(true)
      try {
        try {
          const response = await axiosClient.get('/api/tickets', {
            params: { asset_qa_code: assetQaCode },
          })
          setTimeline(response.data || [])
        } catch {
          const fallback = await axiosClient.get('/api/tickets')
          const filtered = (fallback.data || []).filter((item) => item.assetQaCode === assetQaCode)
          setTimeline(filtered)
        }
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
      timeline.map((item, index) => ({
        id: item.id,
        repairIndex: index + 1,
        brokenAt: formatDateTime(item.createdAt),
        issue: item.description,
        fixer: item.assigneeName || 'Chưa có kỹ thuật viên',
        fixContent: item.description,
        duration: formatDurationMinutes(item.createdAt, item.resolvedAt),
        status: toVietnameseStatus(item.status),
      })),
    [timeline],
  )

  const timelineChunks = useMemo(() => splitChunks(timelineRows, 4), [timelineRows])

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
        <div className="max-h-[70vh] overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-4">
          {!loading && timelineRows.length === 0 && (
            <p className="text-center text-sm text-slate-500">Thiết bị này chưa có lịch sử sửa chữa.</p>
          )}
          {!loading && timelineRows.length > 0 && (
            <div className="space-y-3">
              {timelineChunks.map((chunk, rowIndex) => {
                const isReverse = rowIndex % 2 === 1
                const displayChunk = isReverse ? [...chunk].reverse() : chunk
                const isLastRow = rowIndex === timelineChunks.length - 1
                return (
                  <div key={`row-${rowIndex}`}>
                    <div className="relative rounded-xl border border-slate-200 bg-white px-4 py-6">
                      <div className="absolute left-6 right-6 top-8 h-0.5 bg-slate-300" />
                      <div className="grid gap-3 md:grid-cols-4">
                        {displayChunk.map((row) => (
                          <div key={row.id} className="relative pt-4">
                            <div className="absolute left-1/2 top-0 z-10 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-white bg-fptOrange shadow" />
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                              <p className="font-semibold text-slate-800">Lần sửa: {row.repairIndex}</p>
                              <p className="mt-1 text-slate-700">Hỏng khi: {row.brokenAt}</p>
                              <p className="mt-1 text-slate-700">Lỗi: {row.issue}</p>
                              <p className="mt-1 text-slate-700">Người sửa: {row.fixer}</p>
                              <p className="mt-1 text-slate-700">Chi tiết lỗi: {row.fixContent}</p>
                              <p className="mt-1 text-slate-700">Thời gian sửa: {row.duration}</p>
                              <p className="mt-1 font-semibold text-slate-700">Trạng thái: {row.status}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {!isLastRow && (
                      <div className={`flex ${isReverse ? 'justify-start' : 'justify-end'} px-2`}>
                        <div
                          className={`h-12 w-12 border-2 border-slate-300 ${
                            isReverse ? 'rounded-bl-full border-r-0 border-t-0' : 'rounded-br-full border-l-0 border-t-0'
                          }`}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {loading && <p className="px-3 py-3 text-sm text-slate-500">Đang tải timeline...</p>}
        </div>
      </div>
    </div>
  )
}

export default AssetRepairTimelineModal
