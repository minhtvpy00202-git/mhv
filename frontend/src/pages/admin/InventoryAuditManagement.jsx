import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import axiosClient from '../../api/axiosClient'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { formatVietnamDateTime, toDateTimeLocalValue } from '../../utils/datetime'

const PAGE_SIZE = 10
const getNowDateTime = () => new Date()

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

function InventoryAuditManagement() {
  const [locations, setLocations] = useState([])
  const [audits, setAudits] = useState([])
  const [selectedAudit, setSelectedAudit] = useState(null)
  const [confirmDialog, setConfirmDialog] = useState(createDefaultConfirmDialog)

  // Trạng thái hiển thị các modal chi tiết
  const [openScannedModal, setOpenScannedModal] = useState(false)
  const [openBorrowedModal, setOpenBorrowedModal] = useState(false)
  const [openMissingModal, setOpenMissingModal] = useState(false)

  const [form, setForm] = useState({
    locationId: '',
    startedAt: getNowDateTime(),
    dueDate: null,
    notes: ''
  })
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [pageInfo, setPageInfo] = useState(defaultPageInfo)

  const sortedAudits = useMemo(() => [...audits], [audits])

  // Đồng hồ chạy thời gian thực
  useEffect(() => {
    const timer = setInterval(() => {
      setForm((prev) => ({ ...prev, startedAt: getNowDateTime() }))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const formatDateTimeNoSeconds = (date) => {
    if (!date) return ''
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${hours}:${minutes} ${day}/${month}/${year}`
  }

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
    if (!form.dueDate) {
      toast.error('Vui lòng nhập hạn hoàn tất kiểm kê.')
      return
    }
    setCreating(true)
    try {
      const response = await axiosClient.post('/api/inventory-audits', {
        locationId: Number(form.locationId),
        startedAt: toDateTimeLocalValue(form.startedAt),
        dueDate: form.dueDate ? toDateTimeLocalValue(form.dueDate) : null,
        notes: form.notes,
      })
      toast.success('Tạo phiên kiểm kê thành công.')
      setForm({
        locationId: '',
        startedAt: getNowDateTime(),
        dueDate: null,
        notes: ''
      })
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

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="flex flex-col justify-end">
              <select
                  value={form.locationId}
                  onChange={(e) => setForm((prev) => ({ ...prev, locationId: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2 h-[42px]"
              >
                <option value="">Chọn phòng kiểm kê</option>
                {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.roomName}
                    </option>
                ))}
              </select>
            </div>

            <div className="relative flex flex-col justify-end rounded-lg border border-slate-200 bg-slate-50 px-3 pt-4 pb-1.5 text-sm text-slate-500 h-[42px]">
            <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 absolute top-1 left-3">
              Thời gian bắt đầu
            </span>
              <span className="font-medium text-slate-700 leading-none">
              {formatDateTimeNoSeconds(form.startedAt)}
            </span>
            </div>

            <div className="relative flex flex-col justify-end h-[42px]">
            <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 absolute top-1 left-3 z-10">
              Hạn hoàn tất
            </span>
              <DatePicker
                  selected={form.dueDate}
                  onChange={(date) => setForm((prev) => ({ ...prev, dueDate: date }))}
                  showTimeSelect
                  timeFormat="HH:mm"
                  timeIntervals={15}
                  dateFormat="dd/MM/yyyy HH:mm"
                  className="w-full rounded-lg border border-slate-300 pl-3 pr-2 pt-4 pb-1 text-sm outline-none ring-fptOrange focus:ring-2 h-[42px]"
                  placeholderText="Chọn hạn hoàn tất"
                  isClearable
              />
            </div>

            <div className="flex flex-col justify-end lg:col-span-2">
              <input
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2 h-[42px]"
                  placeholder="Ghi chú phiên kiểm kê"
              />
            </div>
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
            <p className="text-sm text-slate-500">Tổng: {pageInfo.totalItems}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-max divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
              <tr>
                <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600">Mã phiên</th>
                <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600">Phòng</th>
                <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600">Trạng thái</th>
                <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600">Bắt đầu</th>
                <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600">Hạn hoàn tất</th>
                <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600">Kết thúc</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-slate-600">Chi tiết</th>
              </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
              {loading &&
                  Array.from({ length: 6 }).map((_, index) => (
                      <tr key={`audit-loading-${index}`} className="animate-pulse">
                        <td className="px-3 py-2" colSpan={7}>
                          <div className="h-4 w-full rounded bg-slate-200" />
                        </td>
                      </tr>
                  ))}
              {!loading &&
                  sortedAudits.map((audit) => (
                      <tr key={audit.id}>
                        <td className="px-3 py-2">#{audit.id}</td>
                        <td className="px-3 py-2">{audit.locationName}</td>
                        <td className="px-3 py-2">{STATUS_MAP[audit.status] || audit.status}</td>
                        <td className="px-3 py-2">{formatVietnamDateTime(audit.startedAt, '')}</td>
                        <td className="px-3 py-2">{formatVietnamDateTime(audit.dueDate, '')}</td>
                        <td className="px-3 py-2">{formatVietnamDateTime(audit.completedAt, '')}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                              type="button"
                              onClick={() => loadAuditDetail(audit.id)}
                              className="rounded border border-blue-300 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                          >
                            Xem
                          </button>
                        </td>
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
                      <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Tổng thiết bị gốc</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Dự kiến (Cần quét)</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Đã quét</th>
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

                      {/* CỘT ĐÃ QUÉT */}
                      <td className="px-4 py-2.5 text-emerald-600 font-medium">
                        <div className="flex items-center gap-3">
                          <span>{selectedAudit.summary.scannedCount || 0}</span>
                          <div className="relative group inline-block">
                            <button
                                type="button"
                                onClick={() => setOpenScannedModal(true)}
                                className="flex items-center justify-center w-6 h-6 rounded-md border border-amber-300 bg-white shadow-sm transition-all hover:bg-amber-50/80"
                            >
                              <svg className="w-3.5 h-3.5 text-amber-700" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
                            </button>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-[11px] font-medium text-white shadow-md opacity-0 pointer-events-none transition-all duration-200 group-hover:opacity-100 group-hover:pointer-events-auto z-20">
                              Xem chi tiết
                              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* CỘT ĐANG MƯỢN */}
                      <td className="px-4 py-2.5 text-amber-600 font-medium">
                        <div className="flex items-center gap-3">
                          <span>{selectedAudit.summary.borrowedCount || 0}</span>
                          <div className="relative group inline-block">
                            <button
                                type="button"
                                onClick={() => setOpenBorrowedModal(true)}
                                className="flex items-center justify-center w-6 h-6 rounded-md border border-amber-300 bg-white shadow-sm transition-all hover:bg-amber-50/80"
                            >
                              <svg className="w-3.5 h-3.5 text-amber-700" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
                            </button>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-[11px] font-medium text-white shadow-md opacity-0 pointer-events-none transition-all duration-200 group-hover:opacity-100 group-hover:pointer-events-auto z-20">
                              Xem chi tiết
                              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* CỘT THẤT LẠC */}
                      <td className="px-4 py-2.5 text-red-600 font-medium">
                        <div className="flex items-center gap-3">
                          <span>{selectedAudit.summary.missingCount || 0}</span>
                          <div className="relative group inline-block">
                            <button
                                type="button"
                                onClick={() => setOpenMissingModal(true)}
                                className="flex items-center justify-center w-6 h-6 rounded-md border border-amber-300 bg-white shadow-sm transition-all hover:bg-amber-50/80"
                            >
                              <svg className="w-3.5 h-3.5 text-amber-700" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
                            </button>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-[11px] font-medium text-white shadow-md opacity-0 pointer-events-none transition-all duration-200 group-hover:opacity-100 group-hover:pointer-events-auto z-20">
                              Xem chi tiết
                              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
                            </div>
                          </div>
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

        {/* MODAL CHI TIẾT THIẾT BỊ ĐÃ QUÉT */}
        {openScannedModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
              <div className="w-full max-w-3xl rounded-xl bg-white shadow-xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-slate-100 p-4">
                  <h3 className="text-base font-semibold text-slate-800">Danh sách thiết bị đã quét</h3>
                  <button type="button" onClick={() => setOpenScannedModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
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
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Người quét</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Thời gian</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                    {selectedAudit?.scannedItems?.map((item, index) => (
                        <tr key={`${item.assetQaCode}-${item.scannedAt}`} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                          <td className="px-3 py-2 font-medium text-slate-700">{item.assetQaCode}</td>
                          <td className="px-3 py-2 text-slate-600">{item.assetName}</td>
                          <td className="px-3 py-2 text-slate-500">{item.scannedByUsername}</td>
                          <td className="px-3 py-2 text-xs text-slate-400">{formatVietnamDateTime(item.scannedAt, '')}</td>
                        </tr>
                    ))}
                    {(selectedAudit?.scannedItems?.length || 0) === 0 && (
                        <tr><td className="px-3 py-6 text-center text-slate-400" colSpan={5}>Chưa quét thiết bị nào.</td></tr>
                    )}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end border-t border-slate-100 p-3 bg-slate-50 rounded-b-xl">
                  <button type="button" onClick={() => setOpenScannedModal(false)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Đóng</button>
                </div>
              </div>
            </div>
        )}

        {/* MODAL CHI TIẾT THIẾT BỊ ĐANG MƯỢN */}
        {openBorrowedModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
              <div className="w-full max-w-4xl rounded-xl bg-white shadow-xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-slate-100 p-4">
                  <h3 className="text-base font-semibold text-slate-800">Danh sách thiết bị đang mượn</h3>
                  <button type="button" onClick={() => setOpenBorrowedModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
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
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Vị trí hiện tại</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Người mượn</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Hạn trả thực tế</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                    {selectedAudit?.borrowedItems?.map((item, index) => (
                        <tr key={item.assetQaCode} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                          <td className="px-3 py-2 font-medium text-slate-700">{item.assetQaCode}</td>
                          <td className="px-3 py-2 text-slate-600">{item.assetName}</td>
                          {/* Thêm cột vị trí hiện tại của thiết bị (lấy từ item.locationName hoặc item.currentLocation tùy thuộc API của bạn) */}
                          <td className="px-3 py-2 text-slate-600 font-medium">{item.locationName || item.currentLocation || 'N/A'}</td>
                          <td className="px-3 py-2 text-slate-500">{item.borrowerName || 'N/A'}</td>
                          <td className="px-3 py-2 text-xs text-slate-400">{formatVietnamDateTime(item.dueDate, 'Chưa xác định')}</td>
                        </tr>
                    ))}
                    {(selectedAudit?.borrowedItems?.length || 0) === 0 && (
                        <tr><td className="px-3 py-6 text-center text-slate-400" colSpan={6}>Không có thiết bị nào đang mượn.</td></tr>
                    )}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end border-t border-slate-100 p-3 bg-slate-50 rounded-b-xl">
                  <button type="button" onClick={() => setOpenBorrowedModal(false)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Đóng</button>
                </div>
              </div>
            </div>
        )}

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