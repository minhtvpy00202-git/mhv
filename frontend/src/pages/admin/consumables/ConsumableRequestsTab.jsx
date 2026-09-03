import { useMemo, useState } from 'react'
import {
  IconEye as Eye,
  IconSearch as Search,
  IconX as X,
} from '@tabler/icons-react'
import ActionIconButton from '../../../components/ui/ActionIconButton'
import { formatConsumableQuantityText, formatDateTime, getConsumableRequestStatusMeta } from './consumableDisplayUtils'

const REQUEST_PANELS = {
  ISSUE: 'ISSUE',
  DISPOSAL: 'DISPOSAL',
}

function matchesIssueRequest(item, keyword) {
  if (!keyword) return true
  const haystack = [
    item.assetName,
    item.assetQaCode,
    item.locationName,
    item.sourceWarehouseLocationName,
    item.reason,
    item.requestedByFullName,
    item.requestedByUsername,
    item.id,
  ].map((value) => String(value || '').toLowerCase()).join(' ')
  return haystack.includes(keyword)
}

function matchesDisposalRequest(item, keyword) {
  if (!keyword) return true
  const haystack = [
    item.assetName,
    item.assetQaCode,
    item.reason,
    item.requestedByFullName,
    item.requestedByUsername,
    item.lotCode,
    item.id,
    ...(item.items || []).flatMap((lotItem) => [lotItem.lotCode, lotItem.supplierName]),
  ].map((value) => String(value || '').toLowerCase()).join(' ')
  return haystack.includes(keyword)
}

