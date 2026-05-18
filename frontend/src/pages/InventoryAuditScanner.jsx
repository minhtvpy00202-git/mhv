import { Camera, ClipboardCheck, RefreshCcw, ScanLine } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'
import { useAuth } from '../context/AuthContext'
import { formatVietnamDateTime } from '../utils/datetime'

const scannerElementId = 'inventory-audit-scanner'

function extractQaCode(decodedText) {
  try {
    const parsed = JSON.parse(decodedText)
    if (parsed?.qa_code) {
      return String(parsed.qa_code).trim()
    }
  } catch {
    return decodedText.trim()
  }
  return decodedText.trim()
}

function InventoryAuditScanner() {
  const { user } = useAuth()
  const scannerRef = useRef(null)
  const isScanningRef = useRef(false)
  const isSubmittingRef = useRef(false)
  const selectedAuditIdRef = useRef('')
  const [activeAudits, setActiveAudits] = useState([])
  const [selectedAuditId, setSelectedAuditId] = useState('')
  const [scannedCount, setScannedCount] = useState(0)
  const [expectedCount, setExpectedCount] = useState(0)
  const [recentScans, setRecentScans] = useState([])
  const [manualQaCode, setManualQaCode] = useState('')
  const [loadingAudits, setLoadingAudits] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [completing, setCompleting] = useState(false)

  const loadActiveAudits = async () => {
    setLoadingAudits(true)
    try {
      const response = await axiosClient.get('/api/inventory-audits/active')
      const data = response.data || []
      setActiveAudits(data)
      if (data.length === 0) {
        setSelectedAuditId('')
        setRecentScans([])
        setScannedCount(0)
        setExpectedCount(0)
        return
      }
      const hasSelectedAudit = data.some((audit) => String(audit.id) === String(selectedAuditIdRef.current))
      if (hasSelectedAudit) {
        setSelectedAuditId(String(selectedAuditIdRef.current))
      } else {
        setSelectedAuditId(String(data[0].id))
      }
    } catch (error) {
      const message = error?.response?.data?.message || 'Không tải được phiên kiểm kê đang mở.'
      toast.error(message)
    } finally {
      setLoadingAudits(false)
    }
  }

  useEffect(() => {
    loadActiveAudits()
    startScanner()
    return () => {
      stopScanner()
    }
  }, [])

  useEffect(() => {
    selectedAuditIdRef.current = selectedAuditId
  }, [selectedAuditId])

  useEffect(() => {
    const loadAuditDetail = async () => {
      if (!selectedAuditId) {
        setRecentScans([])
        setScannedCount(0)
        setExpectedCount(0)
        return
      }
      setLoadingDetail(true)
      try {
        const response = await axiosClient.get(`/api/inventory-audits/${selectedAuditId}`)
        const detail = response.data
        setRecentScans(detail?.scannedItems || [])
        setScannedCount(detail?.summary?.scannedCount || 0)
        setExpectedCount(detail?.summary?.expectedCount || 0)
      } catch {
        setRecentScans([])
      } finally {
        setLoadingDetail(false)
      }
    }
    loadAuditDetail()
  }, [selectedAuditId])

  const selectedAudit = useMemo(
    () => activeAudits.find((audit) => String(audit.id) === String(selectedAuditId)) || null,
    [activeAudits, selectedAuditId],
  )

  const progressPercent = expectedCount > 0 ? Math.min(100, Math.round((scannedCount / expectedCount) * 100)) : 0

  const resetSelectedAuditState = () => {
    setManualQaCode('')
    setRecentScans([])
    setScannedCount(0)
    setExpectedCount(0)
  }

  const handleScanSubmit = async (qaCodeInput) => {
    const currentAuditId = selectedAuditIdRef.current
    const qaCode = String(qaCodeInput || '').trim()
    if (!currentAuditId || !qaCode || isSubmittingRef.current) return

    isSubmittingRef.current = true
    try {
      const response = await axiosClient.post(`/api/inventory-audits/${currentAuditId}/scan`, {
        assetQaCode: qaCode,
      })
      const data = response.data
      setScannedCount(data.scannedCount || 0)
      setExpectedCount(data.expectedCount || 0)
      setRecentScans((prev) => [
        {
          assetQaCode: data.assetQaCode,
          assetName: data.assetName,
          currentLocationName: data.currentLocationName,
          homeLocationName: data.homeLocationName,
          scannedByUsername: user?.fullName || user?.username || 'Bạn',
          scannedAt: new Date().toISOString(),
        },
        ...prev,
      ])
      setManualQaCode('')
      toast.success(`Đã quét: ${data.assetName} (${data.assetQaCode})`)
    } catch (error) {
      const message = error?.response?.data?.message || 'Quét kiểm kê thất bại.'
      toast.error(message)
    } finally {
      setTimeout(() => {
        isSubmittingRef.current = false
      }, 500)
    }
  }

  const startScanner = async () => {
    if (isScanningRef.current) return
    const scanner = new Html5Qrcode(scannerElementId)
    scannerRef.current = scanner
    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decodedText) => {
          const qaCode = extractQaCode(decodedText)
          if (!qaCode) return
          await handleScanSubmit(qaCode)
        },
        () => {},
      )
      isScanningRef.current = true
    } catch {
      toast.error('Không thể mở camera. Vui lòng cấp quyền truy cập camera.')
    }
  }

  const stopScanner = async () => {
    const scanner = scannerRef.current
    if (!scanner) return
    try {
      if (isScanningRef.current) {
        await scanner.stop()
      }
      await scanner.clear()
    } catch {
      return
    } finally {
      isScanningRef.current = false
      scannerRef.current = null
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-600 p-5 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-white/80">Khu vực kỹ thuật viên hỗ trợ</p>
            <h2 className="mt-1 text-2xl font-bold">Thực hiện kiểm kê thiết bị theo phiên do admin khởi tạo</h2>
            <p className="mt-2 text-sm text-white/90">
              Chọn một phiên đang mở, quét QR hoặc nhập mã QA để cập nhật số lượng thực tế ngay tại hiện trường.
            </p>
          </div>
          <button
            type="button"
            onClick={loadActiveAudits}
            className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-white/15 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
          >
            <RefreshCcw size={16} />
            Tải lại phiên mở
          </button>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Phiên đang mở</p>
          <p className="mt-2 text-2xl font-bold text-slate-800">{activeAudits.length}</p>
          <p className="mt-1 text-xs text-slate-500">Các phiên kiểm kê mà techsupport có thể tiếp nhận.</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Đã quét</p>
          <p className="mt-2 text-2xl font-bold text-slate-800">{scannedCount}</p>
          <p className="mt-1 text-xs text-slate-500">Số thiết bị đã xác nhận trong phiên hiện tại.</p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Tiến độ</p>
          <p className="mt-2 text-2xl font-bold text-slate-800">{progressPercent}%</p>
          <p className="mt-1 text-xs text-slate-500">Dựa trên {expectedCount || 0} thiết bị dự kiến của phòng.</p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Chọn phiên kiểm kê</h3>
                <p className="mt-1 text-sm text-slate-500">Ưu tiên chọn đúng phòng trước khi bắt đầu quét hàng loạt.</p>
              </div>
              {selectedAudit && (
                <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  Phiên #{selectedAudit.id} - {selectedAudit.locationName}
                </div>
              )}
            </div>

            <select
              value={selectedAuditId}
              onChange={(e) => {
                setSelectedAuditId(e.target.value)
                resetSelectedAuditState()
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none ring-blue-500 focus:ring-2"
            >
              <option value="">Chọn phiên kiểm kê đang mở</option>
              {activeAudits.map((audit) => (
                <option key={audit.id} value={audit.id}>
                  #{audit.id} - Phòng {audit.locationName}
                </option>
              ))}
            </select>

            {loadingAudits && <p className="mt-3 text-sm text-slate-500">Đang tải danh sách phiên kiểm kê...</p>}

            {!loadingAudits && activeAudits.length === 0 && (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                Hiện chưa có phiên kiểm kê nào đang mở. Admin cần tạo phiên trước khi techsupport bắt đầu kiểm kê.
              </div>
            )}

            {activeAudits.length > 0 && (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {activeAudits.map((audit) => {
                  const isActive = String(audit.id) === String(selectedAuditId)
                  return (
                    <button
                      key={audit.id}
                      type="button"
                      onClick={() => {
                        setSelectedAuditId(String(audit.id))
                        resetSelectedAuditState()
                      }}
                      className={`rounded-2xl border p-4 text-left transition ${
                        isActive
                          ? 'border-blue-400 bg-blue-50 shadow-sm'
                          : 'border-slate-200 bg-slate-50 hover:border-blue-200 hover:bg-blue-50/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">Phiên #{audit.id}</p>
                          <p className="mt-1 text-sm text-slate-600">{audit.locationName}</p>
                        </div>
                        <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-blue-700">
                          {audit.status}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                        <p>Dự kiến: {audit.expectedCount || 0}</p>
                        <p>Đã quét: {audit.scannedCount || 0}</p>
                        <p>Người tạo: {audit.createdByUsername || '-'}</p>
                        <p>Bắt đầu: {formatVietnamDateTime(audit.startedAt, '')}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Quét kiểm kê</h3>
                <p className="mt-1 text-sm text-slate-500">Camera dùng để đọc QR thiết bị, có kèm ô nhập tay khi cần.</p>
              </div>
              <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                {selectedAuditId ? 'Sẵn sàng quét' : 'Chưa chọn phiên'}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div>
                <div id={scannerElementId} className="min-h-[280px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50" />
                <div className="mt-3 flex items-start gap-2 rounded-2xl border border-blue-100 bg-blue-50 px-3 py-3 text-sm text-blue-900">
                  <Camera size={18} className="mt-0.5 shrink-0" />
                  <p>Cho phép truy cập camera để quét liên tục. Nếu camera không hoạt động, nhập mã QA bên cạnh để vẫn hoàn thành kiểm kê.</p>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Nhập mã QA thủ công</p>
                  <p className="mt-1 text-xs text-slate-500">Hữu ích khi tem mờ hoặc camera khó lấy nét.</p>
                </div>
                <input
                  value={manualQaCode}
                  onChange={(event) => setManualQaCode(event.target.value)}
                  placeholder="Ví dụ: PC0001"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none ring-blue-500 focus:ring-2"
                />
                <button
                  type="button"
                  disabled={!selectedAuditId || !manualQaCode.trim()}
                  onClick={() => handleScanSubmit(manualQaCode)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-3 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ScanLine size={16} />
                  Ghi nhận mã QA
                </button>
                <div className="rounded-2xl bg-white p-3 text-sm text-slate-600">
                  <p className="font-semibold text-slate-800">Trạng thái phiên</p>
                  <p className="mt-2">Phòng: {selectedAudit?.locationName || 'Chưa chọn'}</p>
                  <p className="mt-1">Đã quét: {scannedCount} / {expectedCount || 0}</p>
                </div>
                <button
                  type="button"
                  disabled={!selectedAuditId || completing}
                  onClick={async () => {
                    if (!selectedAuditId) return
                    setCompleting(true)
                    try {
                      await axiosClient.post(`/api/inventory-audits/${selectedAuditId}/complete`)
                      toast.success('Hoàn thành kiểm kê thành công. Admin có thể xem biên bản để xử lý tiếp.')
                      resetSelectedAuditState()
                      await loadActiveAudits()
                    } catch (error) {
                      const message = error?.response?.data?.message || 'Không thể hoàn thành kiểm kê.'
                      toast.error(message)
                    } finally {
                      setCompleting(false)
                    }
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-fptOrange px-3 py-2.5 text-sm font-semibold text-white hover:bg-fptOrangeDark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ClipboardCheck size={16} />
                  {completing ? 'Đang hoàn tất...' : 'Hoàn thành kiểm kê'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <aside className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Thiết bị đã quét</h3>
              <p className="mt-1 text-sm text-slate-500">Danh sách mới nhất trong phiên đang chọn.</p>
            </div>
            {loadingDetail && <span className="text-xs font-medium text-slate-500">Đang tải...</span>}
          </div>

          <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progressPercent}%` }} />
          </div>

          <div className="max-h-[640px] space-y-3 overflow-auto pr-1">
            {recentScans.map((item, index) => (
              <div key={`${item.assetQaCode}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-800">
                  {item.assetQaCode} - {item.assetName}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Phòng hiện tại: {item.currentLocationName || 'Không xác định'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Phòng gốc: {item.homeLocationName || 'Không xác định'}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {item.scannedByUsername || 'Không rõ người quét'} • {formatVietnamDateTime(item.scannedAt, '')}
                </p>
              </div>
            ))}
            {!loadingDetail && recentScans.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                {selectedAuditId
                  ? 'Chưa có thiết bị nào được quét trong phiên này.'
                  : 'Chọn một phiên kiểm kê để bắt đầu quét thiết bị.'}
              </div>
            )}
          </div>
        </aside>
      </section>
    </div>
  )
}

export default InventoryAuditScanner
