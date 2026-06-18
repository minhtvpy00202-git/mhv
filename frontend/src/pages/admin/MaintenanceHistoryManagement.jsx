import { IconFileDescription as Detail, IconMessageCircle as MessageCircle } from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../../api/axiosClient'
import ActionIconButton from '../../components/ui/ActionIconButton'
import ColumnVisibilityDropdown from '../../components/ui/ColumnVisibilityDropdown'
import useColumnVisibility from '../../hooks/useColumnVisibility'
import { getAssetStatusMeta, getTechnicalStatusMeta, getUsageStatusMeta } from '../../utils/assetStatus'
import { formatVietnamDateTime, getServerDateTimeMs } from '../../utils/datetime'
import { resolveBackendMediaUrl } from '../../utils/mediaUrl'

const PAGE_SIZE = 10
const defaultPageInfo = {
  page: 0,
  size: PAGE_SIZE,
  totalPages: 1,
  totalItems: 0,
}
const maintenanceColumnOptions = [
  { key: 'assetQaCode', label: 'Mã thiết bị' },
  { key: 'assetName', label: 'Tên thiết bị' },
  { key: 'homeLocationName', label: 'Phòng gốc' },
  { key: 'currentLocationName', label: 'Phòng hiện tại' },
  { key: 'reporterFullName', label: 'Người báo hỏng' },
  { key: 'description', label: 'Chi tiết hỏng' },
  { key: 'reportTime', label: 'Ngày giờ báo hỏng' },
  { key: 'technicalStatus', label: 'Tình trạng kỹ thuật' },
  { key: 'usageStatus', label: 'Trạng thái sử dụng' },
  { key: 'assetStatus', label: 'Trạng thái hiển thị' },
  { key: 'image', label: 'Ảnh lỗi' },
  { key: 'actions', label: 'Thao tác' },
]
const defaultMaintenanceVisibleColumnKeys = ['assetQaCode', 'assetName', 'reporterFullName', 'description', 'reportTime', 'technicalStatus', 'actions']

function getRowKey(item) {
  return `${item.id}-${item.assetQaCode}-${item.reportTime}`
}

function getBadgeClassName(tone) {
  if (tone === 'emerald') return 'bg-emerald-100 text-emerald-800'
  if (tone === 'blue') return 'bg-blue-100 text-blue-800'
  if (tone === 'red') return 'bg-red-100 text-red-800'
  if (tone === 'amber') return 'bg-amber-100 text-amber-800'
  return 'bg-slate-100 text-slate-700'
}

