const DEFAULT_TIME_ZONE = 'UTC'
const SERVER_LOCAL_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?$/
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/

export function getUserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIME_ZONE
}

function normalizeServerDateTimeInput(value) {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed) return trimmed

  if (SERVER_LOCAL_DATETIME_REGEX.test(trimmed)) {
    // Backend stores and serializes LocalDateTime in UTC, so timezone-less values
    // from Spring must be interpreted as UTC before rendering in the user's zone.
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

function formatDateWithUserTimeZone(value, formatter, fallback) {
  const parsed = parseServerDateTime(value)
  if (!parsed) return fallback
  return formatter.format(parsed)
}

function buildFormatter(options = {}) {
  return new Intl.DateTimeFormat('vi-VN', {
    hour12: false,
    timeZone: getUserTimeZone(),
    ...options,
  })
}

export function formatVietnamDateTime(value, fallback = '-') {
  return formatDateWithUserTimeZone(value, buildFormatter({
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }), fallback)
}

export function formatVietnamDateTimeShort(value, fallback = '-') {
  return formatDateWithUserTimeZone(value, buildFormatter({
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }), fallback)
}

export function formatVietnamTime(value, fallback = '--:--') {
  return formatDateWithUserTimeZone(value, buildFormatter({
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }), fallback)
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
  return buildFormatter({
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(parsed)
}

export function toDateTimeLocalValue(value) {
  const parsed = parseServerDateTime(value)
  if (!parsed) return ''
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  const hours = String(parsed.getHours()).padStart(2, '0')
  const minutes = String(parsed.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export function getFutureDateTimeLocalValue(hoursAhead = 24) {
  return toDateTimeLocalValue(new Date(Date.now() + Math.max(1, hoursAhead) * 60 * 60 * 1000))
}

export function formatCurrentDateTime(value = new Date()) {
  return formatVietnamDateTime(value, '--/--/---- --:--:--')
}

export function getCurrentTimeZoneLabel(value = new Date()) {
  const offsetMinutes = -value.getTimezoneOffset()
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const absoluteOffset = Math.abs(offsetMinutes)
  const hours = String(Math.floor(absoluteOffset / 60)).padStart(2, '0')
  const minutes = absoluteOffset % 60
  if (minutes === 0) {
    return `UTC${sign}${Number.parseInt(hours, 10)}`
  }
  return `UTC${sign}${hours}:${String(minutes).padStart(2, '0')}`
}
