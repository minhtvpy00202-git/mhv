import { useMemo, useState } from 'react'

function normalizeSortValue(value) {
  if (value == null) return ''
  if (typeof value === 'number') return Number.isNaN(value) ? '' : value
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'boolean') return value ? 1 : 0
  return String(value).toLowerCase()
}

function compareValues(aValue, bValue, direction) {
  if (aValue < bValue) return direction === 'asc' ? -1 : 1
  if (aValue > bValue) return direction === 'asc' ? 1 : -1
  return 0
}

export function useTableSort(items, options = {}) {
  const {
    initialKey = 'id',
    initialDirection = 'asc',
    getSortValue,
    onSortChange,
  } = options

  const [sortConfig, setSortConfig] = useState({
    key: initialKey,
    direction: initialDirection,
  })

  const sortedItems = useMemo(() => {
    const list = Array.isArray(items) ? [...items] : []
    list.sort((a, b) => {
      const aRawValue = getSortValue ? getSortValue(a, sortConfig.key) : a?.[sortConfig.key]
      const bRawValue = getSortValue ? getSortValue(b, sortConfig.key) : b?.[sortConfig.key]
      const aValue = normalizeSortValue(aRawValue)
      const bValue = normalizeSortValue(bRawValue)
      return compareValues(aValue, bValue, sortConfig.direction)
    })
    return list
  }, [getSortValue, items, sortConfig])

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
    onSortChange?.(key)
  }

  const getSortLabel = (key, label) => {
    if (sortConfig.key !== key) return label
    return `${label} ${sortConfig.direction === 'asc' ? '▲' : '▼'}`
  }

  return {
    sortConfig,
    setSortConfig,
    sortedItems,
    handleSort,
    getSortLabel,
  }
}
