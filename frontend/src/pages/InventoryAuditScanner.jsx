import {
  IconCamera as Camera,
  IconClipboardCheck as ClipboardCheck,
  IconRefresh as RefreshCcw,
  IconScan as ScanLine,
} from '@tabler/icons-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'
import { useAuth } from '../context/AuthContext'
import { formatVietnamDateTime } from '../utils/datetime'

const MOBILE_SCANNER_ELEMENT_ID = 'inventory-audit-scanner-mobile'
const DESKTOP_SCANNER_ELEMENT_ID = 'inventory-audit-scanner-desktop'
const RECENT_SCANS_PAGE_SIZE = 8
const MOBILE_AUDIT_PANELS = [
  { id: 'sessions', label: 'Phiên mở' },
  { id: 'scanned', label: 'Đã quét' },
  { id: 'progress', label: 'Tiến độ' },
]

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
  const [selectedAuditDetail, setSelectedAuditDetail] = useState(null)
  const [scannedCount, setScannedCount] = useState(0)
  const [recentScans, setRecentScans] = useState([])
  const [manualQaCode, setManualQaCode] = useState('')
  const [loadingAudits, setLoadingAudits] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [recentScansPage, setRecentScansPage] = useState(1)
  const [mobilePanel, setMobilePanel] = useState('sessions')
  const [isDesktopViewport, setIsDesktopViewport] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true,
  )
  const [cameraState, setCameraState] = useState({
    status: 'idle',
    message: 'Chọn một phiên đang mở để bắt đầu quét QR.',
  })

  // --- STATE QUẢN LÝ TAB CHI TIẾT ---
  const [activeTab, setActiveTab] = useState('scanned')
  const scannerElementId = isDesktopViewport ? DESKTOP_SCANNER_ELEMENT_ID : MOBILE_SCANNER_ELEMENT_ID

  const loadActiveAudits = async () => {
    setLoadingAudits(true)
    try {
      const response = await axiosClient.get('/api/inventory-audits/active')
      const allData = response.data || []

      const currentTime = new Date().getTime();
      const data = allData.filter((audit) => {
        if (!audit.dueDate) return true;
        return new Date(audit.dueDate).getTime() > currentTime;
      });

      setActiveAudits(data)
      if (data.length === 0) {
        setSelectedAuditId('')
        setSelectedAuditDetail(null)
        setRecentScans([])
        setScannedCount(0)
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
    return () => {
      stopScanner()
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const handleResize = () => setIsDesktopViewport(window.innerWidth >= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    selectedAuditIdRef.current = selectedAuditId
  }, [selectedAuditId])

  useEffect(() => {
    const loadAuditDetail = async () => {
      if (!selectedAuditId) {
        setSelectedAuditDetail(null)
        setRecentScans([])
        setScannedCount(0)
        return
      }
      setLoadingDetail(true)
      try {
        const response = await axiosClient.get(`/api/inventory-audits/${selectedAuditId}`)
        const detail = response.data
        setSelectedAuditDetail(detail || null)
        setRecentScans(detail?.scannedItems || [])
        setScannedCount(detail?.summary?.scannedCount || 0)
        setActiveTab('scanned')
      } catch {
        setSelectedAuditDetail(null)
        setRecentScans([])
        setScannedCount(0)
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
  const selectedSummary = selectedAuditDetail?.summary || selectedAudit || null
  const expectedCount = Number(selectedSummary?.expectedCount ?? 0)
  const totalRecentScanPages = Math.max(1, Math.ceil(recentScans.length / RECENT_SCANS_PAGE_SIZE))
  const paginatedRecentScans = useMemo(() => {
    const start = (recentScansPage - 1) * RECENT_SCANS_PAGE_SIZE
    return recentScans.slice(start, start + RECENT_SCANS_PAGE_SIZE)
  }, [recentScans, recentScansPage])

  const progressPercent = expectedCount > 0
      ? Math.min(100, Math.round((scannedCount / expectedCount) * 100))
      : selectedAuditId
          ? 100
          : 0

  useEffect(() => {
    setRecentScansPage(1)
  }, [selectedAuditId, recentScans.length])

  useEffect(() => {
    setRecentScansPage((prev) => Math.min(prev, totalRecentScanPages))
  }, [totalRecentScanPages])

  const shouldShowScanner = Boolean(selectedAuditId) && mobilePanel === 'sessions'

  useEffect(() => {
    if (!shouldShowScanner) {
      stopScanner()
      if (!selectedAuditId) {
        setCameraState({
          status: 'idle',
          message: 'Chọn một phiên đang mở để bắt đầu quét QR.',
        })
      }
      return undefined
    }

    let cancelled = false
    const start = async () => {
      await stopScanner()
      if (cancelled) return
      await startScanner()
    }
    const timerId = window.setTimeout(start, 0)

    return () => {
      cancelled = true
      window.clearTimeout(timerId)
      stopScanner()
    }
  }, [shouldShowScanner, scannerElementId])

  const resetSelectedAuditState = () => {
    setManualQaCode('')
    setSelectedAuditDetail(null)
    setRecentScans([])
    setScannedCount(0)
    setActiveTab('scanned')
  }

  const completeSelectedAudit = async () => {
    if (!selectedAuditId) return
    setCompleting(true)
    try {
      await axiosClient.post(`/api/inventory-audits/${selectedAuditId}/complete`)
      toast.success('Hoàn thành kiểm kê thành công. Admin có thể xem biên bản để xử lý tiếp.')
      resetSelectedAuditState()
      await loadActiveAudits()
      setMobilePanel('sessions')
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể hoàn thành kiểm kê.'
      toast.error(message)
    } finally {
      setCompleting(false)
    }
  }

  const handleScanSubmit = async (qaCodeInput) => {
    const currentAuditId = selectedAuditIdRef.current
    const qaCode = String(qaCodeInput || '').trim()
    if (!currentAuditId || !qaCode || isSubmittingRef.current) return

    const currentAuditInfo = activeAudits.find((a) => String(a.id) === String(currentAuditId));
    if (currentAuditInfo?.dueDate && new Date(currentAuditInfo.dueDate).getTime() < new Date().getTime()) {
      toast.error('Phiên kiểm kê này đã quá hạn, hệ thống sẽ tự động đóng phiên.');
      await loadActiveAudits();
      return;
    }

    isSubmittingRef.current = true
    try {
      const response = await axiosClient.post(`/api/inventory-audits/${currentAuditId}/scan`, {
        assetQaCode: qaCode,
      })
      const data = response.data
      setScannedCount(data.scannedCount || 0)

      setSelectedAuditDetail((prev) => {
        if (!prev) return prev;
        const newScannedItem = {
          assetQaCode: data.assetQaCode,
          assetName: data.assetName,
          currentLocationName: data.currentLocationName,
          homeLocationName: data.homeLocationName,
          scannedByUsername: user?.fullName || user?.username || 'Bạn',
          scannedAt: new Date().toISOString(),
        };
        return {
          ...prev,
          summary: {
            ...prev.summary,
            scannedCount: data.scannedCount || 0,
            expectedCount: data.expectedCount || prev.summary?.expectedCount || 0,
          },
          scannedItems: [newScannedItem, ...(prev.scannedItems || [])]
        };
      });

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

  const scanStatusLabel = !selectedAuditId
      ? 'Chưa chọn phiên'
      : scannedCount >= expectedCount
          ? 'Đủ điều kiện hoàn tất'
          : 'Đang quét kiểm kê'

  const startScanner = async () => {
    if (isScanningRef.current) return
    const scannerElement = document.getElementById(scannerElementId)
    if (!scannerElement) {
      setCameraState({
        status: 'idle',
        message: 'Khung camera chưa sẵn sàng. Mở lại phần phiên đang mở để thử lại.',
      })
      return
    }
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setCameraState({
        status: 'error',
        message: 'Camera chỉ hoạt động trên HTTPS hoặc localhost.',
      })
      toast.error('Camera chỉ hoạt động trên HTTPS hoặc localhost.')
      return
    }

    setCameraState({
      status: 'requesting',
      message: 'Đang xin quyền truy cập camera...',
    })

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      stream.getTracks().forEach((track) => track.stop())
    } catch (error) {
      const permissionMessage = error?.name === 'NotAllowedError'
        ? 'Bạn chưa cấp quyền camera. Hãy cho phép camera trong trình duyệt rồi mở lại phần quét QR.'
        : error?.name === 'NotFoundError'
          ? 'Không tìm thấy camera trên thiết bị này.'
          : 'Không thể truy cập camera. Hãy kiểm tra quyền hoặc thử lại.'
      setCameraState({
        status: 'blocked',
        message: permissionMessage,
      })
      toast.error(permissionMessage)
      return
    }

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
      setCameraState({
        status: 'active',
        message: 'Camera đang sẵn sàng. Đưa mã QR vào giữa khung để quét.',
      })
    } catch (error) {
      const startMessage = error?.message || 'Không thể mở camera. Vui lòng cấp quyền truy cập camera.'
      setCameraState({
        status: 'error',
        message: startMessage,
      })
      toast.error(startMessage)
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

  const TABS = [
    { id: 'repairing', label: 'Đang sửa chữa', count: selectedSummary?.repairingCount || 0 },
    { id: 'scanned', label: 'Đã quét', count: selectedSummary?.scannedCount || 0 },
    { id: 'lent', label: 'Đang cho mượn', count: selectedSummary?.lentCount || 0 },
    { id: 'borrowed', label: 'Đang mượn', count: selectedSummary?.borrowedCount || 0 },
    { id: 'missing', label: 'Thất lạc', count: selectedSummary?.missingCount || 0 },
  ]

  return (
      <div className="space-y-4">
        {/* HEADER */}
        <section className="rounded-3xl bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-600 p-4 text-white shadow-sm md:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-medium text-white/80">Khu vực kỹ thuật viên hỗ trợ</p>
              <h2 className="mt-1 text-xl font-bold md:text-2xl">Thực hiện kiểm kê thiết bị theo phiên do admin khởi tạo</h2>
              <p className="mt-2 hidden text-sm text-white/90 md:block">
                Chọn một phiên đang mở, quét QR hoặc nhập mã QA để cập nhật số lượng thực tế ngay tại hiện trường.
              </p>
            </div>
            <button
                type="button"
                onClick={loadActiveAudits}
                className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-white/15 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              <RefreshCcw size={16} />
              <span className="hidden sm:inline">Tải lại phiên mở</span>
              <span className="sm:hidden">Tải lại</span>
            </button>
          </div>
        </section>

        <section className="md:hidden">
          <div className="grid grid-cols-3 gap-2">
            {MOBILE_AUDIT_PANELS.map((panel) => {
              const value = panel.id === 'sessions'
                ? activeAudits.length
                : panel.id === 'scanned'
                  ? scannedCount
                  : `${progressPercent}%`
              const active = mobilePanel === panel.id
              return (
                <button
                  key={panel.id}
                  type="button"
                  onClick={() => setMobilePanel(panel.id)}
                  className={`min-h-[5.75rem] rounded-2xl border px-3 py-3 text-center shadow-sm transition ${
                    active
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  <div className="flex h-full flex-col items-center justify-center">
                    <p className={`text-xs font-semibold ${active ? 'text-white/80' : 'text-slate-500'}`}>{panel.label}</p>
                    <p className="mt-1 text-xl font-bold">{value}</p>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="mt-3 rounded-3xl bg-white p-3 shadow-sm">
            {mobilePanel === 'sessions' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold text-slate-800">Phiên đang mở</h3>
                  {selectedAudit && (
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                      #{selectedAudit.id}
                    </span>
                  )}
                </div>

                {loadingAudits && (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
                    Đang tải danh sách phiên kiểm kê...
                  </div>
                )}

                {!loadingAudits && activeAudits.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
                    Hiện chưa có phiên kiểm kê nào đang mở.
                  </div>
                )}

                {!loadingAudits && activeAudits.length > 0 && (
                  <div className="space-y-2">
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
                          className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                            isActive
                              ? 'border-blue-600 bg-blue-50'
                              : 'border-slate-200 bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-800">Phiên #{audit.id}</p>
                              <p className="mt-1 text-sm text-slate-600">{audit.locationName || 'Không rõ phòng kiểm kê'}</p>
                            </div>
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                              isActive ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'
                            }`}>
                              {String(audit.status || 'OPEN').replace('_', ' ')}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}

                {selectedSummary && (
                  <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-3">
                    <p className="text-sm font-semibold text-slate-800">
                      Phiên #{selectedSummary.id} - {selectedSummary.locationName}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-xl bg-white px-3 py-2">
                        <p className="text-xs text-slate-500">Cần quét</p>
                        <p className="mt-1 font-semibold text-slate-800">{expectedCount}</p>
                      </div>
                      <div className="rounded-xl bg-white px-3 py-2">
                        <p className="text-xs text-slate-500">Đã quét</p>
                        <p className="mt-1 font-semibold text-emerald-700">{scannedCount}</p>
                      </div>
                    </div>
                  </div>
                )}

                {selectedAuditId && (
                  <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-sm font-semibold text-slate-800">Quét QR</h4>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                        {scanStatusLabel}
                      </span>
                    </div>

                    <div
                      id={MOBILE_SCANNER_ELEMENT_ID}
                      className="min-h-[240px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 [&_video]:!h-full [&_video]:!w-full [&_video]:!object-cover"
                    />

                    <div className={`rounded-2xl px-3 py-2 text-sm ${
                      cameraState.status === 'active'
                        ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                        : cameraState.status === 'requesting'
                          ? 'border border-amber-200 bg-amber-50 text-amber-700'
                          : 'border border-slate-200 bg-white text-slate-600'
                    }`}>
                      {cameraState.message}
                    </div>

                    <div className="space-y-2">
                      <input
                        value={manualQaCode}
                        onChange={(event) => setManualQaCode(event.target.value)}
                        placeholder="Nhập mã QA thủ công"
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
                      <button
                        type="button"
                        disabled={!selectedAuditId || completing}
                        onClick={completeSelectedAudit}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-fptOrange px-3 py-2.5 text-sm font-semibold text-white hover:bg-fptOrangeDark disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <ClipboardCheck size={16} />
                        {completing ? 'Đang hoàn tất...' : 'Hoàn thành kiểm kê'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {mobilePanel === 'scanned' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold text-slate-800">Danh sách đã quét</h3>
                  <span className="text-xs font-medium text-slate-500">{recentScans.length} thiết bị</span>
                </div>

                {!loadingDetail && recentScans.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                    {selectedAuditId ? 'Chưa có thiết bị nào được quét trong phiên này.' : 'Chọn một phiên để xem thiết bị đã quét.'}
                  </div>
                )}

                {recentScans.length > 0 && (
                  <>
                    <div className="overflow-x-auto rounded-2xl border border-slate-200">
                      <table className="min-w-[760px] divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold text-slate-600">Mã</th>
                            <th className="px-3 py-2 text-left font-semibold text-slate-600">Tên thiết bị</th>
                            <th className="px-3 py-2 text-left font-semibold text-slate-600">Phòng gốc</th>
                            <th className="px-3 py-2 text-left font-semibold text-slate-600">Phòng hiện tại</th>
                            <th className="px-3 py-2 text-left font-semibold text-slate-600">Người quét</th>
                            <th className="px-3 py-2 text-left font-semibold text-slate-600">Ngày giờ quét</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {paginatedRecentScans.map((item, index) => (
                            <tr key={`${item.assetQaCode}-${item.scannedAt || index}`}>
                              <td className="px-3 py-2 font-medium text-slate-800">{item.assetQaCode || '-'}</td>
                              <td className="px-3 py-2 text-slate-600">{item.assetName || '-'}</td>
                              <td className="px-3 py-2 text-slate-600">{item.homeLocationName || '-'}</td>
                              <td className="px-3 py-2 text-slate-600">{item.currentLocationName || '-'}</td>
                              <td className="px-3 py-2 text-slate-600">{item.scannedByUsername || '-'}</td>
                              <td className="px-3 py-2 text-slate-600">{formatVietnamDateTime(item.scannedAt, '-')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-sm">
                      <button
                        type="button"
                        onClick={() => setRecentScansPage((prev) => Math.max(1, prev - 1))}
                        disabled={recentScansPage === 1}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Trước
                      </button>
                      <span className="font-medium text-slate-600">
                        {recentScansPage}/{totalRecentScanPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setRecentScansPage((prev) => Math.min(totalRecentScanPages, prev + 1))}
                        disabled={recentScansPage === totalRecentScanPages}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Tiếp
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {mobilePanel === 'progress' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold text-slate-800">Tiến độ phiên</h3>
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                    {progressPercent}%
                  </span>
                </div>

                {!selectedAuditId && (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                    Chọn một phiên đang mở để theo dõi tiến độ và hoàn tất kiểm kê.
                  </div>
                )}

                {selectedAuditId && (
                  <>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-sm font-semibold text-slate-800">{selectedAudit?.locationName || 'Chưa chọn phòng'}</p>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progressPercent}%` }} />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded-xl bg-white px-3 py-2">
                          <p className="text-xs text-slate-500">Cần quét</p>
                          <p className="mt-1 font-semibold text-slate-800">{expectedCount}</p>
                        </div>
                        <div className="rounded-xl bg-white px-3 py-2">
                          <p className="text-xs text-slate-500">Đã quét</p>
                          <p className="mt-1 font-semibold text-emerald-700">{scannedCount}</p>
                        </div>
                        <div className="rounded-xl bg-white px-3 py-2">
                          <p className="text-xs text-slate-500">Thất lạc</p>
                          <p className="mt-1 font-semibold text-red-700">{selectedSummary?.missingCount || 0}</p>
                        </div>
                        <div className="rounded-xl bg-white px-3 py-2">
                          <p className="text-xs text-slate-500">Đang sửa chữa</p>
                          <p className="mt-1 font-semibold text-violet-700">{selectedSummary?.repairingCount || 0}</p>
                        </div>
                      </div>
                    </div>

                  </>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="hidden md:block">
          <div className="flex gap-3">
            {MOBILE_AUDIT_PANELS.map((panel) => {
              const value = panel.id === 'sessions'
                ? activeAudits.length
                : panel.id === 'scanned'
                  ? scannedCount
                  : `${progressPercent}%`
              const active = mobilePanel === panel.id
              return (
                <button
                  key={`desktop-${panel.id}`}
                  type="button"
                  onClick={() => setMobilePanel(panel.id)}
                  className={`min-w-[180px] rounded-2xl border px-4 py-4 text-left shadow-sm transition ${
                    active
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200'
                  }`}
                >
                  <p className={`text-sm font-semibold ${active ? 'text-white/80' : 'text-slate-500'}`}>{panel.label}</p>
                  <p className="mt-2 text-3xl font-bold">{value}</p>
                </button>
              )
            })}
          </div>

          <div className="mt-4 rounded-3xl bg-white p-5 shadow-sm">
            {mobilePanel === 'sessions' && (
              <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-slate-800">Phiên đang mở</h3>
                    {selectedAudit && (
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                        #{selectedAudit.id}
                      </span>
                    )}
                  </div>

                  {loadingAudits && (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
                      Đang tải danh sách phiên kiểm kê...
                    </div>
                  )}

                  {!loadingAudits && activeAudits.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
                      Hiện chưa có phiên kiểm kê nào đang mở.
                    </div>
                  )}

                  {!loadingAudits && activeAudits.length > 0 && (
                    <div className="space-y-2">
                      {activeAudits.map((audit) => {
                        const isActive = String(audit.id) === String(selectedAuditId)
                        return (
                          <button
                            key={`desktop-audit-${audit.id}`}
                            type="button"
                            onClick={() => {
                              setSelectedAuditId(String(audit.id))
                              resetSelectedAuditState()
                            }}
                            className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                              isActive
                                ? 'border-blue-600 bg-blue-50'
                                : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-base font-semibold text-slate-800">Phiên #{audit.id}</p>
                                <p className="mt-1 text-sm text-slate-600">{audit.locationName || 'Không rõ phòng kiểm kê'}</p>
                              </div>
                              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                isActive ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'
                              }`}>
                                {String(audit.status || 'OPEN').replace('_', ' ')}
                              </span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {selectedSummary && (
                    <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold text-slate-800">
                            Phiên #{selectedSummary.id} - {selectedSummary.locationName}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">Chọn đúng phiên rồi quét QR ngay trong khung bên dưới.</p>
                        </div>
                        <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
                          {selectedSummary.status || 'OPEN'}
                        </span>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-4">
                        <div className="rounded-xl bg-white px-4 py-3">
                          <p className="text-xs text-slate-500">Cần quét</p>
                          <p className="mt-1 text-xl font-semibold text-slate-800">{expectedCount}</p>
                        </div>
                        <div className="rounded-xl bg-white px-4 py-3">
                          <p className="text-xs text-slate-500">Đã quét</p>
                          <p className="mt-1 text-xl font-semibold text-emerald-700">{scannedCount}</p>
                        </div>
                        <div className="rounded-xl bg-white px-4 py-3">
                          <p className="text-xs text-slate-500">Thất lạc</p>
                          <p className="mt-1 text-xl font-semibold text-red-700">{selectedSummary.missingCount || 0}</p>
                        </div>
                        <div className="rounded-xl bg-white px-4 py-3">
                          <p className="text-xs text-slate-500">Đang sửa chữa</p>
                          <p className="mt-1 text-xl font-semibold text-violet-700">{selectedSummary.repairingCount || 0}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedAuditId ? (
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                      <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <h4 className="text-lg font-semibold text-slate-800">Quét QR</h4>
                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                            {scanStatusLabel}
                          </span>
                        </div>
                        <div
                          id={DESKTOP_SCANNER_ELEMENT_ID}
                          className="min-h-[320px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 [&_video]:!h-full [&_video]:!w-full [&_video]:!object-cover"
                        />
                        <div className={`rounded-2xl px-3 py-2 text-sm ${
                          cameraState.status === 'active'
                            ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                            : cameraState.status === 'requesting'
                              ? 'border border-amber-200 bg-amber-50 text-amber-700'
                              : 'border border-slate-200 bg-white text-slate-600'
                        }`}>
                          {cameraState.message}
                        </div>
                      </div>

                      <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="rounded-2xl bg-white p-3 text-sm text-slate-600">
                          <p className="font-semibold text-slate-800">Trạng thái phiên</p>
                          <p className="mt-2">Phòng: {selectedAudit?.locationName || 'Chưa chọn'}</p>
                          <p className="mt-1">Thiết bị cần quét: {expectedCount}</p>
                          <p className="mt-1">Thiết bị đã quét: {scannedCount} / {expectedCount || 0}</p>
                        </div>
                        <input
                          value={manualQaCode}
                          onChange={(event) => setManualQaCode(event.target.value)}
                          placeholder="Nhập mã QA thủ công"
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
                        <button
                          type="button"
                          disabled={!selectedAuditId || completing}
                          onClick={completeSelectedAudit}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-fptOrange px-3 py-2.5 text-sm font-semibold text-white hover:bg-fptOrangeDark disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <ClipboardCheck size={16} />
                          {completing ? 'Đang hoàn tất...' : 'Hoàn thành kiểm kê'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                      Chọn một phiên đang mở để bắt đầu quét QR và hoàn thành kiểm kê.
                    </div>
                  )}
                </div>
              </div>
            )}

            {mobilePanel === 'scanned' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-slate-800">Danh sách thiết bị đã quét</h3>
                  <span className="text-sm font-medium text-slate-500">{recentScans.length} thiết bị</span>
                </div>
                {!loadingDetail && recentScans.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    {selectedAuditId ? 'Chưa có thiết bị nào được quét trong phiên này.' : 'Chọn một phiên để xem danh sách đã quét.'}
                  </div>
                )}
                {recentScans.length > 0 && (
                  <>
                    <div className="overflow-x-auto rounded-2xl border border-slate-200">
                      <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold text-slate-600">Mã</th>
                            <th className="px-3 py-2 text-left font-semibold text-slate-600">Tên thiết bị</th>
                            <th className="px-3 py-2 text-left font-semibold text-slate-600">Phòng gốc</th>
                            <th className="px-3 py-2 text-left font-semibold text-slate-600">Phòng hiện tại</th>
                            <th className="px-3 py-2 text-left font-semibold text-slate-600">Người quét</th>
                            <th className="px-3 py-2 text-left font-semibold text-slate-600">Ngày giờ quét</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {paginatedRecentScans.map((item, index) => (
                            <tr key={`desktop-scan-${item.assetQaCode}-${item.scannedAt || index}`}>
                              <td className="px-3 py-2 font-medium text-slate-800">{item.assetQaCode || '-'}</td>
                              <td className="px-3 py-2 text-slate-600">{item.assetName || '-'}</td>
                              <td className="px-3 py-2 text-slate-600">{item.homeLocationName || '-'}</td>
                              <td className="px-3 py-2 text-slate-600">{item.currentLocationName || '-'}</td>
                              <td className="px-3 py-2 text-slate-600">{item.scannedByUsername || '-'}</td>
                              <td className="px-3 py-2 text-slate-600">{formatVietnamDateTime(item.scannedAt, '-')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <button
                        type="button"
                        onClick={() => setRecentScansPage((prev) => Math.max(1, prev - 1))}
                        disabled={recentScansPage === 1}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Trước
                      </button>
                      <span className="font-medium text-slate-600">
                        {recentScansPage}/{totalRecentScanPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setRecentScansPage((prev) => Math.min(totalRecentScanPages, prev + 1))}
                        disabled={recentScansPage === totalRecentScanPages}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Tiếp
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {mobilePanel === 'progress' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-slate-800">Tiến độ phiên</h3>
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                    {progressPercent}%
                  </span>
                </div>
                {!selectedAuditId && (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    Chọn một phiên đang mở để theo dõi tiến độ.
                  </div>
                )}
                {selectedAuditId && (
                  <>
                    <div className="grid gap-3 md:grid-cols-4">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-xs text-slate-500">Phòng</p>
                        <p className="mt-1 font-semibold text-slate-800">{selectedAudit?.locationName || 'Chưa chọn'}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-xs text-slate-500">Cần quét</p>
                        <p className="mt-1 font-semibold text-slate-800">{expectedCount}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-xs text-slate-500">Đã quét</p>
                        <p className="mt-1 font-semibold text-emerald-700">{scannedCount}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-xs text-slate-500">Thất lạc</p>
                        <p className="mt-1 font-semibold text-red-700">{selectedSummary?.missingCount || 0}</p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progressPercent}%` }} />
                      </div>

                      <div className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-0.5 scrollbar-hide">
                        {TABS.map((tab) => (
                          <button
                            key={`desktop-progress-${tab.id}`}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 whitespace-nowrap px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                              activeTab === tab.id
                                ? 'border-blue-600 text-blue-700'
                                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                            }`}
                          >
                            {tab.label}
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                              activeTab === tab.id ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {tab.count}
                            </span>
                          </button>
                        ))}
                      </div>

                      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
                        <table className="w-full min-w-max divide-y divide-slate-200 text-sm">
                          <thead className="bg-slate-50">
                            {activeTab === 'repairing' && (
                              <tr>
                                <th className="px-3 py-2 text-left font-semibold text-slate-600 w-12">STT</th>
                                <th className="px-3 py-2 text-left font-semibold text-slate-600">Mã thiết bị</th>
                                <th className="px-3 py-2 text-left font-semibold text-slate-600">Tên thiết bị</th>
                                <th className="px-3 py-2 text-left font-semibold text-slate-600">Phòng gốc</th>
                                <th className="px-3 py-2 text-left font-semibold text-slate-600">Vị trí hiện tại</th>
                                <th className="px-3 py-2 text-left font-semibold text-slate-600">Trạng thái</th>
                              </tr>
                            )}
                            {activeTab === 'scanned' && (
                              <tr>
                                <th className="px-3 py-2 text-left font-semibold text-slate-600 w-12">STT</th>
                                <th className="px-3 py-2 text-left font-semibold text-slate-600">Mã thiết bị</th>
                                <th className="px-3 py-2 text-left font-semibold text-slate-600">Tên thiết bị</th>
                                <th className="px-3 py-2 text-left font-semibold text-slate-600">Người quét</th>
                                <th className="px-3 py-2 text-left font-semibold text-slate-600">Thời gian</th>
                              </tr>
                            )}
                            {activeTab === 'lent' && (
                              <tr>
                                <th className="px-3 py-2 text-left font-semibold text-slate-600 w-12">STT</th>
                                <th className="px-3 py-2 text-left font-semibold text-slate-600">Mã thiết bị</th>
                                <th className="px-3 py-2 text-left font-semibold text-slate-600">Tên thiết bị</th>
                                <th className="px-3 py-2 text-left font-semibold text-slate-600">Đang ở phòng</th>
                                <th className="px-3 py-2 text-left font-semibold text-slate-600">Người mượn</th>
                                <th className="px-3 py-2 text-left font-semibold text-slate-600">Thời gian mượn</th>
                              </tr>
                            )}
                            {activeTab === 'borrowed' && (
                              <tr>
                                <th className="px-3 py-2 text-left font-semibold text-slate-600 w-12">STT</th>
                                <th className="px-3 py-2 text-left font-semibold text-slate-600">Mã thiết bị</th>
                                <th className="px-3 py-2 text-left font-semibold text-slate-600">Tên thiết bị</th>
                                <th className="px-3 py-2 text-left font-semibold text-slate-600">Phòng gốc</th>
                                <th className="px-3 py-2 text-left font-semibold text-slate-600">Hiện đang ở</th>
                                <th className="px-3 py-2 text-left font-semibold text-slate-600">Người mượn</th>
                                <th className="px-3 py-2 text-left font-semibold text-slate-600">Thời gian mượn</th>
                              </tr>
                            )}
                            {activeTab === 'missing' && (
                              <tr>
                                <th className="px-3 py-2 text-left font-semibold text-slate-600 w-12">STT</th>
                                <th className="px-3 py-2 text-left font-semibold text-slate-600">Mã thiết bị</th>
                                <th className="px-3 py-2 text-left font-semibold text-slate-600">Tên thiết bị</th>
                                <th className="px-3 py-2 text-left font-semibold text-slate-600">Xử lý</th>
                              </tr>
                            )}
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {loadingDetail && (
                              <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">Đang tải dữ liệu...</td></tr>
                            )}
                            {!loadingDetail && activeTab === 'repairing' && selectedAuditDetail?.repairingItems?.map((item, index) => (
                              <tr key={`desktop-rep-${item.assetQaCode || index}`} className="hover:bg-slate-50/80">
                                <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                                <td className="px-3 py-2 font-medium text-slate-800">{item.assetQaCode || item.assetCode}</td>
                                <td className="px-3 py-2 text-slate-600">{item.assetName}</td>
                                <td className="px-3 py-2 text-slate-600">{item.homeLocationName || '-'}</td>
                                <td className="px-3 py-2 text-slate-600">{item.currentLocationName || '-'}</td>
                                <td className="px-3 py-2 text-slate-600">{item.displayStatus || item.technicalStatus || '-'}</td>
                              </tr>
                            ))}
                            {!loadingDetail && activeTab === 'repairing' && (!selectedAuditDetail?.repairingItems?.length) && (
                              <tr><td className="px-3 py-6 text-center text-slate-400" colSpan={6}>Không có thiết bị nào đang sửa chữa.</td></tr>
                            )}
                            {!loadingDetail && activeTab === 'scanned' && selectedAuditDetail?.scannedItems?.map((item, index) => (
                              <tr key={`desktop-scan-detail-${item.assetQaCode || index}`} className="hover:bg-slate-50/80">
                                <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                                <td className="px-3 py-2 font-medium text-slate-800">{item.assetQaCode || item.assetCode}</td>
                                <td className="px-3 py-2 text-slate-600">{item.assetName}</td>
                                <td className="px-3 py-2 text-slate-600">{item.scannedByUsername || '-'}</td>
                                <td className="px-3 py-2 text-slate-400">{formatVietnamDateTime(item.scannedAt, '-')}</td>
                              </tr>
                            ))}
                            {!loadingDetail && activeTab === 'scanned' && (!selectedAuditDetail?.scannedItems?.length) && (
                              <tr><td className="px-3 py-6 text-center text-slate-400" colSpan={5}>Chưa quét thiết bị nào.</td></tr>
                            )}
                            {!loadingDetail && activeTab === 'lent' && selectedAuditDetail?.lentItems?.map((item, index) => (
                              <tr key={`desktop-lent-${item.assetQaCode || index}`} className="hover:bg-slate-50/80">
                                <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                                <td className="px-3 py-2 font-medium text-slate-800">{item.assetQaCode || item.assetCode}</td>
                                <td className="px-3 py-2 text-slate-600">{item.assetName}</td>
                                <td className="px-3 py-2 text-slate-600">{item.toLocationName || '-'}</td>
                                <td className="px-3 py-2 text-slate-600">{item.borrowerName || '-'}</td>
                                <td className="px-3 py-2 text-slate-600">{formatVietnamDateTime(item.borrowedAt, 'Chưa xác định')}</td>
                              </tr>
                            ))}
                            {!loadingDetail && activeTab === 'lent' && (!selectedAuditDetail?.lentItems?.length) && (
                              <tr><td className="px-3 py-6 text-center text-slate-400" colSpan={6}>Không có thiết bị nào đang cho mượn.</td></tr>
                            )}
                            {!loadingDetail && activeTab === 'borrowed' && selectedAuditDetail?.borrowedItems?.map((item, index) => (
                              <tr key={`desktop-borrow-${item.assetQaCode || index}`} className="hover:bg-slate-50/80">
                                <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                                <td className="px-3 py-2 font-medium text-slate-800">{item.assetQaCode || item.assetCode}</td>
                                <td className="px-3 py-2 text-slate-600">{item.assetName}</td>
                                <td className="px-3 py-2 text-slate-600">{item.homeLocationName || '-'}</td>
                                <td className="px-3 py-2 text-slate-600">{item.currentLocationName || '-'}</td>
                                <td className="px-3 py-2 text-slate-600">{item.borrowerName || '-'}</td>
                                <td className="px-3 py-2 text-slate-600">{formatVietnamDateTime(item.borrowedAt, 'Chưa xác định')}</td>
                              </tr>
                            ))}
                            {!loadingDetail && activeTab === 'borrowed' && (!selectedAuditDetail?.borrowedItems?.length) && (
                              <tr><td className="px-3 py-6 text-center text-slate-400" colSpan={7}>Không có thiết bị nào đang mượn.</td></tr>
                            )}
                            {!loadingDetail && activeTab === 'missing' && selectedAuditDetail?.missingItems?.map((item, index) => (
                              <tr key={`desktop-miss-${item.assetQaCode || index}`} className="hover:bg-slate-50/80">
                                <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                                <td className="px-3 py-2 font-medium text-slate-800">{item.assetQaCode || item.assetCode}</td>
                                <td className="px-3 py-2 text-slate-600">{item.assetName}</td>
                                <td className="px-3 py-2">
                                  <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                                    item.resolutionStatus === 'PENDING' ? 'bg-amber-50 text-amber-700' : item.resolutionStatus === 'FOUND' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    {item.resolutionStatus === 'PENDING' ? 'Chưa xử lý' : item.resolutionStatus === 'FOUND' ? 'Tìm thấy' : 'Mất hẳn'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                            {!loadingDetail && activeTab === 'missing' && (!selectedAuditDetail?.missingItems?.length) && (
                              <tr><td className="px-3 py-6 text-center text-slate-400" colSpan={4}>Không có thiết bị thất lạc.</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </section>

        {/* THỐNG KÊ TỔNG QUAN */}
        <section className="hidden">
          <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Phiên đang mở</p>
            <p className="mt-2 text-2xl font-bold text-slate-800">{activeAudits.length}</p>
            <p className="mt-1 text-xs text-slate-500">Các phiên kiểm kê mà techsupport có thể tiếp nhận.</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Đã quét</p>
            <p className="mt-1 text-2xl font-bold text-slate-800">{scannedCount}</p>
            <p className="mt-1 text-xs text-slate-500">Số thiết bị đã xác nhận trong phiên hiện tại.</p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Tiến độ</p>
            <p className="mt-2 text-2xl font-bold text-slate-800">{progressPercent}%</p>
            <p className="mt-1 text-xs text-slate-500">Dựa trên {expectedCount || 0} thiết bị thực sự cần quét.</p>
          </div>
        </section>

        {/* ROW 1: CHỌN PHIÊN KIỂM KÊ (Trải dài hết màn hình) */}
        <section className="hidden">
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

          {!loadingAudits && selectedSummary && (
              <div className="mt-4">
                <div className="rounded-2xl border border-blue-400 bg-blue-50/30 p-4 text-left shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-blue-900">Thông tin chi tiết phiên được chọn</p>
                      <p className="mt-1 text-lg font-semibold text-slate-800">Phiên #{selectedSummary.id} - {selectedSummary.locationName}</p>
                    </div>
                    <span className="rounded-full bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white uppercase">
                      {selectedSummary.status}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 border-t border-blue-100 pt-3 text-sm text-slate-700 sm:grid-cols-2 xl:grid-cols-4">
                    <p><span className="font-medium text-slate-500">Tổng thiết bị:</span> {selectedSummary.totalAssetCount || 0}</p>
                    <p><span className="font-medium text-slate-500">Cần quét:</span> {selectedSummary.expectedCount || 0}</p>
                    <p><span className="font-medium text-slate-500">Đang sửa chữa:</span> <span className="font-semibold text-violet-700">{selectedSummary.repairingCount || 0}</span></p>
                    <p><span className="font-medium text-slate-500">Đang cho mượn:</span> <span className="font-semibold text-sky-700">{selectedSummary.lentCount || 0}</span></p>
                    <p><span className="font-medium text-slate-500">Đang mượn:</span> <span className="font-semibold text-amber-700">{selectedSummary.borrowedCount || 0}</span></p>
                    <p><span className="font-medium text-slate-500">Đã quét:</span> <span className="font-semibold text-emerald-700">{selectedSummary.scannedCount || 0}</span></p>
                    <p><span className="font-medium text-slate-500">Thất lạc:</span> <span className="font-semibold text-red-700">{selectedSummary.missingCount || 0}</span></p>
                    <p><span className="font-medium text-slate-500">Người tạo:</span> {selectedSummary.createdByUsername || '-'}</p>
                    <p><span className="font-medium text-slate-500">Bắt đầu lúc:</span> {formatVietnamDateTime(selectedSummary.startedAt, '')}</p>
                    <p className="sm:col-span-2 xl:col-span-3"><span className="font-medium text-slate-500">Hạn hoàn tất:</span> {formatVietnamDateTime(selectedSummary.dueDate, 'Chưa đặt hạn')}</p>
                  </div>

                  <div className="mt-5 border-t border-blue-200 pt-4">
                    <h4 className="mb-2 text-sm font-semibold text-slate-700">Bảng chi tiết thiết bị</h4>
                    <div className="flex gap-2 overflow-x-auto border-b border-slate-200 mb-3 pb-0.5 scrollbar-hide">
                      {TABS.map((tab) => (
                          <button
                              key={tab.id}
                              onClick={() => setActiveTab(tab.id)}
                              className={`flex items-center gap-2 whitespace-nowrap px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                                  activeTab === tab.id
                                      ? 'border-blue-600 text-blue-700'
                                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                              }`}
                          >
                            {tab.label}
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                                activeTab === tab.id ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                            }`}>
                            {tab.count}
                          </span>
                          </button>
                      ))}
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                      <table className="w-full min-w-max divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50">
                        {activeTab === 'repairing' && (
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold text-slate-600 w-12">STT</th>
                              <th className="px-3 py-2 text-left font-semibold text-slate-600">Mã thiết bị</th>
                              <th className="px-3 py-2 text-left font-semibold text-slate-600">Tên thiết bị</th>
                              <th className="px-3 py-2 text-left font-semibold text-slate-600">Phòng gốc</th>
                              <th className="px-3 py-2 text-left font-semibold text-slate-600">Vị trí hiện tại</th>
                              <th className="px-3 py-2 text-left font-semibold text-slate-600">Trạng thái</th>
                            </tr>
                        )}
                        {activeTab === 'scanned' && (
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold text-slate-600 w-12">STT</th>
                              <th className="px-3 py-2 text-left font-semibold text-slate-600">Mã thiết bị</th>
                              <th className="px-3 py-2 text-left font-semibold text-slate-600">Tên thiết bị</th>
                              <th className="px-3 py-2 text-left font-semibold text-slate-600">Người quét</th>
                              <th className="px-3 py-2 text-left font-semibold text-slate-600">Thời gian</th>
                            </tr>
                        )}
                        {activeTab === 'lent' && (
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold text-slate-600 w-12">STT</th>
                              <th className="px-3 py-2 text-left font-semibold text-slate-600">Mã thiết bị</th>
                              <th className="px-3 py-2 text-left font-semibold text-slate-600">Tên thiết bị</th>
                              <th className="px-3 py-2 text-left font-semibold text-slate-600">Đang ở phòng</th>
                              <th className="px-3 py-2 text-left font-semibold text-slate-600">Người mượn</th>
                              <th className="px-3 py-2 text-left font-semibold text-slate-600">Thời gian mượn</th>
                            </tr>
                        )}
                        {activeTab === 'borrowed' && (
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold text-slate-600 w-12">STT</th>
                              <th className="px-3 py-2 text-left font-semibold text-slate-600">Mã thiết bị</th>
                              <th className="px-3 py-2 text-left font-semibold text-slate-600">Tên thiết bị</th>
                              <th className="px-3 py-2 text-left font-semibold text-slate-600">Phòng gốc</th>
                              <th className="px-3 py-2 text-left font-semibold text-slate-600">Hiện đang ở</th>
                              <th className="px-3 py-2 text-left font-semibold text-slate-600">Người mượn</th>
                              <th className="px-3 py-2 text-left font-semibold text-slate-600">Thời gian mượn</th>
                            </tr>
                        )}
                        {activeTab === 'missing' && (
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold text-slate-600 w-12">STT</th>
                              <th className="px-3 py-2 text-left font-semibold text-slate-600">Mã thiết bị</th>
                              <th className="px-3 py-2 text-left font-semibold text-slate-600">Tên thiết bị</th>
                              <th className="px-3 py-2 text-left font-semibold text-slate-600">Xử lý</th>
                            </tr>
                        )}
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                        {loadingDetail && (
                            <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">Đang tải dữ liệu...</td></tr>
                        )}
                        {!loadingDetail && activeTab === 'repairing' && selectedAuditDetail?.repairingItems?.map((item, index) => (
                            <tr key={`rep-${item.assetQaCode || index}`} className="hover:bg-slate-50/80">
                              <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                              <td className="px-3 py-2 font-medium text-slate-800">{item.assetQaCode || item.assetCode}</td>
                              <td className="px-3 py-2 text-slate-600">{item.assetName}</td>
                              <td className="px-3 py-2 text-slate-600">{item.homeLocationName || '-'}</td>
                              <td className="px-3 py-2 text-slate-600">{item.currentLocationName || '-'}</td>
                              <td className="px-3 py-2 text-slate-600">{item.displayStatus || item.technicalStatus || '-'}</td>
                            </tr>
                        ))}
                        {!loadingDetail && activeTab === 'repairing' && (!selectedAuditDetail?.repairingItems?.length) && (
                            <tr><td className="px-3 py-6 text-center text-slate-400" colSpan={6}>Không có thiết bị nào đang sửa chữa.</td></tr>
                        )}
                        {!loadingDetail && activeTab === 'scanned' && selectedAuditDetail?.scannedItems?.map((item, index) => (
                            <tr key={`scan-${item.assetQaCode || index}`} className="hover:bg-slate-50/80">
                              <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                              <td className="px-3 py-2 font-medium text-slate-800">{item.assetQaCode || item.assetCode}</td>
                              <td className="px-3 py-2 text-slate-600">{item.assetName}</td>
                              <td className="px-3 py-2 text-slate-600">{item.scannedByUsername || '-'}</td>
                              <td className="px-3 py-2 text-slate-400">{formatVietnamDateTime(item.scannedAt, '-')}</td>
                            </tr>
                        ))}
                        {!loadingDetail && activeTab === 'scanned' && (!selectedAuditDetail?.scannedItems?.length) && (
                            <tr><td className="px-3 py-6 text-center text-slate-400" colSpan={5}>Chưa quét thiết bị nào.</td></tr>
                        )}
                        {!loadingDetail && activeTab === 'lent' && selectedAuditDetail?.lentItems?.map((item, index) => (
                            <tr key={`lent-${item.assetQaCode || index}`} className="hover:bg-slate-50/80">
                              <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                              <td className="px-3 py-2 font-medium text-slate-800">{item.assetQaCode || item.assetCode}</td>
                              <td className="px-3 py-2 text-slate-600">{item.assetName}</td>
                              <td className="px-3 py-2 text-slate-600">{item.toLocationName || '-'}</td>
                              <td className="px-3 py-2 text-slate-600">{item.borrowerName || '-'}</td>
                              <td className="px-3 py-2 text-slate-600">{formatVietnamDateTime(item.borrowedAt, 'Chưa xác định')}</td>
                            </tr>
                        ))}
                        {!loadingDetail && activeTab === 'lent' && (!selectedAuditDetail?.lentItems?.length) && (
                            <tr><td className="px-3 py-6 text-center text-slate-400" colSpan={6}>Không có thiết bị nào đang cho mượn.</td></tr>
                        )}
                        {!loadingDetail && activeTab === 'borrowed' && selectedAuditDetail?.borrowedItems?.map((item, index) => (
                            <tr key={`borrow-${item.assetQaCode || index}`} className="hover:bg-slate-50/80">
                              <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                              <td className="px-3 py-2 font-medium text-slate-800">{item.assetQaCode || item.assetCode}</td>
                              <td className="px-3 py-2 text-slate-600">{item.assetName}</td>
                              <td className="px-3 py-2 text-slate-600">{item.homeLocationName || '-'}</td>
                              <td className="px-3 py-2 text-slate-600">{item.currentLocationName || '-'}</td>
                              <td className="px-3 py-2 text-slate-600">{item.borrowerName || '-'}</td>
                              <td className="px-3 py-2 text-slate-600">{formatVietnamDateTime(item.borrowedAt, 'Chưa xác định')}</td>
                            </tr>
                        ))}
                        {!loadingDetail && activeTab === 'borrowed' && (!selectedAuditDetail?.borrowedItems?.length) && (
                            <tr><td className="px-3 py-6 text-center text-slate-400" colSpan={7}>Không có thiết bị nào đang mượn.</td></tr>
                        )}
                        {!loadingDetail && activeTab === 'missing' && selectedAuditDetail?.missingItems?.map((item, index) => (
                            <tr key={`miss-${item.assetQaCode || index}`} className="hover:bg-slate-50/80">
                              <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                              <td className="px-3 py-2 font-medium text-slate-800">{item.assetQaCode || item.assetCode}</td>
                              <td className="px-3 py-2 text-slate-600">{item.assetName}</td>
                              <td className="px-3 py-2">
                                <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                                    item.resolutionStatus === 'PENDING' ? 'bg-amber-50 text-amber-700' : item.resolutionStatus === 'FOUND' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {item.resolutionStatus === 'PENDING' ? 'Chưa xử lý' : item.resolutionStatus === 'FOUND' ? 'Tìm thấy' : 'Mất hẳn'}
                                </span>
                              </td>
                            </tr>
                        ))}
                        {!loadingDetail && activeTab === 'missing' && (!selectedAuditDetail?.missingItems?.length) && (
                            <tr><td className="px-3 py-6 text-center text-slate-400" colSpan={4}>Không có thiết bị thất lạc.</td></tr>
                        )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
          )}
        </section>

        {/* ROW 2: QUÉT MÃ & THIẾT BỊ ĐÃ QUÉT (Luôn nằm song song ngang nhau trên màn hình lớn) */}
        <section className="hidden">

          {/* CỘT TRÁI: KHU VỰC QUÉT MÃ */}
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Quét kiểm kê</h3>
                <p className="mt-1 text-sm text-slate-500">Camera dùng để đọc QR thiết bị, có kèm ô nhập tay khi cần.</p>
              </div>
              <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                {scanStatusLabel}
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
              <div>
                <div
                    id={DESKTOP_SCANNER_ELEMENT_ID}
                    className="min-h-[280px] w-full flex items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 [&_video]:!h-full [&_video]:!w-full [&_video]:!object-cover"
                />
                <div className="mt-3 flex items-start gap-2 rounded-2xl border border-blue-100 bg-blue-50 px-3 py-3 text-sm text-blue-900">
                  <Camera size={18} className="mt-0.5 shrink-0" />
                  <p>Cho phép truy cập camera để quét liên tục. Nếu amera không hoạt động, nhập mã QA bên cạnh để vẫn hoàn thành kiểm kê.</p>
                </div>c
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

                  <p className="mt-1">Thiết bị cần quét: {expectedCount}</p>
                  <p className="mt-1">Thiết bị đã quét: {scannedCount} / {expectedCount || 0}</p>
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

          {/* CỘT PHẢI: THIẾT BỊ ĐÃ QUÉT */}
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

            <div className="space-y-3">
              {paginatedRecentScans.map((item, index) => (
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
            {!loadingDetail && recentScans.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-sm">
                <p className="text-slate-500">
                  Hiển thị {paginatedRecentScans.length} / {recentScans.length} thiết bị đã quét
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRecentScansPage((prev) => Math.max(1, prev - 1))}
                    disabled={recentScansPage === 1}
                    className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Trang trước
                  </button>
                  <span className="font-semibold text-slate-700">
                    Trang {recentScansPage}/{totalRecentScanPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setRecentScansPage((prev) => Math.min(totalRecentScanPages, prev + 1))}
                    disabled={recentScansPage === totalRecentScanPages}
                    className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Trang tiếp
                  </button>
                </div>
              </div>
            )}
          </aside>

        </section>
      </div>
  )
}

export default InventoryAuditScanner
