import { IconKey as Key, IconX as X } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'
import ModalOverlay from './ui/ModalOverlay'
import { validateChangePasswordForm } from '../utils/validation'

const INITIAL_FORM = {
  currentPassword: '',
  newPassword: '',
  confirmNewPassword: '',
}

function getFieldClass(hasError) {
  return `mt-1 h-11 w-full rounded-xl border bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 ${
    hasError
      ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100 dark:border-red-500/60 dark:focus:ring-red-500/20'
      : 'border-slate-300 focus:border-fptOrange focus:ring-2 focus:ring-orange-100 dark:border-slate-700 dark:focus:ring-orange-500/20'
  }`
}

export default function ChangePasswordModal({ open, onClose }) {
  const [form, setForm] = useState(INITIAL_FORM)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setForm(INITIAL_FORM)
      setErrors({})
      setSubmitting(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !submitting) {
        onClose?.()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose, submitting])

  if (!open) return null

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: '' }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const nextErrors = validateChangePasswordForm(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    try {
      const response = await axiosClient.put('/api/users/me/password', form)
      toast.success(response?.data?.message || 'Đổi mật khẩu thành công.')
      onClose?.()
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể đổi mật khẩu.'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalOverlay className="bg-slate-950/70 backdrop-blur-sm" zIndex={130}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
        className="w-full max-w-md overflow-hidden rounded-[28px] bg-white shadow-2xl dark:bg-slate-950"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-fptOrange dark:bg-orange-500/10 dark:text-orange-300">
                <Key size={18} />
              </div>
              <h3 id="change-password-title" className="mt-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
                Đổi mật khẩu
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Nhập mật khẩu hiện tại và đặt mật khẩu mới từ 8 ký tự trở lên, có chữ hoa, chữ thường và ký tự đặc biệt.
              </p>
            </div>
            <button
              type="button"
              onClick={() => !submitting && onClose?.()}
              aria-label="Đóng modal đổi mật khẩu"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Mật khẩu hiện tại</span>
            <input
              type="password"
              value={form.currentPassword}
              onChange={(event) => handleChange('currentPassword', event.target.value)}
              className={getFieldClass(Boolean(errors.currentPassword))}
              autoComplete="current-password"
              placeholder="Nhập mật khẩu hiện tại"
              disabled={submitting}
            />
            {errors.currentPassword && <p className="mt-1 text-xs text-red-600">{errors.currentPassword}</p>}
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Mật khẩu mới</span>
            <input
              type="password"
              value={form.newPassword}
              onChange={(event) => handleChange('newPassword', event.target.value)}
              className={getFieldClass(Boolean(errors.newPassword))}
              autoComplete="new-password"
              placeholder="Nhập mật khẩu mới"
              disabled={submitting}
            />
            {errors.newPassword && <p className="mt-1 text-xs text-red-600">{errors.newPassword}</p>}
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Xác nhận mật khẩu mới</span>
            <input
              type="password"
              value={form.confirmNewPassword}
              onChange={(event) => handleChange('confirmNewPassword', event.target.value)}
              className={getFieldClass(Boolean(errors.confirmNewPassword))}
              autoComplete="new-password"
              placeholder="Nhập lại mật khẩu mới"
              disabled={submitting}
            />
            {errors.confirmNewPassword && <p className="mt-1 text-xs text-red-600">{errors.confirmNewPassword}</p>}
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => !submitting && onClose?.()}
              className="inline-flex items-center rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              disabled={submitting}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="inline-flex items-center rounded-xl bg-fptOrange px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-fptOrangeDark disabled:cursor-not-allowed disabled:opacity-70"
              disabled={submitting}
            >
              {submitting ? 'Đang lưu...' : 'Cập nhật mật khẩu'}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  )
}
