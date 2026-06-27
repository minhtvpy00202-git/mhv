import axios from 'axios'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const BASE_URL_HAS_API_SUFFIX = /\/api$/i.test(API_BASE_URL)
const ABSOLUTE_URL_PATTERN = /^[a-z][a-z\d+\-.]*:\/\//i
const API_PREFIX_PATTERN = /^\/?api(?=\/|$)/i

function normalizeRequestUrl(url) {
  if (typeof url !== 'string') return url

  const normalizedUrl = url.trim()
  if (!normalizedUrl || ABSOLUTE_URL_PATTERN.test(normalizedUrl)) {
    return normalizedUrl
  }

  const hasApiPrefix = API_PREFIX_PATTERN.test(normalizedUrl)

  if (BASE_URL_HAS_API_SUFFIX) {
    if (hasApiPrefix) {
      const strippedUrl = normalizedUrl.replace(API_PREFIX_PATTERN, '')
      return strippedUrl.startsWith('/') ? strippedUrl : `/${strippedUrl}`
    }
    return normalizedUrl.startsWith('/') ? normalizedUrl : `/${normalizedUrl}`
  }

  if (hasApiPrefix) {
    return normalizedUrl.startsWith('/') ? normalizedUrl : `/${normalizedUrl}`
  }

  return normalizedUrl.startsWith('/') ? `/api${normalizedUrl}` : `/api/${normalizedUrl}`
}

const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
})

axiosClient.interceptors.request.use(
  (config) => {
    config.url = normalizeRequestUrl(config.url)
    const token = localStorage.getItem('auth_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type']
    }
    return config
  },
  (error) => Promise.reject(error),
)

const getErrorMessageFromText = (text, fallbackMessage) => {
  if (!text) return fallbackMessage
  try {
    const parsed = JSON.parse(text)
    if (typeof parsed?.message === 'string' && parsed.message.trim()) return parsed.message.trim()
  } catch {
    if (text.trim()) return text.trim()
  }
  return fallbackMessage
}

axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const response = error?.response
    let normalizedMessage = 'Đã xảy ra lỗi trong quá trình xử lý.'
    if (response) {
      const { status, data } = response
      if (typeof data === 'string') {
        normalizedMessage = getErrorMessageFromText(data, normalizedMessage)
      } else if (data instanceof Blob) {
        const text = await data.text()
        normalizedMessage = getErrorMessageFromText(text, normalizedMessage)
      } else if (typeof data?.message === 'string' && data.message.trim()) {
        normalizedMessage = data.message.trim()
      } else if (typeof data?.error === 'string' && data.error.trim()) {
        normalizedMessage = data.error.trim()
      } else if (status === 401) {
        normalizedMessage = 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ.'
      } else if (status === 403) {
        normalizedMessage = 'Bạn không có quyền thực hiện thao tác này.'
      } else if (status >= 500) {
        normalizedMessage = 'Lỗi hệ thống nội bộ.'
      }
      response.data = {
        ...(typeof data === 'object' && data !== null && !(data instanceof Blob) ? data : {}),
        message: normalizedMessage,
        status,
      }
    } else if (error?.request) {
      normalizedMessage = 'Không thể kết nối đến máy chủ.'
    }
    error.normalizedMessage = normalizedMessage
    return Promise.reject(error)
  },
)

export default axiosClient
