import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import * as XLSX from 'xlsx' // Import thư viện xuất Excel từ Frontend
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
  OVERDUE: 'QUÁ HẠN',
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

// Hàm phụ trợ để loại bỏ phần giây khỏi chuỗi ngày tháng
const formatNoSeconds = (dateVal, fallback) => {
  const formatted = formatVietnamDateTime(dateVal, fallback);
  if (typeof formatted === 'string') {
    // Xóa :ss (hai chữ số sau dấu hai chấm nằm ngay trước dấu cách hoặc cuối chuỗi)
    return formatted.replace(/:(\d{2})(?=\s|$)/, '');
  }
  return formatted;
};

function InventoryAuditManagement() {
  const [locations, setLocations] = useState([])
  const [audits, setAudits] = useState([])
  const [selectedAudit, setSelectedAudit] = useState(null)
  const [confirmDialog, setConfirmDialog] = useState(createDefaultConfirmDialog)

  // State cho Tab chi tiết thiết bị
  const [activeTab, setActiveTab] = useState('scanned')

  const [form, setForm] = useState(createDefaultAuditForm)
  const [isAutoTime, setIsAutoTime] = useState(true) // State quản lý việc tự động cập nhật thời gian
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
      render: (audit) => {
        // Kiểm tra nếu đang mở và đã qua hạn hoàn tất
        if (audit.status === 'OPEN' && audit.dueDate && new Date(audit.dueDate).getTime() < new Date().getTime()) {
          return <span className="font-semibold text-red-600">QUÁ HẠN</span>;
        }
        return STATUS_MAP[audit.status] || audit.status || '-';
      },
    },
    {
      key: 'startedAt',
      label: 'Bắt đầu',
      headClassName: 'whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600',
      cellClassName: 'whitespace-nowrap px-3 py-2',
      render: (audit) => formatNoSeconds(audit.startedAt, ''),
    },
    {
      key: 'dueDate',
      label: 'Hạn hoàn tất',
      headClassName: 'whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600',
      cellClassName: 'whitespace-nowrap px-3 py-2',
      render: (audit) => formatNoSeconds(audit.dueDate, ''),
    },
    {
      key: 'completedAt',
      label: 'Thời gian hoàn tất',
      headClassName: 'whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600',
      cellClassName: 'whitespace-nowrap px-3 py-2',
      render: (audit) => formatNoSeconds(audit.completedAt, '-'),
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

  // Effect để cập nhật thời gian thực
  useEffect(() => {
    if (!isAutoTime) return; // Dừng chạy nếu người dùng đã tự chỉnh sửa giờ

    const timer = setInterval(() => {
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      setForm((prev) => ({
        ...prev,
        startedAt: toDateTimeLocalValue(now),
        dueDate: toDateTimeLocalValue(tomorrow),
      }));
    }, 1000);

    return () => clearInterval(timer);
  }, [isAutoTime]);

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
      setActiveTab('scanned') // Đặt lại tab mặc định mỗi khi xem phiên mới
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
      setIsAutoTime(true) // Bật lại tự động cập nhật thời gian sau khi tạo xong form
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

  // Hàm xuất file Excel đã nâng cấp: Xuất toàn bộ dữ liệu tổng hợp và chi tiết các tab
  const handleExportReport = async () => {
    if (!selectedAudit?.summary?.id) return
    try {
      toast.info('Đang khởi tạo dữ liệu biên bản kiểm kê...');

      // 1. Tạo mới một Workbook từ SheetJS
      const wb = XLSX.utils.book_new();

      // --- SHEET 1: TỔNG QUAN & BẢNG SỐ LIỆU TỔNG HỢP ---
      const summaryRows = [
        ['BIÊN BẢN KIỂM KÊ TÀI SẢN & THIẾT BỊ'],
        [],
        ['Mã phiên kiểm kê:', `#${selectedAudit.summary.id}`],
        ['Phòng kiểm kê:', selectedAudit.summary.locationName || '-'],
        ['Thời gian bắt đầu:', formatNoSeconds(selectedAudit.summary.startedAt, '')],
        ['Hạn hoàn tất:', formatNoSeconds(selectedAudit.summary.dueDate, 'Chưa đặt hạn')],
        ['Trạng thái:', STATUS_MAP[selectedAudit.summary.status] || selectedAudit.summary.status || '-'],
        ['Ghi chú:', selectedAudit.summary.notes || '-'],
        [],
        ['I. BẢNG SỐ LIỆU TỔNG HỢP'],
        ['Tổng thiết bị', 'Dự kiến (Cần quét)', 'Đang sửa chữa', 'Đã quét', 'Đang cho mượn', 'Đang mượn', 'Thất lạc'],
        [
          selectedAudit.summary.totalAssetCount || 0,
          selectedAudit.summary.expectedCount || 0,
          selectedAudit.summary.repairingCount || 0,
          selectedAudit.summary.scannedCount || 0,
          selectedAudit.summary.lentCount || 0,
          selectedAudit.summary.borrowedCount || 0,
          selectedAudit.summary.missingCount || 0
        ]
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Tong_Quan');

      // --- SHEET 2: CHI TIẾT ĐÃ QUÉT ---
      const scannedRows = [
        ['DANH SÁCH THIẾT BỊ ĐÃ QUÉT'],
        [],
        ['STT', 'Mã thiết bị', 'Tên thiết bị', 'Người quét', 'Thời gian quét'],
        ...(selectedAudit.scannedItems || []).map((item, index) => [
          index + 1,
          item.assetQaCode,
          item.assetName,
          item.scannedByUsername || '-',
          formatNoSeconds(item.scannedAt, '')
        ])
      ];
      const wsScanned = XLSX.utils.aoa_to_sheet(scannedRows);
      XLSX.utils.book_append_sheet(wb, wsScanned, 'Da_Quet');

      // --- SHEET 3: CHI TIẾT ĐANG SỬA CHỮA ---
      const repairingRows = [
        ['DANH SÁCH THIẾT BỊ ĐANG SỬA CHỮA'],
        [],
        ['STT', 'Mã thiết bị', 'Tên thiết bị', 'Phòng gốc', 'Vị trí hiện tại', 'Trạng thái hiển thị'],
        ...(selectedAudit.repairingItems || []).map((item, index) => [
          index + 1,
          item.assetQaCode,
          item.assetName,
          item.homeLocationName || '-',
          item.currentLocationName || '-',
          item.displayStatus || '-'
        ])
      ];
      const wsRepairing = XLSX.utils.aoa_to_sheet(repairingRows);
      XLSX.utils.book_append_sheet(wb, wsRepairing, 'Dang_Sua_Chua');

      // --- SHEET 4: CHI TIẾT ĐANG CHO MƯỢN ---
      const lentRows = [
        ['DANH SÁCH THIẾT BỊ ĐANG CHO MƯỢN'],
        [],
        ['STT', 'Mã thiết bị', 'Tên thiết bị', 'Đang ở phòng', 'Người mượn', 'Thời gian mượn'],
        ...(selectedAudit.lentItems || []).map((item, index) => [
          index + 1,
          item.assetQaCode,
          item.assetName,
          item.toLocationName || '-',
          item.borrowerName || '-',
          formatNoSeconds(item.borrowedAt, 'Chưa xác định')
        ])
      ];
      const wsLent = XLSX.utils.aoa_to_sheet(lentRows);
      XLSX.utils.book_append_sheet(wb, wsLent, 'Cho_Muon');

      // --- SHEET 5: CHI TIẾT ĐANG MƯỢN ---
      const borrowedRows = [
        ['DANH SÁCH THIẾT BỊ ĐANG MƯỢN'],
        [],
        ['STT', 'Mã thiết bị', 'Tên thiết bị', 'Phòng gốc', 'Hiện đang ở', 'Người mượn', 'Thời gian mượn'],
        ...(selectedAudit.borrowedItems || []).map((item, index) => [
          index + 1,
          item.assetQaCode,
          item.assetName,
          item.homeLocationName || '-',
          item.currentLocationName || '-',
          item.borrowerName || '-',
          formatNoSeconds(item.borrowedAt, 'Chưa xác định')
        ])
      ];
      const wsBorrowed = XLSX.utils.aoa_to_sheet(borrowedRows);
      XLSX.utils.book_append_sheet(wb, wsBorrowed, 'Dang_Muon');

      // --- SHEET 6: CHI TIẾT THẤT LẠC ---
      const missingRows = [
        ['DANH SÁCH THIẾT BỊ THẤT LẠC'],
        [],
        ['STT', 'Mã thiết bị', 'Tên thiết bị', 'Trạng thái xử lý', 'Người xử lý / Thông tin bổ sung'],
        ...(selectedAudit.missingItems || []).map((item, index) => [
          index + 1,
          item.assetQaCode,
          item.assetName,
          item.resolutionStatus === 'PENDING' ? 'Chưa xử lý' : item.resolutionStatus === 'FOUND' ? 'Tìm thấy' : 'Mất hẳn',
          item.resolvedByUsername || '-'
        ])
      ];
      const wsMissing = XLSX.utils.aoa_to_sheet(missingRows);
      XLSX.utils.book_append_sheet(wb, wsMissing, 'That_Lac');

      // 3. Tiến hành đóng gói và tải xuống file Excel (.xlsx) dưới Client
      XLSX.writeFile(wb, `bien-ban-kiem-ke-${selectedAudit.summary.id}.xlsx`);
      toast.success('Tải biên bản kiểm kê đầy đủ thành công.');
    } catch (error) {
      console.error('Lỗi khi kết xuất Excel ở Client: ', error);
      toast.error('Xuất biên bản kiểm kê thất bại.');
    }
  }

  // Định nghĩa các tab dữ liệu trên UI
  const TABS = [
    { id: 'repairing', label: 'Đang sửa chữa', count: selectedAudit?.summary?.repairingCount || 0 },
    { id: 'scanned', label: 'Đã quét', count: selectedAudit?.summary?.scannedCount || 0 },
    { id: 'lent', label: 'Đang cho mượn', count: selectedAudit?.summary?.lentCount || 0 },
    { id: 'borrowed', label: 'Đang mượn', count: selectedAudit?.summary?.borrowedCount || 0 },
    { id: 'missing', label: 'Thất lạc', count: selectedAudit?.summary?.missingCount || 0 },
  ]

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
                  onChange={(e) => {
                    setIsAutoTime(false);
                    setForm((prev) => ({ ...prev, startedAt: e.target.value }));
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-500">Thời gian kết thúc</span>
              <input
                  type="datetime-local"
                  value={form.dueDate}
                  onChange={(e) => {
                    setIsAutoTime(false);
                    setForm((prev) => ({ ...prev, dueDate: e.target.value }));
                  }}
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
                    Bắt đầu: {formatNoSeconds(selectedAudit.summary.startedAt, '')} | Hạn hoàn tất: {formatNoSeconds(selectedAudit.summary.dueDate, 'Chưa đặt hạn')}
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
                        {selectedAudit.summary.repairingCount || 0}
                      </td>
                      <td className="px-4 py-2.5 text-emerald-600 font-medium">
                        {selectedAudit.summary.scannedCount || 0}
                      </td>
                      <td className="px-4 py-2.5 text-sky-600 font-medium">
                        {selectedAudit.summary.lentCount || 0}
                      </td>
                      <td className="px-4 py-2.5 text-amber-600 font-medium">
                        {selectedAudit.summary.borrowedCount || 0}
                      </td>
                      <td className="px-4 py-2.5 text-red-600 font-medium">
                        {selectedAudit.summary.missingCount || 0}
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

              {/* KHU VỰC BẢNG CHI TIẾT TỪNG TAB */}

              <div className="pt-4 mt-6 border-t border-slate-100">
                <h4 className="mb-2 text-sm font-semibold text-slate-700">Bảng chi tiết thiết bị</h4>
                {/* THANH ĐIỀU HƯỚNG TAB */}
                <div className="flex gap-2 overflow-x-auto border-b border-slate-200 mb-4 pb-0.5 scrollbar-hide">
                  {TABS.map((tab) => (
                      <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`flex items-center gap-2 whitespace-nowrap px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                              activeTab === tab.id
                                  ? 'border-fptOrange text-fptOrange'
                                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                          }`}
                      >
                        {tab.label}
                        <span className={`rounded-full px-2 py-0.5 text-xs ${
                            activeTab === tab.id ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                        {tab.count}
                      </span>
                      </button>
                  ))}
                </div>

                {/* NỘI DUNG TAB - BẢNG CHI TIẾT */}

                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full min-w-max divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                    {activeTab === 'repairing' && (
                        <tr>
                          <th className="px-4 py-2 text-left font-semibold text-slate-600">STT</th>
                          <th className="px-4 py-2 text-left font-semibold text-slate-600">Mã thiết bị</th>
                          <th className="px-4 py-2 text-left font-semibold text-slate-600">Tên thiết bị</th>
                          <th className="px-4 py-2 text-left font-semibold text-slate-600">Phòng gốc</th>
                          <th className="px-4 py-2 text-left font-semibold text-slate-600">Vị trí hiện tại</th>
                          <th className="px-4 py-2 text-left font-semibold text-slate-600">Trạng thái hiển thị</th>
                        </tr>
                    )}
                    {activeTab === 'scanned' && (
                        <tr>
                          <th className="px-4 py-2 text-left font-semibold text-slate-600">STT</th>
                          <th className="px-4 py-2 text-left font-semibold text-slate-600">Mã thiết bị</th>
                          <th className="px-4 py-2 text-left font-semibold text-slate-600">Tên thiết bị</th>
                          <th className="px-4 py-2 text-left font-semibold text-slate-600">Người quét</th>
                          <th className="px-4 py-2 text-left font-semibold text-slate-600">Thời gian</th>
                        </tr>
                    )}
                    {activeTab === 'lent' && (
                        <tr>
                          <th className="px-4 py-2 text-left font-semibold text-slate-600">STT</th>
                          <th className="px-4 py-2 text-left font-semibold text-slate-600">Mã thiết bị</th>
                          <th className="px-4 py-2 text-left font-semibold text-slate-600">Tên thiết bị</th>
                          <th className="px-4 py-2 text-left font-semibold text-slate-600">Đang ở phòng</th>
                          <th className="px-4 py-2 text-left font-semibold text-slate-600">Người mượn</th>
                          <th className="px-4 py-2 text-left font-semibold text-slate-600">Thời gian mượn</th>
                        </tr>
                    )}
                    {activeTab === 'borrowed' && (
                        <tr>
                          <th className="px-4 py-2 text-left font-semibold text-slate-600">STT</th>
                          <th className="px-4 py-2 text-left font-semibold text-slate-600">Mã thiết bị</th>
                          <th className="px-4 py-2 text-left font-semibold text-slate-600">Tên thiết bị</th>
                          <th className="px-4 py-2 text-left font-semibold text-slate-600">Phòng gốc</th>
                          <th className="px-4 py-2 text-left font-semibold text-slate-600">Hiện đang ở</th>
                          <th className="px-4 py-2 text-left font-semibold text-slate-600">Người mượn</th>
                          <th className="px-4 py-2 text-left font-semibold text-slate-600">Thời gian mượn</th>
                        </tr>
                    )}
                    {activeTab === 'missing' && (
                        <tr>
                          <th className="px-4 py-2 text-left font-semibold text-slate-600">STT</th>
                          <th className="px-4 py-2 text-left font-semibold text-slate-600">Mã thiết bị</th>
                          <th className="px-4 py-2 text-left font-semibold text-slate-600">Tên thiết bị</th>
                          <th className="px-4 py-2 text-left font-semibold text-slate-600">Xử lý</th>
                          <th className="px-4 py-2 text-right font-semibold text-slate-600">Hành động</th>
                        </tr>
                    )}
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">

                    {/* Bảng Đang sửa chữa */}
                    {activeTab === 'repairing' && selectedAudit?.repairingItems?.map((item, index) => (
                        <tr key={`rep-${item.assetQaCode}-${index}`} className="hover:bg-slate-50/50">
                          <td className="px-4 py-2 text-slate-500">{index + 1}</td>
                          <td className="px-4 py-2 font-medium text-slate-700">{item.assetQaCode}</td>
                          <td className="px-4 py-2 text-slate-600">{item.assetName}</td>
                          <td className="px-4 py-2 text-slate-600">{item.homeLocationName || '-'}</td>
                          <td className="px-4 py-2 text-slate-600">{item.currentLocationName || '-'}</td>
                          <td className="px-4 py-2 text-slate-600">{item.displayStatus || '-'}</td>
                        </tr>
                    ))}
                    {activeTab === 'repairing' && (!selectedAudit?.repairingItems || selectedAudit.repairingItems.length === 0) && (
                        <tr><td className="px-4 py-6 text-center text-slate-400" colSpan={6}>Không có thiết bị nào đang sửa chữa.</td></tr>
                    )}

                    {/* Bảng Đã quét */}
                    {activeTab === 'scanned' && selectedAudit?.scannedItems?.map((item, index) => (
                        <tr key={`scan-${item.assetQaCode}-${index}`} className="hover:bg-slate-50/50">
                          <td className="px-4 py-2 text-slate-500">{index + 1}</td>
                          <td className="px-4 py-2 font-medium text-slate-700">{item.assetQaCode}</td>
                          <td className="px-4 py-2 text-slate-600">{item.assetName}</td>
                          <td className="px-4 py-2 text-slate-600">{item.scannedByUsername || '-'}</td>
                          <td className="px-4 py-2 text-slate-400">{formatNoSeconds(item.scannedAt, '')}</td>
                        </tr>
                    ))}
                    {activeTab === 'scanned' && (!selectedAudit?.scannedItems || selectedAudit.scannedItems.length === 0) && (
                        <tr><td className="px-4 py-6 text-center text-slate-400" colSpan={5}>Chưa quét thiết bị nào.</td></tr>
                    )}

                    {/* Bảng Đang cho mượn */}
                    {activeTab === 'lent' && selectedAudit?.lentItems?.map((item, index) => (
                        <tr key={`lent-${item.assetQaCode}-${index}`} className="hover:bg-slate-50/50">
                          <td className="px-4 py-2 text-slate-500">{index + 1}</td>
                          <td className="px-4 py-2 font-medium text-slate-700">{item.assetQaCode}</td>
                          <td className="px-4 py-2 text-slate-600">{item.assetName}</td>
                          <td className="px-4 py-2 text-slate-600">{item.toLocationName || '-'}</td>
                          <td className="px-4 py-2 text-slate-600">{item.borrowerName || '-'}</td>
                          <td className="px-4 py-2 text-slate-600">{formatNoSeconds(item.borrowedAt, 'Chưa xác định')}</td>
                        </tr>
                    ))}
                    {activeTab === 'lent' && (!selectedAudit?.lentItems || selectedAudit.lentItems.length === 0) && (
                        <tr><td className="px-4 py-6 text-center text-slate-400" colSpan={6}>Không có thiết bị nào đang cho mượn.</td></tr>
                    )}

                    {/* Bảng Đang mượn */}
                    {activeTab === 'borrowed' && selectedAudit?.borrowedItems?.map((item, index) => (
                        <tr key={`borrow-${item.assetQaCode}-${index}`} className="hover:bg-slate-50/50">
                          <td className="px-4 py-2 text-slate-500">{index + 1}</td>
                          <td className="px-4 py-2 font-medium text-slate-700">{item.assetQaCode}</td>
                          <td className="px-4 py-2 text-slate-600">{item.assetName}</td>
                          <td className="px-4 py-2 text-slate-600">{item.homeLocationName || '-'}</td>
                          <td className="px-4 py-2 text-slate-600">{item.currentLocationName || '-'}</td>
                          <td className="px-4 py-2 text-slate-600">{item.borrowerName || '-'}</td>
                          <td className="px-4 py-2 text-slate-600">{formatNoSeconds(item.borrowedAt, 'Chưa xác định')}</td>
                        </tr>
                    ))}
                    {activeTab === 'borrowed' && (!selectedAudit?.borrowedItems || selectedAudit.borrowedItems.length === 0) && (
                        <tr><td className="px-4 py-6 text-center text-slate-400" colSpan={7}>Không có thiết bị nào đang mượn.</td></tr>
                    )}

                    {/* Bảng Thất lạc */}
                    {activeTab === 'missing' && selectedAudit?.missingItems?.map((item, index) => (
                        <tr key={`miss-${item.assetQaCode}-${index}`} className="hover:bg-slate-50/50">
                          <td className="px-4 py-2 text-slate-500">{index + 1}</td>
                          <td className="px-4 py-2 font-medium text-slate-700">{item.assetQaCode}</td>
                          <td className="px-4 py-2 text-slate-600">{item.assetName}</td>
                          <td className="px-4 py-2">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                                item.resolutionStatus === 'PENDING' ? 'bg-amber-50 text-amber-700' : item.resolutionStatus === 'FOUND' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {item.resolutionStatus === 'PENDING' ? 'Chưa xử lý' : item.resolutionStatus === 'FOUND' ? 'Tìm thấy' : 'Mất hẳn'}
                            </span>
                            {item.resolvedByUsername && <p className="text-[10px] text-slate-400 mt-0.5">Bởi: {item.resolvedByUsername}</p>}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {item.resolutionStatus === 'PENDING' ? (
                                <div className="flex gap-1.5 justify-end">
                                  <button type="button" onClick={() => handleResolveFound(item.assetQaCode)} className="rounded bg-emerald-50 border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">Thấy</button>
                                  <button type="button" onClick={() => handleResolveLost(item.assetQaCode)} className="rounded bg-red-50 border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100">Mất</button>
                                </div>
                            ) : <span className="text-xs text-slate-400">-</span>}
                          </td>
                        </tr>
                    ))}
                    {activeTab === 'missing' && (!selectedAudit?.missingItems || selectedAudit.missingItems.length === 0) && (
                        <tr><td className="px-4 py-6 text-center text-slate-400" colSpan={5}>Không có thiết bị thất lạc.</td></tr>
                    )}
                    </tbody>
                  </table>
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