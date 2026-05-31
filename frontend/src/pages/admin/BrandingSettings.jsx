import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { useBranding } from '../../context/BrandingContext'
import { normalizeHexColor, toRgba } from '../../utils/brandingTheme'

function BrandingSettings() {
  const { branding, loading, updateBranding } = useBranding()
  const [form, setForm] = useState({
    companyName: '',
    legalEntityName: '',
    taxCode: '',
    appName: '',
    primaryColor: '',
    address: '',
    phoneNumber: '',
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setForm({
      companyName: branding.companyName || '',
      legalEntityName: branding.legalEntityName || '',
      taxCode: branding.taxCode || '',
      appName: branding.appName || '',
      primaryColor: branding.primaryColor || '',
      address: branding.address || '',
      phoneNumber: branding.phoneNumber || '',
    })
  }, [branding.address, branding.appName, branding.companyName, branding.legalEntityName, branding.phoneNumber, branding.primaryColor, branding.taxCode])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!form.companyName.trim()) {
      toast.error('Vui lòng nhập tên viết tắt.')
      return
    }
    if (!form.appName.trim()) {
      toast.error('Vui lòng nhập tên ứng dụng.')
      return
    }
    if (!/^#([0-9a-fA-F]{6})$/.test(form.primaryColor.trim())) {
      toast.error('Màu sắc chủ đạo phải có dạng #RRGGBB.')
      return
    }
    setSubmitting(true)
    try {
      await updateBranding({
        companyName: form.companyName.trim(),
        legalEntityName: form.legalEntityName.trim(),
        taxCode: form.taxCode.trim(),
        appName: form.appName.trim(),
        primaryColor: form.primaryColor.trim(),
        address: form.address.trim(),
        phoneNumber: form.phoneNumber.trim(),
      })
      toast.success('Đã cập nhật cấu hình thương hiệu hệ thống.')
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể cập nhật cấu hình thương hiệu.'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const previewPrimaryColor = normalizeHexColor(form.primaryColor || branding.primaryColor)

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Cấu hình hệ thống</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-800 dark:text-slate-100">Cấu hình thương hiệu hệ thống</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
          Các giá trị này được dùng để hiển thị trên sidebar, tiêu đề trình duyệt, màn đăng nhập, biên bản Word và màu nhấn chính của giao diện.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="grid gap-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Tên doanh nghiệp</label>
              <input
                value={form.legalEntityName}
                onChange={(event) => setForm((prev) => ({ ...prev, legalEntityName: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-orange-400 dark:focus:ring-orange-500/20"
                placeholder="Công ty TNHH ABC..."
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Tên viết tắt</label>
                <input
                  value={form.companyName}
                  onChange={(event) => setForm((prev) => ({ ...prev, companyName: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-orange-400 dark:focus:ring-orange-500/20"
                  placeholder="Ví dụ: ABC"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Mã số thuế</label>
                <input
                  value={form.taxCode}
                  onChange={(event) => setForm((prev) => ({ ...prev, taxCode: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-orange-400 dark:focus:ring-orange-500/20"
                  placeholder="Ví dụ: 0312345678"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Tên ứng dụng</label>
              <input
                value={form.appName}
                onChange={(event) => setForm((prev) => ({ ...prev, appName: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-orange-400 dark:focus:ring-orange-500/20"
                placeholder="Ví dụ: Asset Management"
              />
            </div>

            <div className="grid gap-5 md:grid-cols-[120px_minmax(0,1fr)]">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Màu chủ đạo</label>
                <input
                  type="color"
                  value={normalizeHexColor(form.primaryColor || '#f27025')}
                  onChange={(event) => setForm((prev) => ({ ...prev, primaryColor: event.target.value.toUpperCase() }))}
                  className="h-11 w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-1 py-1 dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Mã màu HEX</label>
                <input
                  value={form.primaryColor}
                  onChange={(event) => setForm((prev) => ({ ...prev, primaryColor: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm uppercase text-slate-700 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-orange-400 dark:focus:ring-orange-500/20"
                  placeholder="#F27025"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Địa chỉ</label>
              <input
                value={form.address}
                onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-orange-400 dark:focus:ring-orange-500/20"
                placeholder="Ví dụ: 123 Nguyễn Văn A, Hà Nội"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Số điện thoại</label>
              <input
                value={form.phoneNumber}
                onChange={(event) => setForm((prev) => ({ ...prev, phoneNumber: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-orange-400 dark:focus:ring-orange-500/20"
                placeholder="Ví dụ: 0901234567"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={submitting || loading}
                className="rounded-xl bg-fptOrange px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-60"
              >
                Lưu cấu hình
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Xem trước</p>
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800" style={{ backgroundColor: toRgba(previewPrimaryColor, 0.1), borderColor: toRgba(previewPrimaryColor, 0.24) }}>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Sidebar Admin</p>
              <p className="mt-1 text-lg font-semibold" style={{ color: previewPrimaryColor }}>{(form.companyName || 'FPT').trim()} Admin</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Thông tin doanh nghiệp</p>
              <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{form.legalEntityName || 'Chưa cấu hình tên doanh nghiệp'}</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{form.taxCode || 'Chưa cấu hình mã số thuế'}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Tên ứng dụng</p>
              <p className="mt-1 text-lg font-semibold text-slate-800 dark:text-slate-100">
                {`${(form.companyName || 'FPT').trim()} ${(form.appName || 'Asset Management').trim()}`.trim()}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Thông tin liên hệ</p>
              <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">{form.address || 'Chưa cấu hình địa chỉ'}</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{form.phoneNumber || 'Chưa cấu hình số điện thoại'}</p>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}

export default BrandingSettings
