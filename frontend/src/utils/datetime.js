const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh'
const SERVER_LOCAL_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?$/
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/

function normalizeServerDateTimeInput(value) {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed) return trimmed

  if (SERVER_LOCAL_DATETIME_REGEX.test(trimmed)) {
    return `${trimmed}Z`
  }

  return trimmed
}

export function parseServerDateTime(value) {
  if (!value) return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  const normalized = normalizeServerDateTimeInput(value)
  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

export function getServerDateTimeMs(value) {
  const parsed = parseServerDateTime(value)
  return parsed ? parsed.getTime() : Number.NaN
}

export function formatVietnamDateTime(value, fallback = '-') {
  const parsed = parseServerDateTime(value)
  if (!parsed) return fallback
  return parsed.toLocaleString('vi-VN', {
    hour12: false,
    timeZone: VIETNAM_TIME_ZONE,
  })
}

export function formatVietnamTime(value, fallback = '--:--') {
  const parsed = parseServerDateTime(value)
  if (!parsed) return fallback
  return parsed.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: VIETNAM_TIME_ZONE,
  })
}

export function formatVietnamDate(value, fallback = '-') {
  if (!value) return fallback
  const raw = String(value).trim()
  if (DATE_ONLY_REGEX.test(raw)) {
    const [year, month, day] = raw.split('-')
    return `${day}/${month}/${year}`
  }

  const parsed = parseServerDateTime(value)
  if (!parsed) return fallback
  return parsed.toLocaleDateString('vi-VN', {
    timeZone: VIETNAM_TIME_ZONE,
  })
}

