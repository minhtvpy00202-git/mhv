import { IconColumns3 as ColumnsIcon, IconSearch as SearchIcon } from '@tabler/icons-react'
import { useEffect, useMemo, useRef, useState } from 'react'

function ColumnVisibilityDropdown({
  columns,
  visibleColumns,
  selectedCount,
  allSelected,
  onToggleColumn,
  onSelectAll,
  onResetDefault,
  presets = [],
  onApplyPreset,
  className = '',
  buttonLabel = 'Chọn cột',
}) {
  const [open, setOpen] = useState(false)
  const [keyword, setKeyword] = useState('')
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handlePointerDownOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false)
      }
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDownOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handlePointerDownOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const filteredColumns = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()
    if (!normalizedKeyword) return columns
    return columns.filter((column) => column.label.toLowerCase().includes(normalizedKeyword))
  }, [columns, keyword])

  return (
    <div className={`relative ${className}`.trim()} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        <ColumnsIcon size={16} />
        {buttonLabel}
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
          {selectedCount}/{columns.length}
        </span>
      </button>
      {open && (
        <div className="absolute right-0 z-[120] mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-800">Cột hiển thị</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              Đóng
            </button>
          </div>
          <label className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
            <SearchIcon size={16} className="text-slate-400" />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Tìm cột"
              className="w-full border-0 bg-transparent text-sm outline-none"
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onSelectAll}
              className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Chọn tất cả
            </button>
            <button
              type="button"
              onClick={onResetDefault}
              className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Về mặc định
            </button>
          </div>
          {presets.length > 0 && typeof onApplyPreset === 'function' && (
            <div className="mt-3 flex flex-wrap gap-2">
              {presets.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => onApplyPreset(preset.keys)}
                  className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700 hover:bg-orange-100"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}
          <div className="mt-3 max-h-80 overflow-auto rounded-xl border border-slate-100 bg-slate-50/70 p-2">
            <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-white">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => {
                  if (allSelected) {
                    onResetDefault()
                    return
                  }
                  onSelectAll()
                }}
                className="h-4 w-4 rounded border-slate-300 text-fptOrange focus:ring-fptOrange"
              />
              <span className="text-sm font-medium text-slate-700">(Chọn tất cả)</span>
            </label>
            {filteredColumns.map((column) => (
              <label key={column.key} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-white">
                <input
                  type="checkbox"
                  checked={Boolean(visibleColumns[column.key])}
                  onChange={() => onToggleColumn(column.key)}
                  className="h-4 w-4 rounded border-slate-300 text-fptOrange focus:ring-fptOrange"
                />
                <span className="text-sm text-slate-700">{column.label}</span>
              </label>
            ))}
            {filteredColumns.length === 0 && (
              <p className="px-2 py-3 text-sm text-slate-500">Không tìm thấy cột phù hợp.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default ColumnVisibilityDropdown
