import { useMemo, useState } from 'react'
import {
  IconCheck as Check,
  IconDownload as Download,
  IconFileDescription as Detail,
  IconSearch as Search,
  IconTrash as Trash2,
  IconX as X,
} from '@tabler/icons-react'
import ActionIconButton from '../../../components/ui/ActionIconButton'
import {
  formatConsumableQuantityText,
  formatDate,
  formatDateTime,
  getConsumableDisposalStatusMeta,
} from './consumableDisplayUtils'

const DISPOSAL_PANELS = {
  EXPIRED: 'EXPIRED',
  HISTORY: 'HISTORY',
}

export default function ConsumableDisposalTab({
  expiredLots,
  expiredLotsLoading,
  disposalRequestsLoading,
  filteredDisposalRequests,
  pagedDisposalRequests,
  disposalHistoryFilters,
  onDisposalHistoryFiltersChange,
  disposalHistoryPage,
  disposalHistoryTotalPages,
  disposalPageSize,
  onDisposalHistoryPageChange,
  pendingDisposalCount,
  isAdmin,
  downloadingDisposalRequestId,
  onOpenDisposalRequestModal,
  onOpenDisposalDecisionModal,
  onDownloadDisposalDocument,
  onSelectDisposalHistoryRequest,
}) {
  const [disposalPanel, setDisposalPanel] = useState(DISPOSAL_PANELS.EXPIRED)

  const panelTableTitle = useMemo(() => {
    if (disposalPanel === DISPOSAL_PANELS.HISTORY) return 'Lịch sử tiêu huỷ'
    return 'Lô hàng hết hạn cần tiêu huỷ'
  }, [disposalPanel])

  const panelMeta = useMemo(() => {
    if (disposalPanel === DISPOSAL_PANELS.HISTORY) {
      if (disposalRequestsLoading) return null
      if (pendingDisposalCount > 0) {
        return `${filteredDisposalRequests.length} phiếu • ${pendingDisposalCount} chờ duyệt`
      }
      return `${filteredDisposalRequests.length} phiếu`
    }
    if (expiredLotsLoading) return null
    return `${expiredLots.length} lô`
  }, [
    disposalPanel,
    disposalRequestsLoading,
    expiredLotsLoading,
    expiredLots.length,
    filteredDisposalRequests.length,
    pendingDisposalCount,
  ])

  const disposalPanelOptions = useMemo(() => [
    { key: DISPOSAL_PANELS.EXPIRED, label: 'Lô hết hạn', count: expiredLots.length },
    { key: DISPOSAL_PANELS.HISTORY, label: 'Lịch sử tiêu huỷ', count: pendingDisposalCount || undefined },
  ], [expiredLots.length, pendingDisposalCount])

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
          <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900">
            {disposalPanelOptions.map((option) => {
              const active = disposalPanel === option.key
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setDisposalPanel(option.key)}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                    active
                      ? 'bg-white text-fptOrangeDark shadow-sm dark:bg-slate-950 dark:text-orange-300'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {option.label}
                  {option.count > 0 && (
                    <span className={`inline-flex min-w-[1.1rem] justify-center rounded-full px-1.5 py-0.5 text-[10px] ${
                      active
                        ? 'bg-orange-100 text-fptOrangeDark dark:bg-orange-500/15 dark:text-orange-300'
                        : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                    >
                      {option.count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {disposalPanel === DISPOSAL_PANELS.HISTORY && (
            <>
              <div className="relative min-w-[180px] flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  value={disposalHistoryFilters.keyword}
                  onChange={(e) => onDisposalHistoryFiltersChange({ keyword: e.target.value, resetPage: true })}
                  className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-sm outline-none ring-fptOrange focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  placeholder="Tìm vật tư, mã, lô..."
                />
              </div>
              <select
                value={disposalHistoryFilters.status}
                onChange={(e) => onDisposalHistoryFiltersChange({ status: e.target.value, resetPage: true })}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none ring-fptOrange focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="PENDING">Chờ duyệt</option>
                <option value="APPROVED">Đã tiêu huỷ</option>
                <option value="REJECTED">Từ chối</option>
              </select>
            </>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">{panelTableTitle}</h2>
          {panelMeta && (
            <p className="text-xs font-medium tabular-nums text-slate-400 dark:text-slate-500">{panelMeta}</p>
          )}
        </div>

        <div className="rounded-lg border border-slate-100 dark:border-slate-800">
          {disposalPanel === DISPOSAL_PANELS.EXPIRED && (
            <table className="w-full table-fixed divide-y divide-slate-200 text-xs dark:divide-slate-800">
              <colgroup>
                <col className="w-[72px]" />
                <col className="w-[22%]" />
                <col className="w-[12%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
                <col className="w-[14%]" />
                <col className="w-[96px]" />
              </colgroup>
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="px-2 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Mã</th>
                  <th className="px-2 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Tên vật tư</th>
                  <th className="px-2 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Lô</th>
                  <th className="px-2 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Tồn còn</th>
                  <th className="px-2 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">HSD</th>
                  <th className="px-2 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Ngày nhập</th>
                  <th className="px-2 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Trạng thái</th>
                  <th className="px-1 py-2 text-right font-semibold text-slate-600 dark:text-slate-400">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {expiredLotsLoading && Array.from({ length: 3 }).map((_, index) => (
                  <tr key={`expired-lot-skeleton-${index}`} className="animate-pulse">
                    {Array.from({ length: 8 }).map((__, cellIndex) => (
                      <td key={`expired-lot-cell-${cellIndex}`} className="px-2 py-2">
                        <div className="h-3.5 w-16 rounded bg-slate-200 dark:bg-slate-700" />
                      </td>
                    ))}
                  </tr>
                ))}
                {!expiredLotsLoading && expiredLots.map((lot) => (
                  <tr key={lot.lotId} className="bg-white hover:bg-orange-50/30 dark:bg-slate-950 dark:hover:bg-slate-900/60">
                    <td className="truncate px-2 py-1.5 font-semibold text-slate-600 dark:text-slate-300" title={lot.assetQaCode}>
                      {lot.assetQaCode}
                    </td>
                    <td className="truncate px-2 py-1.5 font-medium text-slate-800 dark:text-slate-100" title={lot.assetName}>
                      {lot.assetName}
                    </td>
                    <td className="truncate px-2 py-1.5 text-slate-600 dark:text-slate-300">
                      {lot.lotCode || `Lô #${lot.lotId}`}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-slate-800 dark:text-slate-100">
                      {formatConsumableQuantityText(lot, { quantityField: 'quantityRemaining', formattedField: 'formattedQuantityRemaining' })}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-slate-600 dark:text-slate-300">
                      {formatDate(lot.expirationDate)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-slate-600 dark:text-slate-300">
                      {formatDate(lot.receivedDate)}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex flex-wrap gap-1">
                        <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-300">
                          Quá hạn {lot.daysExpired} ngày
                        </span>
                        {lot.pendingDisposal && (
                          <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                            Chờ duyệt
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-1 py-1.5">
                      <div className="flex justify-end">
                        <ActionIconButton
                          icon={Trash2}
                          label={lot.pendingDisposal ? 'Đang chờ duyệt tiêu huỷ' : 'Tạo yêu cầu tiêu huỷ'}
                          variant="danger"
                          className="h-7 w-7"
                          disabled={lot.pendingDisposal}
                          onClick={() => onOpenDisposalRequestModal(lot)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                {!expiredLotsLoading && expiredLots.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                      Hiện chưa có lô vật tư nào hết hạn cần tiêu huỷ.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {disposalPanel === DISPOSAL_PANELS.HISTORY && (
            <>
              <table className="w-full table-fixed divide-y divide-slate-200 text-xs dark:divide-slate-800">
                <colgroup>
                  <col className="w-[8%]" />
                  <col className="w-[20%]" />
                  <col className="w-[10%]" />
                  <col className="w-[10%]" />
                  <col className="w-[16%]" />
                  <col className="w-[10%]" />
                  <col className="w-[14%]" />
                  <col className="w-[120px]" />
                </colgroup>
                <thead className="bg-slate-50 dark:bg-slate-900">
                  <tr>
                    <th className="px-2 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Phiếu</th>
                    <th className="px-2 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Vật tư</th>
                    <th className="px-2 py-2 text-right font-semibold text-slate-600 dark:text-slate-400">Số lượng</th>
                    <th className="px-2 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Số lô</th>
                    <th className="px-2 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Người đề nghị</th>
                    <th className="px-2 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Trạng thái</th>
                    <th className="px-2 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Xử lý</th>
                    <th className="px-1 py-2 text-right font-semibold text-slate-600 dark:text-slate-400">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {disposalRequestsLoading && Array.from({ length: 3 }).map((_, index) => (
                    <tr key={`disposal-history-skeleton-${index}`} className="animate-pulse">
                      {Array.from({ length: 8 }).map((__, cellIndex) => (
                        <td key={`disposal-history-cell-${cellIndex}`} className="px-2 py-2">
                          <div className="h-3.5 w-16 rounded bg-slate-200 dark:bg-slate-700" />
                        </td>
                      ))}
                    </tr>
                  ))}
                  {!disposalRequestsLoading && pagedDisposalRequests.map((item) => {
                    const statusMeta = getConsumableDisposalStatusMeta(item.status)
                    return (
                      <tr key={item.id} className="bg-white hover:bg-orange-50/30 dark:bg-slate-950 dark:hover:bg-slate-900/60">
                        <td className="px-2 py-1.5 text-slate-700 dark:text-slate-200">
                          <div className="font-semibold">#{item.id}</div>
                          <div className="truncate text-[10px] text-slate-400 dark:text-slate-500">{item.assetQaCode}</div>
                        </td>
                        <td className="px-2 py-1.5 text-slate-700 dark:text-slate-200">
                          <div className="truncate font-medium">{item.assetName}</div>
                          <div className="mt-0.5 line-clamp-2 text-[10px] text-slate-400 dark:text-slate-500">{item.reason}</div>
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-slate-700 dark:text-slate-200">
                          {formatConsumableQuantityText(item, { quantityField: 'quantityRequested', formattedField: 'formattedQuantityRequested' })}
                        </td>
                        <td className="px-2 py-1.5 text-slate-700 dark:text-slate-200">
                          <div className="font-medium">{item.itemCount || item.items?.length || 1} lô</div>
                          <div className="mt-0.5 truncate text-[10px] text-slate-400 dark:text-slate-500">
                            {(item.items || []).slice(0, 2).map((lotItem) => lotItem.lotCode || `Lô #${lotItem.receiptLotId}`).join(', ') || (item.lotCode || `Lô #${item.receiptLotId}`)}
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-slate-700 dark:text-slate-200">
                          <div className="truncate font-medium">{item.requestedByFullName || item.requestedByUsername}</div>
                          <div className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">{formatDateTime(item.createdAt)}</div>
                        </td>
                        <td className="px-2 py-1.5">
                          <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusMeta.className}`}>
                            {statusMeta.label}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-slate-700 dark:text-slate-200">
                          {item.resolvedAt ? (
                            <>
                              <div className="truncate font-medium">{item.resolvedByFullName || item.resolvedByUsername}</div>
                              <div className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">{formatDateTime(item.resolvedAt)}</div>
                            </>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500">Đang chờ xử lý</span>
                          )}
                        </td>
                        <td className="px-1 py-1.5">
                          <div className="flex justify-end gap-0.5">
                            <ActionIconButton
                              icon={Detail}
                              label="Xem chi tiết phiếu tiêu huỷ"
                              variant="info"
                              className="h-7 w-7"
                              onClick={() => onSelectDisposalHistoryRequest(item)}
                            />
                            {isAdmin && String(item.status || '').toUpperCase() === 'PENDING' && (
                              <>
                                <ActionIconButton
                                  icon={Check}
                                  label="Duyệt tiêu huỷ"
                                  variant="success"
                                  className="h-7 w-7"
                                  onClick={() => onOpenDisposalDecisionModal(item, 'APPROVE')}
                                />
                                <ActionIconButton
                                  icon={X}
                                  label="Từ chối yêu cầu tiêu huỷ"
                                  variant="danger"
                                  className="h-7 w-7"
                                  onClick={() => onOpenDisposalDecisionModal(item, 'REJECT')}
                                />
                              </>
                            )}
                            {String(item.status || '').toUpperCase() === 'APPROVED' && (
                              <ActionIconButton
                                icon={Download}
                                label="Tải biên bản tiêu huỷ"
                                variant="default"
                                className="h-7 w-7"
                                onClick={() => onDownloadDisposalDocument(item.id)}
                                disabled={downloadingDisposalRequestId === item.id}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {!disposalRequestsLoading && filteredDisposalRequests.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                        Không có phiếu tiêu huỷ nào khớp với bộ lọc hiện tại.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {!disposalRequestsLoading && filteredDisposalRequests.length > 0 && (
                <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 dark:border-slate-800">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Hiển thị {disposalHistoryPage * disposalPageSize + 1}–{Math.min((disposalHistoryPage + 1) * disposalPageSize, filteredDisposalRequests.length)} / {filteredDisposalRequests.length} phiếu
                  </p>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => onDisposalHistoryPageChange(0)} disabled={disposalHistoryPage === 0} className="rounded px-1.5 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800">«</button>
                    <button type="button" onClick={() => onDisposalHistoryPageChange(Math.max(0, disposalHistoryPage - 1))} disabled={disposalHistoryPage === 0} className="rounded px-1.5 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800">‹</button>
                    <span className="rounded bg-orange-50 px-2.5 py-1 text-xs font-semibold text-fptOrangeDark dark:bg-orange-500/10 dark:text-orange-300">
                      {disposalHistoryPage + 1} / {disposalHistoryTotalPages}
                    </span>
                    <button type="button" onClick={() => onDisposalHistoryPageChange(Math.min(disposalHistoryTotalPages - 1, disposalHistoryPage + 1))} disabled={disposalHistoryPage >= disposalHistoryTotalPages - 1} className="rounded px-1.5 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800">›</button>
                    <button type="button" onClick={() => onDisposalHistoryPageChange(disposalHistoryTotalPages - 1)} disabled={disposalHistoryPage >= disposalHistoryTotalPages - 1} className="rounded px-1.5 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800">»</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
