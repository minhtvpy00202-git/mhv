import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import axiosClient from '../../api/axiosClient'

function formatDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('vi-VN')
}

function InventoryAuditManagement() {
  const [locations, setLocations] = useState([])
  const [audits, setAudits] = useState([])
  const [selectedAudit, setSelectedAudit] = useState(null)
  const [form, setForm] = useState({ locationId: '', notes: '' })
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const sortedAudits = useMemo(() => [...audits], [audits])

  const loadInitialData = async () => {
    setLoading(true)
    try {
      const [locationRes, auditRes] = await Promise.all([
        axiosClient.get('/api/locations'),
        axiosClient.get('/api/inventory-audits'),
      ])
      setLocations(locationRes.data || [])
      setAudits(auditRes.data || [])
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể tải dữ liệu kiểm kê.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInitialData()
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
    setCreating(true)
    try {
      const response = await axiosClient.post('/api/inventory-audits', {
        locationId: Number(form.locationId),
        notes: form.notes,
      })
      toast.success('Tạo phiên kiểm kê thành công.')
      setForm({ locationId: '', notes: '' })
      await loadInitialData()
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
      await loadInitialData()
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
    const confirmed = window.confirm(`Xác nhận mất hẳn thiết bị ${qaCode}? Thiết bị sẽ bị xóa khỏi hệ thống.`)
    if (!confirmed) return
    try {
      const response = await axiosClient.post(`/api/inventory-audits/${selectedAudit.summary.id}/missing/${qaCode}/lost`)
      setSelectedAudit(response.data)
      toast.success(`Đã chốt mất hẳn thiết bị ${qaCode}.`)
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể chốt mất hẳn thiết bị.'
      toast.error(message)
    }
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
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Tạo phiên kiểm kê định kỳ</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <select
            value={form.locationId}
            onChange={(e) => setForm((prev) => ({ ...prev, locationId: e.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
          >
            <option value="">Chọn phòng kiểm kê</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.roomName}
              </option>
            ))}
          </select>
          <input
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
            placeholder="Ghi chú phiên kiểm kê"
          />
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

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-base font-semibold text-slate-800">Danh sách phiên kiểm kê</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">Mã phiên</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">Phòng</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">Trạng thái</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">Bắt đầu</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">Kết thúc</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-600">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading &&
                Array.from({ length: 6 }).map((_, index) => (
                  <tr key={`audit-loading-${index}`} className="animate-pulse">
                    <td className="px-3 py-2" colSpan={6}>
                      <div className="h-4 w-full rounded bg-slate-200" />
                    </td>
                  </tr>
                ))}
              {!loading &&
                sortedAudits.map((audit) => (
                  <tr key={audit.id}>
                    <td className="px-3 py-2">#{audit.id}</td>
                    <td className="px-3 py-2">{audit.locationName}</td>
                    <td className="px-3 py-2">{audit.status}</td>
                    <td className="px-3 py-2">{formatDateTime(audit.startedAt)}</td>
                    <td className="px-3 py-2">{formatDateTime(audit.completedAt)}</td>
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
      </div>

      {selectedAudit && (
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-slate-800">
              Chi tiết phiên #{selectedAudit.summary.id} - {selectedAudit.summary.locationName}
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleExportReport}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Xuất biên bản
              </button>
              {selectedAudit.summary.status === 'OPEN' && (
                <button
                  type="button"
                  onClick={handleCompleteAudit}
                  className="rounded-lg bg-fptOrange px-3 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark"
                >
                  Hoàn thành kiểm kê
                </button>
              )}
            </div>
          </div>
          <p className="mb-2 text-sm text-slate-600">
            Dự kiến: {selectedAudit.summary.expectedCount || 0} | Đã quét: {selectedAudit.summary.scannedCount || 0} | Thất lạc:{' '}
            {selectedAudit.summary.missingCount || 0}
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="mb-2 font-semibold text-slate-700">Thiết bị đã quét</h4>
              <div className="max-h-64 overflow-auto rounded border border-slate-200">
                {selectedAudit.scannedItems.map((item) => (
                  <div key={`${item.assetQaCode}-${item.scannedAt}`} className="border-b border-slate-100 px-3 py-2 text-sm">
                    <p className="font-medium text-slate-700">
                      {item.assetQaCode} - {item.assetName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {item.scannedByUsername} • {formatDateTime(item.scannedAt)}
                    </p>
                  </div>
                ))}
                {selectedAudit.scannedItems.length === 0 && <p className="px-3 py-2 text-sm text-slate-500">Chưa quét thiết bị nào.</p>}
              </div>
            </div>
            <div>
              <h4 className="mb-2 font-semibold text-slate-700">Thiết bị thất lạc</h4>
              <div className="max-h-64 overflow-auto rounded border border-slate-200">
                {selectedAudit.missingItems.map((item) => (
                  <div key={item.assetQaCode} className="border-b border-slate-100 px-3 py-2 text-sm">
                    <p className="font-medium text-slate-700">
                      {item.assetQaCode} - {item.assetName}
                    </p>
                    <p className="text-xs text-slate-500">
                      Trạng thái: {item.resolutionStatus} {item.resolvedByUsername ? `• ${item.resolvedByUsername}` : ''}
                    </p>
                    {item.resolutionStatus === 'PENDING' && (
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleResolveFound(item.assetQaCode)}
                          className="rounded border border-emerald-300 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                        >
                          Đã tìm thấy thiết bị
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResolveLost(item.assetQaCode)}
                          className="rounded border border-red-300 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                        >
                          Đã mất hẳn
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {selectedAudit.missingItems.length === 0 && <p className="px-3 py-2 text-sm text-slate-500">Không có thiết bị thất lạc.</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default InventoryAuditManagement
