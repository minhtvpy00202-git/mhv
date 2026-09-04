import {
  IconArrowLeft as ArrowLeft,
  IconCheck as Check,
  IconRefresh as Refresh,
} from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'
import { useAuth } from '../context/AuthContext'
import { formatVietnamDateTime } from '../utils/datetime'
import {
  CONSUMABLE_FULFILLMENT_STATUS,
  TERMINAL_INQUIRY_STATUSES,
  getInquiryBasePath,
  getInquirySlaMeta,
  getInquiryStatusMeta,
  getInquiryTypeLabel,
} from '../utils/inquiry'

function InquiryDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const [inquiry, setInquiry] = useState(null)
  const [options, setOptions] = useState({ locations: [] })
  const [consumableFulfillment, setConsumableFulfillment] = useState(null)
  const [note, setNote] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const basePath = getInquiryBasePath(user?.role)
  const isEmployee = user?.role === 'NhanVien'
  const isHandlerRole = ['Admin', 'ConsumableManager'].includes(user?.role)
  const isTargetHandler = isHandlerRole && inquiry?.targetRole === user?.role
  const isAssignedToCurrentUser = isHandlerRole && Number(inquiry?.assigneeId) === Number(user?.userId)
  const canManageInquiry = isTargetHandler && (!inquiry?.assigneeId || isAssignedToCurrentUser)
  const isTerminal = TERMINAL_INQUIRY_STATUSES.includes(inquiry?.status)
  const statusMeta = getInquiryStatusMeta(inquiry?.status)
  const slaMeta = getInquirySlaMeta(inquiry)

  const warehouseOptions = useMemo(() => options.locations.filter((location) => {
    if (location.storageWarehouse) return true
    const textValue = `${location.areaTypeKey || ''} ${location.areaTypeLabel || ''} ${location.name || ''}`.toLowerCase()
    return textValue.includes('warehouse') || textValue.includes('kho')
  }), [options.locations])

  const loadLinkedRecord = useCallback(async (currentInquiry) => {
    setConsumableFulfillment(null)
    if (!currentInquiry?.linkedEntityId) return
    try {
      if (currentInquiry.linkedEntityType === 'CONSUMABLE_REQUEST') {
        const response = await axiosClient.get(`/api/consumable-fulfillments/inquiry/${currentInquiry.id}`)
        setConsumableFulfillment(response.data)
        if (response.data?.sourceWarehouseLocationId) setWarehouseId(String(response.data.sourceWarehouseLocationId))
      }
    } catch {
      // Phiếu liên kết có thể chưa sẵn sàng ngay sau lúc chuyển đổi; lần tải kế tiếp sẽ thử lại.
    }
  }, [])

  const loadDetail = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [detailResponse, optionResponse] = await Promise.all([
        axiosClient.get(`/api/inquiries/${id}`),
        axiosClient.get('/api/inquiries/options'),
      ])
      setInquiry(detailResponse.data)
      setOptions(optionResponse.data || { locations: [] })
      await loadLinkedRecord(detailResponse.data)
    } catch (error) {
      if (!silent) toast.error(error?.response?.data?.message || 'Không tải được yêu cầu.')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [id, loadLinkedRecord])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDetail(), 0)
    const interval = window.setInterval(() => void loadDetail(true), 20000)
    return () => {
      window.clearTimeout(timer)
      window.clearInterval(interval)
    }
  }, [loadDetail])

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

  if (loading) return <div className="rounded-2xl bg-white p-6 text-sm text-slate-500">Đang tải yêu cầu...</div>
  if (!inquiry) return <div className="rounded-2xl bg-white p-6 text-sm text-slate-500">Không tìm thấy yêu cầu.</div>

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
          <p><span className="block text-xs text-slate-400">Người phụ trách</span><b>{inquiry.assigneeName || 'Chưa phân công'}</b></p>
          <p><span className="block text-xs text-slate-400">Phòng nhận/sử dụng</span><b>{inquiry.destinationLocationName}</b></p>
          <p>
            <span className="block text-xs text-slate-400">Số lượng yêu cầu</span>
            <b>{inquiry.formattedRequestedInputQuantity || `${inquiry.quantityRequestedInput || inquiry.quantityRequested} ${inquiry.quantityRequestedUnit === 'WHOLESALE' ? (inquiry.wholesaleUnit || inquiry.unit || '') : (inquiry.retailUnit || inquiry.unit || '')}`}</b>
            {inquiry.formattedQuantityRequested && inquiry.formattedQuantityRequested !== inquiry.formattedRequestedInputQuantity && (
              <span className="mt-1 block text-xs font-normal text-slate-500">Quy đổi: {inquiry.formattedQuantityRequested}</span>
            )}
          </p>
          <p><span className="block text-xs text-slate-400">Ngày cần</span><b>{inquiry.neededFrom || '-'}</b></p>
          <p><span className="block text-xs text-slate-400">Ngày trả dự kiến</span><b>{inquiry.expectedReturnDate || '-'}</b></p>
          <p className="sm:col-span-2"><span className="block text-xs text-slate-400">Mục đích</span><b>{inquiry.purpose}</b></p>
        </div>
        {inquiry.decisionNote && <p className="mt-3 rounded-2xl bg-slate-100 p-3 text-sm text-slate-600">Ghi chú xử lý: {inquiry.decisionNote}</p>}
        <div className={`mt-3 rounded-2xl border p-3 text-sm ${slaMeta.breached ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}><b>SLA phản hồi:</b> {slaMeta.label} · Hạn {formatVietnamDateTime(inquiry.slaResponseDueAt)}</div>
      </section>

      {canManageInquiry && !isTerminal && (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">Duyệt và xử lý yêu cầu</h3>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} rows={2} placeholder="Ghi chú xử lý hoặc lý do từ chối..." className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          <div className="mt-3 flex flex-wrap gap-2">
            {!inquiry.linkedEntityId && inquiry.inquiryType === 'CONSUMABLE_REQUEST' && <><select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-xs"><option value="">Chọn kho xuất</option>{warehouseOptions.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select><button disabled={busy || !warehouseId} onClick={() => runAction(() => axiosClient.post(`/api/inquiries/${id}/fulfill-consumable`, { sourceWarehouseLocationId: Number(warehouseId), note: note || null }), 'Đã ghi nhận cấp phát vật tư.')} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Xác nhận đã cấp</button></>}
            {!inquiry.linkedEntityId && <button disabled={busy || !note.trim()} onClick={() => runAction(() => axiosClient.post(`/api/inquiries/${id}/reject`, { note: note.trim() }), 'Đã từ chối yêu cầu.')} className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Từ chối yêu cầu</button>}
          </div>
        </section>
      )}

      {isEmployee && !isTerminal && <div className="flex flex-wrap gap-2">{inquiry.linkedEntityId && inquiry.status === 'WAITING_EMPLOYEE' && (inquiry.linkedEntityType !== 'CONSUMABLE_REQUEST' || consumableFulfillment?.status === 'FULFILLED' || consumableFulfillment?.closedPartial) && <button disabled={busy} onClick={() => runAction(() => axiosClient.post(`/api/inquiries/${id}/confirm-receipt`), 'Đã xác nhận bạn đã nhận thiết bị/vật tư.')} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"><Check size={16} /> Xác nhận đã nhận</button>}{!inquiry.linkedEntityId && <button disabled={busy} onClick={() => runAction(() => axiosClient.post(`/api/inquiries/${id}/cancel`, { note: note || null }), 'Đã hủy yêu cầu.')} className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600">Hủy yêu cầu</button>}</div>}

      {consumableFulfillment && <section className="rounded-3xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-950/40">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-600">Tiến độ cấp phát #{consumableFulfillment.originalConsumableRequestId}</p>
            <p className="mt-2 text-sm text-indigo-900 dark:text-indigo-100">Trạng thái: <b>{CONSUMABLE_FULFILLMENT_STATUS[consumableFulfillment.status] || consumableFulfillment.status}</b> · Kho xuất: <b>{consumableFulfillment.sourceWarehouseLocationName || 'Chưa chọn'}</b></p>
            <p className="mt-1 text-sm text-indigo-800 dark:text-indigo-200">Đã cấp <b>{consumableFulfillment.fulfilledQuantity || 0}/{consumableFulfillment.requestedQuantity}</b> · Còn lại <b>{consumableFulfillment.remainingQuantity || 0}</b></p>
          </div>
          {consumableFulfillment.requiresAdminApproval && <span className={`rounded-full px-3 py-1 text-xs font-semibold ${consumableFulfillment.adminApproved ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>{consumableFulfillment.adminApproved ? 'Admin đã duyệt' : 'Chờ Admin duyệt'}</span>}
        </div>
        {consumableFulfillment.decisionNote && <p className="mt-3 rounded-xl bg-white/70 p-3 text-sm text-indigo-800 dark:bg-slate-900/70 dark:text-indigo-100">Ghi chú: {consumableFulfillment.decisionNote}</p>}
        {user?.role === 'Admin' && consumableFulfillment.requiresAdminApproval && !consumableFulfillment.adminApproved && consumableFulfillment.status === 'PENDING' && <div className="mt-3 space-y-2"><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} rows={2} placeholder="Ghi chú phê duyệt hoặc lý do từ chối..." className="w-full rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm" /><div className="flex flex-wrap gap-2"><button disabled={busy} onClick={() => runAction(() => axiosClient.post(`/api/consumable-fulfillments/${consumableFulfillment.id}/admin-approve`, { note: note || null }), 'Đã phê duyệt yêu cầu cấp vật tư.')} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">Phê duyệt</button><button disabled={busy || !note.trim()} onClick={() => runAction(() => axiosClient.post(`/api/consumable-fulfillments/${consumableFulfillment.id}/reject`, { note: note.trim() }), 'Đã từ chối yêu cầu cấp vật tư.')} className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Từ chối</button></div></div>}
        {isEmployee && consumableFulfillment.status === 'PENDING' && (consumableFulfillment.fulfilledQuantity || 0) === 0 && <button disabled={busy} onClick={() => runAction(() => axiosClient.post(`/api/consumable-fulfillments/${consumableFulfillment.id}/cancel`, { note: note || null }), 'Đã hủy phiếu cấp vật tư.')} className="mt-3 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600">Hủy phiếu cấp vật tư</button>}
        {canManageInquiry && user?.role === 'ConsumableManager' && !consumableFulfillment.closedPartial && !['FULFILLED', 'REJECTED', 'CANCELLED'].includes(consumableFulfillment.status) && <div className="mt-4 space-y-3 border-t border-indigo-200 pt-3">
          {['PENDING', 'PREPARING', 'READY_FOR_PICKUP', 'PARTIALLY_FULFILLED'].includes(consumableFulfillment.status) && <>
            <div className="flex flex-wrap gap-2"><select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} className="min-w-48 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs"><option value="">Chọn kho xuất</option>{warehouseOptions.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select><button disabled={busy || !warehouseId || (consumableFulfillment.requiresAdminApproval && !consumableFulfillment.adminApproved)} onClick={() => runAction(() => axiosClient.post(`/api/consumable-fulfillments/${consumableFulfillment.id}/warehouse`, { warehouseLocationId: Number(warehouseId) }), 'Đã cập nhật kho xuất.')} className="rounded-xl border border-indigo-300 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 disabled:opacity-40">Đổi kho</button></div>
            <div className="flex flex-wrap gap-2"><button disabled={busy || (consumableFulfillment.requiresAdminApproval && !consumableFulfillment.adminApproved)} onClick={() => runAction(() => axiosClient.post(`/api/consumable-fulfillments/${consumableFulfillment.id}/fulfill`, { note: note || null }), 'Đã ghi nhận cấp phát vật tư.')} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Xác nhận đã cấp</button></div>
          </>}
          {(consumableFulfillment.fulfilledQuantity || 0) === 0 && <button disabled={busy || !note.trim()} onClick={() => runAction(() => axiosClient.post(`/api/consumable-fulfillments/${consumableFulfillment.id}/reject`, { note: note.trim() }), 'Đã từ chối phiếu cấp phát.')} className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Từ chối phiếu</button>}
        </div>}
      </section>}

    </div>
  )
}

export default InquiryDetail
