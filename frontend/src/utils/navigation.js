export function isNarrowViewport() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia('(max-width: 768px)').matches
}

function prefersTechSupportMobilePath() {
  if (typeof window === 'undefined') {
    return false
  }
  const currentPath = window.location?.pathname || ''
  if (currentPath.startsWith('/tech-mobile/')) {
    return true
  }
  if (currentPath.startsWith('/tech/')) {
    return false
  }
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
