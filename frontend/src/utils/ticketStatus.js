export function getTicketStatusMeta(status) {
  if (status === 'PENDING') {
    return {
      label: 'Mới báo hỏng',
      badgeClassName: 'border border-amber-200 bg-amber-50 text-amber-700',
    }
  }
  if (status === 'IN_PROGRESS') {
    return {
      label: 'Đang xử lý',
      badgeClassName: 'border border-blue-200 bg-blue-50 text-blue-700',
    }
  }
  if (status === 'AWAITING_CONFIRMATION') {
    return {
      label: 'Chờ xác nhận',
      badgeClassName: 'border border-violet-200 bg-violet-50 text-violet-700',
    }
  }
  if (status === 'WAITING_REPLACEMENT') {
    return {
      label: 'Chờ thay thế',
      badgeClassName: 'border border-orange-200 bg-orange-50 text-orange-700',
    }
  }
  if (status === 'RESOLVED') {
    return {
      label: 'Đã hoàn tất',
      badgeClassName: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
    }
  }
  if (status === 'CLOSED_UNRESOLVED') {
    return {
      label: 'Đóng - không thể sửa',
      badgeClassName: 'border border-rose-300 bg-rose-50 text-rose-700',
    }
  }
  if (status === 'CANCELLED') {
    return {
      label: 'Đã hủy',
      badgeClassName: 'border border-slate-300 bg-slate-100 text-slate-700',
    }
  }
  if (status === 'REJECTED') {
    return {
      label: 'Đã từ chối',
      badgeClassName: 'border border-red-200 bg-red-50 text-red-700',
    }
  }
  return {
    label: status || 'Không xác định',
    badgeClassName: 'border border-slate-200 bg-slate-50 text-slate-700',
  }
}

export const TICKET_CHAT_OPEN_STATUSES = ['PENDING', 'IN_PROGRESS', 'AWAITING_CONFIRMATION', 'WAITING_REPLACEMENT']
export const TICKET_TECH_WORK_STATUSES = ['IN_PROGRESS', 'WAITING_REPLACEMENT']
export const TICKET_TERMINAL_STATUSES = ['RESOLVED', 'CLOSED_UNRESOLVED', 'CANCELLED', 'REJECTED']
