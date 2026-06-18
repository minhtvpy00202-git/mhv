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
  const [selectedAuditDetail, setSelectedAuditDetail] = useState(null)
  const [scannedCount, setScannedCount] = useState(0)
  const [recentScans, setRecentScans] = useState([])
  const [manualQaCode, setManualQaCode] = useState('')
  const [loadingAudits, setLoadingAudits] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [completing, setCompleting] = useState(false)

  // --- STATE QUẢN LÝ TAB CHI TIẾT ---
  const [activeTab, setActiveTab] = useState('scanned')

  const loadActiveAudits = async () => {
    setLoadingAudits(true)
    try {
      const response = await axiosClient.get('/api/inventory-audits/active')
      const data = response.data || []
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
        setActiveTab('scanned') // Đặt lại tab mặc định mỗi khi đổi phiên
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

  const progressPercent = expectedCount > 0
      ? Math.min(100, Math.round((scannedCount / expectedCount) * 100))
      : selectedAuditId
          ? 100
          : 0

  const resetSelectedAuditState = () => {
    setManualQaCode('')
    setSelectedAuditDetail(null)
    setRecentScans([])
    setScannedCount(0)
    setActiveTab('scanned')
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

      // Cập nhật lại list sau khi quét thành công
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

  // Định nghĩa các tab dữ liệu
  const TABS = [
    { id: 'repairing', label: 'Đang sửa chữa', count: selectedSummary?.repairingCount || 0 },
    { id: 'scanned', label: 'Đã quét', count: selectedSummary?.scannedCount || 0 },
    { id: 'lent', label: 'Đang cho mượn', count: selectedSummary?.lentCount || 0 },
    { id: 'borrowed', label: 'Đang mượn', count: selectedSummary?.borrowedCount || 0 },
    { id: 'missing', label: 'Thất lạc', count: selectedSummary?.missingCount || 0 },
  ]

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
            <p className="mt-1 text-2xl font-bold text-slate-800">{scannedCount}</p>
            <p className="mt-1 text-xs text-slate-500">Số thiết bị đã xác nhận trong phiên hiện tại.</p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Tiến độ</p>
            <p className="mt-2 text-2xl font-bold text-slate-800">{progressPercent}%</p>
            <p className="mt-1 text-xs text-slate-500">Dựa trên {expectedCount || 0} thiết bị thực sự cần quét.</p>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
          <div className="space-y-4">
            {/* KHỐI CHỌN PHIÊN & HIỂN THỊ CHI TIẾT */}
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

              {/* KHỐI HIỂN THỊ THÔNG SỐ TỔNG QUAN */}
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

                      <div className="mt-4 grid gap-3 border-t border-blue-100 pt-3 text-sm text-slate-700 sm:grid-cols-2 xl:grid-cols-3">
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

                      {/* --- KHU VỰC TAB & BẢNG CHI TIẾT --- */}
                      <div className="mt-5 border-t border-blue-200 pt-4">
                        <h4 className="mb-2 text-sm font-semibold text-slate-700">Bảng chi tiết thiết bị</h4>
                        {/* THANH ĐIỀU HƯỚNG TAB */}
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

                        {/* NỘI DUNG BẢNG */}
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

                            {/* Bảng Đang sửa chữa */}
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

                            {/* Bảng Đã quét */}
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

                            {/* Bảng Đang cho mượn */}
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

                            {/* Bảng Đang mượn */}
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

                            {/* Bảng Thất lạc */}
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
            </div>

            {/* KHU VỰC QUÉT MÃ */}
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

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div>
                  <div
                      id={scannerElementId}
                      className="min-h-[280px] w-full flex items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 [&_video]:!h-full [&_video]:!w-full [&_video]:!object-cover"
                  />
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