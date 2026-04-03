import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'
import TicketChatBox from '../components/TicketChatBox'
import { useAuth } from '../context/AuthContext'

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('vi-VN')
}

const statusStyles = {
  PENDING: 'bg-amber-100 text-amber-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  RESOLVED: 'bg-emerald-100 text-emerald-800',
}

function toVietnameseRole(role) {
  if (role === 'Admin') return 'Quản trị viên'
  if (role === 'TechSupport') return 'Kỹ thuật viên hỗ trợ'
  return 'Nhân viên'
}

function TicketDetail() {
  const { ticketId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showChat, setShowChat] = useState(true)

  useEffect(() => {
    if (!ticketId) return
    let mounted = true
    const loadTicket = async () => {
      setLoading(true)
      try {
        const response = await axiosClient.get('/api/tickets')
        const found = (response.data || []).find((item) => Number(item.id) === Number(ticketId))
        if (!mounted) return
        if (!found) {
          toast.error('Không tìm thấy ticket.')
          setTicket(null)
          return
        }
        setTicket(found)
      } catch (error) {
        const message = error?.response?.data?.message || 'Không tải được thông tin ticket.'
        toast.error(message)
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }
    loadTicket()
    return () => {
      mounted = false
    }
  }, [ticketId])

  const statusClassName = useMemo(
    () => statusStyles[ticket?.status] || 'bg-slate-100 text-slate-700',
    [ticket?.status],
  )
  const backPath = location.pathname.startsWith('/admin/')
    ? '/admin/tickets'
    : location.pathname.startsWith('/tech/')
      ? '/tech/tickets'
      : '/mobile/home'
  const isMobileRoute = location.pathname.startsWith('/mobile/')
  const isTechRoute = location.pathname.startsWith('/tech/')
  const canOpenChat = !isTechRoute || Number(ticket?.assigneeId) === Number(user?.userId)

  return (
    <div className={`space-y-4 ${isMobileRoute ? 'pb-4' : 'pb-24'}`}>
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Chi tiết Ticket #{ticketId}</h2>
            <p className="mt-1 text-sm text-slate-600">Trao đổi trực tiếp giữa giảng viên và kỹ thuật viên.</p>
          </div>
          <Link
            to={backPath}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Quay lại
          </Link>
        </div>
      </section>

      {loading && (
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Đang tải dữ liệu ticket...</p>
        </section>
      )}

      {!loading && ticket && (
        <section className="grid gap-3 rounded-2xl bg-white p-4 shadow-sm md:grid-cols-2">
          <p className="text-sm text-slate-700">
            <span className="font-semibold">Thiết bị:</span> {ticket.assetQaCode}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-semibold">Mức độ ưu tiên:</span> {ticket.priority}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-semibold">Người báo:</span> {ticket.reporterName} | {toVietnameseRole(ticket.reporterRole)}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-semibold">Kỹ thuật viên:</span> {ticket.assigneeName || 'Chưa gán'}
          </p>
          <p className="text-sm text-slate-700 md:col-span-2">
            <span className="font-semibold">Mô tả:</span> {ticket.description}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-semibold">Tạo lúc:</span> {formatDateTime(ticket.createdAt)}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-semibold">Hạn SLA:</span> {formatDateTime(ticket.dueDate)}
          </p>
          <div className="md:col-span-2">
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClassName}`}>{ticket.status}</span>
          </div>
        </section>
      )}

      {!canOpenChat && isTechRoute && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Bạn chỉ có thể mở chat sau khi bấm “Nhận xử lý” ticket này.
        </section>
      )}

      {canOpenChat && (isMobileRoute ? (
        <TicketChatBox ticketId={Number(ticketId)} embedded />
      ) : (
        <>
          {showChat && <TicketChatBox ticketId={Number(ticketId)} onClose={() => setShowChat(false)} />}
          {!showChat && (
            <button
              type="button"
              onClick={() => setShowChat(true)}
              className="fixed bottom-4 right-4 z-40 rounded-full bg-fptOrange px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-fptOrangeDark"
            >
              Mở chat
            </button>
          )}
        </>
      ))}
    </div>
  )
}

export default TicketDetail
