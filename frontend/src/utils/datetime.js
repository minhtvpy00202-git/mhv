const APP_TIME_ZONE = 'Asia/Ho_Chi_Minh'
const DEFAULT_TIME_ZONE = APP_TIME_ZONE
const SERVER_LOCAL_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?$/
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/
const LOCAL_DATETIME_VALUE_REGEX = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/
const VIETNAM_UTC_OFFSET_MINUTES = 7 * 60

export function getUserTimeZone() {
  return DEFAULT_TIME_ZONE
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
    timeZone: APP_TIME_ZONE,
    ...options,
  })
}

function formatPartsInVietnamTimeZone(value) {
  const parsed = parseServerDateTime(value)
  if (!parsed) return null
  const formatter = buildFormatter({
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = formatter.formatToParts(parsed)
  const values = Object.create(null)
  parts.forEach((part) => {
    if (part.type !== 'literal') {
      values[part.type] = part.value
    }
  })
  return values
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
  const values = formatPartsInVietnamTimeZone(value)
  if (!values) return ''
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`
}

export function toServerDateTimeValue(value) {
  if (!value) return ''
  const match = String(value).trim().match(LOCAL_DATETIME_VALUE_REGEX)
  if (!match) return ''
  const [, year, month, day, hour, minute, second = '00'] = match
  const utcTimestamp = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  ) - VIETNAM_UTC_OFFSET_MINUTES * 60 * 1000
  return new Date(utcTimestamp).toISOString().slice(0, 19)
}

export function getFutureDateTimeLocalValue(hoursAhead = 24) {
  return toDateTimeLocalValue(new Date(Date.now() + Math.max(1, hoursAhead) * 60 * 60 * 1000))
}

export function formatCurrentDateTime(value = new Date()) {
  return formatVietnamDateTime(value, '--/--/---- --:--:--')
}

export function getCurrentTimeZoneLabel(value = new Date()) {
  void value
  return 'UTC+7'
}