function MaintenanceHistoryManagement() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [pageInfo, setPageInfo] = useState(defaultPageInfo)
  const [previewImageUrl, setPreviewImageUrl] = useState('')
  const {
    visibleColumns,
    activeColumns,
    selectedCount,
    allSelected,
    toggleColumn,
    selectAllColumns,
    resetDefaultColumns,
  } = useColumnVisibility({
    storageKey: 'mhv-admin-maintenance-history-visible-columns',
    columns: maintenanceColumnOptions,
    defaultVisibleKeys: defaultMaintenanceVisibleColumnKeys,
  })

  const loadData = async (page = pageInfo.page) => {
    setLoading(true)
    try {
      const response = await axiosClient.get('/api/maintenance/history', {
        params: { page, size: pageInfo.size || PAGE_SIZE },
      })
      const data = response.data || {}
      setRows(data.items || [])
      setPageInfo({
        page: data.page ?? 0,
        size: data.size ?? PAGE_SIZE,
        totalPages: data.totalPages || 1,
        totalItems: data.totalItems || 0,
      })
    } catch (error) {
      const message = error?.response?.data?.message || 'Không tải được lịch sử báo hỏng.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleOpenTicketChat = async (item) => {
    try {
      const response = await axiosClient.get('/api/tickets', {
        params: { asset_qa_code: item.assetQaCode },
      })
      const matchedTickets = response.data || []
      if (matchedTickets.length === 0) {
        toast.info(`Chưa có ticket sự cố cho thiết bị ${item.assetQaCode}.`)
        return
      }
      const ticketToOpen = [...matchedTickets].sort((a, b) => {
        const aOpen = a.status !== 'RESOLVED' ? 1 : 0
        const bOpen = b.status !== 'RESOLVED' ? 1 : 0
        if (aOpen !== bOpen) return bOpen - aOpen
        return getServerDateTimeMs(b.createdAt) - getServerDateTimeMs(a.createdAt)
      })[0]
      navigate(`/admin/tickets`)
    } catch (error) {
      const message = error?.response?.data?.message || 'Không mở được ticket/chat.'
      toast.error(message)
    }
  }

  const tableColumns = useMemo(() => ([
    { key: 'assetQaCode', label: 'Mã thiết bị', headClassName: 'whitespace-nowrap px-3 py-2 text-left', cellClassName: 'px-3 py-2', render: (item) => item.assetQaCode },
    { key: 'assetName', label: 'Tên thiết bị', headClassName: 'whitespace-nowrap px-3 py-2 text-left', cellClassName: 'px-3 py-2', render: (item) => item.assetName },
    { key: 'homeLocationName', label: 'Phòng gốc', headClassName: 'whitespace-nowrap px-3 py-2 text-left', cellClassName: 'px-3 py-2', render: (item) => item.homeLocationName },
    { key: 'currentLocationName', label: 'Phòng hiện tại', headClassName: 'whitespace-nowrap px-3 py-2 text-left', cellClassName: 'px-3 py-2', render: (item) => item.currentLocationName },
    { key: 'reporterFullName', label: 'Người báo hỏng', headClassName: 'whitespace-nowrap px-3 py-2 text-left', cellClassName: 'px-3 py-2', render: (item) => item.reporterFullName },
    { key: 'description', label: 'Chi tiết hỏng', headClassName: 'whitespace-nowrap px-3 py-2 text-left', cellClassName: 'px-3 py-2', render: (item) => item.description },
    { key: 'reportTime', label: 'Ngày giờ báo hỏng', headClassName: 'whitespace-nowrap px-3 py-2 text-left', cellClassName: 'px-3 py-2', render: (item) => formatVietnamDateTime(item.reportTime) },
    { key: 'technicalStatus', label: 'Tình trạng kỹ thuật', headClassName: 'whitespace-nowrap px-3 py-2 text-left', cellClassName: 'px-3 py-2', render: (item) => { const meta = getTechnicalStatusMeta(item.technicalStatus); return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${getBadgeClassName(meta.tone)}`}>{meta.label}</span> } },
    { key: 'usageStatus', label: 'Trạng thái sử dụng', headClassName: 'whitespace-nowrap px-3 py-2 text-left', cellClassName: 'px-3 py-2', render: (item) => { const meta = getUsageStatusMeta(item.usageStatus); return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${getBadgeClassName(meta.tone)}`}>{meta.label}</span> } },
    { key: 'assetStatus', label: 'Trạng thái hiển thị', headClassName: 'whitespace-nowrap px-3 py-2 text-left', cellClassName: 'px-3 py-2', render: (item) => { const meta = getAssetStatusMeta(item.assetStatus); return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${getBadgeClassName(meta.tone)}`}>{meta.label}</span> } },
    { key: 'image', label: 'Ảnh lỗi', headClassName: 'whitespace-nowrap px-3 py-2 text-left', cellClassName: 'px-3 py-2', render: (item) => <ActionIconButton icon={Detail} label="Xem ảnh lỗi" onClick={() => { if (!item.imageUrl) { toast.info('Bản ghi này chưa có ảnh lỗi.'); return } setPreviewImageUrl(item.imageUrl) }} /> },
    { key: 'actions', label: 'Thao tác', headClassName: 'whitespace-nowrap px-3 py-2 text-left', cellClassName: 'px-3 py-2', render: (item) => <ActionIconButton icon={MessageCircle} label="Mở ticket hoặc chat" variant="primary" onClick={() => handleOpenTicketChat(item)} /> },
  ]), [])
  const renderedColumns = useMemo(
    () => tableColumns.filter((column) => activeColumns.some((activeColumn) => activeColumn.key === column.key)),
    [activeColumns, tableColumns],
  )

  return (
    <div className="min-w-0 space-y-4">
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800">Lịch sử báo hỏng</h2>
        <p className="mt-1 text-sm text-slate-500">
          Luồng maintenance đã tách riêng tình trạng kỹ thuật và trạng thái sử dụng để tránh chồng nghĩa giữa hỏng và đang sửa chữa.
        </p>
      </section>

      <section className="min-w-0 rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-3 flex justify-end">
          <ColumnVisibilityDropdown
            columns={maintenanceColumnOptions}
            visibleColumns={visibleColumns}
            selectedCount={selectedCount}
            allSelected={allSelected}
            onToggleColumn={(columnKey) => {
              if (visibleColumns[columnKey] && selectedCount === 1) {
                toast.info('Cần giữ lại ít nhất 1 cột hiển thị.')
                return
              }
              toggleColumn(columnKey)
            }}
            onSelectAll={selectAllColumns}
            onResetDefault={resetDefaultColumns}
          />
        </div>
        <div className="w-full max-w-full overflow-x-auto overflow-y-hidden rounded border border-slate-200">
          <table className="w-max min-w-[1500px] text-sm">
            <thead className="bg-slate-50">
              <tr>
                {renderedColumns.map((column) => (
                  <th key={column.key} className={column.headClassName}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading &&
                rows.map((item) => {
                  const rowKey = getRowKey(item)
                  const assetStatusMeta = getAssetStatusMeta(item.assetStatus)
                  const technicalStatusMeta = getTechnicalStatusMeta(item.technicalStatus)
                  const usageStatusMeta = getUsageStatusMeta(item.usageStatus)
                  return (
                  <tr key={rowKey} className="border-t border-slate-100 align-top">
                    {renderedColumns.map((column) => (
                      <td key={`${rowKey}-${column.key}`} className={column.cellClassName}>
                        {column.render(item)}
                      </td>
                    ))}
                  </tr>
                )})}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={Math.max(renderedColumns.length, 1)} className="px-3 py-3 text-center text-slate-500">
                    Chưa có dữ liệu báo hỏng.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {loading && <p className="px-3 py-3 text-sm text-slate-500">Đang tải dữ liệu...</p>}
        </div>

        <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
          <p>
            Trang {pageInfo.page + 1} / {Math.max(1, pageInfo.totalPages)} • Tổng {pageInfo.totalItems} bản ghi
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => loadData(0)}
              disabled={pageInfo.page <= 0}
              className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
            >
              Đầu
            </button>
            <button
              type="button"
              onClick={() => loadData(Math.max(0, pageInfo.page - 1))}
              disabled={pageInfo.page <= 0}
              className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
            >
              Trước
            </button>
            <button
              type="button"
              onClick={() => loadData(Math.min(pageInfo.totalPages - 1, pageInfo.page + 1))}
              disabled={pageInfo.page >= pageInfo.totalPages - 1}
              className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
            >
              Sau
            </button>
            <button
              type="button"
              onClick={() => loadData(Math.max(0, pageInfo.totalPages - 1))}
              disabled={pageInfo.page >= pageInfo.totalPages - 1}
              className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
            >
              Cuối
            </button>
          </div>
        </div>
      </section>
      {previewImageUrl && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4">
          <div className="rounded-2xl bg-white p-4 shadow-xl">
            <img src={resolveBackendMediaUrl(previewImageUrl)} alt="error-preview" className="h-[300px] w-[300px] rounded-lg object-cover" />
            <button
              type="button"
              onClick={() => setPreviewImageUrl('')}
              className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default MaintenanceHistoryManagement
