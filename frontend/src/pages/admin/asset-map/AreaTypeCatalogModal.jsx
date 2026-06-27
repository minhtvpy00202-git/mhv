import { useMemo, useState } from 'react'
import { buildAreaGroupOptions } from './areaTypes'

function createDefaultForm() {
  return {
    label: '',
    areaGroupLabel: '',
    description: '',
  }
}

export default function AreaTypeCatalogModal({
  areaTypes,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}) {
  const [editingId, setEditingId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState(createDefaultForm)

  const editingItem = useMemo(
    () => (areaTypes || []).find((item) => Number(item.id) === Number(editingId)) || null,
    [areaTypes, editingId],
  )
  const areaGroupOptions = useMemo(() => buildAreaGroupOptions(areaTypes), [areaTypes])

  const resetForm = () => {
    setEditingId(null)
    setForm(createDefaultForm())
  }

  const handleEdit = (item) => {
    setEditingId(item.id)
    setForm({
      label: item.label || '',
      areaGroupLabel: item.areaGroupLabel || '',
      description: item.description || '',
    })
  }

  const handleSubmit = async () => {
    if (!form.label.trim()) return
    setSubmitting(true)
    try {
      if (editingId) {
        await onUpdate(editingId, form)
      } else {
        await onCreate(form)
      }
      resetForm()
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (item) => {
    if (submitting) return
    setSubmitting(true)
    try {
      await onDelete(item)
      if (Number(editingId) === Number(item.id)) {
        resetForm()
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/70 p-4">
      <div className="w-full max-w-5xl rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Quản lý loại khu vực</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Danh mục này dùng chung cho form tạo phòng, preview và bộ lọc trên sơ đồ.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Đóng
          </button>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_360px]">
          <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="grid grid-cols-[minmax(0,1.4fr)_100px_100px_110px_84px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
              <span>Loại khu vực</span>
              <span>Nhóm</span>
              <span>Đang dùng</span>
              <span>Loại</span>
              <span className="text-right">Tác vụ</span>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {(areaTypes || []).map((item) => (
                <div
                  key={item.id}
                  className={`grid grid-cols-[minmax(0,1.4fr)_100px_100px_110px_84px] gap-3 border-b border-slate-100 px-4 py-3 text-sm dark:border-slate-800 ${
                    Number(editingId) === Number(item.id) ? 'bg-orange-50/70 dark:bg-orange-950/10' : 'bg-white dark:bg-slate-900'
                  }`}
                >
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{item.label}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      `{item.typeKey}`{item.description ? ` · ${item.description}` : ''}
                    </p>
                  </div>
                  <div className="text-slate-600 dark:text-slate-300">{item.areaGroupLabel || 'Chưa phân nhóm'}</div>
                  <div className="text-slate-600 dark:text-slate-300">{item.usageCount || 0}</div>
                  <div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      item.builtIn
                        ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                        : 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-200'
                    }`}>
                      {item.builtIn ? 'Mặc định' : 'Tùy chỉnh'}
                    </span>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(item)}
                      className="text-xs font-semibold text-fptOrange hover:text-fptOrangeDark"
                    >
                      Sửa
                    </button>
                    {!item.builtIn && (
                      <button
                        type="button"
                        onClick={() => { void handleDelete(item) }}
                        disabled={submitting}
                        className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
                      >
                        Xóa
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {editingItem ? `Sửa loại: ${editingItem.label}` : 'Thêm loại mới'}
                </h4>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {editingItem
                    ? 'Có thể đổi tên hiển thị, nhóm khu vực và mô tả.'
                    : 'Tạo loại mới để dùng trong danh sách chọn khi thêm hoặc sửa phòng.'}
                </p>
              </div>
              {editingItem && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Tạo mới
                </button>
              )}
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Tên loại khu vực</label>
                <input
                  value={form.label}
                  onChange={(event) => setForm((previous) => ({ ...previous, label: event.target.value }))}
                  placeholder="Ví dụ: Sảnh, Khu chờ, Đường nội bộ"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Nhóm khu vực</label>
                <select
                  value={form.areaGroupLabel}
                  onChange={(event) => setForm((previous) => ({ ...previous, areaGroupLabel: event.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="">Chọn nhóm khu vực</option>
                  {areaGroupOptions.map((option) => (
                    <option key={option.key} value={option.label}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Mô tả</label>
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))}
                  placeholder="Mô tả ngắn để người dùng hiểu vai trò của loại khu vực này."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={resetForm}
                disabled={submitting}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Làm lại
              </button>
              <button
                type="button"
                onClick={() => { void handleSubmit() }}
                disabled={submitting || !form.label.trim() || !form.areaGroupLabel.trim()}
                className="rounded-lg bg-fptOrange px-4 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark disabled:opacity-50"
              >
                {submitting ? 'Đang lưu...' : (editingItem ? 'Lưu thay đổi' : 'Thêm loại')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
