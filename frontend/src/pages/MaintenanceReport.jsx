import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'

const scannerElementId = 'maintenance-scanner'

function MaintenanceReport() {
  const scannerRef = useRef(null)
  const isScanningRef = useRef(false)
  const [assetQaCode, setAssetQaCode] = useState('')
  const [assetName, setAssetName] = useState('')
  const [description, setDescription] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    startScanner()
    return () => {
      stopScanner()
    }
  }, [])

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
          setAssetQaCode(qaCode)
          try {
            const response = await axiosClient.get(`/api/assets/${qaCode}`)
            setAssetName(response.data?.name || '')
          } catch {
            setAssetName('')
          }
          setShowModal(true)
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
    if (loading) return
    setShowModal(false)
    setAssetQaCode('')
    setAssetName('')
    setDescription('')
    startScanner()
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!assetQaCode || !description) {
      toast.error('Vui lòng nhập đầy đủ mã QA và mô tả lỗi.')
      return
    }
    setLoading(true)
    try {
      await axiosClient.post('/api/maintenance/report', { assetQaCode, description })
      toast.success(`Đã gửi báo hỏng thành công${assetName ? `: ${assetName}` : ''}.`)
      closeModal()
    } catch (error) {
      const message = error?.response?.data?.message || 'Gửi báo hỏng thất bại.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Quét QR để báo hỏng thiết bị</h2>
        <div id={scannerElementId} className="overflow-hidden rounded-xl border border-slate-200" />
      </section>

      {showModal && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/50 p-4">
          <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl bg-white p-4">
            <h3 className="text-base font-semibold text-slate-800">Nhập mô tả lỗi thiết bị</h3>
            <p className="mt-1 text-sm text-slate-600">Mã QA: {assetQaCode}</p>
            <p className="text-sm text-slate-600">Tên thiết bị: {assetName || 'Đang tải...'}</p>
            <div className="mt-3">
              <label className="mb-1 block text-sm font-medium text-slate-700">Mô tả lỗi</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-fptOrange focus:ring-2"
                placeholder="Mô tả chi tiết tình trạng hỏng"
              />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-fptOrange px-4 py-2 font-semibold text-white hover:bg-fptOrangeDark disabled:opacity-60"
              >
                Gửi báo hỏng
              </button>
              <button
                type="button"
                onClick={closeModal}
                disabled={loading}
                className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Đóng
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default MaintenanceReport
