import { IconDeviceFloppy as Save, IconRefresh as Refresh } from '@tabler/icons-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import axiosClient from '../../api/axiosClient'
import { formatVietnamDateTime } from '../../utils/datetime'

const EMPTY_FORM = {
  assetResponseSlaMinutes: 30,
  consumableResponseSlaMinutes: 45,
  overdueReminderIntervalHours: 24,
  largeQuantityThreshold: 20,
  highValueThreshold: 5000000,
}

function InquiryWorkflowSettings() {
  const [form, setForm] = useState(EMPTY_FORM)
  const [metadata, setMetadata] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadSettings = useCallback(async () => {
    setLoading(true)
    try {
      const response = await axiosClient.get('/api/inquiry-workflow-settings')
      setForm({
        assetResponseSlaMinutes: response.data.assetResponseSlaMinutes,
        consumableResponseSlaMinutes: response.data.consumableResponseSlaMinutes,
        overdueReminderIntervalHours: response.data.overdueReminderIntervalHours,
        largeQuantityThreshold: response.data.largeQuantityThreshold,
        highValueThreshold: response.data.highValueThreshold,
      })
      setMetadata(response.data)
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Không tải được cấu hình luồng yêu cầu.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSettings(), 0)
    return () => window.clearTimeout(timer)
  }, [loadSettings])

  const updateNumber = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }))
  }

  const saveSettings = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, Number(value)]))
      const response = await axiosClient.put('/api/inquiry-workflow-settings', payload)
      setMetadata(response.data)
      setForm((current) => ({ ...current, ...payload }))
      toast.success('Đã lưu cấu hình SLA và ngưỡng phê duyệt.')
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Không lưu được cấu hình.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="rounded-3xl bg-white p-6 text-sm text-slate-500 shadow-sm">Đang tải cấu hình...</div>
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-600">Luồng yêu cầu</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">SLA và ngưỡng phê duyệt</h1>
          <p className="mt-2 text-sm text-slate-500">Áp dụng cho các yêu cầu tạo mới; dữ liệu và thời hạn của yêu cầu cũ không bị thay đổi.</p>
        </div>
        <button type="button" onClick={() => void loadSettings()} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-600"><Refresh size={17} /> Tải lại</button>
      </header>

      <form onSubmit={saveSettings} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm font-semibold text-slate-700 dark:text-slate-200">SLA phản hồi yêu cầu mượn (phút)<input required type="number" min="5" max="1440" value={form.assetResponseSlaMinutes} onChange={updateNumber('assetResponseSlaMinutes')} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" /></label>
          <label className="space-y-2 text-sm font-semibold text-slate-700 dark:text-slate-200">SLA phản hồi yêu cầu vật tư (phút)<input required type="number" min="5" max="1440" value={form.consumableResponseSlaMinutes} onChange={updateNumber('consumableResponseSlaMinutes')} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" /></label>
          <label className="space-y-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Chu kỳ nhắc quá hạn (giờ)<input required type="number" min="1" max="168" value={form.overdueReminderIntervalHours} onChange={updateNumber('overdueReminderIntervalHours')} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" /></label>
          <label className="space-y-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Ngưỡng số lượng cần Admin duyệt<input required type="number" min="1" max="1000000" value={form.largeQuantityThreshold} onChange={updateNumber('largeQuantityThreshold')} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" /></label>
          <label className="space-y-2 text-sm font-semibold text-slate-700 dark:text-slate-200 md:col-span-2">Ngưỡng giá trị cần Admin duyệt (VNĐ)<input required type="number" min="0" step="1000" value={form.highValueThreshold} onChange={updateNumber('highValueThreshold')} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" /><span className="block text-xs font-normal text-slate-400">Giá trị được tính bằng giá mua của vật tư nhân với số lượng yêu cầu. Đặt 0 để chỉ dùng ngưỡng số lượng.</span></label>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <p className="text-xs text-slate-400">{metadata?.updatedAt ? `Cập nhật gần nhất bởi ${metadata.updatedByName || 'hệ thống'} lúc ${formatVietnamDateTime(metadata.updatedAt)}` : 'Đang dùng cấu hình mặc định của hệ thống.'}</p>
          <button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Save size={18} /> {saving ? 'Đang lưu...' : 'Lưu cấu hình'}</button>
        </div>
      </form>
    </div>
  )
}

export default InquiryWorkflowSettings
