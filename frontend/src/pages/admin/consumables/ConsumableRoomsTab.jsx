import { useEffect, useMemo, useRef, useState } from 'react'
import {
  IconCheck as Check,
  IconChevronDown as ChevronDown,
  IconRefresh as RefreshCw,
  IconSearch as Search,
  IconSend as Send,
  IconX as X,
} from '@tabler/icons-react'
import ActionIconButton from '../../../components/ui/ActionIconButton'
import {
  formatConsumableQuantityText,
  formatConsumableRequestedInputText,
  formatCurrency,
  formatDate,
  formatDateTime,
  getConsumableUnitBreakdownTooltip,
  getConsumableExpiryState,
  getConsumableRequestStatusMeta,
  getStatusBadgeClass,
} from './consumableDisplayUtils'
import { ALL_ROOMS_ID } from './useLocationOverview'

const ALL_ROOMS_OPTION = { id: ALL_ROOMS_ID, roomName: 'Tất cả phòng' }

const ROOM_PANELS = {
  STOCKS: 'STOCKS',
  ISSUES: 'ISSUES',
  REQUESTS: 'REQUESTS',
}

const STOCK_STATUS_FILTERS = {
  ALL: 'ALL',
  LOW: 'LOW',
  EMPTY: 'EMPTY',
}

function getStockTone(stock) {
  const issued = Number(stock.quantityIssued ?? 0)
  const remaining = Number(stock.quantityRemaining ?? 0)
  if (remaining <= 0) return 'red'
  if (issued > 0 && remaining <= Math.max(1, Math.floor(issued * 0.2))) return 'amber'
  return 'emerald'
}

function matchesStockSearch(stock, keyword) {
  if (!keyword) return true
  const haystack = [
    stock.assetQaCode,
    stock.assetName,
    stock.categoryName,
  ].map((value) => String(value || '').toLowerCase()).join(' ')
  return haystack.includes(keyword)
}

function matchesStockStatusFilter(stock, filter) {
  if (filter === STOCK_STATUS_FILTERS.ALL) return true
  const tone = getStockTone(stock)
  if (filter === STOCK_STATUS_FILTERS.EMPTY) return tone === 'red'
  if (filter === STOCK_STATUS_FILTERS.LOW) return tone === 'amber'
  return true
}

