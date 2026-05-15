export function isNarrowViewport() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia('(max-width: 768px)').matches
}

export function toTechSupportMobilePath(pathname = '') {
  const normalizedPath = String(pathname || '')
  if (normalizedPath.startsWith('/tech-mobile/')) {
    return normalizedPath
  }
  if (normalizedPath.startsWith('/tech/')) {
    return normalizedPath.replace('/tech/', '/tech-mobile/')
  }
  return '/tech-mobile/tickets'
}

export function toTechSupportDesktopPath(pathname = '') {
  const normalizedPath = String(pathname || '')
  if (normalizedPath.startsWith('/tech/')) {
    return normalizedPath
  }
  if (normalizedPath.startsWith('/tech-mobile/')) {
    return normalizedPath.replace('/tech-mobile/', '/tech/')
  }
  return '/tech/tickets'
}

function prefersTechSupportMobilePath() {
  if (typeof window === 'undefined') {
    return false
  }
  const currentPath = window.location?.pathname || ''
  return isNarrowViewport()
}

export function getTechSupportHomePath() {
  return prefersTechSupportMobilePath() ? '/tech-mobile/tickets' : '/tech/tickets'
}

export function getTechSupportTicketPath(ticketId) {
  return `${getTechSupportHomePath()}/${ticketId}`
}

export function isTechSupportMobilePath(pathname = '') {
  return String(pathname).startsWith('/tech-mobile/')
}
