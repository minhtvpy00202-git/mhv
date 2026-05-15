export function normalizePhone(phone) {
  return String(phone || '').replace(/[^\d+]/g, '').trim()
}

export function getZaloPhone(phone) {
  const normalized = normalizePhone(phone)
  if (!normalized) return ''

  if (normalized.startsWith('+84')) {
    return `0${normalized.slice(3)}`
  }
  if (normalized.startsWith('84')) {
    return `0${normalized.slice(2)}`
  }
  if (normalized.startsWith('0')) {
    return normalized
  }
  return ''
}

export function getZaloUrl(phone) {
  const zaloPhone = getZaloPhone(phone)
  return zaloPhone ? `https://zalo.me/${zaloPhone}` : ''
}

export async function copyText(value) {
  const text = String(value || '').trim()
  if (!text) {
    throw new Error('empty')
  }

  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}
