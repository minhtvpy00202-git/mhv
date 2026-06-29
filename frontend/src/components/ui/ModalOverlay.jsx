import { useEffect } from 'react'
import { createPortal } from 'react-dom'

let scrollLockCount = 0

function lockBodyScroll() {
  scrollLockCount += 1
  if (scrollLockCount === 1) {
    document.body.dataset.modalScrollLock = document.body.style.overflow || ''
    document.body.style.overflow = 'hidden'
  }
}

function unlockBodyScroll() {
  scrollLockCount = Math.max(0, scrollLockCount - 1)
  if (scrollLockCount === 0) {
    document.body.style.overflow = document.body.dataset.modalScrollLock || ''
    delete document.body.dataset.modalScrollLock
  }
}

export default function ModalOverlay({
  children,
  className = 'bg-slate-900/60',
  zIndex = 100,
}) {
  useEffect(() => {
    lockBodyScroll()
    return unlockBodyScroll
  }, [])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className={`fixed inset-0 flex items-start justify-center overflow-y-auto p-4 sm:items-center sm:p-6 ${className}`}
      style={{ zIndex }}
    >
      {children}
    </div>,
    document.body,
  )
}
