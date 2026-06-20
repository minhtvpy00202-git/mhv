import { getApiBaseUrl, joinApiPath } from '../api/apiPath'

const IS_LOCAL_FRONTEND = ['localhost', '127.0.0.1'].includes(window.location.hostname)
const DEFAULT_BACKEND_BASE_URL = IS_LOCAL_FRONTEND
  ? 'http://localhost:8080'
  : `${window.location.origin}/api`

const BACKEND_BASE_URL = getApiBaseUrl() || DEFAULT_BACKEND_BASE_URL

export function resolveBackendMediaUrl(url) {
  if (!url) return ''
  const normalizedUrl = String(url).trim().replaceAll('\\', '/')
  if (!normalizedUrl) return ''

  if (
    normalizedUrl.startsWith('http://')
    || normalizedUrl.startsWith('https://')
    || normalizedUrl.startsWith('data:')
    || normalizedUrl.startsWith('blob:')
  ) {
    return normalizedUrl
  }

  if (normalizedUrl.startsWith('/api/')) {
    return joinApiPath(BACKEND_BASE_URL, normalizedUrl)
  }

  if (normalizedUrl.startsWith('/uploads/')) {
    return joinApiPath(BACKEND_BASE_URL, normalizedUrl)
  }

  if (normalizedUrl.startsWith('uploads/')) {
    return joinApiPath(BACKEND_BASE_URL, `/${normalizedUrl}`)
  }

  const uploadsIndex = normalizedUrl.indexOf('/uploads/')
  if (uploadsIndex >= 0) {
    return joinApiPath(BACKEND_BASE_URL, normalizedUrl.substring(uploadsIndex))
  }

  if (normalizedUrl.startsWith('/')) {
    return joinApiPath(BACKEND_BASE_URL, normalizedUrl)
  }

  return joinApiPath(BACKEND_BASE_URL, `/${normalizedUrl}`)
}
