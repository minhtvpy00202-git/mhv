const RAW_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

export function getApiBaseUrl() {
  return RAW_API_BASE_URL
}

export function baseUrlHasApiSuffix(baseUrl = getApiBaseUrl()) {
  return /\/api$/i.test(String(baseUrl || '').replace(/\/$/, ''))
}

/** Gỡ /api/api/... lặp do base URL đã có /api mà path vẫn bắt đầu bằng /api/. */
export function collapseDuplicateApiPrefix(path) {
  if (typeof path !== 'string') return path
  let normalized = path
  while (/^\/api\/api(\/|$)/i.test(normalized)) {
    normalized = normalized.replace(/^\/api/i, '')
  }
  return normalized
}

/**
 * Chuẩn hoá path trước khi ghép với axios baseURL.
 * - Local (base http://localhost:8080): giữ /api/... → http://localhost:8080/api/...
 * - Deploy (base https://host/api): bỏ prefix /api → https://host/api/...
 */
export function normalizeRequestPath(url, baseUrl = getApiBaseUrl()) {
  if (typeof url !== 'string' || !url.startsWith('/')) return url
  const path = collapseDuplicateApiPrefix(url)
  if (baseUrlHasApiSuffix(baseUrl) && path.startsWith('/api/')) {
    return path.slice(4)
  }
  return path
}

/** Ghép base URL + path /api/... — dùng cho WebSocket, media, link tải file. */
export function joinApiPath(baseUrl, apiPath) {
  const base = String(baseUrl || '').replace(/\/$/, '')
  const rawPath = apiPath.startsWith('/') ? apiPath : `/${apiPath}`
  const path = collapseDuplicateApiPrefix(rawPath)
  if (baseUrlHasApiSuffix(base) && path.startsWith('/api/')) {
    return `${base}${path.slice(4)}`
  }
  return `${base}${path}`
}

export function resolveApiUrl(apiPath, baseUrl = getApiBaseUrl()) {
  const path = apiPath.startsWith('/') ? apiPath : `/${apiPath}`
  if (!baseUrl) {
    return path
  }
  return joinApiPath(baseUrl, path)
}
