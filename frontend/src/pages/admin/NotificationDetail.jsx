import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../../api/axiosClient'

function formatDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('vi-VN')
}

function NotificationDetail() {
  const { id } = useParams()
  const [notification, setNotification] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const response = await axiosClient.get(`/api/notifications/${id}`)
        setNotification(response.data)
      } catch (error) {
        const message = error?.response?.data?.message || 'Không tải được chi tiết thông báo.'
        toast.error(message)
      } finally {
        setLoading(false)
      }
    }
    fetchDetail()
  }, [id])

  return (
    <div className="space-y-4 rounded-xl bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Chi tiết nghiệp vụ</h2>
        <Link to="/admin/assets" className="text-sm font-medium text-fptOrange hover:underline">
          Quay lại
        </Link>
      </div>
      {loading && <p className="text-sm text-slate-500">Đang tải dữ liệu...</p>}
      {!loading && notification && (
        <div className="space-y-2 text-sm text-slate-700">
          <p>
            <span className="font-semibold">Thiết bị:</span> {notification.assetQaCode || '-'}
          </p>
          <p>
            <span className="font-semibold">Nghiệp vụ:</span> {notification.eventType}
          </p>
          <p>
            <span className="font-semibold">Tiêu đề:</span> {notification.title}
          </p>
          <p>
            <span className="font-semibold">Thời gian xảy ra:</span> {formatDateTime(notification.occurredAt)}
          </p>
          <p>
            <span className="font-semibold">Người thực hiện:</span> {notification.actorUsername}
          </p>
          <p className="whitespace-pre-line rounded-lg border border-slate-200 bg-slate-50 p-3">
            {notification.detail || 'Không có chi tiết bổ sung.'}
          </p>
        </div>
      )}
    </div>
  )
}

export default NotificationDetail
