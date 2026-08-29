import { useState } from 'react'
import ModalOverlay from './ui/ModalOverlay'

function TicketReasonForm({ title, description, confirmLabel, tone, submitting, onClose, onSubmit }) {
  const [reason, setReason] = useState('')
  const [validationMessage, setValidationMessage] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()
    const normalizedReason = reason.trim()
    if (normalizedReason.length < 10) {
      setValidationMessage('Lý do phải có ít nhất 10 ký tự.')
      return
    }
    setValidationMessage('')
    onSubmit(normalizedReason)
  }

  const confirmClassName = tone === 'primary'
    ? 'bg-blue-600 hover:bg-blue-700'
    : 'bg-red-600 hover:bg-red-700'

  return (
    <ModalOverlay className="bg-slate-950/70 backdrop-blur-sm" zIndex={150}>
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl dark:bg-slate-950">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
        <label className="mt-4 block text-sm font-semibold text-slate-700 dark:text-slate-200">
          Lý do
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            maxLength={1000}
            placeholder="Nhập lý do cụ thể để lưu vào lịch sử ticket..."
            className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        {validationMessage && <p className="mt-2 text-sm font-medium text-red-600">{validationMessage}</p>}
        <div className="mt-5 flex gap-2">
          <button type="submit" disabled={submitting} className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 ${confirmClassName}`}>
            {submitting ? 'Đang xử lý...' : confirmLabel}
          </button>
          <button type="button" onClick={onClose} disabled={submitting} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200">
            Đóng
          </button>
        </div>
      </form>
    </ModalOverlay>
  )
}

function TicketReasonModal({ open, title, description, confirmLabel, tone = 'danger', submitting = false, onClose, onSubmit }) {
  if (!open) return null
  return (
    <TicketReasonForm
      key={title}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      tone={tone}
      submitting={submitting}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  )
}

export default TicketReasonModal
