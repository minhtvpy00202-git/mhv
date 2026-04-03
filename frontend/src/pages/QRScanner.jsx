import { useEffect, useMemo, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'
import { useAuth } from '../context/AuthContext'

const scannerElementId = 'qa-scanner'

function QRScanner() {
  const scannerRef = useRef(null)
  const isScanningRef = useRef(false)
  const keepScannerAliveRef = useRef(true)
  const [scannedQaCode, setScannedQaCode] = useState('')
  const [scannedAssetName, setScannedAssetName] = useState('')
  const [scannedLocationId, setScannedLocationId] = useState(null)
  const [scannedHomeLocationId, setScannedHomeLocationId] = useState(null)
  const [scannedLocationName, setScannedLocationName] = useState('')
  const [scannedHomeLocationName, setScannedHomeLocationName] = useState('')
  const [showActionModal, setShowActionModal] = useState(false)
  const [toLocationId, setToLocationId] = useState('')
  const [locations, setLocations] = useState([])
  const [locationQuery, setLocationQuery] = useState('')
  const [showLocationOptions, setShowLocationOptions] = useState(false)
  const [loadingAction, setLoadingAction] = useState(false)
  const { user } = useAuth()

  const userId = useMemo(() => user?.userId ?? null, [user])
  const filteredLocations = useMemo(() => {
    const keyword = locationQuery.trim().toLowerCase()
    if (!keyword) return locations
    return locations.filter((location) => location.roomName.toLowerCase().startsWith(keyword))
  }, [locationQuery, locations])

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

  const fetchLocations = async () => {
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
      return true
    } catch {
      setScannedAssetName('')
      setScannedLocationId(null)
      setScannedHomeLocationId(null)
      setScannedLocationName('')
      setScannedHomeLocationName('')
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
          await stopScanner()
          setScannedQaCode(qaCode)
          const exists = await fetchAssetInfo(qaCode)
          if (!exists) {
            setScannedQaCode('')
            startScanner()
            return
          }
          setShowActionModal(true)
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

  const closeModal = () => {
    setShowActionModal(false)
    setScannedQaCode('')
    setScannedAssetName('')
    setScannedLocationId(null)
    setScannedHomeLocationId(null)
    setScannedLocationName('')
    setScannedHomeLocationName('')
    setToLocationId('')
    setLocationQuery('')
    setShowLocationOptions(false)
    startScanner()
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
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Quét mã QR thiết bị</h2>
        <div id={scannerElementId} className="overflow-hidden rounded-xl border border-slate-200" />
      </div>

      {showActionModal && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-4">
            <h3 className="text-base font-semibold text-slate-800">Xác nhận thao tác thiết bị</h3>
            <p className="mt-1 text-sm text-slate-600">Mã QA: {scannedQaCode}</p>
            <p className="text-sm text-slate-600">Tên thiết bị: {scannedAssetName || 'Đang tải...'}</p>
            <p className="text-sm text-slate-600">Phòng hiện tại: {scannedLocationName || 'Không xác định'}</p>
            <p className="text-sm text-slate-600">Phòng gốc: {scannedHomeLocationName || 'Không xác định'}</p>

            {canCheckout && (
              <div className="mt-3 space-y-2">
                <label className="text-sm font-medium text-slate-700">Phòng đích</label>
                <div className="relative">
                  <input
                    type="text"
                    value={locationQuery}
                    onFocus={() => setShowLocationOptions(true)}
                    onChange={(e) => {
                      setLocationQuery(e.target.value)
                      setToLocationId('')
                      setShowLocationOptions(true)
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-fptOrange focus:ring-2"
                    placeholder="Gõ để tìm phòng, ví dụ: 2"
                  />
                  {showLocationOptions && (
                    <div className="absolute z-10 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                      {filteredLocations.length > 0 ? (
                        filteredLocations.map((location) => (
                          <button
                            key={location.id}
                            type="button"
                            onClick={() => {
                              setToLocationId(String(location.id))
                              setLocationQuery(location.roomName)
                              setShowLocationOptions(false)
                            }}
                            className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-orange-50"
                          >
                            {location.roomName}
                          </button>
                        ))
                      ) : (
                        <p className="px-3 py-2 text-sm text-slate-500">Không có phòng phù hợp.</p>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-500">Phòng sẽ lọc theo tiền tố A-Z hoặc số bạn nhập.</p>
              </div>
            )}

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
