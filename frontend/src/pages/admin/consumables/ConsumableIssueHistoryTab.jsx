import { useMemo, useState } from 'react'
import { IconRefresh as RefreshCw, IconSearch as Search } from '@tabler/icons-react'
import { ALL_ROOMS_ID } from './useLocationOverview'
import {
  formatConsumableQuantityText,
  formatCurrency,
  formatDateTime,
} from './consumableDisplayUtils'

const ALL_ROOMS_OPTION = { id: ALL_ROOMS_ID, roomName: 'Tất cả phòng' }

function matchesKeyword(item, keyword) {
  if (!keyword) return true
  const haystack = [
    item.assetQaCode,
    item.assetName,
    item.issuedToLocationName,
    item.sourceWarehouseLocationName,
    item.issuedByFullName,
    item.issuedByUsername,
    item.note,
  ]
    .map((value) => String(value || '').toLowerCase())
    .join(' ')
  return haystack.includes(keyword)
}

export default function ConsumableIssueHistoryTab({
  roomOptions,
  selectedRoomId,
  onRoomChange,
  roomOverview,
  roomOverviewLoading,
  onRefresh,
}) {
  const [keyword, setKeyword] = useState('')

  const roomSelectOptions = useMemo(
    () => [ALL_ROOMS_OPTION, ...(roomOptions || [])],
    [roomOptions],
  )

  const issueHistory = roomOverview?.issueHistory || []
  const normalizedKeyword = keyword.trim().toLowerCase()

  const filteredIssueHistory = useMemo(
    () => issueHistory.filter((item) => matchesKeyword(item, normalizedKeyword)),
    [issueHistory, normalizedKeyword],
  )

  const summary = useMemo(() => {
    const totalQuantity = filteredIssueHistory.reduce(
      (sum, item) => sum + Number(item.quantity || 0),
      0,
    )
    const distinctAssets = new Set(
      filteredIssueHistory.map((item) => String(item.assetQaCode || '').trim()).filter(Boolean),
    ).size
    const distinctRooms = new Set(
      filteredIssueHistory.map((item) => String(item.issuedToLocationName || '').trim()).filter(Boolean),
    ).size
    return {
      totalRecords: filteredIssueHistory.length,
      totalQuantity,
      distinctAssets,
      distinctRooms,
    }
  }, [filteredIssueHistory])

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid gap-3 md:grid-cols-[minmax(220px,280px)_minmax(260px,1fr)]">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Phòng nhận
              <select
                value={selectedRoomId || ALL_ROOMS_ID}
                onChange={(event) => onRoomChange(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                {roomSelectOptions.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.roomName}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Tìm kiếm
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900">
                <Search size={16} className="text-slate-400" />
                <input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="Mã QA, tên vật tư, phòng, người cấp phát..."
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
              </div>
            </label>
          </div>

          <button
            type="button"
            onClick={() => onRefresh()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            <RefreshCw size={16} />
            Tải lại
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Lượt cấp phát</p>
            <p className="mt-2 text-2xl font-semibold text-slate-800 dark:text-slate-100">{summary.totalRecords}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Tổng số lượng</p>
            <p className="mt-2 text-2xl font-semibold text-slate-800 dark:text-slate-100">{summary.totalQuantity}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Vật tư</p>
            <p className="mt-2 text-2xl font-semibold text-slate-800 dark:text-slate-100">{summary.distinctAssets}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Phòng nhận</p>
            <p className="mt-2 text-2xl font-semibold text-slate-800 dark:text-slate-100">{summary.distinctRooms}</p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        {roomOverviewLoading ? (
          <p className="p-4 text-sm text-slate-500">Đang tải lịch sử cấp phát...</p>
        ) : filteredIssueHistory.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">Chưa có lịch sử cấp phát phù hợp.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Vật tư</th>
                  <th className="px-4 py-3">Số lượng</th>
                  <th className="px-4 py-3">Phòng nhận</th>
                  <th className="px-4 py-3">Kho xuất</th>
                  <th className="px-4 py-3">Người cấp phát</th>
                  <th className="px-4 py-3">Đơn giá</th>
                  <th className="px-4 py-3">Thời gian</th>
                  <th className="px-4 py-3">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredIssueHistory.map((item) => (
                  <tr key={item.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{item.assetName}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.assetQaCode}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                      {item.formattedQuantity || formatConsumableQuantityText(item, {
                        quantityField: 'quantity',
                        formattedField: 'formattedQuantity',
                      })}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{item.issuedToLocationName}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{item.sourceWarehouseLocationName || 'Chưa ghi nhận'}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{item.issuedByFullName || item.issuedByUsername || 'Chưa ghi nhận'}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{formatCurrency(item.unitPrice)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDateTime(item.issuedAt)}</td>
                    <td className="max-w-[280px] px-4 py-3 text-slate-600 dark:text-slate-300">
                      <p className="line-clamp-3">{item.note || '—'}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
