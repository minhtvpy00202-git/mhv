const RAW_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const IS_LOCAL_FRONTEND = ['localhost', '127.0.0.1'].includes(window.location.hostname)
const DEFAULT_BACKEND_BASE_URL = IS_LOCAL_FRONTEND
  ? 'http://localhost:8080'
  : `${window.location.origin}/api`

const BACKEND_BASE_URL = RAW_API_BASE_URL || DEFAULT_BACKEND_BASE_URL

export function resolveBackendMediaUrl(url) {
  if (!url) return ''
  if (
    url.startsWith('http://')
    || url.startsWith('https://')
    || url.startsWith('data:')
    || url.startsWith('blob:')
  ) {
    return url
  }

  if (url.startsWith('/api/')) {
    return `${window.location.origin}${url}`
  }

  if (url.startsWith('/')) {
    return `${BACKEND_BASE_URL}${url}`
  }

  return `${BACKEND_BASE_URL}/${url}`
}