export default function ConsumableRequestsTab({
  pendingConsumableRequests,
  pendingConsumableRequestsLoading,
  pendingDisposalRequests,
  pendingDisposalRequestsLoading,
  downloadingDisposalRequestId,
  onOpenConsumableDecisionModal,
  onOpenDisposalDecisionModal,
  readOnly = false,
}) {
  const [requestPanel, setRequestPanel] = useState(REQUEST_PANELS.ISSUE)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [selectedIssueRequest, setSelectedIssueRequest] = useState(null)

  const normalizedKeyword = searchKeyword.trim().toLowerCase()

  const filteredIssueRequests = useMemo(
    () => pendingConsumableRequests.filter((item) => matchesIssueRequest(item, normalizedKeyword)),
    [normalizedKeyword, pendingConsumableRequests],
  )

  const filteredDisposalRequests = useMemo(
    () => pendingDisposalRequests.filter((item) => matchesDisposalRequest(item, normalizedKeyword)),
    [normalizedKeyword, pendingDisposalRequests],
  )

  const requestPanelOptions = useMemo(() => [
    { key: REQUEST_PANELS.ISSUE, label: 'Cấp phát', count: pendingConsumableRequests.length || undefined },
    { key: REQUEST_PANELS.DISPOSAL, label: 'Tiêu huỷ', count: pendingDisposalRequests.length || undefined },
  ], [pendingConsumableRequests.length, pendingDisposalRequests.length])

  const panelTableTitle = useMemo(() => {
    if (requestPanel === REQUEST_PANELS.DISPOSAL) return 'Yêu cầu tiêu huỷ chờ duyệt'
    return readOnly ? 'Danh sách yêu cầu và phiếu cấp phát' : 'Phiếu cấp phát chờ duyệt'
  }, [readOnly, requestPanel])

  const panelMeta = useMemo(() => {
    if (requestPanel === REQUEST_PANELS.DISPOSAL) {
      if (pendingDisposalRequestsLoading) return null
      if (normalizedKeyword) {
        return `${filteredDisposalRequests.length} / ${pendingDisposalRequests.length} phiếu`
      }
      return `${pendingDisposalRequests.length} phiếu`
    }
    if (pendingConsumableRequestsLoading) return null
    if (normalizedKeyword) {
      return `${filteredIssueRequests.length} / ${pendingConsumableRequests.length} phiếu`
    }
    return `${pendingConsumableRequests.length} phiếu`
  }, [
    filteredDisposalRequests.length,
    filteredIssueRequests.length,
    normalizedKeyword,
    pendingConsumableRequests.length,
    pendingConsumableRequestsLoading,
    pendingDisposalRequests.length,
    pendingDisposalRequestsLoading,
    requestPanel,
  ])

  const isLoading = requestPanel === REQUEST_PANELS.DISPOSAL
    ? pendingDisposalRequestsLoading
    : pendingConsumableRequestsLoading

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
          <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900">
            {requestPanelOptions.map((option) => {
              const active = requestPanel === option.key
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setRequestPanel(option.key)}
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

          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-sm outline-none ring-fptOrange focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              placeholder={requestPanel === REQUEST_PANELS.DISPOSAL ? 'Tìm vật tư, mã, lô...' : 'Tìm vật tư, phòng, người yêu cầu...'}
            />
          </div>
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
          {requestPanel === REQUEST_PANELS.ISSUE && (
            <table className="w-full table-fixed divide-y divide-slate-200 text-xs dark:divide-slate-800">
              <colgroup>
                <col className="w-[8%]" />
                <col className="w-[22%]" />
                <col className="w-[14%]" />
                <col className="w-[10%]" />
                <col className="w-[16%]" />
                <col className="w-[14%]" />
                <col className="w-[11%]" />
                <col className="w-[96px]" />
              </colgroup>
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="px-2 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Phiếu</th>
                  <th className="px-2 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Vật tư</th>
                  <th className="px-2 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Phòng</th>
                  <th className="px-2 py-2 text-right font-semibold text-slate-600 dark:text-slate-400">Số lượng</th>
                  <th className="px-2 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Người yêu cầu</th>
                  <th className="px-2 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Thời gian</th>
                  <th className="px-2 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Trạng thái</th>
                  <th className="px-1 py-2 text-right font-semibold text-slate-600 dark:text-slate-400">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {isLoading && Array.from({ length: 3 }).map((_, index) => (
                  <tr key={`issue-request-skeleton-${index}`} className="animate-pulse">
                    {Array.from({ length: 8 }).map((__, cellIndex) => (
                      <td key={`issue-request-cell-${cellIndex}`} className="px-2 py-2">
                        <div className="h-3.5 w-16 rounded bg-slate-200 dark:bg-slate-700" />
                      </td>
                    ))}
                  </tr>
                ))}
                {!isLoading && filteredIssueRequests.map((item) => (
                  <tr key={item.id} className="bg-white hover:bg-orange-50/30 dark:bg-slate-950 dark:hover:bg-slate-900/60">
                    <td className="px-2 py-1.5 text-slate-700 dark:text-slate-200">
                      <div className="font-semibold">#{item.id}</div>
                      <div className="truncate text-[10px] text-slate-400 dark:text-slate-500">{item.assetQaCode}</div>
                    </td>
                    <td className="px-2 py-1.5 text-slate-700 dark:text-slate-200">
                      <div className="truncate font-medium">{item.assetName}</div>
                      <div className="mt-0.5 line-clamp-2 text-[10px] text-slate-400 dark:text-slate-500">{item.reason}</div>
                    </td>
                    <td className="truncate px-2 py-1.5 text-slate-600 dark:text-slate-300" title={item.locationName}>
                      <div className="truncate">{item.locationName}</div>
                      <div className="truncate text-[10px] text-slate-400 dark:text-slate-500">
                        Kho xuất: {item.sourceWarehouseLocationName || 'Chưa chọn'}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-slate-800 dark:text-slate-100">
                      {formatConsumableQuantityText(item, { quantityField: 'quantityRequested', formattedField: 'formattedQuantityRequested' })}
                    </td>
                    <td className="px-2 py-1.5 text-slate-700 dark:text-slate-200">
                      <div className="truncate font-medium">{item.requestedByFullName || item.requestedByUsername}</div>
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-slate-600 dark:text-slate-300">
                      {formatDateTime(item.createdAt)}
                    </td>
                    <td className="px-2 py-1.5">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${getConsumableRequestStatusMeta(item.status).className}`}>
                        {getConsumableRequestStatusMeta(item.status).label}
                      </span>
                    </td>
                    <td className="px-1 py-1.5">
                      <div className="flex justify-end gap-0.5">
                        {readOnly ? (
                          <ActionIconButton icon={Eye} label="Xem chi tiết" className="h-7 w-7" onClick={() => setSelectedIssueRequest(item)} />
                        ) : (
                          <>
                            <ActionIconButton icon={Eye} label="Duyệt cấp phát" variant="success" className="h-7 w-7" onClick={() => onOpenConsumableDecisionModal(item, 'APPROVE')} />
                            <ActionIconButton icon={X} label="Từ chối phiếu" variant="danger" className="h-7 w-7" onClick={() => onOpenConsumableDecisionModal(item, 'REJECT')} />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!isLoading && filteredIssueRequests.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                      {normalizedKeyword
                        ? 'Không có phiếu cấp phát nào khớp với từ khóa tìm kiếm.'
                        : 'Hiện chưa có yêu cầu hoặc phiếu cấp phát nào.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {requestPanel === REQUEST_PANELS.DISPOSAL && (
            <table className="w-full table-fixed divide-y divide-slate-200 text-xs dark:divide-slate-800">
              <colgroup>
                <col className="w-[8%]" />
                <col className="w-[22%]" />
                <col className="w-[10%]" />
                <col className="w-[12%]" />
                <col className="w-[16%]" />
                <col className="w-[14%]" />
                <col className="w-[96px]" />
              </colgroup>
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="px-2 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Phiếu</th>
                  <th className="px-2 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Vật tư</th>
                  <th className="px-2 py-2 text-right font-semibold text-slate-600 dark:text-slate-400">Số lượng</th>
                  <th className="px-2 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Số lô</th>
                  <th className="px-2 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Người đề nghị</th>
                  <th className="px-2 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Thời gian</th>
                  <th className="px-1 py-2 text-right font-semibold text-slate-600 dark:text-slate-400">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {isLoading && Array.from({ length: 3 }).map((_, index) => (
                  <tr key={`disposal-request-skeleton-${index}`} className="animate-pulse">
                    {Array.from({ length: 7 }).map((__, cellIndex) => (
                      <td key={`disposal-request-cell-${cellIndex}`} className="px-2 py-2">
                        <div className="h-3.5 w-16 rounded bg-slate-200 dark:bg-slate-700" />
                      </td>
                    ))}
                  </tr>
                ))}
                {!isLoading && filteredDisposalRequests.map((item) => (
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
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-slate-600 dark:text-slate-300">
                      {formatDateTime(item.createdAt)}
                    </td>
                    <td className="px-1 py-1.5">
                      <div className="flex justify-end gap-0.5">
                        {!readOnly && <>
                          <ActionIconButton icon={Eye} label="Duyệt tiêu huỷ" variant="success" className="h-7 w-7" onClick={() => onOpenDisposalDecisionModal(item, 'APPROVE')} disabled={downloadingDisposalRequestId === item.id} />
                          <ActionIconButton icon={X} label="Từ chối yêu cầu tiêu huỷ" variant="danger" className="h-7 w-7" onClick={() => onOpenDisposalDecisionModal(item, 'REJECT')} disabled={downloadingDisposalRequestId === item.id} />
                        </>}
                      </div>
                    </td>
                  </tr>
                ))}
                {!isLoading && filteredDisposalRequests.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                      {normalizedKeyword
                        ? 'Không có yêu cầu tiêu huỷ nào khớp với từ khóa tìm kiếm.'
                        : 'Hiện không có yêu cầu tiêu huỷ nào đang chờ duyệt.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selectedIssueRequest && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-[2px] sm:p-6" onMouseDown={() => setSelectedIssueRequest(null)}>
          <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/70 bg-slate-50 shadow-2xl dark:border-slate-700 dark:bg-slate-950" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-950 sm:px-6">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Phiếu cấp phát #{selectedIssueRequest.id}</h3>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getConsumableRequestStatusMeta(selectedIssueRequest.status).className}`}>
                    {getConsumableRequestStatusMeta(selectedIssueRequest.status).label}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Thông tin theo dõi dành cho quản trị viên</p>
              </div>
              <button type="button" onClick={() => setSelectedIssueRequest(null)} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800" aria-label="Đóng"><X size={19} /></button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                <h4 className="mb-4 text-xs font-bold uppercase tracking-[0.12em] text-fptOrangeDark dark:text-orange-300">Thông tin cấp phát</h4>
                <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
                  {[
                    ['Vật tư', selectedIssueRequest.assetName],
                    ['Mã vật tư', selectedIssueRequest.assetQaCode],
                    ['Số lượng yêu cầu', formatConsumableQuantityText(selectedIssueRequest, { quantityField: 'quantityRequested', formattedField: 'formattedQuantityRequested' })],
                    ['Phòng nhận', selectedIssueRequest.locationName],
                    ['Kho xuất', selectedIssueRequest.sourceWarehouseLocationName || 'Chưa chọn'],
                  ].map(([label, value]) => <div key={label}><dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</dt><dd className="mt-1 font-medium leading-6 text-slate-800 dark:text-slate-100">{value || '-'}</dd></div>)}
                </dl>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                <h4 className="mb-4 text-xs font-bold uppercase tracking-[0.12em] text-fptOrangeDark dark:text-orange-300">Theo dõi xử lý</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950/60">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Người yêu cầu</p>
                    <p className="mt-1 font-semibold text-slate-800 dark:text-slate-100">{selectedIssueRequest.requestedByFullName || selectedIssueRequest.requestedByUsername || '-'}</p>
                    <p className="mt-1 text-xs text-slate-500">Tạo lúc {formatDateTime(selectedIssueRequest.createdAt)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950/60">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Người xử lý</p>
                    <p className="mt-1 font-semibold text-slate-800 dark:text-slate-100">{selectedIssueRequest.resolvedByFullName || selectedIssueRequest.resolvedByUsername || 'Chưa có'}</p>
                    <p className="mt-1 text-xs text-slate-500">{selectedIssueRequest.resolvedAt ? `Xử lý lúc ${formatDateTime(selectedIssueRequest.resolvedAt)}` : 'Phiếu chưa được xử lý'}</p>
                  </div>
                </div>
              </section>

              <section className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
                  <h4 className="text-[11px] font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">Lý do cấp phát</h4>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200">{selectedIssueRequest.reason || '-'}</p>
                </div>
                <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
                  <h4 className="text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">Ghi chú xử lý</h4>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200">{selectedIssueRequest.decisionNote || 'Chưa có ghi chú'}</p>
                </div>
              </section>
            </div>
            <div className="flex justify-end border-t border-slate-200 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-950 sm:px-6">
              <button type="button" onClick={() => setSelectedIssueRequest(null)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
