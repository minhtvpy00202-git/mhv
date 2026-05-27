export function getSessionCache(key) {
  if (!key || typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    if (!parsed.expiresAt || parsed.expiresAt <= Date.now()) {
      window.sessionStorage.removeItem(key)
      return null
    }
    return parsed.value ?? null
  } catch {
    return null
  }
}

export function setSessionCache(key, value, ttlMs) {
  if (!key || typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(key, JSON.stringify({
      value,
      expiresAt: Date.now() + ttlMs,
    }))
  } catch {}
}
