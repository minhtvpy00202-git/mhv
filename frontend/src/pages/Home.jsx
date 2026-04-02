import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'

const PAGE_SIZE = 5

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('vi-VN')
}

function Pagination({ page, totalPages, onFirst, onPrev, onNext, onLast }) {
  return (
    <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
      <p>
        Trang {page} / {totalPages}
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={onFirst} disabled={page <= 1} className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50">
          Đầu
        </button>
        <button type="button" onClick={onPrev} disabled={page <= 1} className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50">
          Trước
        </button>
        <button type="button" onClick={onNext} disabled={page >= totalPages} className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50">
          Sau
        </button>
        <button type="button" onClick={onLast} disabled={page >= totalPages} className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50">
          Cuối
        </button>
      </div>
    </div>
  )
}

function Home() {
  const navigate = useNavigate()
  const [usageHistory, setUsageHistory] = useState([])
  const [maintenanceHistory, setMaintenanceHistory] = useState([])
  const [auditHistory, setAuditHistory] = useState([])
  const [ticketId, setTicketId] = useState('')
  const [previewImageUrl, setPreviewImageUrl] = useState('')
  const [usagePage, setUsagePage] = useState(1)
  const [maintenancePage, setMaintenancePage] = useState(1)
  const [auditPage, setAuditPage] = useState(1)

  useEffect(() => {
    const loadData = async () => {
      try {
        const [usageRes, maintenanceRes, auditRes] = await Promise.all([
          axiosClient.get('/api/usage/history/me'),
          axiosClient.get('/api/maintenance/history/me'),
          axiosClient.get('/api/inventory-audits/history/me'),
        ])
        setUsageHistory(usageRes.data || [])
        setMaintenanceHistory(maintenanceRes.data || [])
        setAuditHistory(auditRes.data || [])
        setUsagePage(1)
        setMaintenancePage(1)
        setAuditPage(1)
      } catch (error) {
        const message = error?.response?.data?.message || 'Không tải được lịch sử trang chủ.'
        toast.error(message)
      }
    }
    loadData()
  }, [])

  const usageTotalPages = Math.max(1, Math.ceil(usageHistory.length / PAGE_SIZE))
  const maintenanceTotalPages = Math.max(1, Math.ceil(maintenanceHistory.length / PAGE_SIZE))
  const auditTotalPages = Math.max(1, Math.ceil(auditHistory.length / PAGE_SIZE))

  const usageRows = useMemo(() => {
    const start = (usagePage - 1) * PAGE_SIZE
    return usageHistory.slice(start, start + PAGE_SIZE)
  }, [usageHistory, usagePage])

  const maintenanceRows = useMemo(() => {
    const start = (maintenancePage - 1) * PAGE_SIZE
    return maintenanceHistory.slice(start, start + PAGE_SIZE)
  }, [maintenanceHistory, maintenancePage])

  const auditRows = useMemo(() => {
    const start = (auditPage - 1) * PAGE_SIZE
    return auditHistory.slice(start, start + PAGE_SIZE)
  }, [auditHistory, auditPage])

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800">Xin chào nhân viên</h2>
        <p className="mt-1 text-sm text-slate-600">Dưới đây là lịch sử thao tác của tài khoản đang đăng nhập.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={ticketId}
            onChange={(event) => setTicketId(event.target.value.replace(/\D/g, ''))}
            placeholder="Nhập mã ticket để mở chat"
            className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-fptOrange"
          />
          <button
            type="button"
            onClick={() => {
              if (!ticketId) {
                toast.error('Vui lòng nhập mã ticket.')
                return
              }
              navigate(`/mobile/tickets/${ticketId}`)
            }}
            className="rounded-lg bg-fptOrange px-3 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark"
          >
            Mở chat ticket
          </button>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-base font-semibold text-slate-800">Lịch sử mượn/trả</h3>
        <div className="overflow-auto rounded border border-slate-200">
          <table className="min-w-[900px] text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left">Mã thiết bị</th>
                <th className="px-3 py-2 text-left">Tên thiết bị</th>
                <th className="px-3 py-2 text-left">Phòng gốc</th>
                <th className="px-3 py-2 text-left">Phòng đích</th>
                <th className="px-3 py-2 text-left">Ngày giờ mượn</th>
                <th className="px-3 py-2 text-left">Ngày giờ trả</th>
              </tr>
            </thead>
            <tbody>
              {usageRows.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{item.assetQaCode}</td>
                  <td className="px-3 py-2">{item.assetName}</td>
                  <td className="px-3 py-2">{item.homeLocationName}</td>
                  <td className="px-3 py-2">{item.borrowedLocationName}</td>
                  <td className="px-3 py-2">{formatDateTime(item.startTime)}</td>
                  <td className="px-3 py-2">{formatDateTime(item.endTime)}</td>
                </tr>
              ))}
              {usageRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-3 text-center text-slate-500">
                    Chưa có dữ liệu mượn/trả.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={usagePage}
          totalPages={usageTotalPages}
          onFirst={() => setUsagePage(1)}
          onPrev={() => setUsagePage((prev) => Math.max(1, prev - 1))}
          onNext={() => setUsagePage((prev) => Math.min(usageTotalPages, prev + 1))}
          onLast={() => setUsagePage(usageTotalPages)}
        />
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-base font-semibold text-slate-800">Lịch sử báo hỏng</h3>
        <div className="overflow-auto rounded border border-slate-200">
          <table className="min-w-[900px] text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left">Mã thiết bị</th>
                <th className="px-3 py-2 text-left">Tên thiết bị</th>
                <th className="px-3 py-2 text-left">Phòng gốc</th>
                <th className="px-3 py-2 text-left">Phòng hiện tại</th>
                <th className="px-3 py-2 text-left">Ngày giờ báo hỏng</th>
                <th className="px-3 py-2 text-left">Trạng thái</th>
                <th className="px-3 py-2 text-left">Ảnh lỗi</th>
              </tr>
            </thead>
            <tbody>
              {maintenanceRows.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{item.assetQaCode}</td>
                  <td className="px-3 py-2">{item.assetName}</td>
                  <td className="px-3 py-2">{item.homeLocationName}</td>
                  <td className="px-3 py-2">{item.currentLocationName}</td>
                  <td className="px-3 py-2">{formatDateTime(item.reportTime)}</td>
                  <td className="px-3 py-2">{item.assetStatus}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!item.imageUrl) {
                          toast.info('Bản ghi này chưa có ảnh lỗi.')
                          return
                        }
                        setPreviewImageUrl(item.imageUrl)
                      }}
                      className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Lỗi
                    </button>
                  </td>
                </tr>
              ))}
              {maintenanceRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-3 text-center text-slate-500">
                    Chưa có dữ liệu báo hỏng.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={maintenancePage}
          totalPages={maintenanceTotalPages}
          onFirst={() => setMaintenancePage(1)}
          onPrev={() => setMaintenancePage((prev) => Math.max(1, prev - 1))}
          onNext={() => setMaintenancePage((prev) => Math.min(maintenanceTotalPages, prev + 1))}
          onLast={() => setMaintenancePage(maintenanceTotalPages)}
        />
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-base font-semibold text-slate-800">Lịch sử kiểm kê</h3>
        <div className="overflow-auto rounded border border-slate-200">
          <table className="min-w-[900px] text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left">Mã phiên</th>
                <th className="px-3 py-2 text-left">Phòng kiểm kê</th>
                <th className="px-3 py-2 text-left">Bắt đầu</th>
                <th className="px-3 py-2 text-left">Hoàn thành</th>
                <th className="px-3 py-2 text-left">Dự kiến</th>
                <th className="px-3 py-2 text-left">Đã quét</th>
                <th className="px-3 py-2 text-left">Thất lạc</th>
                <th className="px-3 py-2 text-left">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {auditRows.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">#{item.id}</td>
                  <td className="px-3 py-2">{item.locationName}</td>
                  <td className="px-3 py-2">{formatDateTime(item.startedAt)}</td>
                  <td className="px-3 py-2">{formatDateTime(item.completedAt)}</td>
                  <td className="px-3 py-2">{item.expectedCount ?? 0}</td>
                  <td className="px-3 py-2">{item.scannedCount ?? 0}</td>
                  <td className="px-3 py-2">{item.missingCount ?? 0}</td>
                  <td className="px-3 py-2">{item.status}</td>
                </tr>
              ))}
              {auditRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-3 text-center text-slate-500">
                    Chưa có dữ liệu kiểm kê.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={auditPage}
          totalPages={auditTotalPages}
          onFirst={() => setAuditPage(1)}
          onPrev={() => setAuditPage((prev) => Math.max(1, prev - 1))}
          onNext={() => setAuditPage((prev) => Math.min(auditTotalPages, prev + 1))}
          onLast={() => setAuditPage(auditTotalPages)}
        />
      </section>
      {previewImageUrl && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4">
          <div className="rounded-2xl bg-white p-4 shadow-xl">
            <img src={previewImageUrl} alt="error-preview" className="h-[300px] w-[300px] rounded-lg object-cover" />
            <button
              type="button"
              onClick={() => setPreviewImageUrl('')}
              className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Home
