import {
  IconArrowLeft as ArrowLeft,
  IconCamera as Camera,
  IconCheck as Check,
  IconMessageCircle as MessageCircle,
  IconPackage as Package,
  IconRefresh as Refresh,
  IconSend as Send,
  IconUserCheck as UserCheck,
} from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'
import AuthenticatedInquiryImage from '../components/AuthenticatedInquiryImage'
import { useAuth } from '../context/AuthContext'
import useWebSocket from '../hooks/useWebSocket'
import { formatVietnamDateTime } from '../utils/datetime'
import {
  BORROW_STATUS,
  CONSUMABLE_FULFILLMENT_STATUS,
  TERMINAL_INQUIRY_STATUSES,
  getInquiryBasePath,
  getInquirySlaMeta,
  getInquiryStatusMeta,
  getInquiryTypeLabel,
} from '../utils/inquiry'

function InquiryDetail() {
  const { id } = useParams()
  const { token, user } = useAuth()
  const { connected, subscribe } = useWebSocket(token)
  const [inquiry, setInquiry] = useState(null)
  const [messages, setMessages] = useState([])
  const [options, setOptions] = useState({ locations: [], handlers: [] })
  const [borrowRequest, setBorrowRequest] = useState(null)
  const [consumableFulfillment, setConsumableFulfillment] = useState(null)
  const [text, setText] = useState('')
  const [note, setNote] = useState('')
  const [transferUserId, setTransferUserId] = useState('')
  const [alternativeQaCode, setAlternativeQaCode] = useState('')
  const [alternativeQuantity, setAlternativeQuantity] = useState('1')
  const [warehouseId, setWarehouseId] = useState('')
  const [prepareQuantity, setPrepareQuantity] = useState('')
  const [templates, setTemplates] = useState([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [templateTitle, setTemplateTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const fileInputRef = useRef(null)
  const messageEndRef = useRef(null)

  const basePath = getInquiryBasePath(user?.role)
  const isEmployee = user?.role === 'NhanVien'
  const isHandlerRole = ['Admin', 'ConsumableManager'].includes(user?.role)
  const isAssignedHandler = isHandlerRole && Number(inquiry?.assigneeId) === Number(user?.userId)
  const isTargetHandler = isHandlerRole && inquiry?.targetRole === user?.role
  const isTerminal = TERMINAL_INQUIRY_STATUSES.includes(inquiry?.status)
  const canMessage = !isTerminal && (isEmployee || isAssignedHandler)
  const statusMeta = getInquiryStatusMeta(inquiry?.status)
  const slaMeta = getInquirySlaMeta(inquiry)

  const warehouseOptions = useMemo(() => options.locations.filter((location) => {
    if (location.storageWarehouse) return true
    const textValue = `${location.areaTypeKey || ''} ${location.areaTypeLabel || ''} ${location.name || ''}`.toLowerCase()
    return textValue.includes('warehouse') || textValue.includes('kho')
  }), [options.locations])

  const loadLinkedRecord = useCallback(async (currentInquiry) => {
    setBorrowRequest(null)
    setConsumableFulfillment(null)
    if (!currentInquiry?.linkedEntityId) return
    try {
      if (currentInquiry.linkedEntityType === 'ASSET_BORROW_REQUEST') {
        const response = await axiosClient.get(`/api/borrow-requests/${currentInquiry.linkedEntityId}`)
        setBorrowRequest(response.data)
      } else if (currentInquiry.linkedEntityType === 'CONSUMABLE_REQUEST') {
        const response = await axiosClient.get(`/api/consumable-fulfillments/inquiry/${currentInquiry.id}`)
        setConsumableFulfillment(response.data)
        if (response.data?.sourceWarehouseLocationId) setWarehouseId(String(response.data.sourceWarehouseLocationId))
        if (response.data?.remainingQuantity) setPrepareQuantity(String(response.data.remainingQuantity))
      }
    } catch {
      // Phiếu liên kết có thể chưa sẵn sàng ngay sau lúc chuyển đổi; lần tải kế tiếp sẽ thử lại.
    }
  }, [])

  const loadDetail = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [detailResponse, messageResponse, optionResponse] = await Promise.all([
        axiosClient.get(`/api/inquiries/${id}`),
        axiosClient.get(`/api/inquiries/${id}/messages`),
        axiosClient.get('/api/inquiries/options'),
      ])
      setInquiry(detailResponse.data)
      setMessages(messageResponse.data || [])
      setOptions(optionResponse.data || { locations: [], handlers: [] })
      setTransferUserId(detailResponse.data?.assigneeId ? String(detailResponse.data.assigneeId) : '')
      await loadLinkedRecord(detailResponse.data)
    } catch (error) {
      if (!silent) toast.error(error?.response?.data?.message || 'Không tải được yêu cầu.')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [id, loadLinkedRecord])

  const loadTemplates = useCallback(async () => {
    if (!isHandlerRole) return
    try {
      const response = await axiosClient.get('/api/inquiry-reply-templates')
      setTemplates(response.data || [])
    } catch {
      setTemplates([])
    }
  }, [isHandlerRole])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDetail(), 0)
    const interval = window.setInterval(() => void loadDetail(true), 20000)
    return () => {
      window.clearTimeout(timer)
      window.clearInterval(interval)
    }
  }, [loadDetail])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadTemplates(), 0)
    return () => window.clearTimeout(timer)
  }, [loadTemplates])

  useEffect(() => {
    if (!connected || !user?.userId) return undefined
    const unsubscribeMessage = subscribe(`/topic/users/${user.userId}/inquiries/${id}`, (message) => {
      if (!message?.id) return
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message])
      void axiosClient.post(`/api/inquiries/${id}/read`)
    })
    const unsubscribeUpdate = subscribe(`/topic/users/${user.userId}/inquiry-updates`, (payload) => {
      if (Number(payload?.inquiryId) === Number(id)) void loadDetail(true)
    })
    const unsubscribeBorrow = subscribe(`/topic/users/${user.userId}/borrow-requests`, (payload) => {
      if (Number(payload?.inquiryId) === Number(id)) {
        setBorrowRequest(payload)
        void loadDetail(true)
      }
    })
    return () => {
      unsubscribeMessage()
      unsubscribeUpdate()
      unsubscribeBorrow()
    }
  }, [connected, id, loadDetail, subscribe, user?.userId])

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages])

  const runAction = async (request, successMessage) => {
    setBusy(true)
    try {
      await request()
      toast.success(successMessage)
      setNote('')
      await loadDetail(true)
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Không thể thực hiện thao tác.')
    } finally {
      setBusy(false)
    }
  }

  const sendMessage = async (event) => {
    event.preventDefault()
    if (!text.trim() || !canMessage) return
    setBusy(true)
    try {
      const response = await axiosClient.post(`/api/inquiries/${id}/messages`, { content: text.trim() })
      setMessages((current) => current.some((item) => item.id === response.data?.id) ? current : [...current, response.data])
      setText('')
      setInquiry((current) => current ? { ...current, status: isEmployee ? 'IN_PROGRESS' : 'WAITING_EMPLOYEE' } : current)
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Không gửi được tin nhắn.')
    } finally {
      setBusy(false)
    }
  }

  const uploadImage = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !canMessage) return
    const formData = new FormData()
    formData.append('file', file)
    setBusy(true)
    try {
      const upload = await axiosClient.post(`/api/inquiries/${id}/media`, formData)
      const response = await axiosClient.post(`/api/inquiries/${id}/messages`, {
        mediaUrl: upload.data.mediaUrl,
        mediaType: upload.data.mediaType,
      })
      setMessages((current) => current.some((item) => item.id === response.data?.id) ? current : [...current, response.data])
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Không gửi được ảnh.')
    } finally {
      setBusy(false)
    }
  }

  const createTemplate = async () => {
    if (!templateTitle.trim() || !text.trim()) return
    setBusy(true)
    try {
      const response = await axiosClient.post('/api/inquiry-reply-templates', {
        title: templateTitle.trim(),
        content: text.trim(),
      })
      toast.success('Đã lưu câu trả lời mẫu cho bộ phận.')
      setTemplateTitle('')
      await loadTemplates()
      setSelectedTemplateId(String(response.data?.id || ''))
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Không lưu được câu trả lời mẫu.')
    } finally {
      setBusy(false)
    }
  }

  const deleteTemplate = async () => {
    if (!selectedTemplateId) return
    setBusy(true)
    try {
      await axiosClient.delete(`/api/inquiry-reply-templates/${selectedTemplateId}`)
      toast.success('Đã xóa câu trả lời mẫu.')
      setSelectedTemplateId('')
      await loadTemplates()
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Không xóa được câu trả lời mẫu.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="rounded-2xl bg-white p-6 text-sm text-slate-500">Đang tải yêu cầu...</div>
  if (!inquiry) return <div className="rounded-2xl bg-white p-6 text-sm text-slate-500">Không tìm thấy yêu cầu.</div>

  const renderBorrowActions = () => {
    if (!borrowRequest) return null
    const status = borrowRequest.status
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {user?.role === 'Admin' && status === 'PENDING' && <>
          <button disabled={busy} onClick={() => runAction(() => axiosClient.post(`/api/borrow-requests/${borrowRequest.id}/approve`, { note }), 'Đã duyệt phiếu mượn.')} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">Duyệt</button>
          <button disabled={busy} onClick={() => runAction(() => axiosClient.post(`/api/borrow-requests/${borrowRequest.id}/reject`, { note }), 'Đã từ chối phiếu mượn.')} className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white">Từ chối</button>
        </>}
        {user?.role === 'Admin' && status === 'APPROVED' && <button disabled={busy} onClick={() => runAction(() => axiosClient.post(`/api/borrow-requests/${borrowRequest.id}/reserve`, { note, reservationMinutes: 1440 }), 'Đã giữ thiết bị trong 24 giờ.')} className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white">Giữ chỗ 24 giờ</button>}
        {user?.role === 'Admin' && ['APPROVED', 'RESERVED'].includes(status) && <button disabled={busy} onClick={() => runAction(() => axiosClient.post(`/api/borrow-requests/${borrowRequest.id}/handover`), 'Đã xác nhận bàn giao thiết bị.')} className="rounded-xl bg-orange-600 px-3 py-2 text-xs font-semibold text-white">Xác nhận bàn giao</button>}
        {status === 'CHECKED_OUT' && ['Admin', 'NhanVien'].includes(user?.role) && <button disabled={busy} onClick={() => runAction(() => axiosClient.post(`/api/borrow-requests/${borrowRequest.id}/return`), 'Đã xác nhận trả thiết bị.')} className="rounded-xl bg-slate-800 px-3 py-2 text-xs font-semibold text-white">Xác nhận trả</button>}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link to={basePath} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500"><ArrowLeft size={16} /> Quay lại</Link>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-orange-600">{getInquiryTypeLabel(inquiry.inquiryType)} #{inquiry.id}</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">{inquiry.assetQaCode} · {inquiry.assetName}</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${statusMeta.className}`}>{statusMeta.label}</span>
            <button type="button" onClick={() => loadDetail()} className="rounded-xl border border-slate-300 p-2 text-slate-500"><Refresh size={17} /></button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-950 sm:grid-cols-2 lg:grid-cols-4">
          <p><span className="block text-xs text-slate-400">Người yêu cầu</span><b>{inquiry.requesterName}</b></p>
          <p><span className="block text-xs text-slate-400">Người phụ trách</span><b>{inquiry.assigneeName || 'Chưa tiếp nhận'}</b></p>
          <p><span className="block text-xs text-slate-400">Phòng nhận/sử dụng</span><b>{inquiry.destinationLocationName}</b></p>
          <p><span className="block text-xs text-slate-400">Số lượng</span><b>{inquiry.quantityRequested} {inquiry.unit || ''}</b></p>
          <p><span className="block text-xs text-slate-400">Ngày cần</span><b>{inquiry.neededFrom || '-'}</b></p>
          <p><span className="block text-xs text-slate-400">Ngày trả dự kiến</span><b>{inquiry.expectedReturnDate || '-'}</b></p>
          <p className="sm:col-span-2"><span className="block text-xs text-slate-400">Mục đích</span><b>{inquiry.purpose}</b></p>
        </div>
        {inquiry.alternativeAssetQaCode && <div className="mt-3 rounded-2xl border border-violet-200 bg-violet-50 p-3 text-sm text-violet-800">Phương án thay thế: <b>{inquiry.alternativeAssetQaCode} · {inquiry.alternativeAssetName}</b>{inquiry.proposedQuantity ? `, số lượng ${inquiry.proposedQuantity}` : ''}. {inquiry.alternativeAccepted ? 'Nhân viên đã đồng ý.' : 'Đang chờ nhân viên xác nhận.'}</div>}
        {inquiry.decisionNote && <p className="mt-3 rounded-2xl bg-slate-100 p-3 text-sm text-slate-600">Ghi chú xử lý: {inquiry.decisionNote}</p>}
        <div className={`mt-3 rounded-2xl border p-3 text-sm ${slaMeta.breached ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}><b>SLA phản hồi:</b> {slaMeta.label} · Hạn {formatVietnamDateTime(inquiry.slaResponseDueAt)}</div>
      </section>

      {isTargetHandler && !inquiry.assigneeId && !isTerminal && <button disabled={busy} onClick={() => runAction(() => axiosClient.post(`/api/inquiries/${id}/claim`), 'Đã nhận xử lý yêu cầu.')} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white"><UserCheck size={18} /> Nhận xử lý yêu cầu</button>}

      {isAssignedHandler && !isTerminal && (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">Xử lý nghiệp vụ</h3>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950">
              <label className="text-xs font-semibold text-slate-500">Chuyển người phụ trách</label>
              <div className="mt-2 flex gap-2"><select value={transferUserId} onChange={(event) => setTransferUserId(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="">Chọn người xử lý</option>{options.handlers.map((handler) => <option key={handler.id} value={handler.id}>{handler.fullName || handler.username}</option>)}</select><button disabled={busy || !transferUserId || Number(transferUserId) === Number(user.userId)} onClick={() => runAction(() => axiosClient.post(`/api/inquiries/${id}/transfer`, { assigneeUserId: Number(transferUserId) }), 'Đã chuyển người phụ trách.')} className="rounded-xl bg-slate-800 px-3 text-xs font-semibold text-white disabled:opacity-40">Chuyển</button></div>
            </div>
            {!inquiry.linkedEntityId && <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950">
              <label className="text-xs font-semibold text-slate-500">Đề xuất thiết bị/vật tư thay thế</label>
              <div className="mt-2 grid grid-cols-[1fr_5rem_auto] gap-2"><input value={alternativeQaCode} onChange={(event) => setAlternativeQaCode(event.target.value)} placeholder="Mã QA" className="min-w-0 rounded-xl border border-slate-300 px-3 py-2 text-sm" /><input type="number" min="1" value={alternativeQuantity} onChange={(event) => setAlternativeQuantity(event.target.value)} className="rounded-xl border border-slate-300 px-2 py-2 text-sm" /><button disabled={busy || !alternativeQaCode.trim()} onClick={() => runAction(() => axiosClient.post(`/api/inquiries/${id}/alternative`, { alternativeAssetQaCode: alternativeQaCode.trim(), proposedQuantity: Number(alternativeQuantity), note: note || null }), 'Đã gửi phương án thay thế.')} className="rounded-xl bg-violet-600 px-3 text-xs font-semibold text-white disabled:opacity-40">Đề xuất</button></div>
            </div>}
          </div>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} rows={2} placeholder="Ghi chú xử lý hoặc lý do từ chối..." className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          <div className="mt-3 flex flex-wrap gap-2">
            {!inquiry.linkedEntityId && inquiry.inquiryType === 'ASSET_BORROW' && <button disabled={busy} onClick={() => runAction(() => axiosClient.post(`/api/inquiries/${id}/create-borrow-request`), 'Đã tạo phiếu mượn thiết bị.')} className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-3 py-2 text-xs font-semibold text-white"><Package size={16} /> Tạo phiếu mượn</button>}
            {!inquiry.linkedEntityId && inquiry.inquiryType === 'CONSUMABLE_REQUEST' && <><select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-xs"><option value="">Chọn kho xuất</option>{warehouseOptions.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select><button disabled={busy || !warehouseId} onClick={() => runAction(() => axiosClient.post(`/api/inquiries/${id}/create-consumable-request`, { sourceWarehouseLocationId: Number(warehouseId), note: note || null }), 'Đã tạo phiếu cấp phát vật tư.')} className="rounded-xl bg-orange-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Tạo phiếu cấp phát</button></>}
            {!inquiry.linkedEntityId && <button disabled={busy || !note.trim()} onClick={() => runAction(() => axiosClient.post(`/api/inquiries/${id}/reject`, { note: note.trim() }), 'Đã từ chối yêu cầu.')} className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Từ chối yêu cầu</button>}
            {!inquiry.linkedEntityId && <button disabled={busy} onClick={() => runAction(() => axiosClient.post(`/api/inquiries/${id}/close`, { note: note || null }), 'Đã hoàn tất yêu cầu.')} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">Đóng hoàn tất</button>}
          </div>
        </section>
      )}

      {isEmployee && !isTerminal && <div className="flex flex-wrap gap-2">{inquiry.alternativeAssetQaCode && !inquiry.alternativeAccepted && <button disabled={busy} onClick={() => runAction(() => axiosClient.post(`/api/inquiries/${id}/alternative/accept`), 'Đã chấp nhận phương án thay thế.')} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white"><Check size={16} /> Chấp nhận phương án</button>}{inquiry.linkedEntityId && inquiry.status === 'WAITING_EMPLOYEE' && (inquiry.linkedEntityType !== 'CONSUMABLE_REQUEST' || consumableFulfillment?.status === 'FULFILLED' || consumableFulfillment?.closedPartial) && <button disabled={busy} onClick={() => runAction(() => axiosClient.post(`/api/inquiries/${id}/confirm-receipt`), 'Đã xác nhận bạn đã nhận thiết bị/vật tư.')} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"><Check size={16} /> Xác nhận đã nhận</button>}{!inquiry.linkedEntityId && <button disabled={busy} onClick={() => runAction(() => axiosClient.post(`/api/inquiries/${id}/cancel`, { note: note || null }), 'Đã hủy yêu cầu.')} className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600">Hủy yêu cầu</button>}</div>}

      {borrowRequest && <section className="rounded-3xl border border-indigo-200 bg-indigo-50 p-4"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-600">Phiếu mượn #{borrowRequest.id}</p><p className="mt-2 text-sm text-indigo-900">Trạng thái: <b>{BORROW_STATUS[borrowRequest.status] || borrowRequest.status}</b>{borrowRequest.reservationExpiresAt ? ` · Giữ đến ${formatVietnamDateTime(borrowRequest.reservationExpiresAt)}` : ''}</p>{renderBorrowActions()}</section>}

      {consumableFulfillment && <section className="rounded-3xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-950/40">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-600">Tiến độ cấp phát #{consumableFulfillment.originalConsumableRequestId}</p>
            <p className="mt-2 text-sm text-indigo-900 dark:text-indigo-100">Trạng thái: <b>{CONSUMABLE_FULFILLMENT_STATUS[consumableFulfillment.status] || consumableFulfillment.status}</b> · Kho xuất: <b>{consumableFulfillment.sourceWarehouseLocationName || 'Chưa chọn'}</b></p>
            <p className="mt-1 text-sm text-indigo-800 dark:text-indigo-200">Đã cấp <b>{consumableFulfillment.fulfilledQuantity || 0}/{consumableFulfillment.requestedQuantity}</b> · Còn lại <b>{consumableFulfillment.remainingQuantity || 0}</b>{consumableFulfillment.preparedQuantity ? ` · Đang chuẩn bị ${consumableFulfillment.preparedQuantity}` : ''}</p>
          </div>
          {consumableFulfillment.requiresAdminApproval && <span className={`rounded-full px-3 py-1 text-xs font-semibold ${consumableFulfillment.adminApproved ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>{consumableFulfillment.adminApproved ? 'Admin đã duyệt' : 'Chờ Admin duyệt'}</span>}
        </div>
        {consumableFulfillment.decisionNote && <p className="mt-3 rounded-xl bg-white/70 p-3 text-sm text-indigo-800 dark:bg-slate-900/70 dark:text-indigo-100">Ghi chú: {consumableFulfillment.decisionNote}</p>}
        {user?.role === 'Admin' && consumableFulfillment.requiresAdminApproval && !consumableFulfillment.adminApproved && consumableFulfillment.status === 'PENDING' && <div className="mt-3 space-y-2"><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} rows={2} placeholder="Ghi chú phê duyệt hoặc lý do từ chối..." className="w-full rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm" /><div className="flex flex-wrap gap-2"><button disabled={busy} onClick={() => runAction(() => axiosClient.post(`/api/consumable-fulfillments/${consumableFulfillment.id}/admin-approve`, { note: note || null }), 'Đã phê duyệt yêu cầu cấp vật tư.')} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">Phê duyệt</button><button disabled={busy || !note.trim()} onClick={() => runAction(() => axiosClient.post(`/api/consumable-fulfillments/${consumableFulfillment.id}/reject`, { note: note.trim() }), 'Đã từ chối yêu cầu cấp vật tư.')} className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Từ chối</button></div></div>}
        {isEmployee && consumableFulfillment.status === 'PENDING' && (consumableFulfillment.fulfilledQuantity || 0) === 0 && <button disabled={busy} onClick={() => runAction(() => axiosClient.post(`/api/consumable-fulfillments/${consumableFulfillment.id}/cancel`, { note: note || null }), 'Đã hủy phiếu cấp vật tư.')} className="mt-3 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600">Hủy phiếu cấp vật tư</button>}
        {isAssignedHandler && user?.role === 'ConsumableManager' && !consumableFulfillment.closedPartial && !['FULFILLED', 'REJECTED', 'CANCELLED'].includes(consumableFulfillment.status) && <div className="mt-4 space-y-3 border-t border-indigo-200 pt-3">
          {['PENDING', 'PARTIALLY_FULFILLED'].includes(consumableFulfillment.status) && <>
            <div className="flex flex-wrap gap-2"><select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} className="min-w-48 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs"><option value="">Chọn kho xuất</option>{warehouseOptions.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select><button disabled={busy || !warehouseId || (consumableFulfillment.requiresAdminApproval && !consumableFulfillment.adminApproved)} onClick={() => runAction(() => axiosClient.post(`/api/consumable-fulfillments/${consumableFulfillment.id}/warehouse`, { warehouseLocationId: Number(warehouseId) }), 'Đã cập nhật kho xuất.')} className="rounded-xl border border-indigo-300 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 disabled:opacity-40">Đổi kho</button></div>
            <div className="flex flex-wrap gap-2"><input type="number" min="1" max={consumableFulfillment.remainingQuantity} value={prepareQuantity} onChange={(event) => setPrepareQuantity(event.target.value)} className="w-32 rounded-xl border border-indigo-200 px-3 py-2 text-xs" /><button disabled={busy || !prepareQuantity || Number(prepareQuantity) <= 0 || Number(prepareQuantity) > Number(consumableFulfillment.remainingQuantity) || (consumableFulfillment.requiresAdminApproval && !consumableFulfillment.adminApproved)} onClick={() => runAction(() => axiosClient.post(`/api/consumable-fulfillments/${consumableFulfillment.id}/prepare`, { quantity: Number(prepareQuantity), note: note || null }), 'Đã bắt đầu chuẩn bị vật tư.')} className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Bắt đầu chuẩn bị</button>{consumableFulfillment.status === 'PARTIALLY_FULFILLED' && <button disabled={busy || !note.trim()} onClick={() => runAction(() => axiosClient.post(`/api/consumable-fulfillments/${consumableFulfillment.id}/close-partial`, { note: note.trim() }), 'Đã kết thúc yêu cầu ở mức cấp một phần.')} className="rounded-xl border border-orange-300 bg-white px-3 py-2 text-xs font-semibold text-orange-700 disabled:opacity-40">Kết thúc cấp một phần</button>}</div>
          </>}
          {consumableFulfillment.status === 'PREPARING' && <button disabled={busy} onClick={() => runAction(() => axiosClient.post(`/api/consumable-fulfillments/${consumableFulfillment.id}/ready`, { note: note || null }), 'Đã báo vật tư sẵn sàng để nhận.')} className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white">Báo sẵn sàng</button>}
          {consumableFulfillment.status === 'READY_FOR_PICKUP' && <button disabled={busy} onClick={() => runAction(() => axiosClient.post(`/api/consumable-fulfillments/${consumableFulfillment.id}/fulfill`, { note: note || null }), 'Đã ghi nhận cấp phát vật tư.')} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">Xác nhận đã cấp</button>}
          {(consumableFulfillment.fulfilledQuantity || 0) === 0 && <button disabled={busy || !note.trim()} onClick={() => runAction(() => axiosClient.post(`/api/consumable-fulfillments/${consumableFulfillment.id}/reject`, { note: note.trim() }), 'Đã từ chối phiếu cấp phát.')} className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Từ chối phiếu</button>}
        </div>}
      </section>}

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800"><h3 className="inline-flex items-center gap-2 font-semibold"><MessageCircle size={18} className="text-orange-600" /> Hội thoại</h3><span className={`text-xs font-semibold ${connected ? 'text-emerald-600' : 'text-slate-400'}`}>{connected ? 'Trực tuyến' : 'Đang đồng bộ'}</span></div>
        <div className="max-h-[32rem] min-h-72 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && <p className="py-10 text-center text-sm text-slate-400">Chưa có tin nhắn.</p>}
          {messages.map((message) => {
            const mine = Number(message.senderId) === Number(user?.userId)
            return <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[85%] rounded-2xl px-3 py-2 ${mine ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-100'}`}><p className={`text-[11px] font-semibold ${mine ? 'text-white/75' : 'text-slate-400'}`}>{message.senderName} · {formatVietnamDateTime(message.createdAt)}</p>{message.content && <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{message.content}</p>}{message.mediaUrl && <AuthenticatedInquiryImage src={message.mediaUrl} className="mt-2 max-h-72 w-full rounded-xl object-cover" />}</div></div>
          })}
          <div ref={messageEndRef} />
        </div>
        {canMessage ? <form onSubmit={sendMessage} className="flex flex-wrap items-end gap-2 border-t border-slate-100 p-3 dark:border-slate-800">{isAssignedHandler && <div className="grid w-full gap-2 rounded-2xl bg-slate-50 p-3 dark:bg-slate-950 sm:grid-cols-[1fr_1fr_auto_auto]"><select value={selectedTemplateId} onChange={(event) => { const nextId = event.target.value; setSelectedTemplateId(nextId); const template = templates.find((item) => String(item.id) === nextId); if (template) setText(template.content) }} className="rounded-xl border border-slate-300 px-3 py-2 text-xs"><option value="">Chọn câu trả lời mẫu</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.title}</option>)}</select><input value={templateTitle} onChange={(event) => setTemplateTitle(event.target.value)} maxLength={100} placeholder="Tên mẫu mới" className="rounded-xl border border-slate-300 px-3 py-2 text-xs" /><button type="button" disabled={busy || !templateTitle.trim() || !text.trim()} onClick={createTemplate} className="rounded-xl bg-slate-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Lưu mẫu</button><button type="button" disabled={busy || !selectedTemplateId} onClick={deleteTemplate} className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 disabled:opacity-40">Xóa mẫu</button></div>}<input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadImage} className="hidden" /><button type="button" disabled={busy} onClick={() => fileInputRef.current?.click()} className="rounded-xl border border-slate-300 p-2.5 text-slate-500"><Camera size={19} /></button><textarea value={text} onChange={(event) => setText(event.target.value)} rows={1} maxLength={4000} placeholder="Nhập nội dung trao đổi..." className="min-h-11 flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /><button disabled={busy || !text.trim()} className="rounded-xl bg-orange-600 p-3 text-white disabled:bg-slate-300"><Send size={18} /></button></form> : <p className="border-t border-slate-100 p-4 text-center text-sm text-slate-500">{isTerminal ? 'Yêu cầu đã kết thúc; hội thoại được lưu ở chế độ chỉ xem.' : 'Người phụ trách cần nhận yêu cầu trước khi trao đổi.'}</p>}
      </section>
    </div>
  )
}

export default InquiryDetail
