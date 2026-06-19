import { useEffect, useMemo, useState } from 'react'

function buildVisibleColumnState(columns, selectedKeys) {
  return columns.reduce((acc, column) => {
    acc[column.key] = selectedKeys.includes(column.key)
    return acc
  }, {})
}

function getSafeDefaultKeys(columns, defaultVisibleKeys) {
  const availableKeys = columns.map((column) => column.key)
  const filtered = (defaultVisibleKeys || []).filter((key) => availableKeys.includes(key))
  return filtered.length > 0 ? filtered : availableKeys
}

export default function useColumnVisibility({
  storageKey,
  columns,
  defaultVisibleKeys,
}) {
  const safeDefaultKeys = useMemo(
    () => getSafeDefaultKeys(columns, defaultVisibleKeys),
    [columns, defaultVisibleKeys],
  )

  const [visibleColumns, setVisibleColumns] = useState(() => {
    if (typeof window === 'undefined') {
      return buildVisibleColumnState(columns, safeDefaultKeys)
    }

    try {
      const rawValue = window.localStorage.getItem(storageKey)
      if (!rawValue) {
        return buildVisibleColumnState(columns, safeDefaultKeys)
      }

      const parsed = JSON.parse(rawValue)
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return buildVisibleColumnState(columns, safeDefaultKeys)
      }

      const validKeys = parsed.filter((key) => columns.some((column) => column.key === key))
      return buildVisibleColumnState(columns, validKeys.length > 0 ? validKeys : safeDefaultKeys)
    } catch {
      return buildVisibleColumnState(columns, safeDefaultKeys)
    }
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const selectedKeys = columns
      .filter((column) => visibleColumns[column.key])
      .map((column) => column.key)
    window.localStorage.setItem(storageKey, JSON.stringify(selectedKeys))
  }, [columns, storageKey, visibleColumns])

  const activeColumns = useMemo(
    () => columns.filter((column) => visibleColumns[column.key]),
    [columns, visibleColumns],
  )

  const selectedCount = activeColumns.length
  const allSelected = selectedCount === columns.length

  const toggleColumn = (columnKey) => {
    setVisibleColumns((prev) => {
      const nextValue = !prev[columnKey]
      if (!nextValue && columns.filter((column) => prev[column.key]).length === 1) {
        return prev
      }
      return {
        ...prev,
        [columnKey]: nextValue,
      }
    })
  }

  const selectAllColumns = () => {
    setVisibleColumns(buildVisibleColumnState(columns, columns.map((column) => column.key)))
  }

  const resetDefaultColumns = () => {
    setVisibleColumns(buildVisibleColumnState(columns, safeDefaultKeys))
  }

  const applyColumnPreset = (columnKeys) => {
    const validKeys = (columnKeys || []).filter((key) => columns.some((column) => column.key === key))
    setVisibleColumns(buildVisibleColumnState(columns, validKeys.length > 0 ? validKeys : safeDefaultKeys))
  }

  return {
    visibleColumns,
    activeColumns,
    selectedCount,
    allSelected,
    toggleColumn,
    selectAllColumns,
    resetDefaultColumns,
    applyColumnPreset,
  }
}
