import { IconClipboardList as ClipboardList, IconRefresh as RefreshCcw } from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import axiosClient from '../../api/axiosClient'
import { formatVietnamDateTime } from '../../utils/datetime'

const STATUS_MAP = {
  OPEN: 'ĐANG MỞ',
  COMPLETED: 'ĐÃ HOÀN THÀNH',
}

function getAuditStatusMeta(audit) {
  const requiredScanCount = Number(audit.requiredScanCount ?? audit.expectedCount ?? 0)
  const scannedCount = Number(audit.scannedCount ?? 0)
  if (audit.status === 'COMPLETED') {
    return { label: STATUS_MAP.COMPLETED, className: 'bg-emerald-100 text-emerald-700' }
  }
  if (scannedCount >= requiredScanCount) {
    return { label: 'ĐỦ ĐIỀU KIỆN HOÀN TẤT', className: 'bg-blue-100 text-blue-700' }
  }
  return { label: STATUS_MAP[audit.status] || audit.status || 'Đang theo dõi', className: 'bg-amber-100 text-amber-700' }
}

function TechSupportInventoryAuditHistory() {
  const [auditHistory, setAuditHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalState, setModalState] = useState({
    open: false,
    title: '',
    items: [],
    loading: false,
  })

  const loadAuditHistory = async () => {
    setLoading(true)
    try {
      const response = await axiosClient.get('/api/inventory-audits/history/me')
      setAuditHistory(response.data || [])
    } catch (error) {
      const message = error?.response?.data?.message || 'Không tải được lịch sử kiểm kê của bạn.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAuditHistory()
  }, [])

  const completedCount = useMemo(
      () => auditHistory.filter((audit) => audit.status === 'COMPLETED').length,
      [auditHistory],
  )

  const totalMissingCount = useMemo(
      () => auditHistory.reduce((sum, audit) => sum + Number(audit.missingCount || 0), 0),
      [auditHistory],
  )

  const openItemsModal = async (auditId, type) => {
    setModalState({
      open: true,
      title: type === 'borrowed' ? 'Danh sách thiết bị đang cho mượn' : 'Danh sách thiết bị cần quét',
      items: [],
      loading: true,
    })
    try {
      const response = await axiosClient.get(`/api/inventory-audits/${auditId}`)
      const detail = response.data || {}
      setModalState({
        open: true,
        title: type === 'borrowed' ? 'Danh sách thiết bị đang cho mượn' : 'Danh sách thiết bị cần quét',
        items: type === 'borrowed' ? (detail.borrowedItems || []) : (detail.requiredScanItems || []),
        loading: false,
      })
    } catch (error) {
      const message = error?.response?.data?.message || 'Không tải được danh sách thiết bị của phiên kiểm kê.'
      toast.error(message)
      setModalState({
        open: false,
        title: '',
        items: [],
        loading: false,
      })
    }
  }

  const closeModal = () => {
    setModalState({
      open: false,
      title: '',
      items: [],
      loading: false,
    })
  }

  return (
      <div className="space-y-4">
        <section className="rounded-3xl bg-gradient-to-br from-indigo-700 via-blue-700 to-cyan-600 p-5 text-white shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-medium text-white/80">Lịch sử thực hiện của kỹ thuật viên</p>
              <h2 className="mt-1 text-2xl font-bold">Lịch sử kiểm kê</h2>
              <p className="mt-2 text-sm text-white/90">
                Theo dõi các phiên kiểm kê bạn đã tham gia, số lượng đã quét và kết quả thất lạc của từng đợt.
              </p>
            </div>
            <button
                type="button"
                onClick={loadAuditHistory}
                className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-white/15 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              <RefreshCcw size={16} />
              Tải lại lịch sử
            </button>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Tổng phiên đã tham gia</p>
            <p className="mt-2 text-2xl font-bold text-slate-800">{auditHistory.length}</p>
            <p className="mt-1 text-xs text-slate-500">Bao gồm cả phiên đang mở và đã hoàn tất.</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Phiên đã hoàn tất</p>
            <p className="mt-2 text-2xl font-bold text-slate-800">{completedCount}</p>
            <p className="mt-1 text-xs text-slate-500">Các phiên đã được chốt kết quả kiểm kê.</p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Tổng số thất lạc</p>
            <p className="mt-2 text-2xl font-bold text-slate-800">{totalMissingCount}</p>
            <p className="mt-1 text-xs text-slate-500">Tổng hợp từ các phiên bạn đã tham gia.</p>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Danh sách phiên kiểm kê</h3>
              <p className="mt-1 text-sm text-slate-500">Xem nhanh phòng kiểm kê, thời điểm thực hiện và kết quả từng phiên.</p>
            </div>
            <ClipboardList className="text-blue-600" size={20} />
          </div>

          <div className="space-y-3">
            {loading && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                  Đang tải lịch sử kiểm kê...
                </div>
            )}

            {!loading && auditHistory.map((audit) => {
              const statusMeta = getAuditStatusMeta(audit)
              const requiredScanCount = Number(audit.requiredScanCount ?? audit.expectedCount ?? 0)

              return (
                  <div key={audit.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">Phiên #{audit.id}</p>
                        <p className="mt-1 text-sm text-slate-600">{audit.locationName || 'Không rõ phòng kiểm kê'}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusMeta.className}`}>
                    {statusMeta.label}
                  </span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                      <div className="rounded-xl bg-white px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Bắt đầu</p>
                        <p className="mt-1 text-sm text-slate-700">{formatVietnamDateTime(audit.startedAt, '')}</p>
                      </div>
                      <div className="rounded-xl bg-white px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Hoàn thành</p>
                        <p className="mt-1 text-sm text-slate-700">{formatVietnamDateTime(audit.completedAt, '')}</p>
                      </div>
                      <div className="rounded-xl bg-white px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Hạn hoàn tất</p>
                        <p className="mt-1 text-sm text-slate-700">{formatVietnamDateTime(audit.dueDate, 'Chưa đặt hạn')}</p>
                      </div>

                      <div className="rounded-xl bg-white px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Thiết bị cần quét</p>
                        <p className="mt-1 text-sm font-semibold text-slate-800">{requiredScanCount}</p>
                        <button
                            type="button"
                            onClick={() => openItemsModal(audit.id, 'required')}
                            className="mt-2 text-xs font-semibold text-blue-700 hover:underline"
                        >
                          Xem danh sách
                        </button>
                      </div>
                      <div className="rounded-xl bg-white px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Thiết bị đã quét</p>
                        <p className="mt-1 text-sm font-semibold text-slate-800">{audit.scannedCount ?? 0} / {requiredScanCount}</p>
                      </div>
                      <div className="rounded-xl bg-white px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Thất lạc</p>
                        <p className="mt-1 text-sm font-semibold text-slate-800">{audit.missingCount ?? 0}</p>
                      </div>
                    </div>
                  </div>
              )
            })}

            {!loading && auditHistory.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                  Bạn chưa tham gia phiên kiểm kê nào.
                </div>
            )}
          </div>
        </section>

        {modalState.open && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4">
              <div className="w-full max-w-4xl rounded-2xl bg-white p-5 shadow-2xl">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{modalState.title}</h3>
                    <p className="text-sm text-slate-500">Xem danh sách thiết bị và phòng hiện tại của từng thiết bị.</p>
                  </div>
                  <button
                      type="button"
                      onClick={closeModal}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Đóng
                  </button>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Mã QA</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Tên thiết bị</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Phòng hiện tại</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Phòng gốc</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                    {modalState.loading && (
                        <tr>
                          <td colSpan={4} className="px-3 py-4 text-center text-slate-500">
                            Đang tải danh sách thiết bị...
                          </td>
                        </tr>
                    )}
                    {!modalState.loading && modalState.items.map((item) => (
                        <tr key={`${item.assetQaCode}-${item.currentLocationName}-${item.homeLocationName}`}>
                          <td className="px-3 py-2">{item.assetQaCode}</td>
                          <td className="px-3 py-2">{item.assetName}</td>
                          <td className="px-3 py-2">{item.currentLocationName || 'Không xác định'}</td>
                          <td className="px-3 py-2">{item.homeLocationName || 'Không xác định'}</td>
                        </tr>
                    ))}
                    {!modalState.loading && modalState.items.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-3 py-4 text-center text-slate-500">
                            Không có thiết bị nào trong danh sách này.
                          </td>
                        </tr>
                    )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
        )}
      </div>
  )
}

export default TechSupportInventoryAuditHistory