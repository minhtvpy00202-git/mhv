import { useMemo, useState } from 'react'
import { IconAlertTriangle as AlertTriangle, IconArrowsTransferUp as Transfer, IconRefresh as RefreshCw, IconSearch as Search } from '@tabler/icons-react'
import SearchableSelect from '../../../components/ui/SearchableSelect'
import {
  formatConsumableQuantityText,
  formatCurrency,
  formatDate,
  formatDateTime,
  getConsumableUnitBreakdownTooltip,
  getStatusBadgeClass,
} from './consumableDisplayUtils'

function getWarehouseStockTone(stock) {
  if (stock?.outOfStock) return 'red'
  if (stock?.lowStock) return 'amber'
  return 'emerald'
}

export default function ConsumableWarehousesTab({
  warehouseOptions,
  selectedWarehouseId,
  onWarehouseChange,
  warehouseOverview,
  warehouseOverviewLoading,
  warehouseAlerts,
  onRefresh,
  onOpenTransferModal,
}) {
  const [searchKeyword, setSearchKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const stocks = warehouseOverview?.stocks || []
  const transferHistory = warehouseOverview?.transferHistory || []
  const alerts = warehouseAlerts || []
  const normalizedKeyword = searchKeyword.trim().toLowerCase()

  const filteredStocks = useMemo(() => (
    stocks.filter((stock) => {
      const matchesKeyword = !normalizedKeyword || [
        stock.assetQaCode,
        stock.assetName,
        stock.categoryName,
        stock.warehouseLocationName,
      ].some((value) => String(value || '').toLowerCase().includes(normalizedKeyword))
      if (!matchesKeyword) return false
      if (statusFilter === 'LOW') return Boolean(stock.lowStock)
      if (statusFilter === 'OUT') return Boolean(stock.outOfStock)
      return true
    })
  ), [normalizedKeyword, statusFilter, stocks])

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[240px] flex-1">
            <SearchableSelect
              value={selectedWarehouseId}
              onChange={(nextValue) => onWarehouseChange(String(nextValue || ''))}
              options={warehouseOptions}
              getOptionValue={(option) => option.id}
              getOptionLabel={(option) => option.roomName}
              getOptionDescription={(option) => option.floorName || option.areaTypeLabel || 'Kho lưu trữ'}
              placeholder="Gõ để lọc kho"
              emptyOptionLabel="Tất cả kho"
            />
          </div>
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none ring-fptOrange focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              placeholder="Tìm theo mã, tên vật tư, loại hoặc kho"
            />
          </div>
          <div className="inline-flex rounded-lg border border-slate-300 p-0.5 dark:border-slate-700">
            {[
              { key: 'ALL', label: 'Tất cả' },
              { key: 'LOW', label: 'Sắp hết' },
              { key: 'OUT', label: 'Hết sạch' },
            ].map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setStatusFilter(option.key)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                  statusFilter === option.key
                    ? 'bg-orange-50 text-fptOrangeDark dark:bg-orange-500/10 dark:text-orange-300'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCw size={15} />
            Làm mới
          </button>
          <button
            type="button"
            onClick={onOpenTransferModal}
            className="inline-flex items-center gap-2 rounded-lg bg-fptOrange px-3 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark"
          >
            <Transfer size={15} />
            Chuyển kho nội bộ
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Kho đang xem</p>
            <p className="mt-1 text-lg font-semibold text-slate-800 dark:text-slate-100">{warehouseOverview?.warehouseLocationName || 'Tất cả kho'}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Giá trị tồn</p>
            <p className="mt-1 text-lg font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(warehouseOverview?.totalInventoryValue)}</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/20 dark:bg-amber-500/10">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Sắp hết theo kho</p>
            <p className="mt-1 text-lg font-semibold text-amber-800 dark:text-amber-100">{warehouseOverview?.lowStockCount ?? 0}</p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-500/20 dark:bg-red-500/10">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">Hết sạch theo kho</p>
            <p className="mt-1 text-lg font-semibold text-red-800 dark:text-red-100">{warehouseOverview?.outOfStockCount ?? 0}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_420px]">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Báo cáo tồn theo từng kho</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Hiển thị {filteredStocks.length} / {stocks.length} dòng</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed divide-y divide-slate-200 text-xs dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Kho</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Vật tư</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-600 dark:text-slate-400">Tồn</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-600 dark:text-slate-400">Ngưỡng</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">HSD gần nhất</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-600 dark:text-slate-400">Giá trị tồn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {warehouseOverviewLoading && Array.from({ length: 4 }).map((_, index) => (
                  <tr key={`warehouse-stock-skeleton-${index}`} className="animate-pulse">
                    {Array.from({ length: 6 }).map((__, cellIndex) => (
                      <td key={`warehouse-stock-cell-${cellIndex}`} className="px-3 py-2">
                        <div className="h-3.5 w-16 rounded bg-slate-200 dark:bg-slate-700" />
                      </td>
                    ))}
                  </tr>
                ))}
                {!warehouseOverviewLoading && filteredStocks.map((stock) => {
                  const tone = getWarehouseStockTone(stock)
                  return (
                    <tr key={`${stock.warehouseLocationId}-${stock.assetQaCode}`} className="bg-white dark:bg-slate-950">
                      <td className="truncate px-3 py-2 text-slate-700 dark:text-slate-200" title={stock.warehouseLocationName}>
                        {stock.warehouseLocationName || '–'}
                      </td>
                      <td className="px-3 py-2">
                        <div className="truncate font-medium text-slate-800 dark:text-slate-100" title={stock.assetName}>{stock.assetName}</div>
                        <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">{stock.assetQaCode} • {stock.categoryName || 'Chưa phân loại'}</div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-800 dark:text-slate-100">
                        <span title={getConsumableUnitBreakdownTooltip(stock)} className={`inline-flex rounded-full px-2 py-0.5 font-semibold ${getStatusBadgeClass(tone)}`}>
                          {formatConsumableQuantityText(stock, { quantityField: 'quantityRemaining', formattedField: 'formattedQuantityRemaining' })}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">
                        {formatConsumableQuantityText(stock, { quantityField: 'minimumStock', formattedField: 'formattedMinimumStock' })}
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{formatDate(stock.nearestExpirationDate)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-200">{formatCurrency(stock.inventoryValue)}</td>
                    </tr>
                  )
                })}
                {!warehouseOverviewLoading && filteredStocks.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                      Không có dữ liệu tồn kho phù hợp với bộ lọc hiện tại.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <AlertTriangle size={16} className="text-amber-500" />
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Cảnh báo sắp hết theo kho</h3>
            </div>
            <div className="max-h-[340px] overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
                  Hiện chưa có cảnh báo tồn thấp theo kho.
                </div>
              ) : alerts.map((item) => (
                <div key={`alert-${item.warehouseLocationId}-${item.assetQaCode}`} className="border-b border-slate-100 px-4 py-3 last:border-b-0 dark:border-slate-800">
                  <p className="font-medium text-slate-800 dark:text-slate-100">{item.assetName}</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{item.warehouseLocationName} • {item.assetQaCode}</p>
                  <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                    Còn {formatConsumableQuantityText(item, { quantityField: 'quantityRemaining', formattedField: 'formattedQuantityRemaining' })} / ngưỡng {formatConsumableQuantityText(item, { quantityField: 'minimumStock', formattedField: 'formattedMinimumStock' })}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Lịch sử chuyển kho</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{transferHistory.length} bản ghi</p>
            </div>
            <div className="max-h-[360px] overflow-y-auto">
              {transferHistory.length === 0 ? (
                <div className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
                  Chưa có giao dịch chuyển kho nội bộ.
                </div>
              ) : transferHistory.map((item) => (
                <div key={item.id} className="border-b border-slate-100 px-4 py-3 last:border-b-0 dark:border-slate-800">
                  <p className="font-medium text-slate-800 dark:text-slate-100">{item.assetName}</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{item.assetQaCode} • {item.sourceWarehouseLocationName} -> {item.targetWarehouseLocationName}</p>
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                    {formatConsumableQuantityText(item, { quantityField: 'quantityTransferred', formattedField: 'formattedQuantityTransferred' })}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{item.transferredByFullName || item.transferredByUsername} • {formatDateTime(item.transferredAt)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
