import {
  IconCheck as Check,
  IconChevronDown as ChevronDown,
  IconSearch as Search,
} from '@tabler/icons-react'
import { createPortal } from 'react-dom'
import { useEffect, useId, useMemo, useRef, useState } from 'react'

function defaultGetOptionValue(option) {
  return option?.value ?? option?.id ?? ''
}

function defaultGetOptionLabel(option) {
  return option?.label ?? option?.name ?? ''
}

function defaultGetOptionDescription(option) {
  return option?.description ?? ''
}

function defaultRenderOption(option) {
  return (
    <div>
      <p className="font-medium text-slate-700 dark:text-slate-100">{option.label}</p>
      {option.description ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">{option.description}</p>
      ) : null}
    </div>
  )
}

export default function SearchableSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Gõ để tìm...',
  emptyOptionLabel,
  emptyOptionValue = '',
  emptyText = 'Không có kết quả phù hợp.',
  disabled = false,
  inputClassName = '',
  dropdownClassName = '',
  getOptionValue = defaultGetOptionValue,
  getOptionLabel = defaultGetOptionLabel,
  getOptionDescription = defaultGetOptionDescription,
  getOptionSearchText,
  renderOption = defaultRenderOption,
  dropdownZIndex = 140,
}) {
  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)
  const listboxId = useId()
  const normalizedValue = value == null ? '' : String(value)
  const emptyValueString = String(emptyOptionValue)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [dropdownStyle, setDropdownStyle] = useState(null)

  const preparedOptions = useMemo(() => {
    const builtOptions = options.map((option, index) => {
      const optionValue = getOptionValue(option)
      const optionLabel = String(getOptionLabel(option) || '')
      const optionDescription = String(getOptionDescription(option) || '')
      const searchText = String(
        getOptionSearchText ? getOptionSearchText(option) : [optionLabel, optionDescription].filter(Boolean).join(' '),
      ).toLowerCase()

      return {
        key: `${String(optionValue)}-${index}`,
        value: optionValue,
        valueString: String(optionValue),
        label: optionLabel,
        description: optionDescription,
        searchText,
        original: option,
      }
    })

    if (emptyOptionLabel !== undefined) {
      builtOptions.unshift({
        key: '__empty__',
        value: emptyOptionValue,
        valueString: String(emptyOptionValue),
        label: emptyOptionLabel,
        description: '',
        searchText: String(emptyOptionLabel).toLowerCase(),
        original: null,
      })
    }

    return builtOptions
  }, [emptyOptionLabel, emptyOptionValue, getOptionDescription, getOptionLabel, getOptionSearchText, getOptionValue, options])

  const selectedOption = useMemo(
    () => preparedOptions.find((option) => option.valueString === normalizedValue) || null,
    [normalizedValue, preparedOptions],
  )
  const isEmptyOptionSelected = selectedOption?.valueString === emptyValueString

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return preparedOptions
    return preparedOptions.filter((option) => option.searchText.includes(normalizedQuery))
  }, [preparedOptions, query])

  useEffect(() => {
    if (!open) {
      setQuery(isEmptyOptionSelected ? '' : (selectedOption?.label || ''))
    }
  }, [isEmptyOptionSelected, open, selectedOption])

  useEffect(() => {
    if (!open) return

    const selectedIndex = filteredOptions.findIndex((option) => option.valueString === normalizedValue)
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : (filteredOptions.length > 0 ? 0 : -1))
  }, [filteredOptions, normalizedValue, open])

  useEffect(() => {
    if (!open) return

    const updateDropdownPosition = () => {
      const inputElement = inputRef.current
      if (!inputElement) return

      const rect = inputElement.getBoundingClientRect()
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0
      const spaceBelow = Math.max(0, viewportHeight - rect.bottom - 12)
      const spaceAbove = Math.max(0, rect.top - 12)
      const shouldOpenUpward = spaceBelow < 220 && spaceAbove > spaceBelow
      const maxHeight = Math.max(160, Math.min(320, shouldOpenUpward ? spaceAbove : spaceBelow))

      setDropdownStyle({
        position: 'fixed',
        left: rect.left,
        width: rect.width,
        top: shouldOpenUpward ? undefined : rect.bottom + 4,
        bottom: shouldOpenUpward ? viewportHeight - rect.top + 4 : undefined,
        maxHeight,
        zIndex: dropdownZIndex,
      })
    }

    updateDropdownPosition()

    const handlePointerDownOutside = (event) => {
      const target = event.target
      const clickedInsideContainer = containerRef.current?.contains(target)
      const clickedInsideDropdown = dropdownRef.current?.contains(target)
      if (!clickedInsideContainer && !clickedInsideDropdown) {
        setOpen(false)
      }
    }

    window.addEventListener('resize', updateDropdownPosition)
    window.addEventListener('scroll', updateDropdownPosition, true)
    document.addEventListener('pointerdown', handlePointerDownOutside)
    return () => {
      window.removeEventListener('resize', updateDropdownPosition)
      window.removeEventListener('scroll', updateDropdownPosition, true)
      document.removeEventListener('pointerdown', handlePointerDownOutside)
    }
  }, [dropdownZIndex, open])

  const commitSelection = (option) => {
    onChange?.(option.value, option.original)
    setQuery(option.valueString === emptyValueString ? '' : option.label)
    setOpen(false)
  }

  const openDropdown = () => {
    if (disabled) return
    // Khi mở dropdown, luôn bỏ text hiện tại khỏi ô tìm kiếm để hiển thị toàn bộ danh sách.
    setQuery('')
    setOpen(true)
  }

  const handleKeyDown = (event) => {
    if (disabled) return

    if (!open && (event.key === 'ArrowDown' || event.key === 'Enter')) {
      event.preventDefault()
      openDropdown()
      return
    }

    if (!open) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlightedIndex((previous) => (
        filteredOptions.length === 0 ? -1 : Math.min(previous + 1, filteredOptions.length - 1)
      ))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightedIndex((previous) => (
        filteredOptions.length === 0 ? -1 : Math.max(previous - 1, 0)
      ))
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
        commitSelection(filteredOptions[highlightedIndex])
      }
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
    }
  }

  const dropdownContent = open && typeof document !== 'undefined' && dropdownStyle ? createPortal(
    <div
      ref={dropdownRef}
      id={listboxId}
      role="listbox"
      style={dropdownStyle}
      className={`overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900 ${dropdownClassName}`}
    >
      {filteredOptions.map((option, index) => {
        const isSelected = option.valueString === normalizedValue
        const isHighlighted = index === highlightedIndex

        return (
          <button
            key={option.key}
            type="button"
            role="option"
            aria-selected={isSelected}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => commitSelection(option)}
            className={`flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-sm ${
              isHighlighted
                ? 'bg-orange-50 dark:bg-orange-500/10'
                : 'hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <div className="min-w-0 flex-1">
              {renderOption(option, {
                isSelected,
                isHighlighted,
                original: option.original,
              })}
            </div>
            {isSelected ? <Check size={16} className="mt-0.5 shrink-0 text-fptOrange" /> : null}
          </button>
        )
      })}
      {filteredOptions.length === 0 && (
        <p className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">{emptyText}</p>
      )}
    </div>,
    document.body,
  ) : null

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onFocus={() => {
            openDropdown()
          }}
          onChange={(event) => {
            setQuery(event.target.value)
            if (!open) setOpen(true)
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={open ? listboxId : undefined}
          className={`w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-16 text-sm outline-none ring-fptOrange focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:disabled:bg-slate-900 ${inputClassName}`}
        />
        <span className="pointer-events-none absolute inset-y-0 right-10 flex items-center text-slate-400">
          <Search size={16} />
        </span>
        <button
          type="button"
          onClick={() => {
            if (disabled) return
            if (open) {
              setOpen(false)
              return
            }
            openDropdown()
          }}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 transition hover:text-slate-600 disabled:cursor-not-allowed dark:hover:text-slate-200"
          disabled={disabled}
          aria-label="Mở danh sách"
        >
          <ChevronDown size={16} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
        </button>
      </div>
      {dropdownContent}
    </div>
  )
}
