import {
  IconArrowLeft as ArrowLeft,
  IconCalendar as Calendar,
  IconCamera as Camera,
  IconCheck as Check,
  IconClock as Clock,
  IconHash as Hash,
  IconMapPin as MapPin,
  IconMessageCircle as MessageCircle,
  IconPackage as Package,
  IconRefresh as Refresh,
  IconSend as Send,
  IconSparkles as Sparkles,
  IconUser as User,
  IconUserCheck as UserCheck,
} from '@tabler/icons-react'
import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'
import AuthenticatedInquiryImage from '../components/AuthenticatedInquiryImage'
import { useAuth } from '../context/AuthContext'
import useWebSocket from '../hooks/useWebSocket'
import { formatVietnamDate, formatVietnamDateTime } from '../utils/datetime'
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
  const [templateContent, setTemplateContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [currentTime, setCurrentTime] = useState(() => Date.now())
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
  const reservationOpensAt = borrowRequest?.neededFrom
    ? new Date(`${borrowRequest.neededFrom}T00:00:00+07:00`).getTime() - 24 * 60 * 60 * 1000
    : null
  const canStartReservation = reservationOpensAt == null || currentTime >= reservationOpensAt
  const reservationButtonLabel = borrowRequest?.neededFrom
    ? `Giữ chỗ đến hết ${formatVietnamDate(borrowRequest.neededFrom)}`
    : 'Giữ chỗ theo ngày cần'
  const reservationAvailableLabel = borrowRequest?.neededFrom
    ? `Có thể giữ chỗ từ ${new Date(reservationOpensAt).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`
    : 'Chưa đến thời gian giữ chỗ'

  const warehouseOptions = useMemo(() => options.locations.filter((location) => {
    if (location.storageWarehouse) return true
    const textValue = `${location.areaTypeKey || ''} ${location.areaTypeLabel || ''} ${location.name || ''}`.toLowerCase()
    return textValue.includes('warehouse') || textValue.includes('kho')
  }), [options.locations])

  const transferableHandlers = useMemo(
    () => options.handlers.filter((handler) => Number(handler.id) !== Number(inquiry?.assigneeId)),
    [inquiry?.assigneeId, options.handlers],
  )

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

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
      setTransferUserId((current) => Number(current) === Number(detailResponse.data?.assigneeId) ? '' : current)
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

  const handleMessageKeyDown = (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent?.isComposing) return
    event.preventDefault()
    if (!text.trim() || busy || !canMessage) return
    event.currentTarget.form?.requestSubmit()
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
    if (!templateContent.trim()) return
    setBusy(true)
    try {
      const response = await axiosClient.post('/api/inquiry-reply-templates', {
        title: templateContent.trim().slice(0, 100),
        content: templateContent.trim(),
      })
      toast.success('Đã lưu câu trả lời mẫu cho bộ phận.')
      setTemplateContent('')
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
        {user?.role === 'Admin' && status === 'APPROVED' && <button disabled={busy || !canStartReservation} title={!canStartReservation ? reservationAvailableLabel : undefined} onClick={() => runAction(() => axiosClient.post(`/api/borrow-requests/${borrowRequest.id}/reserve`, { note }), `Đã giữ thiết bị đến hết ngày cần ${formatVietnamDate(borrowRequest.neededFrom, '')}.`)} className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300">{canStartReservation ? reservationButtonLabel : reservationAvailableLabel}</button>}
        {user?.role === 'Admin' && ['APPROVED', 'RESERVED'].includes(status) && <button disabled={busy} onClick={() => runAction(() => axiosClient.post(`/api/borrow-requests/${borrowRequest.id}/handover`), 'Đã xác nhận bàn giao thiết bị.')} className="rounded-xl bg-orange-600 px-3 py-2 text-xs font-semibold text-white">Xác nhận bàn giao</button>}
        {status === 'CHECKED_OUT' && ['Admin', 'NhanVien'].includes(user?.role) && <button disabled={busy} onClick={() => runAction(() => axiosClient.post(`/api/borrow-requests/${borrowRequest.id}/return`), 'Đã xác nhận trả thiết bị.')} className="rounded-xl bg-slate-800 px-3 py-2 text-xs font-semibold text-white">Xác nhận trả</button>}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="relative min-w-0">
            <Link to={basePath} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-orange-600"><ArrowLeft size={16} /> Quay lại hộp thư</Link>
            <p className="mt-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-orange-600"><Sparkles size={14} /> {getInquiryTypeLabel(inquiry.inquiryType)} #{inquiry.id}</p>
            <h2 className="mt-2 truncate text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-3xl">{inquiry.assetQaCode} · {inquiry.assetName}</h2>
          </div>
          <div className="relative flex items-center gap-2">
            <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${statusMeta.className}`}>{statusMeta.label}</span>
            <button type="button" onClick={() => loadDetail()} disabled={loading || busy} aria-label="Làm mới yêu cầu" className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-orange-500/10"><Refresh size={17} className={loading ? 'animate-spin' : ''} /></button>
          </div>
        </div>
        <div className="relative mt-5 grid gap-x-5 gap-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Người yêu cầu', value: inquiry.requesterName, icon: User },
            { label: 'Người phụ trách', value: inquiry.assigneeName || 'Chưa tiếp nhận', icon: User },
            { label: 'Phòng nhận / sử dụng', value: inquiry.destinationLocationName, icon: MapPin },
            { label: 'Số lượng', value: `${inquiry.quantityRequested} ${inquiry.unit || ''}`, icon: Hash },
            { label: 'Ngày cần', value: formatVietnamDate(inquiry.neededFrom), icon: Calendar },
            { label: 'Ngày trả dự kiến', value: formatVietnamDate(inquiry.expectedReturnDate), icon: Calendar },
          ].map(({ label, value, icon }) => <div key={label} className="flex min-w-0 items-start gap-2.5"><span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800">{createElement(icon, { size: 16 })}</span><p className="min-w-0"><span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</span><b className="mt-0.5 block truncate text-slate-800 dark:text-slate-100">{value}</b></p></div>)}
          <div className="sm:col-span-2"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Mục đích sử dụng</p><p className="mt-1 font-semibold leading-6 text-slate-800 dark:text-slate-100">{inquiry.purpose}</p></div>
        </div>
        {inquiry.alternativeAssetQaCode && <div className="mt-3 rounded-xl border border-violet-200 border-l-4 border-l-violet-500 bg-white p-3 text-sm text-slate-700 dark:border-violet-500/30 dark:border-l-violet-400 dark:bg-slate-900 dark:text-slate-200">Phương án thay thế: <b>{inquiry.alternativeAssetQaCode} · {inquiry.alternativeAssetName}</b>{inquiry.proposedQuantity ? `, số lượng ${inquiry.proposedQuantity}` : ''}. {inquiry.alternativeAccepted ? 'Nhân viên đã đồng ý.' : 'Đang chờ nhân viên xác nhận.'}</div>}
        {inquiry.decisionNote && <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"><b>Ghi chú xử lý:</b> {inquiry.decisionNote}</p>}
        <div className={`relative mt-3 flex items-center gap-2 rounded-xl border-l-4 bg-slate-50 p-3 text-sm dark:bg-slate-900 ${slaMeta.breached ? 'border-l-rose-500 text-rose-700 dark:text-rose-300' : 'border-l-emerald-500 text-emerald-700 dark:text-emerald-300'}`}><Clock size={17} /><span><b>SLA phản hồi:</b> {slaMeta.label} · Hạn {formatVietnamDateTime(inquiry.slaResponseDueAt)}</span></div>
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
      <div className="space-y-4 xl:order-2 xl:sticky xl:top-5">

      {isTargetHandler && !inquiry.assigneeId && !isTerminal && <button disabled={busy} onClick={() => runAction(() => axiosClient.post(`/api/inquiries/${id}/claim`), 'Đã nhận xử lý yêu cầu.')} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white"><UserCheck size={18} /> Nhận xử lý yêu cầu</button>}

      {isAssignedHandler && !isTerminal && (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">Xử lý nghiệp vụ</h3>
          <div className="mt-3 grid gap-3">
            <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950">
              <label className="text-xs font-semibold text-slate-500">Chuyển người phụ trách</label>
              <div className="mt-2 flex gap-2"><select value={transferUserId} onChange={(event) => setTransferUserId(event.target.value)} disabled={busy || transferableHandlers.length === 0} className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:disabled:bg-slate-800"><option value="">{transferableHandlers.length ? 'Chọn người xử lý' : 'Không có người phù hợp'}</option>{transferableHandlers.map((handler) => <option key={handler.id} value={handler.id}>{handler.fullName || handler.username}</option>)}</select><button type="button" disabled={busy || !transferUserId} onClick={() => runAction(() => axiosClient.post(`/api/inquiries/${id}/transfer`, { assigneeUserId: Number(transferUserId) }), 'Đã chuyển người phụ trách.')} className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-700">Chuyển</button></div>
              {transferableHandlers.length === 0 && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Hiện không có người xử lý nào khác trong cùng nhóm để chuyển yêu cầu.</p>}
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

      {borrowRequest && <section className="rounded-2xl border border-slate-200 border-l-4 border-l-indigo-500 bg-white p-4 shadow-sm dark:border-slate-800 dark:border-l-indigo-400 dark:bg-slate-900"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-600 dark:text-indigo-300">Phiếu mượn #{borrowRequest.id}</p><p className="mt-2 text-sm text-slate-700 dark:text-slate-200">Trạng thái: <b>{BORROW_STATUS[borrowRequest.status] || borrowRequest.status}</b>{borrowRequest.reservationExpiresAt ? ` · Giữ đến ${formatVietnamDateTime(borrowRequest.reservationExpiresAt)}` : ''}</p>{renderBorrowActions()}</section>}

      {consumableFulfillment && <section className="rounded-2xl border border-slate-200 border-l-4 border-l-indigo-500 bg-white p-4 shadow-sm dark:border-slate-800 dark:border-l-indigo-400 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-600">Tiến độ cấp phát #{consumableFulfillment.originalConsumableRequestId}</p>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">Trạng thái: <b>{CONSUMABLE_FULFILLMENT_STATUS[consumableFulfillment.status] || consumableFulfillment.status}</b> · Kho xuất: <b>{consumableFulfillment.sourceWarehouseLocationName || 'Chưa chọn'}</b></p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Đã cấp <b>{consumableFulfillment.fulfilledQuantity || 0}/{consumableFulfillment.requestedQuantity}</b> · Còn lại <b>{consumableFulfillment.remainingQuantity || 0}</b>{consumableFulfillment.preparedQuantity ? ` · Đang chuẩn bị ${consumableFulfillment.preparedQuantity}` : ''}</p>
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

      </div>
      <div className="xl:order-1">
      <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800"><h3 className="inline-flex items-center gap-2 font-semibold"><MessageCircle size={18} className="text-orange-600" /> Hội thoại</h3><span className={`text-xs font-semibold ${connected ? 'text-emerald-600' : 'text-slate-400'}`}>{connected ? 'Trực tuyến' : 'Đang đồng bộ'}</span></div>
        <div className="max-h-[32rem] min-h-72 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && <p className="py-10 text-center text-sm text-slate-400">Chưa có tin nhắn.</p>}
          {messages.map((message) => {
            const mine = Number(message.senderId) === Number(user?.userId)
            return <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[85%] rounded-2xl px-3 py-2 ${mine ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-100'}`}><p className={`text-[11px] font-semibold ${mine ? 'text-white/75' : 'text-slate-400'}`}>{message.senderName} · {formatVietnamDateTime(message.createdAt)}</p>{message.content && <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{message.content}</p>}{message.mediaUrl && <AuthenticatedInquiryImage src={message.mediaUrl} className="mt-2 max-h-72 w-full rounded-xl object-cover" />}</div></div>
          })}
          <div ref={messageEndRef} />
        </div>
        {canMessage ? (
          <form onSubmit={sendMessage} className="flex flex-wrap items-end gap-2 border-t border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-950/50">
            {isAssignedHandler && (
              <div className="w-full rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Câu trả lời mẫu</p>
                  <span className="text-[11px] text-slate-400">{templates.length} mẫu đã lưu</span>
                </div>
                <div className="mt-2 flex max-h-32 flex-wrap gap-2 overflow-y-auto">
                  {templates.length === 0 && <p className="w-full rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-400 dark:bg-slate-800">Chưa có nội dung mẫu.</p>}
                  {templates.map((template) => (
                    <button key={template.id} type="button" onClick={() => { setSelectedTemplateId(String(template.id)); setText(template.content) }} className={`max-w-full rounded-lg border px-3 py-2 text-left text-sm transition ${String(template.id) === selectedTemplateId ? 'border-orange-300 bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300' : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-orange-200 hover:bg-orange-50/60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200'}`}>
                      {template.content}
                    </button>
                  ))}
                </div>
                <textarea value={templateContent} onChange={(event) => setTemplateContent(event.target.value)} maxLength={4000} rows={2} placeholder="Nhập nội dung muốn lưu..." aria-label="Nội dung câu trả lời mẫu mới" className="mt-2 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" disabled={busy || !templateContent.trim()} onClick={createTemplate} className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-700">Lưu nội dung</button>
                  <button type="button" disabled={busy || !selectedTemplateId} onClick={deleteTemplate} className="rounded-lg border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300">Xóa nội dung đã chọn</button>
                </div>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadImage} className="hidden" />
            <button type="button" disabled={busy} onClick={() => fileInputRef.current?.click()} aria-label="Gửi ảnh" className="rounded-xl border border-slate-300 bg-white p-2.5 text-slate-500 transition hover:text-orange-600 disabled:opacity-50 dark:bg-slate-900"><Camera size={19} /></button>
            <textarea value={text} onChange={(event) => setText(event.target.value)} onKeyDown={handleMessageKeyDown} rows={1} maxLength={4000} placeholder="Nhập nội dung trao đổi..." className="min-h-11 flex-1 resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100 dark:bg-slate-900" />
            <button disabled={busy || !text.trim()} aria-label="Gửi tin nhắn" className="rounded-xl bg-orange-600 p-3 text-white shadow-sm transition hover:bg-orange-700 disabled:bg-slate-300"><Send size={18} /></button>
          </form>
        ) : <p className="border-t border-slate-100 p-4 text-center text-sm text-slate-500">{isTerminal ? 'Yêu cầu đã kết thúc; hội thoại được lưu ở chế độ chỉ xem.' : 'Người phụ trách cần nhận yêu cầu trước khi trao đổi.'}</p>}
      </section>
      </div>
      </div>
    </div>
  )
}

export default InquiryDetail