export default function ConsumableRoomsTab({
  roomOptions,
  selectedRoomId,
  onRoomChange,
  roomOverview,
  roomOverviewLoading,
  isAdmin,
  canIssueFromWarehouse,
  onOpenIssueModalFromRoomStock,
  onOpenStockAdjustModal,
  onOpenConsumableDecisionModal,
}) {
  const [roomPanel, setRoomPanel] = useState(ROOM_PANELS.STOCKS)
  const [stockSearchKeyword, setStockSearchKeyword] = useState('')
  const [stockStatusFilter, setStockStatusFilter] = useState(STOCK_STATUS_FILTERS.ALL)
  const [roomAutocompleteOpen, setRoomAutocompleteOpen] = useState(false)
  const [roomInputText, setRoomInputText] = useState('')
  const [highlightedRoomIndex, setHighlightedRoomIndex] = useState(0)
  const roomAutocompleteRef = useRef(null)

  useEffect(() => {
    setRoomPanel(ROOM_PANELS.STOCKS)
    setStockSearchKeyword('')
    setStockStatusFilter(STOCK_STATUS_FILTERS.ALL)
  }, [selectedRoomId])

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!roomAutocompleteRef.current?.contains(event.target)) {
        setRoomAutocompleteOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  const roomSelectOptions = useMemo(() => {
    if (String(selectedRoomId) === ALL_ROOMS_ID) return roomOptions
    if (!selectedRoomId) return roomOptions
    if (roomOptions.some((location) => String(location.id) === String(selectedRoomId))) {
      return roomOptions
    }
    if (roomOverview?.locationName) {
      return [{ id: selectedRoomId, roomName: roomOverview.locationName }, ...roomOptions]
    }
    return roomOptions
  }, [roomOptions, selectedRoomId, roomOverview?.locationName])

  const isAllRoomsView = String(selectedRoomId) === ALL_ROOMS_ID

  const selectedRoomName = useMemo(() => {
    if (isAllRoomsView) return ALL_ROOMS_OPTION.roomName
    return (
      roomSelectOptions.find((location) => String(location.id) === String(selectedRoomId))?.roomName
      || roomOverview?.locationName
      || ''
    )
  }, [isAllRoomsView, roomSelectOptions, selectedRoomId, roomOverview?.locationName])

  const roomAutocompleteOptions = useMemo(() => {
    const term = roomInputText.trim().toLowerCase()
    const matchedRooms = !term
      ? roomSelectOptions
      : roomSelectOptions.filter((location) => (
        String(location.roomName || '').toLowerCase().includes(term)
      ))
    const showAllRoomsOption = !term || ALL_ROOMS_OPTION.roomName.toLowerCase().includes(term)
    return showAllRoomsOption ? [ALL_ROOMS_OPTION, ...matchedRooms] : matchedRooms
  }, [roomSelectOptions, roomInputText])

  useEffect(() => {
    if (!roomAutocompleteOpen) {
      setRoomInputText(selectedRoomName)
    }
  }, [selectedRoomName, roomAutocompleteOpen])

  useEffect(() => {
    setHighlightedRoomIndex(0)
  }, [roomInputText, roomAutocompleteOpen])

  const handleRoomPick = (location) => {
    onRoomChange(String(location.id))
    setRoomInputText(location.roomName)
    setRoomAutocompleteOpen(false)
  }

  const handleRoomInputFocus = () => {
    setRoomAutocompleteOpen(true)
    setRoomInputText('')
  }

  const handleRoomInputChange = (value) => {
    setRoomInputText(value)
    setRoomAutocompleteOpen(true)
  }

  const handleRoomInputKeyDown = (event) => {
    if (!roomAutocompleteOpen && (event.key === 'ArrowDown' || event.key === 'Enter')) {
      setRoomAutocompleteOpen(true)
      return
    }
    if (event.key === 'Escape') {
      setRoomAutocompleteOpen(false)
      setRoomInputText(selectedRoomName)
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlightedRoomIndex((index) => (
        roomAutocompleteOptions.length === 0
          ? 0
          : Math.min(index + 1, roomAutocompleteOptions.length - 1)
      ))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightedRoomIndex((index) => Math.max(index - 1, 0))
      return
    }
    if (event.key === 'Enter' && roomAutocompleteOpen) {
      event.preventDefault()
      const option = roomAutocompleteOptions[highlightedRoomIndex]
      if (option) handleRoomPick(option)
    }
  }

  const issueHistory = roomOverview?.issueHistory || []
  const requestHistory = roomOverview?.requestHistory || []
  const stocks = roomOverview?.stocks || []

  const stockSearchTerm = stockSearchKeyword.trim().toLowerCase()
  const hasActiveStockFilters = Boolean(stockSearchTerm) || stockStatusFilter !== STOCK_STATUS_FILTERS.ALL

  const stockStatusCounts = useMemo(() => (
    stocks.reduce((counts, stock) => {
      const tone = getStockTone(stock)
      if (tone === 'red') counts.empty += 1
      if (tone === 'amber') counts.low += 1
      return counts
    }, { low: 0, empty: 0 })
  ), [stocks])

  const filteredStocks = useMemo(() => (
    stocks.filter((stock) => (
      matchesStockSearch(stock, stockSearchTerm)
      && matchesStockStatusFilter(stock, stockStatusFilter)
    ))
  ), [stocks, stockSearchTerm, stockStatusFilter])

  const stockFilterOptions = useMemo(() => [
    { key: STOCK_STATUS_FILTERS.ALL, label: 'Tất cả' },
    { key: STOCK_STATUS_FILTERS.LOW, label: 'Sắp hết', count: stockStatusCounts.low },
    { key: STOCK_STATUS_FILTERS.EMPTY, label: 'Hết hàng', count: stockStatusCounts.empty },
  ], [stockStatusCounts.empty, stockStatusCounts.low])

  const pendingRequestCount = useMemo(
    () => requestHistory.filter((item) => String(item.status || '').toUpperCase() === 'PENDING').length,
    [requestHistory],
  )

  const panelMeta = useMemo(() => {
    if (!selectedRoomId || roomOverviewLoading) return null
    if (roomPanel === ROOM_PANELS.ISSUES) {
      return isAllRoomsView
        ? `${issueHistory.length} lần cấp · ${roomOverview?.roomCount || 0} phòng`
        : `${issueHistory.length} lần cấp`
    }
    if (roomPanel === ROOM_PANELS.REQUESTS) {
      if (pendingRequestCount > 0) {
        return isAllRoomsView
          ? `${requestHistory.length} phiếu • ${pendingRequestCount} chờ duyệt · ${roomOverview?.roomCount || 0} phòng`
          : `${requestHistory.length} phiếu • ${pendingRequestCount} chờ duyệt`
      }
      return isAllRoomsView
        ? `${requestHistory.length} phiếu · ${roomOverview?.roomCount || 0} phòng`
        : `${requestHistory.length} phiếu`
    }
    if (hasActiveStockFilters) {
      return isAllRoomsView
        ? `Hiển thị ${filteredStocks.length} / ${stocks.length} vật tư · ${roomOverview?.roomCount || 0} phòng`
        : `Hiển thị ${filteredStocks.length} / ${stocks.length} vật tư`
    }
    return isAllRoomsView
      ? `Tổng: ${stocks.length} vật tư · ${roomOverview?.roomCount || 0} phòng`
      : `Tổng: ${stocks.length} vật tư`
  }, [
    selectedRoomId,
    roomOverviewLoading,
    roomPanel,
    issueHistory.length,
    requestHistory.length,
    pendingRequestCount,
    stocks.length,
    filteredStocks.length,
    hasActiveStockFilters,
    isAllRoomsView,
    roomOverview?.roomCount,
  ])

  const roomPanelTabs = [
    { key: ROOM_PANELS.STOCKS, label: 'Tồn phòng' },
    { key: ROOM_PANELS.ISSUES, label: 'Lịch sử cấp' },
    {
      key: ROOM_PANELS.REQUESTS,
      label: 'Phiếu cấp phát',
      badge: pendingRequestCount > 0 ? pendingRequestCount : null,
    },
  ]

  const panelTableTitle = useMemo(() => {
    if (roomPanel === ROOM_PANELS.ISSUES) return 'Lịch sử cấp phát theo phòng'
    if (roomPanel === ROOM_PANELS.REQUESTS) return 'Phiếu cấp phát theo phòng'
    return 'Danh sách tồn vật tư theo phòng'
  }, [roomPanel])

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
        <div ref={roomAutocompleteRef} className="relative w-full min-w-[220px] max-w-[280px] shrink-0">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 z-[1] -translate-y-1/2 text-slate-400" size={14} />
          <input
            value={roomInputText}
            onChange={(e) => handleRoomInputChange(e.target.value)}
            onFocus={handleRoomInputFocus}
            onKeyDown={handleRoomInputKeyDown}
            role="combobox"
            aria-expanded={roomAutocompleteOpen}
            aria-autocomplete="list"
            aria-controls="room-autocomplete-list"
            className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-8 text-sm outline-none ring-fptOrange focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            placeholder="Tìm hoặc chọn phòng..."
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => {
              if (roomAutocompleteOpen) {
                setRoomAutocompleteOpen(false)
                setRoomInputText(selectedRoomName)
              } else {
                handleRoomInputFocus()
              }
            }}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            aria-label={roomAutocompleteOpen ? 'Đóng danh sách phòng' : 'Mở danh sách phòng'}
          >
            <ChevronDown className={`transition ${roomAutocompleteOpen ? 'rotate-180' : ''}`} size={16} />
          </button>
          {roomAutocompleteOpen && (
            <ul
              id="room-autocomplete-list"
              role="listbox"
              className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-950"
            >
              {roomAutocompleteOptions.map((location, index) => {
                const active = String(location.id) === String(selectedRoomId)
                const highlighted = index === highlightedRoomIndex
                const isAllOption = String(location.id) === ALL_ROOMS_ID
                return (
                  <li key={location.id} role="option" aria-selected={active}>
                    <button
                      type="button"
                      onMouseEnter={() => setHighlightedRoomIndex(index)}
                      onClick={() => handleRoomPick(location)}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition ${
                        highlighted
                          ? 'bg-orange-50 text-fptOrangeDark dark:bg-orange-500/10 dark:text-orange-300'
                          : active
                            ? 'font-semibold text-fptOrangeDark dark:text-orange-300'
                            : isAllOption
                              ? 'font-medium text-slate-800 dark:text-slate-100'
                              : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-900'
                      }`}
                    >
                      <span className="min-w-0 break-words">{location.roomName}</span>
                      {active && <Check size={14} className="shrink-0" />}
                    </button>
                  </li>
                )
              })}
              {roomAutocompleteOptions.length === 0 && (
                <li className="px-3 py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                  Không có phòng phù hợp.
                </li>
              )}
            </ul>
          )}
        </div>

        {selectedRoomId && (
          <>
            <span className="hidden h-6 w-px shrink-0 bg-slate-200 dark:bg-slate-700 sm:block" aria-hidden />
            <div className="inline-flex shrink-0 rounded-lg border border-slate-300 p-0.5 dark:border-slate-700">
              {roomPanelTabs.map((tab) => {
                const active = roomPanel === tab.key
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setRoomPanel(tab.key)}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                      active
                        ? 'bg-orange-50 text-fptOrangeDark shadow-sm dark:bg-orange-500/10 dark:text-orange-300'
                        : 'text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-slate-100'
                    }`}
                  >
                    <span>{tab.label}</span>
                    {tab.badge != null && (
                      <span className="inline-flex min-w-4 items-center justify-center rounded-full bg-amber-100 px-1 py-0.5 text-[10px] text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                        {tab.badge}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {roomPanel === ROOM_PANELS.STOCKS && (
              <>
                <div className="relative w-full min-w-[160px] max-w-[200px] shrink-0">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input
                    value={stockSearchKeyword}
                    onChange={(e) => setStockSearchKeyword(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 py-1.5 pl-8 pr-2.5 text-sm outline-none ring-fptOrange focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    placeholder="Tìm vật tư..."
                  />
                </div>
                <div className="inline-flex shrink-0 rounded-lg border border-slate-300 p-0.5 dark:border-slate-700">
                  {stockFilterOptions.map((option) => {
                    const active = stockStatusFilter === option.key
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setStockStatusFilter(option.key)}
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold transition ${
                          active
                            ? 'bg-orange-50 text-fptOrangeDark shadow-sm dark:bg-orange-500/10 dark:text-orange-300'
                            : 'text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-slate-100'
                        }`}
                      >
                        <span>{option.label}</span>
                        {option.key !== STOCK_STATUS_FILTERS.ALL && option.count > 0 && (
                          <span className={`rounded-full px-1 py-0.5 text-[10px] ${
                            option.key === STOCK_STATUS_FILTERS.EMPTY
                              ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                          }`}>
                            {option.count}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </>
            )}

          </>
        )}

          </div>

        {!selectedRoomId && (
          <p className="mt-3 rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Chọn phòng để xem vật tư đã cấp tại phòng.
          </p>
        )}
      </div>

      {selectedRoomId && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">{panelTableTitle}</h2>
            {panelMeta && !roomOverviewLoading && (
              <p className="text-xs font-medium tabular-nums text-slate-400 dark:text-slate-500">{panelMeta}</p>
            )}
          </div>
          <div className="rounded-lg border border-slate-100 dark:border-slate-800">
          {roomPanel === ROOM_PANELS.STOCKS && (
            <table className="w-full table-fixed divide-y divide-slate-200 text-xs dark:divide-slate-800">
              <colgroup>
                {isAllRoomsView ? (
                  <>
                    <col className="w-[68px]" />
                    <col className="w-[10%]" />
                    <col className="w-[21%]" />
                    <col className="w-[10%]" />
                    <col className="w-[10%]" />
                    <col className="w-[52px]" />
                    <col className="w-[52px]" />
                    <col className="w-[72px]" />
                    <col className="w-[10%]" />
                    <col className="w-[152px]" />
                  </>
                ) : (
                  <>
                    <col className="w-[72px]" />
                    <col className="w-[26%]" />
                    <col className="w-[11%]" />
                    <col className="w-[11%]" />
                    <col className="w-[52px]" />
                    <col className="w-[52px]" />
                    <col className="w-[72px]" />
                    <col className="w-[11%]" />
                    <col className="w-[152px]" />
                  </>
                )}
              </colgroup>
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="px-2 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Mã</th>
                  {isAllRoomsView && (
                    <th className="px-2 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Phòng</th>
                  )}
                  <th className="px-2 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Tên vật tư</th>
                  <th className="px-2 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Loại</th>
                  <th className="px-2 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Tồn tại phòng</th>
                  <th className="px-1.5 py-2 text-right font-semibold text-slate-600 dark:text-slate-400">Đã cấp</th>
                  <th className="px-1.5 py-2 text-right font-semibold text-slate-600 dark:text-slate-400">Đã dùng</th>
                  <th className="px-1.5 py-2 text-center font-semibold text-slate-600 dark:text-slate-400">HSD</th>
                  <th className="px-2 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Cấp gần nhất</th>
                  <th className="px-1 py-2 text-right font-semibold text-slate-600 dark:text-slate-400">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {roomOverviewLoading && Array.from({ length: 3 }).map((_, index) => (
                  <tr key={`room-stock-skeleton-${index}`} className="animate-pulse">
                    {Array.from({ length: isAllRoomsView ? 10 : 9 }).map((__, cellIndex) => (
                      <td key={`room-stock-cell-${cellIndex}`} className="px-2 py-2">
                        <div className="h-3.5 w-16 rounded bg-slate-200 dark:bg-slate-700" />
                      </td>
                    ))}
                  </tr>
                ))}
                {!roomOverviewLoading && filteredStocks.map((stock) => {
                  const expiryState = getConsumableExpiryState(stock)
                  return (
                    <tr key={`${stock.assetQaCode}-${stock.locationId}`} className="bg-white hover:bg-orange-50/30 dark:bg-slate-950 dark:hover:bg-slate-900/60">
                      <td className="truncate px-2 py-1.5 font-semibold text-slate-600 dark:text-slate-300" title={stock.assetQaCode}>{stock.assetQaCode}</td>
                      {isAllRoomsView && (
                        <td className="truncate px-2 py-1.5 text-slate-600 dark:text-slate-300" title={stock.locationName}>
                          {stock.locationName || '–'}
                        </td>
                      )}
                      <td className="truncate px-2 py-1.5 font-medium text-slate-800 dark:text-slate-100" title={stock.assetName}>
                        {stock.assetName}
                      </td>
                      <td className="truncate px-2 py-1.5 text-slate-600 dark:text-slate-300" title={stock.categoryName}>
                        {stock.categoryName || '–'}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-slate-800 dark:text-slate-100">
                        <span title={getConsumableUnitBreakdownTooltip(stock)}>
                          {formatConsumableQuantityText(stock, { quantityField: 'quantityRemaining', formattedField: 'formattedQuantityRemaining' })}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-1.5 py-1.5 text-right tabular-nums text-slate-600 dark:text-slate-300">
                        {formatConsumableQuantityText(stock, { quantityField: 'quantityIssued', formattedField: 'formattedQuantityIssued' })}
                      </td>
                      <td className="whitespace-nowrap px-1.5 py-1.5 text-right tabular-nums text-slate-600 dark:text-slate-300">
                        {formatConsumableQuantityText(stock, { quantityField: 'quantityConsumed', formattedField: 'formattedQuantityConsumed' })}
                      </td>
                      <td className="px-1.5 py-1.5 text-center">
                        {stock.expiryTrackingEnabled ? (
                          <span title={expiryState.label} className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums ${getStatusBadgeClass(expiryState.tone)}`}>
                            {expiryState.dateLabel === 'Chưa cập nhật' ? 'Chưa HSD' : expiryState.dateLabel}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">–</span>
                        )}
                      </td>
                      <td className="truncate px-2 py-1.5 text-slate-600 dark:text-slate-300" title={formatDateTime(stock.lastIssuedAt)}>
                        {stock.lastIssuedAt ? formatDate(stock.lastIssuedAt) : '–'}
                      </td>
                      <td className="px-1 py-1.5">
                        <div className="flex justify-end gap-0.5">
                          {canIssueFromWarehouse && (
                            <ActionIconButton
                              icon={Send}
                              label="Cấp phát"
                              variant="info"
                              className="h-7 w-7"
                              onClick={() => onOpenIssueModalFromRoomStock(stock)}
                            />
                          )}
                          <ActionIconButton icon={RefreshCw} label="Cập nhật tồn" variant="warning" className="h-7 w-7" onClick={() => onOpenStockAdjustModal(stock)} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {!roomOverviewLoading && stocks.length === 0 && (
                  <tr>
                    <td colSpan={isAllRoomsView ? 10 : 9} className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                      {isAllRoomsView ? 'Chưa có vật tư tiêu hao được cấp phát tại các phòng.' : 'Phòng này chưa có vật tư tiêu hao được cấp phát.'}
                    </td>
                  </tr>
                )}
                {!roomOverviewLoading && stocks.length > 0 && filteredStocks.length === 0 && (
                  <tr>
                    <td colSpan={isAllRoomsView ? 10 : 9} className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                      Không có vật tư khớp bộ lọc hiện tại.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {roomPanel === ROOM_PANELS.ISSUES && (
            <table className="w-full table-fixed divide-y divide-slate-200 text-xs dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Vật tư</th>
                  {isAllRoomsView && (
                    <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Phòng</th>
                  )}
                  <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Số lượng</th>
                  <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Đơn giá</th>
                  <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Thời gian</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Người cấp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {roomOverviewLoading && Array.from({ length: 3 }).map((_, index) => (
                  <tr key={`room-issue-skeleton-${index}`} className="animate-pulse">
                    {Array.from({ length: isAllRoomsView ? 6 : 5 }).map((__, cellIndex) => (
                      <td key={`room-issue-cell-${cellIndex}`} className="px-3 py-2">
                        <div className="h-3.5 w-16 rounded bg-slate-200 dark:bg-slate-700" />
                      </td>
                    ))}
                  </tr>
                ))}
                {!roomOverviewLoading && issueHistory.map((item) => (
                  <tr key={item.id} className="bg-white dark:bg-slate-950">
                    <td className="max-w-[280px] truncate px-3 py-1.5 font-medium text-slate-800 dark:text-slate-100" title={item.assetName}>{item.assetName}</td>
                    {isAllRoomsView && (
                      <td className="max-w-[180px] truncate px-3 py-1.5 text-slate-600 dark:text-slate-300" title={item.issuedToLocationName}>
                        {item.issuedToLocationName || '–'}
                      </td>
                    )}
                    <td className="whitespace-nowrap px-3 py-1.5 tabular-nums text-slate-700 dark:text-slate-200">
                      {formatConsumableQuantityText(item, { quantityField: 'quantity', formattedField: 'formattedQuantity' })}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-slate-700 dark:text-slate-200">{formatCurrency(item.unitPrice)}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-slate-600 dark:text-slate-300">{formatDateTime(item.issuedAt)}</td>
                    <td className="max-w-[180px] truncate px-3 py-1.5 text-slate-600 dark:text-slate-300">{item.issuedByFullName || item.issuedByUsername || '–'}</td>
                  </tr>
                ))}
                {!roomOverviewLoading && issueHistory.length === 0 && (
                  <tr>
                    <td colSpan={isAllRoomsView ? 6 : 5} className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                      {isAllRoomsView ? 'Chưa có lịch sử cấp phát tại các phòng.' : 'Chưa có lịch sử cấp phát cho phòng này.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {roomPanel === ROOM_PANELS.REQUESTS && (
            <table className="w-full table-fixed divide-y divide-slate-200 text-xs dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Vật tư</th>
                  {isAllRoomsView && (
                    <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Phòng</th>
                  )}
                  <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Số lượng</th>
                  <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Trạng thái</th>
                  <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Thời gian</th>
                  <th className="whitespace-nowrap px-2 py-2 text-right font-semibold text-slate-600 dark:text-slate-400">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {roomOverviewLoading && Array.from({ length: 3 }).map((_, index) => (
                  <tr key={`room-request-skeleton-${index}`} className="animate-pulse">
                    {Array.from({ length: isAllRoomsView ? 6 : 5 }).map((__, cellIndex) => (
                      <td key={`room-request-cell-${cellIndex}`} className="px-3 py-2">
                        <div className="h-3.5 w-16 rounded bg-slate-200 dark:bg-slate-700" />
                      </td>
                    ))}
                  </tr>
                ))}
                {!roomOverviewLoading && requestHistory.map((item) => (
                  <tr key={item.id} className="bg-white hover:bg-orange-50/30 dark:bg-slate-950 dark:hover:bg-slate-900/60">
                    <td className="max-w-[280px] truncate px-3 py-1.5 font-medium text-slate-800 dark:text-slate-100" title={item.assetName}>{item.assetName}</td>
                    {isAllRoomsView && (
                      <td className="max-w-[180px] truncate px-3 py-1.5 text-slate-600 dark:text-slate-300" title={item.locationName}>
                        {item.locationName || '–'}
                      </td>
                    )}
                    <td className="whitespace-nowrap px-3 py-1.5 tabular-nums text-slate-700 dark:text-slate-200">
                      <div>{formatConsumableRequestedInputText(item)}</div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500">
                        {formatConsumableQuantityText(item, { quantityField: 'quantityRequested', formattedField: 'formattedQuantityRequested' })}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${getConsumableRequestStatusMeta(item.status).className}`}>
                        {getConsumableRequestStatusMeta(item.status).label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-slate-600 dark:text-slate-300">{formatDateTime(item.createdAt)}</td>
                    <td className="whitespace-nowrap px-2 py-1.5">
                      {isAdmin && String(item.status || '').toUpperCase() === 'PENDING' ? (
                        <div className="flex justify-end gap-0.5">
                          <ActionIconButton icon={Check} label="Duyệt cấp phát" variant="success" className="h-7 w-7" onClick={() => onOpenConsumableDecisionModal(item, 'APPROVE')} />
                          <ActionIconButton icon={X} label="Từ chối phiếu" variant="danger" className="h-7 w-7" onClick={() => onOpenConsumableDecisionModal(item, 'REJECT')} />
                        </div>
                      ) : (
                        <span className="block text-right text-slate-400 dark:text-slate-500">–</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!roomOverviewLoading && requestHistory.length === 0 && (
                  <tr>
                    <td colSpan={isAllRoomsView ? 6 : 5} className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                        {isAllRoomsView ? 'Chưa có phiếu cấp phát tại các phòng.' : 'Chưa có phiếu cấp phát nào cho phòng này.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
          </div>
        </div>
      )}
    </div>
  )
}
