import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import axiosClient from '../../api/axiosClient'
import ColumnVisibilityDropdown from '../../components/ui/ColumnVisibilityDropdown'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import useColumnVisibility from '../../hooks/useColumnVisibility'
import { formatVietnamDateTime, toDateTimeLocalValue } from '../../utils/datetime'

const PAGE_SIZE = 10
const inventoryAuditColumnStorageKey = 'admin.inventoryAudit.visibleColumns'

const STATUS_MAP = {
  OPEN: 'ĐANG MỞ',
  COMPLETED: 'ĐÃ HOÀN THÀNH',
}

const defaultPageInfo = {
  page: 0,
  size: PAGE_SIZE,
  totalPages: 1,
  totalItems: 0,
}

function createDefaultConfirmDialog() {
  return {
    open: false,
    title: '',
    message: '',
    confirmLabel: 'Xác nhận',
    cancelLabel: 'Hủy',
    tone: 'danger',
    busy: false,
    onConfirm: null,
  }
}

function createDefaultAuditForm() {
  const now = new Date()
  return {
    locationId: '',
    startedAt: toDateTimeLocalValue(now),
    dueDate: toDateTimeLocalValue(new Date(now.getTime() + 24 * 60 * 60 * 1000)),
    notes: '',
  }
}

function DetailIconButton({ onClick }) {
  return (
    <div className="relative group inline-block">
      <button
        type="button"
        onClick={onClick}
        className="flex h-6 w-6 items-center justify-center rounded-md border border-amber-300 bg-white shadow-sm transition-all hover:bg-amber-50/80"
      >
        <svg className="h-3.5 w-3.5 text-amber-700" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </button>
      <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-md transition-all duration-200 group-hover:pointer-events-auto group-hover:opacity-100">
        Xem chi tiết
        <div className="absolute left-1/2 top-full -mt-1 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
      </div>
    </div>
  )
}

