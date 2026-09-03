import { formatVietnamDate, formatVietnamDateTime } from '../../../utils/datetime'

export function formatCurrency(value) {
  if (value == null || value === '') return 'Chưa cập nhật'
  const numericValue = Number(value)
  if (Number.isNaN(numericValue)) return String(value)
  return `${numericValue.toLocaleString('vi-VN')} VND`
}

export function formatCurrencyCompact(value) {
  if (value == null || value === '') return null
  const numericValue = Number(value)
  if (Number.isNaN(numericValue)) return null
  return `${numericValue.toLocaleString('vi-VN')}₫`
}

export function formatDate(value) {
  return formatVietnamDate(value, 'Chưa cập nhật')
}

export function formatDateTime(value) {
  return formatVietnamDateTime(value, 'Chưa cập nhật')
}

export function getStatusBadgeClass(tone) {
  if (tone === 'slate') return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'
  if (tone === 'red') return 'bg-red-100 text-red-700 ring-1 ring-red-200'
  if (tone === 'amber') return 'bg-amber-100 text-amber-700 ring-1 ring-amber-200'
  return 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200'
}

function getFirstText(...values) {
  return values.map((value) => String(value || '').trim()).find(Boolean) || ''
}

export function getConsumableRetailUnit(item, fallback = 'đơn vị') {
  return getFirstText(item?.retailUnit, item?.unit, fallback)
}

export function formatConsumableQuantityText(item, options = {}) {
  const {
    quantityField = 'quantityOnHand',
    formattedField = 'formattedQuantityOnHand',
    fallback = null,
  } = options

  const formattedValue = getFirstText(item?.[formattedField])
  if (formattedValue) return formattedValue

  const quantity = Number(item?.[quantityField] ?? 0)
  if (Number.isNaN(quantity) || quantity < 0) {
    return fallback ?? `0 ${getConsumableRetailUnit(item)}`
  }

  const retailUnit = getConsumableRetailUnit(item)
  const wholesaleUnit = getFirstText(item?.wholesaleUnit, retailUnit)
  const factor = Number(item?.wholesaleToRetailFactor ?? 1)
  if (!Number.isInteger(factor) || factor <= 1) {
    return `${quantity} ${retailUnit}`
  }

  const wholesaleQuantity = Math.floor(quantity / factor)
  const retailQuantity = quantity % factor
  if (wholesaleQuantity > 0 && retailQuantity > 0) {
    return `${wholesaleQuantity} ${wholesaleUnit} + ${retailQuantity} ${retailUnit}`
  }
  if (wholesaleQuantity > 0) {
    return `${wholesaleQuantity} ${wholesaleUnit}`
  }
  return `${retailQuantity} ${retailUnit}`
}

export function formatConsumableRequestedInputText(item, fallback = null) {
  const formattedValue = getFirstText(item?.formattedRequestedInputQuantity)
  if (formattedValue) return formattedValue

  const quantity = Number(item?.quantityRequestedInput ?? item?.quantityRequested ?? 0)
  if (Number.isNaN(quantity) || quantity < 0) {
    return fallback ?? `0 ${getConsumableRetailUnit(item)}`
  }

  const normalizedUnit = getFirstText(item?.quantityRequestedUnit, 'RETAIL').toUpperCase()
  if (normalizedUnit === 'WHOLESALE') {
    return `${quantity} ${getFirstText(item?.wholesaleUnit, getConsumableRetailUnit(item))}`
  }
  return `${quantity} ${getConsumableRetailUnit(item)}`
}

export function getConsumableUnitBreakdownTooltip(item) {
  const retailUnit = getConsumableRetailUnit(item, '')
  const wholesaleUnit = getFirstText(item?.wholesaleUnit)
  const factor = Number(item?.wholesaleToRetailFactor ?? 1)
  if (!retailUnit || !wholesaleUnit || !Number.isInteger(factor) || factor <= 1) {
    return ''
  }
  return `1 ${wholesaleUnit} = ${factor} ${retailUnit}`
}

function parseDateOnly(value) {
  const raw = String(value || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  const [year, month, day] = raw.split('-').map(Number)
  const parsed = new Date(year, month - 1, day)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function getConsumableExpiryState(asset) {
  if (!asset?.expiryTrackingEnabled) {
    return {
      label: 'Không quản lý',
      tone: 'slate',
      dateLabel: 'Không áp dụng',
    }
  }
  if (!asset?.expirationDate) {
    return {
      label: 'Chưa cập nhật',
      tone: 'amber',
      dateLabel: 'Chưa cập nhật',
    }
  }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expirationDate = parseDateOnly(asset.expirationDate)
  if (!expirationDate) {
    return {
      label: 'Chưa cập nhật',
      tone: 'amber',
      dateLabel: 'Chưa cập nhật',
    }
  }
  const diffDays = Math.round((expirationDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
  if (diffDays < 0) {
    return {
      label: 'Đã hết hạn',
      tone: 'red',
      dateLabel: formatDate(asset.expirationDate),
    }
  }
  if (diffDays === 0) {
    return {
      label: 'Hết hạn hôm nay',
      tone: 'red',
      dateLabel: formatDate(asset.expirationDate),
    }
  }
  if (diffDays <= 30) {
    return {
      label: 'Sắp hết hạn',
      tone: 'amber',
      dateLabel: formatDate(asset.expirationDate),
    }
  }
  return {
    label: 'Còn hạn',
    tone: 'emerald',
    dateLabel: formatDate(asset.expirationDate),
  }
}

export function getConsumableRequestStatusMeta(status) {
  const normalizedStatus = String(status || 'PENDING').trim().toUpperCase()
  if (normalizedStatus === 'APPROVED') {
    return {
      label: 'Đã cấp phát',
      className: 'bg-emerald-100 text-emerald-700',
    }
  }
  if (normalizedStatus === 'REJECTED') {
    return {
      label: 'Từ chối',
      className: 'bg-red-100 text-red-700',
    }
  }
  return {
    label: 'Chờ duyệt',
    className: 'bg-amber-100 text-amber-700',
  }
}

export function getConsumableDisposalStatusMeta(status) {
  const normalizedStatus = String(status || 'PENDING').trim().toUpperCase()
  if (normalizedStatus === 'APPROVED') {
    return {
      label: 'Đã tiêu huỷ',
      className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    }
  }
  if (normalizedStatus === 'REJECTED') {
    return {
      label: 'Từ chối',
      className: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
    }
  }
  return {
    label: 'Chờ duyệt',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  }
}
