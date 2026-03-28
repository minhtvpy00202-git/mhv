import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'

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
  const scannerRef = useRef(null)
  const isScanningRef = useRef(false)
  const isSubmittingRef = useRef(false)
  const selectedAuditIdRef = useRef('')
  const [activeAudits, setActiveAudits] = useState([])
  const [selectedAuditId, setSelectedAuditId] = useState('')
  const [scannedCount, setScannedCount] = useState(0)
  const [expectedCount, setExpectedCount] = useState(0)
  const [recentScans, setRecentScans] = useState([])

  const loadActiveAudits = async () => {
    try {
      const response = await axiosClient.get('/api/inventory-audits/active')
      const data = response.data || []
      setActiveAudits(data)
      if (!selectedAuditId && data.length > 0) {
        setSelectedAuditId(String(data[0].id))
      }
    } catch (error) {
      const message = error?.response?.data?.message || 'Không tải được phiên kiểm kê đang mở.'
      toast.error(message)
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
      try {
        const response = await axiosClient.get(`/api/inventory-audits/${selectedAuditId}`)
        const detail = response.data
        setRecentScans(detail?.scannedItems || [])
        setScannedCount(detail?.summary?.scannedCount || 0)
        setExpectedCount(detail?.summary?.expectedCount || 0)
      } catch {
        setRecentScans([])
      }
    }
    loadAuditDetail()
  }, [selectedAuditId])

  const startScanner = async () => {
    if (isScanningRef.current) return
    const scanner = new Html5Qrcode(scannerElementId)
    scannerRef.current = scanner
    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decodedText) => {
          if (isSubmittingRef.current) return
          const currentAuditId = selectedAuditIdRef.current
          if (!currentAuditId) return
          const qaCode = extractQaCode(decodedText)
          if (!qaCode) return
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
                scannedByUsername: 'Bạn',
                scannedAt: new Date().toISOString(),
              },
              ...prev,
            ])
            toast.success(`Đã quét: ${data.assetName} (${data.assetQaCode})`)
          } catch (error) {
            const message = error?.response?.data?.message || 'Quét kiểm kê thất bại.'
            toast.error(message)
          } finally {
            setTimeout(() => {
              isSubmittingRef.current = false
            }, 500)
          }
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
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Quét kiểm kê hàng loạt</h2>
        <select
          value={selectedAuditId}
          onChange={(e) => {
            setSelectedAuditId(e.target.value)
            setScannedCount(0)
            setExpectedCount(0)
          }}
          className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
        >
          <option value="">Chọn phiên kiểm kê đang mở</option>
          {activeAudits.map((audit) => (
            <option key={audit.id} value={audit.id}>
              #{audit.id} - Phòng {audit.locationName}
            </option>
          ))}
        </select>
        <p className="mb-3 text-sm text-slate-600">
          Đã quét: <span className="font-semibold">{scannedCount}</span> / Dự kiến: <span className="font-semibold">{expectedCount}</span>
        </p>
        <div id={scannerElementId} className="overflow-hidden rounded-xl border border-slate-200" />
        <button
          type="button"
          disabled={!selectedAuditId}
          onClick={async () => {
            try {
              await axiosClient.post(`/api/inventory-audits/${selectedAuditId}/complete`)
              toast.success('Hoàn thành kiểm kê. Admin sẽ nhận biên bản và cảnh báo thất lạc.')
              await loadActiveAudits()
              setSelectedAuditId('')
              setRecentScans([])
              setScannedCount(0)
              setExpectedCount(0)
            } catch (error) {
              const message = error?.response?.data?.message || 'Không thể hoàn thành kiểm kê.'
              toast.error(message)
            }
          }}
          className="mt-3 w-full rounded-lg bg-fptOrange px-3 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark disabled:opacity-60"
        >
          Hoàn thành kiểm kê
        </button>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-base font-semibold text-slate-800">Danh sách đã quét</h3>
        <div className="max-h-56 overflow-auto rounded border border-slate-200">
          {recentScans.map((item, index) => (
            <div key={`${item.assetQaCode}-${index}`} className="border-b border-slate-100 px-3 py-2 text-sm">
              <p className="font-medium text-slate-700">
                {item.assetQaCode} - {item.assetName}
              </p>
              <p className="text-xs text-slate-500">
                Phòng hiện tại: {item.currentLocationName || 'Không xác định'} | Phòng gốc: {item.homeLocationName || 'Không xác định'}
              </p>
            </div>
          ))}
          {recentScans.length === 0 && <p className="px-3 py-2 text-sm text-slate-500">Chưa quét thiết bị nào.</p>}
        </div>
      </section>
    </div>
  )
}

export default InventoryAuditScanner