function AssetListModal({ open, title, onClose, columns, items, emptyMessage }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <h3 className="text-base font-semibold text-slate-800">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="overflow-auto p-4">
          <table className="w-full divide-y divide-slate-200 text-sm">
            <thead className="sticky top-0 bg-slate-50 shadow-[0_1px_0_0_rgba(226,232,240,1)]">
              <tr>
                {columns.map((column) => (
                  <th key={column.key} className="px-3 py-2 text-left font-semibold text-slate-600">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {items.map((item, index) => (
                <tr key={`${item.assetQaCode || title}-${index}`} className="hover:bg-slate-50/50">
                  {columns.map((column) => (
                    <td key={`${item.assetQaCode || title}-${column.key}-${index}`} className="px-3 py-2 text-slate-600">
                      {column.render ? column.render(item, index) : (item[column.key] || '-')}
                    </td>
                  ))}
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td className="px-3 py-6 text-center text-slate-400" colSpan={columns.length}>
                    {emptyMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end rounded-b-xl border-t border-slate-100 bg-slate-50 p-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Đóng</button>
        </div>
      </div>
    </div>
  )
}

function InventoryAuditManagement() {
  const [locations, setLocations] = useState([])
  const [audits, setAudits] = useState([])
  const [selectedAudit, setSelectedAudit] = useState(null)
  const [confirmDialog, setConfirmDialog] = useState(createDefaultConfirmDialog)

  // Trạng thái hiển thị các modal chi tiết
  const [openScannedModal, setOpenScannedModal] = useState(false)
  const [openLentModal, setOpenLentModal] = useState(false)
  const [openBorrowedModal, setOpenBorrowedModal] = useState(false)
  const [openRepairingModal, setOpenRepairingModal] = useState(false)
  const [openMissingModal, setOpenMissingModal] = useState(false)
  const [form, setForm] = useState(createDefaultAuditForm)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [pageInfo, setPageInfo] = useState(defaultPageInfo)

  const sortedAudits = useMemo(() => [...audits], [audits])
  const auditColumnOptions = useMemo(() => ([
    {
      key: 'id',
      label: 'Mã phiên',
      headClassName: 'whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600',
      cellClassName: 'whitespace-nowrap px-3 py-2',
      render: (audit) => `#${audit.id}`,
    },
    {
      key: 'locationName',
      label: 'Phòng',
      headClassName: 'whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600',
      cellClassName: 'whitespace-nowrap px-3 py-2',
      render: (audit) => audit.locationName || '-',
    },
    {
      key: 'status',
      label: 'Trạng thái',
      headClassName: 'whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600',
      cellClassName: 'whitespace-nowrap px-3 py-2',
      render: (audit) => STATUS_MAP[audit.status] || audit.status || '-',
    },
    {
      key: 'startedAt',
      label: 'Bắt đầu',
      headClassName: 'whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600',
      cellClassName: 'whitespace-nowrap px-3 py-2',
      render: (audit) => formatVietnamDateTime(audit.startedAt, ''),
    },
    {
      key: 'dueDate',
      label: 'Hạn hoàn tất',
      headClassName: 'whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600',
      cellClassName: 'whitespace-nowrap px-3 py-2',
      render: (audit) => formatVietnamDateTime(audit.dueDate, ''),
    },
    {
      key: 'completedAt',
      label: 'Kết thúc',
      headClassName: 'whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600',
      cellClassName: 'whitespace-nowrap px-3 py-2',
      render: (audit) => formatVietnamDateTime(audit.completedAt, ''),
    },
    {
      key: 'detail',
      label: 'Chi tiết',
      headClassName: 'whitespace-nowrap px-3 py-2 text-right font-semibold text-slate-600',
      cellClassName: 'whitespace-nowrap px-3 py-2 text-right',
      render: (audit) => (
        <button
          type="button"
          onClick={() => loadAuditDetail(audit.id)}
          className="rounded border border-blue-300 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
        >
          Xem
        </button>
      ),
    },
  ]), [])
  const {
    visibleColumns,
    activeColumns,
    selectedCount,
    allSelected,
    toggleColumn,
    selectAllColumns,
    resetDefaultColumns,
  } = useColumnVisibility({
    storageKey: inventoryAuditColumnStorageKey,
    columns: auditColumnOptions,
    defaultVisibleKeys: auditColumnOptions.map((column) => column.key),
  })

  const loadInitialData = async (page = 0) => {
    setLoading(true)
    try {
      const response = await axiosClient.get('/api/inventory-audits/bootstrap', {
        params: { page, size: pageInfo.size || PAGE_SIZE },
      })
      const data = response.data || {}
      const auditPage = data.audits || {}
      setLocations((data.locations || []).filter((location) => location?.hasAsset !== false))
      setAudits(auditPage.items || [])
      setPageInfo({
        page: auditPage.page ?? 0,
        size: auditPage.size ?? PAGE_SIZE,
        totalPages: auditPage.totalPages || 1,
        totalItems: auditPage.totalItems || 0,
      })
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể tải dữ liệu kiểm kê.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const bootstrapTimer = window.setTimeout(() => {
      void loadInitialData()
    }, 0)

    return () => {
      window.clearTimeout(bootstrapTimer)
    }
  }, [])

  const loadAuditDetail = async (auditId) => {
    try {
      const response = await axiosClient.get(`/api/inventory-audits/${auditId}`)
      setSelectedAudit(response.data)
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể tải chi tiết kiểm kê.'
      toast.error(message)
    }
  }

  const handleCreateAudit = async () => {
    if (!form.locationId) {
      toast.error('Vui lòng chọn phòng kiểm kê.')
      return
    }
    if (!form.startedAt) {
      toast.error('Vui lòng nhập thời gian bắt đầu kiểm kê.')
      return
    }
    if (!form.dueDate) {
      toast.error('Vui lòng nhập hạn hoàn tất kiểm kê.')
      return
    }
    if (new Date(form.dueDate).getTime() <= new Date(form.startedAt).getTime()) {
      toast.error('Hạn hoàn tất phải sau thời gian bắt đầu.')
      return
    }
    setCreating(true)
    try {
      const response = await axiosClient.post('/api/inventory-audits', {
        locationId: Number(form.locationId),
        startedAt: form.startedAt,
        dueDate: form.dueDate,
        notes: form.notes,
      })
      toast.success('Tạo phiên kiểm kê thành công.')
      setForm(createDefaultAuditForm())
      await loadInitialData(0)
      await loadAuditDetail(response.data.id)
    } catch (error) {
      const message = error?.response?.data?.message || 'Tạo phiên kiểm kê thất bại.'
      toast.error(message)
    } finally {
      setCreating(false)
    }
  }

  const handleCompleteAudit = async () => {
    if (!selectedAudit?.summary?.id) return
    try {
      const response = await axiosClient.post(`/api/inventory-audits/${selectedAudit.summary.id}/complete`)
      setSelectedAudit(response.data)
      await loadInitialData(pageInfo.page)
      toast.success('Hoàn thành kiểm kê thành công.')
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể hoàn thành kiểm kê.'
      toast.error(message)
    }
  }

  const handleResolveFound = async (qaCode) => {
    try {
      const response = await axiosClient.post(`/api/inventory-audits/${selectedAudit.summary.id}/missing/${qaCode}/found`)
      setSelectedAudit(response.data)
      toast.success(`Đã xác nhận tìm thấy thiết bị ${qaCode}.`)
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể cập nhật trạng thái tìm thấy.'
      toast.error(message)
    }
  }

  const handleResolveLost = async (qaCode) => {
    setConfirmDialog({
      open: true,
      title: 'Xác nhận mất hẳn thiết bị',
      message: `Bạn có chắc muốn chốt mất hẳn thiết bị ${qaCode}? Thiết bị sẽ bị xóa khỏi hệ thống.`,
      confirmLabel: 'Xác nhận mất',
      cancelLabel: 'Hủy',
      tone: 'danger',
      busy: false,
      onConfirm: async () => {
        try {
          const response = await axiosClient.post(`/api/inventory-audits/${selectedAudit.summary.id}/missing/${qaCode}/lost`)
          setSelectedAudit(response.data)
          toast.success(`Đã chốt mất hẳn thiết bị ${qaCode}.`)
          return true
        } catch (error) {
          const message = error?.response?.data?.message || 'Không thể chốt mất hẳn thiết bị.'
          toast.error(message)
          return false
        }
      },
    })
  }

  const closeConfirmDialog = () => {
    setConfirmDialog((previous) => (previous.busy ? previous : createDefaultConfirmDialog()))
  }

  const handleConfirmDialogAccept = async () => {
    if (!confirmDialog.onConfirm || confirmDialog.busy) return
    setConfirmDialog((previous) => ({ ...previous, busy: true }))
    const shouldClose = await confirmDialog.onConfirm()
    if (shouldClose === false) {
      setConfirmDialog((previous) => ({ ...previous, busy: false }))
      return
    }
    setConfirmDialog(createDefaultConfirmDialog())
  }

  const handleExportReport = async () => {
    if (!selectedAudit?.summary?.id) return
    try {
      const response = await axiosClient.get(`/api/reports/export-inventory-audit/${selectedAudit.summary.id}`, {
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `bien-ban-kiem-ke-${selectedAudit.summary.id}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Đang tải biên bản kiểm kê.')
    } catch (error) {
      const message = error?.response?.data?.message || 'Xuất biên bản kiểm kê thất bại.'
      toast.error(message)
    }
  }

  return (
      <div className="space-y-4">
        {/* KHỐI TẠO PHIÊN KIỂM KÊ ĐỊNH KỲ */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-slate-800">Tạo phiên kiểm kê định kỳ</h2>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-500">Phòng kiểm kê</span>
              <select
                  value={form.locationId}
                  onChange={(e) => setForm((prev) => ({ ...prev, locationId: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
              >
                <option value="">Chọn phòng kiểm kê</option>
                {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.roomName}
                    </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-500">Thời gian bắt đầu</span>
              <input
                  type="datetime-local"
                  value={form.startedAt}
                  onChange={(e) => setForm((prev) => ({ ...prev, startedAt: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-500">Thời gian kết thúc</span>
              <input
                  type="datetime-local"
                  value={form.dueDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-500">Ghi chú</span>
              <input
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
                  placeholder="Ghi chú phiên kiểm kê"
              />
            </label>
          </div>

          <button
              type="button"
              onClick={handleCreateAudit}
              disabled={creating}
              className="mt-3 rounded-lg bg-fptOrange px-4 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark disabled:opacity-60"
          >
            Tạo phiên kiểm kê
          </button>
        </div>

        {/* DANH SÁCH CÁC PHIÊN KIỂM KÊ */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-slate-800">Danh sách phiên kiểm kê</h3>
            <div className="flex items-center gap-2">
              <p className="text-sm text-slate-500">Tổng: {pageInfo.totalItems}</p>
              <div className="w-full min-w-[136px] sm:w-auto">
                <ColumnVisibilityDropdown
                  columns={auditColumnOptions}
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
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-max divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
              <tr>
                {activeColumns.map((column) => (
                  <th key={column.key} className={column.headClassName}>
                    {column.label}
                  </th>
                ))}
              </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
              {loading &&
                  Array.from({ length: 6 }).map((_, index) => (
                      <tr key={`audit-loading-${index}`} className="animate-pulse">
                        <td className="px-3 py-2" colSpan={Math.max(activeColumns.length, 1)}>
                          <div className="h-4 w-full rounded bg-slate-200" />
                        </td>
                      </tr>
                  ))}
              {!loading &&
                  sortedAudits.map((audit) => (
                      <tr key={audit.id}>
                        {activeColumns.map((column) => (
                          <td key={`${audit.id}-${column.key}`} className={column.cellClassName}>
                            {column.render(audit)}
                          </td>
                        ))}
                      </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {/* Phân trang */}
          {!loading && pageInfo.totalItems > 0 && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
                <p>Trang {pageInfo.page + 1} / {Math.max(1, pageInfo.totalPages)}</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => loadInitialData(0)} disabled={pageInfo.page <= 0} className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50">Đầu</button>
                  <button type="button" onClick={() => loadInitialData(Math.max(0, pageInfo.page - 1))} disabled={pageInfo.page <= 0} className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50">Trước</button>
                  <button type="button" onClick={() => loadInitialData(Math.min(pageInfo.totalPages - 1, pageInfo.page + 1))} disabled={pageInfo.page >= pageInfo.totalPages - 1} className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50">Sau</button>
                  <button type="button" onClick={() => loadInitialData(Math.max(0, pageInfo.totalPages - 1))} disabled={pageInfo.page >= pageInfo.totalPages - 1} className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50">Cuối</button>
                </div>
              </div>
          )}
        </div>

        {/* CHI TIẾT PHIÊN ĐANG ĐƯỢC CHỌN */}
        {selectedAudit && (
            <div className="rounded-xl bg-white p-4 shadow-sm space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-800">
                    Chi tiết phiên #{selectedAudit.summary.id} - {selectedAudit.summary.locationName}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Bắt đầu: {formatVietnamDateTime(selectedAudit.summary.startedAt, '')} | Hạn hoàn tất: {formatVietnamDateTime(selectedAudit.summary.dueDate, 'Chưa đặt hạn')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                      type="button"
                      onClick={handleExportReport}
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
                  >
                    Xuất biên bản
                  </button>
                  {selectedAudit.summary.status === 'OPEN' && (
                      <button
                          type="button"
                          onClick={handleCompleteAudit}
                          className="rounded-lg bg-fptOrange px-3 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark transition-colors"
                      >
                        Hoàn thành kiểm kê
                      </button>
                  )}
                </div>
              </div>

              {/* BẢNG SỐ LIỆU TỔNG HỢP */}
              <div>
                <h4 className="mb-2 text-sm font-semibold text-slate-700">Bảng số liệu tổng hợp</h4>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full min-w-max divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Tổng thiết bị</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Dự kiến (Cần quét)</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Đang sửa chữa</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Đã quét</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Đang cho mượn</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Đang mượn</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Thất lạc</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                    <tr className="hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 font-medium text-slate-800">
                        {selectedAudit.summary.totalAssetCount || 0} thiết bị
                      </td>
                      <td className="px-4 py-2.5 text-slate-700">
                        {selectedAudit.summary.expectedCount || 0}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-violet-600">
                        <div className="flex items-center gap-3">
                          <span>{selectedAudit.summary.repairingCount || 0}</span>
                          <DetailIconButton onClick={() => setOpenRepairingModal(true)} />
                        </div>
                      </td>

                      <td className="px-4 py-2.5 text-emerald-600 font-medium">
                        <div className="flex items-center gap-3">
                          <span>{selectedAudit.summary.scannedCount || 0}</span>
                          <DetailIconButton onClick={() => setOpenScannedModal(true)} />
                        </div>
                      </td>

                      <td className="px-4 py-2.5 text-sky-600 font-medium">
                        <div className="flex items-center gap-3">
                          <span>{selectedAudit.summary.lentCount || 0}</span>
                          <DetailIconButton onClick={() => setOpenLentModal(true)} />
                        </div>
                      </td>

                      <td className="px-4 py-2.5 text-amber-600 font-medium">
                        <div className="flex items-center gap-3">
                          <span>{selectedAudit.summary.borrowedCount || 0}</span>
                          <DetailIconButton onClick={() => setOpenBorrowedModal(true)} />
                        </div>
                      </td>

                      <td className="px-4 py-2.5 text-red-600 font-medium">
                        <div className="flex items-center gap-3">
                          <span>{selectedAudit.summary.missingCount || 0}</span>
                          <DetailIconButton onClick={() => setOpenMissingModal(true)} />
                        </div>
                      </td>
                    </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedAudit.summary.notes && (
                  <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600 border border-slate-100">
                    <span className="font-semibold text-slate-700">Ghi chú phiên:</span> {selectedAudit.summary.notes}
                  </div>
              )}
            </div>
        )}

        <AssetListModal
          open={openScannedModal}
          title="Danh sách thiết bị đã quét"
          onClose={() => setOpenScannedModal(false)}
          items={selectedAudit?.scannedItems || []}
          emptyMessage="Chưa quét thiết bị nào."
          columns={[
            { key: 'index', label: 'STT', render: (_, index) => index + 1 },
            { key: 'assetQaCode', label: 'Mã thiết bị', render: (item) => <span className="font-medium text-slate-700">{item.assetQaCode}</span> },
            { key: 'assetName', label: 'Tên thiết bị' },
            { key: 'scannedByUsername', label: 'Người quét' },
            { key: 'scannedAt', label: 'Thời gian', render: (item) => <span className="text-xs text-slate-400">{formatVietnamDateTime(item.scannedAt, '')}</span> },
          ]}
        />

        <AssetListModal
          open={openLentModal}
          title="Danh sách thiết bị đang cho mượn"
          onClose={() => setOpenLentModal(false)}
          items={selectedAudit?.lentItems || []}
          emptyMessage="Không có thiết bị nào đang cho mượn."
          columns={[
            { key: 'index', label: 'STT', render: (_, index) => index + 1 },
            { key: 'assetQaCode', label: 'Mã thiết bị', render: (item) => <span className="font-medium text-slate-700">{item.assetQaCode}</span> },
            { key: 'assetName', label: 'Tên thiết bị' },
            { key: 'toLocationName', label: 'Đang ở phòng' },
            { key: 'borrowerName', label: 'Người mượn' },
            { key: 'borrowedAt', label: 'Thời gian mượn', render: (item) => formatVietnamDateTime(item.borrowedAt, 'Chưa xác định') },
          ]}
        />

        <AssetListModal
          open={openBorrowedModal}
          title="Danh sách thiết bị đang mượn"
          onClose={() => setOpenBorrowedModal(false)}
          items={selectedAudit?.borrowedItems || []}
          emptyMessage="Không có thiết bị nào đang mượn."
          columns={[
            { key: 'index', label: 'STT', render: (_, index) => index + 1 },
            { key: 'assetQaCode', label: 'Mã thiết bị', render: (item) => <span className="font-medium text-slate-700">{item.assetQaCode}</span> },
            { key: 'assetName', label: 'Tên thiết bị' },
            { key: 'homeLocationName', label: 'Phòng gốc' },
            { key: 'currentLocationName', label: 'Hiện đang ở' },
            { key: 'borrowerName', label: 'Người mượn' },
            { key: 'borrowedAt', label: 'Thời gian mượn', render: (item) => formatVietnamDateTime(item.borrowedAt, 'Chưa xác định') },
          ]}
        />

        <AssetListModal
          open={openRepairingModal}
          title="Danh sách thiết bị đang sửa chữa"
          onClose={() => setOpenRepairingModal(false)}
          items={selectedAudit?.repairingItems || []}
          emptyMessage="Không có thiết bị nào đang sửa chữa."
          columns={[
            { key: 'index', label: 'STT', render: (_, index) => index + 1 },
            { key: 'assetQaCode', label: 'Mã thiết bị', render: (item) => <span className="font-medium text-slate-700">{item.assetQaCode}</span> },
            { key: 'assetName', label: 'Tên thiết bị' },
            { key: 'homeLocationName', label: 'Phòng gốc' },
            { key: 'currentLocationName', label: 'Vị trí hiện tại' },
            { key: 'displayStatus', label: 'Trạng thái hiển thị' },
          ]}
        />

        {/* MODAL CHI TIẾT THIẾT BỊ THẤT LẠC / THIẾU */}
        {openMissingModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
              <div className="w-full max-w-3xl rounded-xl bg-white shadow-xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-slate-100 p-4">
                  <h3 className="text-base font-semibold text-slate-800">Danh sách thiết bị thất lạc / thiếu</h3>
                  <button type="button" onClick={() => setOpenMissingModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="overflow-auto p-4">
                  <table className="w-full text-sm divide-y divide-slate-200">
                    <thead className="bg-slate-50 sticky top-0 shadow-[0_1px_0_0_rgba(226,232,240,1)]">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600 w-16">STT</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Mã thiết bị</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Tên thiết bị</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Xử lý</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-600">Hành động</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                    {selectedAudit?.missingItems?.map((item, index) => (
                        <tr key={item.assetQaCode} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                          <td className="px-3 py-2 font-medium text-slate-700">{item.assetQaCode}</td>
                          <td className="px-3 py-2 text-slate-600">{item.assetName}</td>
                          <td className="px-3 py-2">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                            item.resolutionStatus === 'PENDING' ? 'bg-amber-50 text-amber-700' : item.resolutionStatus === 'FOUND' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {item.resolutionStatus === 'PENDING' ? 'Chưa xử lý' : item.resolutionStatus === 'FOUND' ? 'Tìm thấy' : 'Mất hẳn'}
                        </span>
                            {item.resolvedByUsername && <p className="text-[10px] text-slate-400 mt-0.5">Bởi: {item.resolvedByUsername}</p>}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {item.resolutionStatus === 'PENDING' ? (
                                <div className="flex gap-1.5 justify-end">
                                  <button type="button" onClick={() => handleResolveFound(item.assetQaCode)} className="rounded bg-emerald-50 border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">Thấy</button>
                                  <button type="button" onClick={() => handleResolveLost(item.assetQaCode)} className="rounded bg-red-50 border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100">Mất</button>
                                </div>
                            ) : <span className="text-xs text-slate-400">-</span>}
                          </td>
                        </tr>
                    ))}
                    {(selectedAudit?.missingItems?.length || 0) === 0 && (
                        <tr><td className="px-3 py-6 text-center text-slate-400" colSpan={5}>Không có thiết bị thất lạc.</td></tr>
                    )}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end border-t border-slate-100 p-3 bg-slate-50 rounded-b-xl">
                  <button type="button" onClick={() => setOpenMissingModal(false)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Đóng</button>
                </div>
              </div>
            </div>
        )}

        <ConfirmDialog
            open={confirmDialog.open}
            title={confirmDialog.title}
            message={confirmDialog.message}
            confirmLabel={confirmDialog.confirmLabel}
            cancelLabel={confirmDialog.cancelLabel}
            tone={confirmDialog.tone}
            busy={confirmDialog.busy}
            onConfirm={handleConfirmDialogAccept}
            onClose={closeConfirmDialog}
        />
      </div>
  )
}

export default InventoryAuditManagement
