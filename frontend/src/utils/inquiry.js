export const INQUIRY_STATUS = {
  NEW: { label: 'Mới tạo', className: 'border-amber-200 bg-amber-50 text-amber-700' },
  CLAIMED: { label: 'Đã tiếp nhận', className: 'border-blue-200 bg-blue-50 text-blue-700' },
  IN_PROGRESS: { label: 'Đang trao đổi', className: 'border-sky-200 bg-sky-50 text-sky-700' },
  WAITING_EMPLOYEE: { label: 'Chờ nhân viên', className: 'border-violet-200 bg-violet-50 text-violet-700' },
  WAITING_APPROVAL: { label: 'Chờ phê duyệt', className: 'border-orange-200 bg-orange-50 text-orange-700' },
  CONVERTED: { label: 'Đã tạo phiếu', className: 'border-indigo-200 bg-indigo-50 text-indigo-700' },
  COMPLETED: { label: 'Hoàn tất', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  REJECTED: { label: 'Từ chối', className: 'border-red-200 bg-red-50 text-red-700' },
  CANCELLED: { label: 'Đã hủy', className: 'border-slate-300 bg-slate-100 text-slate-700' },
}

export const BORROW_STATUS = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  RESERVED: 'Đã giữ chỗ',
  CHECKED_OUT: 'Đã bàn giao',
  RETURNED: 'Đã trả',
  REJECTED: 'Từ chối',
  CANCELLED: 'Đã hủy',
  EXPIRED: 'Hết giữ chỗ',
}

export const CONSUMABLE_FULFILLMENT_STATUS = {
  PENDING: 'Chờ chuẩn bị',
  PREPARING: 'Đang chuẩn bị',
  READY_FOR_PICKUP: 'Sẵn sàng nhận',
  PARTIALLY_FULFILLED: 'Đã cấp một phần',
  FULFILLED: 'Đã cấp đủ',
  REJECTED: 'Đã từ chối',
  CANCELLED: 'Đã hủy',
}

export function getInquiryStatusMeta(status) {
  return INQUIRY_STATUS[status] || {
    label: status || 'Không xác định',
    className: 'border-slate-200 bg-slate-50 text-slate-700',
  }
}

export function getInquiryTypeLabel(type) {
  return type === 'CONSUMABLE_REQUEST' ? 'Cấp phát vật tư' : 'Mượn thiết bị'
}

export function getInquiryBasePath(role) {
  if (role === 'Admin') return '/admin/inquiries'
  if (role === 'ConsumableManager') return '/supply/inquiries'
  return '/mobile/inquiries'
}

export const TERMINAL_INQUIRY_STATUSES = ['COMPLETED', 'REJECTED', 'CANCELLED']

export function getInquirySlaMeta(inquiry) {
  if (!inquiry?.slaResponseDueAt) {
    return { label: 'Chưa có SLA', breached: false, completed: false }
  }
  const dueAt = new Date(inquiry.slaResponseDueAt).getTime()
  const firstResponseAt = inquiry.firstResponseAt ? new Date(inquiry.firstResponseAt).getTime() : null
  const observedAt = firstResponseAt || Date.now()
  const breached = observedAt > dueAt
  const minutes = Math.max(0, Math.ceil(Math.abs(dueAt - observedAt) / 60000))
  if (firstResponseAt) {
    return {
      label: breached ? `Phản hồi trễ ${minutes} phút` : `Phản hồi đúng SLA (${minutes} phút sớm)`,
      breached,
      completed: true,
    }
  }
  return {
    label: breached ? `Quá hạn phản hồi ${minutes} phút` : `Còn ${minutes} phút để phản hồi`,
    breached,
    completed: false,
  }
}
