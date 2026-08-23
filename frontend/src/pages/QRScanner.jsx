import { useEffect, useMemo, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { toast } from 'react-toastify'
import { useNavigate, useSearchParams } from 'react-router-dom'
import axiosClient from '../api/axiosClient'
import SearchableSelect from '../components/ui/SearchableSelect'
import { useAuth } from '../context/AuthContext'
import { parseSpecsToEntries } from '../utils/assetSpecs'

const scannerElementId = 'qa-scanner'

function QRScanner() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const inquiryMode = searchParams.get('mode') === 'inquiry'
  const scannerRef = useRef(null)
  const isScanningRef = useRef(false)
  const keepScannerAliveRef = useRef(true)
  const [scannedQaCode, setScannedQaCode] = useState('')
  const [scannedAssetName, setScannedAssetName] = useState('')
  const [scannedLocationId, setScannedLocationId] = useState(null)
  const [scannedHomeLocationId, setScannedHomeLocationId] = useState(null)
  const [scannedLocationName, setScannedLocationName] = useState('')
  const [scannedHomeLocationName, setScannedHomeLocationName] = useState('')
  const [scannedSpecs, setScannedSpecs] = useState([])
  const [showActionModal, setShowActionModal] = useState(false)
  const [toLocationId, setToLocationId] = useState('')
  const [locations, setLocations] = useState([])
  const [loadingAction, setLoadingAction] = useState(false)
  const [manualQaCode, setManualQaCode] = useState('')
  const [manualLookupLoading, setManualLookupLoading] = useState(false)
  const { user } = useAuth()

  const userId = useMemo(() => user?.userId ?? null, [user])
  useEffect(() => {
    if (!showActionModal && keepScannerAliveRef.current) {
      void startScanner()
    } else {
      void stopScanner()
    }
    fetchLocations()
    const handleVisibilityChange = () => {
      if (document.hidden) {
        void stopScanner()
        return
      }
      if (!showActionModal && keepScannerAliveRef.current) {
        void startScanner()
      }
    }
    const handlePageHide = () => {
      void stopScanner()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', handlePageHide)
    return () => {
      keepScannerAliveRef.current = false
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', handlePageHide)
      void stopScanner()
    }
  }, [showActionModal])

  async function fetchLocations() {
    try {
      const response = await axiosClient.get('/api/locations')
      setLocations(response.data || [])
    } catch (error) {
      const message = error?.response?.data?.message || 'Không tải được danh sách phòng.'
      toast.error(message)
    }
  }

  const fetchAssetInfo = async (qaCode) => {
    try {
      const response = await axiosClient.get(`/api/assets/${qaCode}`)
      setScannedAssetName(response.data?.name || '')
      setScannedLocationId(response.data?.locationId || null)
      setScannedHomeLocationId(response.data?.homeLocationId || null)
      setScannedLocationName(response.data?.locationName || '')
      setScannedHomeLocationName(response.data?.homeLocationName || '')
      setScannedSpecs(parseSpecsToEntries(response.data?.specs))
      return true
    } catch {
      setScannedAssetName('')
      setScannedLocationId(null)
      setScannedHomeLocationId(null)
      setScannedLocationName('')
      setScannedHomeLocationName('')
      setScannedSpecs([])
      toast.error('Mã tài sản không tồn tại')
      return false
    }
  }

  const extractQaCode = (decodedText) => {
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

  async function startScanner() {
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
          await stopScanner()
          const exists = await openActionModalByQaCode(qaCode)
          if (!exists) {
            startScanner()
            return
          }
        },
        () => {},
      )
      isScanningRef.current = true
    } catch {
      toast.error('Không thể mở camera. Vui lòng cấp quyền truy cập camera.')
    }
  }

  const openActionModalByQaCode = async (qaCode) => {
    const normalizedQaCode = String(qaCode || '').trim()
    if (!normalizedQaCode) return false
    setScannedQaCode(normalizedQaCode)
    setManualQaCode(normalizedQaCode)
    const exists = await fetchAssetInfo(normalizedQaCode)
    if (!exists) {
      setScannedQaCode('')
      return false
    }
    if (inquiryMode) {
      keepScannerAliveRef.current = false
      navigate(`/mobile/inquiries?qaCode=${encodeURIComponent(normalizedQaCode)}`, { replace: true })
      return true
    }
    setShowActionModal(true)
    return true
  }

  async function stopScanner() {
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

  const closeModal = () => {
    setShowActionModal(false)
    setScannedQaCode('')
    setScannedAssetName('')
    setScannedLocationId(null)
    setScannedHomeLocationId(null)
    setScannedLocationName('')
    setScannedHomeLocationName('')
    setScannedSpecs([])
    setToLocationId('')
    setManualQaCode('')
    startScanner()
  }

  const handleManualLookup = async () => {
    const normalizedQaCode = extractQaCode(manualQaCode)
    if (!normalizedQaCode) {
      toast.error('Vui lòng nhập mã QA của thiết bị.')
      return
    }
    setManualLookupLoading(true)
    keepScannerAliveRef.current = false
    await stopScanner()
    const exists = await openActionModalByQaCode(normalizedQaCode)
    if (!exists) {
      startScanner()
    }
    setManualLookupLoading(false)
  }

  const handleCheckout = async () => {
    if (!userId) {
      toast.error('Không tìm thấy thông tin người dùng đăng nhập.')
      return
    }
    if (!toLocationId) {
      toast.error('Vui lòng chọn phòng đích.')
      return
    }
    if (scannedLocationId !== null && Number(toLocationId) === Number(scannedLocationId)) {
      toast.error('Phòng đích không được trùng với phòng hiện tại của thiết bị.')
      return
    }
    setLoadingAction(true)
    try {
      await axiosClient.post('/api/usage/checkout', {
        assetQaCode: scannedQaCode,
        userId,
        toLocationId: Number(toLocationId),
      })
      toast.success(`Mượn thiết bị thành công${scannedAssetName ? `: ${scannedAssetName}` : ''}.`)
      closeModal()
    } catch (error) {
      const message = error?.response?.data?.message || 'Mượn thiết bị thất bại.'
      toast.error(message)
    } finally {
      setLoadingAction(false)
    }
  }

  const handleCheckin = async () => {
    setLoadingAction(true)
    try {
      await axiosClient.post('/api/usage/checkin', {
        assetQaCode: scannedQaCode,
      })
      toast.success(`Trả thiết bị thành công${scannedAssetName ? `: ${scannedAssetName}` : ''}.`)
      closeModal()
    } catch (error) {
      const message = error?.response?.data?.message || 'Trả thiết bị thất bại.'
      toast.error(message)
    } finally {
      setLoadingAction(false)
    }
  }

  const canCheckout = scannedLocationId !== null && scannedHomeLocationId !== null
    ? Number(scannedLocationId) === Number(scannedHomeLocationId)
    : true
  const canCheckin = scannedLocationId !== null && scannedHomeLocationId !== null
    ? Number(scannedLocationId) !== Number(scannedHomeLocationId)
    : true

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-800">{inquiryMode ? 'Quét QR để tạo yêu cầu' : 'Quét mã QR thiết bị'}</h2>
        <div id={scannerElementId} className="overflow-hidden rounded-xl border border-slate-200" />
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-800">Hoặc nhập tay mã QA</p>
          <p className="mt-1 text-xs text-slate-500">
            Dùng khi mã QR bị mờ, hỏng hoặc camera trên thiết bị không hoạt động.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={manualQaCode}
              onChange={(event) => setManualQaCode(event.target.value)}
              placeholder="Ví dụ: QA000123"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
            />
            <button
              type="button"
              onClick={() => {
                void handleManualLookup()
              }}
              disabled={manualLookupLoading}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {manualLookupLoading ? 'Đang kiểm tra...' : 'Tra cứu mã'}
            </button>
          </div>
        </div>
      </div>

      {showActionModal && (
        <div className="fixed inset-0 z-[1000] flex items-end justify-center overflow-y-auto bg-black/50 p-4 sm:items-center sm:p-6">
          <div className="flex max-h-[92vh] w-full max-w-md flex-col rounded-2xl bg-white p-4">
            <div className="overflow-y-auto pr-1">
            <h3 className="text-base font-semibold text-slate-800">Xác nhận thao tác thiết bị</h3>
            <p className="mt-1 text-sm text-slate-600">Mã QA: {scannedQaCode}</p>
            <p className="text-sm text-slate-600">Tên thiết bị: {scannedAssetName || 'Đang tải...'}</p>
            <p className="text-sm text-slate-600">Phòng hiện tại: {scannedLocationName || 'Không xác định'}</p>
            <p className="text-sm text-slate-600">Phòng gốc: {scannedHomeLocationName || 'Không xác định'}</p>
            {scannedSpecs.length > 0 && (
              <div className="mt-3 rounded-xl bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-700">Đặc tính kỹ thuật</p>
                <div className="mt-2 space-y-1 text-sm text-slate-600">
                  {scannedSpecs.map((entry) => (
                    <p key={`${entry.name}-${entry.value}`}>
                      <span className="font-medium text-slate-700">{entry.name}:</span> {entry.value}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {canCheckout && (
              <div className="mt-3 space-y-2">
                <label className="text-sm font-medium text-slate-700">Phòng đích</label>
                <SearchableSelect
                  value={toLocationId}
                  onChange={(nextValue) => setToLocationId(String(nextValue || ''))}
                  options={locations}
                  placeholder="Gõ để tìm phòng, ví dụ: Hành lang 1"
                  emptyText="Không có phòng phù hợp."
                  getOptionValue={(location) => location.id}
                  getOptionLabel={(location) => location.roomName || `Phòng #${location.id}`}
                  getOptionSearchText={(location) => `${location.roomName || ''} ${location.description || ''}`}
                  dropdownZIndex={1100}
                />
                <p className="text-xs text-slate-500">Danh sách sẽ tự nổi lên và đổi hướng hiển thị để không che khuất vùng thao tác.</p>
              </div>
            )}
            </div>

            <div className={`mt-4 grid gap-2 ${canCheckout && canCheckin ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {canCheckout && (
                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={loadingAction}
                  className="rounded-lg bg-fptOrange px-3 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark disabled:opacity-60"
                >
                  Mượn thiết bị
                </button>
              )}
              {canCheckin && (
                <button
                  type="button"
                  onClick={handleCheckin}
                  disabled={loadingAction}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  Trả thiết bị
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={closeModal}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default QRScanner
