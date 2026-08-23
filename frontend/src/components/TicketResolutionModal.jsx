import { useState } from 'react'
import ModalOverlay from './ui/ModalOverlay'

const outcomeOptions = [
  { value: 'REPAIRED', label: 'Đã sửa chữa thành công' },
  { value: 'NO_FAULT_FOUND', label: 'Không phát hiện lỗi' },
  { value: 'UNREPAIRABLE', label: 'Không thể sửa chữa' },
  { value: 'REPLACEMENT_REQUIRED', label: 'Cần thay thế thiết bị' },
]

function TicketResolutionForm({ ticketId, submitting, onClose, onSubmit }) {
  const [outcome, setOutcome] = useState('REPAIRED')
  const [note, setNote] = useState('')
  const [image, setImage] = useState(null)
  const [validationMessage, setValidationMessage] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()
    const normalizedNote = note.trim()
    if (normalizedNote.length < 10) {
      setValidationMessage('Ghi chú xử lý phải có ít nhất 10 ký tự.')
      return
    }
    setValidationMessage('')
    onSubmit({ outcome, note: normalizedNote, image })
  }

  return (
    <ModalOverlay className="bg-slate-950/70 backdrop-blur-sm" zIndex={150}>
      <form onSubmit={handleSubmit} className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl dark:bg-slate-950">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Biên bản hoàn tất ticket #{ticketId}
        </h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Kết quả này quyết định trạng thái kỹ thuật của thiết bị sau xử lý.
        </p>

        <div className="mt-5 space-y-4">
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
            Kết quả xử lý
            <select
              value={outcome}
              onChange={(event) => setOutcome(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900"
            >
              {outcomeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
            Ghi chú xử lý
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="Mô tả nguyên nhân, công việc đã thực hiện và kết quả kiểm tra..."
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900"
            />
            <span className="mt-1 block text-xs font-normal text-slate-500">{note.trim().length}/1000 ký tự, tối thiểu 10.</span>
          </label>

          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
            Ảnh sau xử lý (không bắt buộc)
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => setImage(event.target.files?.[0] || null)}
              className="mt-1.5 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 dark:border-slate-700 dark:bg-slate-900"
            />
          </label>

          {validationMessage && <p className="text-sm font-medium text-red-600">{validationMessage}</p>}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {submitting ? 'Đang hoàn tất...' : 'Xác nhận hoàn tất'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200"
          >
            Đóng
          </button>
        </div>
      </form>
    </ModalOverlay>
  )
}

function TicketResolutionModal({ open, ticketId, submitting = false, onClose, onSubmit }) {
  if (!open) return null
  return (
    <TicketResolutionForm
      key={ticketId}
      ticketId={ticketId}
      submitting={submitting}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  )
}

export default TicketResolutionModal
