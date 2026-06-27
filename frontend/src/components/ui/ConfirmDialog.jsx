import { useEffect } from 'react'
import { createPortal } from 'react-dom'

const toneClassMap = {
  danger: 'bg-red-600 hover:bg-red-700 focus:ring-red-200',
  warning: 'bg-amber-500 hover:bg-amber-600 focus:ring-amber-200',
  primary: 'bg-fptOrange hover:bg-fptOrangeDark focus:ring-orange-200',
}

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Xóa',
  cancelLabel = 'Hủy',
  tone = 'danger',
  busy = false,
  onConfirm,
  onClose,
}) {
  useEffect(() => {
    if (!open) return undefined

    const handleEscape = (event) => {
      if (event.key === 'Escape' && !busy) {
        onClose?.()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [busy, onClose, open])

  if (!open) return null

  const confirmToneClass = toneClassMap[tone] || toneClassMap.danger

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-slate-900/60 p-4"
      style={{ zIndex: 110 }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
          <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">{message}</p>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${confirmToneClass}`}
          >
            {busy ? 'Đang xử lý...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default ConfirmDialog
