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
  if (status === 'RESOLVED') {
    return {
      label: 'Đã hoàn tất',
      badgeClassName: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
    }
  }
  return {
    label: status || 'Không xác định',
    badgeClassName: 'border border-slate-200 bg-slate-50 text-slate-700',
  }
}
