import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { useBranding } from '../../context/BrandingContext'
import { normalizeHexColor, toRgba } from '../../utils/brandingTheme'

// Màn hình cấu hình thương hiệu cho phép admin thay đổi tên hiển thị và màu nhận diện của hệ thống.
function BrandingSettings() {
  // Lấy dữ liệu branding hiện tại, trạng thái tải ban đầu và hàm cập nhật từ context dùng chung.
  const { branding, loading, updateBranding } = useBranding()
  // Form cục bộ để người dùng nhập trước khi bấm lưu.
  const [form, setForm] = useState({
    companyName: '',
    legalEntityName: '',
    taxCode: '',
    appName: '',
    primaryColor: '',
    address: '',
    phoneNumber: '',
  })
  // Dùng để khóa nút lưu khi đang gửi request cập nhật.
  const [submitting, setSubmitting] = useState(false)

  // Mỗi khi branding trong context đổi, đổ lại dữ liệu vào form để UI luôn bám theo cấu hình mới nhất.
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

  // Xử lý submit form: kiểm tra dữ liệu bắt buộc, chuẩn hóa đầu vào và gọi API cập nhật branding.
  const handleSubmit = async (event) => {
    // Ngăn form reload lại trang theo hành vi mặc định của trình duyệt.
    event.preventDefault()
    // Bắt buộc phải có tên viết tắt vì giá trị này dùng ở nhiều vị trí như sidebar và tiêu đề.
    if (!form.companyName.trim()) {
      toast.error('Vui lòng nhập tên viết tắt.')
      return
    }
    // Bắt buộc phải có tên ứng dụng để ghép thành tên đầy đủ hiển thị trên giao diện.
    if (!form.appName.trim()) {
      toast.error('Vui lòng nhập tên ứng dụng.')
      return
    }
    // Chỉ chấp nhận mã màu hex 6 ký tự để đảm bảo backend và UI xử lý đồng nhất.
    if (!/^#([0-9a-fA-F]{6})$/.test(form.primaryColor.trim())) {
      toast.error('Màu sắc chủ đạo phải có dạng #RRGGBB.')
      return
    }
    // Bật trạng thái gửi để disable nút và tránh bấm lặp nhiều lần.
    setSubmitting(true)
    try {
      // Gửi payload đã được trim để tránh lưu dữ liệu bị dư khoảng trắng.
      await updateBranding({
        companyName: form.companyName.trim(),
        legalEntityName: form.legalEntityName.trim(),
        taxCode: form.taxCode.trim(),
        appName: form.appName.trim(),
        primaryColor: form.primaryColor.trim(),
        address: form.address.trim(),
        phoneNumber: form.phoneNumber.trim(),
      })
      // Báo thành công nếu backend lưu branding xong.
      toast.success('Đã cập nhật cấu hình thương hiệu hệ thống.')
    } catch (error) {
      // Ưu tiên lấy message backend trả về, nếu không có thì dùng thông báo mặc định.
      const message = error?.response?.data?.message || 'Không thể cập nhật cấu hình thương hiệu.'
      toast.error(message)
    } finally {
      // Dù thành công hay thất bại cũng phải mở lại nút lưu.
      setSubmitting(false)
    }
  }

  // Chuẩn hóa màu preview để luôn có một màu hợp lệ dùng cho phần xem trước.
  const previewPrimaryColor = normalizeHexColor(form.primaryColor || branding.primaryColor)

  return (
    <div className="space-y-6">
      {/* Khối tiêu đề giải thích mục đích của trang cấu hình branding. */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Cấu hình hệ thống</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-800 dark:text-slate-100">Cấu hình thương hiệu hệ thống</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
          Các giá trị này được dùng để hiển thị trên sidebar, tiêu đề trình duyệt, màn đăng nhập, biên bản Word và màu nhấn chính của giao diện.
        </p>
      </div>

      {/* Form chính bên trái và khối xem trước bên phải. */}
      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Cột trái chứa toàn bộ input cấu hình thương hiệu. */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="grid gap-5">
            {/* Tên pháp lý đầy đủ của doanh nghiệp. */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Tên doanh nghiệp</label>
              <input
                value={form.legalEntityName}
                onChange={(event) => setForm((prev) => ({ ...prev, legalEntityName: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-orange-400 dark:focus:ring-orange-500/20"
                placeholder="Công ty TNHH ABC..."
              />
            </div>

            {/* Hàng gồm tên viết tắt và mã số thuế vì hai trường này thường được cấu hình cùng nhau. */}
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

            {/* Tên ứng dụng nghiệp vụ sẽ được ghép với tên viết tắt để hiển thị ở nhiều nơi. */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Tên ứng dụng</label>
              <input
                value={form.appName}
                onChange={(event) => setForm((prev) => ({ ...prev, appName: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-orange-400 dark:focus:ring-orange-500/20"
                placeholder="Ví dụ: Asset Management"
              />
            </div>

            {/* Cặp input chọn màu giúp người dùng vừa pick bằng UI vừa có thể nhập mã hex thủ công. */}
            <div className="grid gap-5 md:grid-cols-[120px_minmax(0,1fr)]">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Màu chủ đạo</label>
                <input
                  // Color picker giúp chọn nhanh màu chủ đạo trực quan.
                  type="color"
                  value={normalizeHexColor(form.primaryColor || '#f27025')}
                  // Ép về chữ hoa để mã màu hiển thị nhất quán trong toàn hệ thống.
                  onChange={(event) => setForm((prev) => ({ ...prev, primaryColor: event.target.value.toUpperCase() }))}
                  className="h-11 w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-1 py-1 dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Mã màu HEX</label>
                <input
                  // Ô nhập tay cho phép paste hoặc chỉnh chính xác mã màu.
                  value={form.primaryColor}
                  onChange={(event) => setForm((prev) => ({ ...prev, primaryColor: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm uppercase text-slate-700 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-orange-400 dark:focus:ring-orange-500/20"
                  placeholder="#F27025"
                />
              </div>
            </div>

            {/* Địa chỉ doanh nghiệp hoặc đơn vị vận hành. */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Địa chỉ</label>
              <input
                value={form.address}
                onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-orange-400 dark:focus:ring-orange-500/20"
                placeholder="Ví dụ: 123 Nguyễn Văn A, Hà Nội"
              />
            </div>

            {/* Số điện thoại liên hệ chính dùng cho phần hiển thị thương hiệu. */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Số điện thoại</label>
              <input
                value={form.phoneNumber}
                onChange={(event) => setForm((prev) => ({ ...prev, phoneNumber: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-orange-400 dark:focus:ring-orange-500/20"
                placeholder="Ví dụ: 0901234567"
              />
            </div>

            {/* Khu vực hành động, hiện tại chỉ có nút lưu cấu hình. */}
            <div className="flex items-center gap-3">
              <button
                type="submit"
                // Disable khi đang submit hoặc khi branding ban đầu vẫn đang được tải.
                disabled={submitting || loading}
                className="rounded-xl bg-fptOrange px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-60"
              >
                Lưu cấu hình
              </button>
            </div>
          </div>
        </div>

        {/* Cột phải mô phỏng nhanh kết quả branding để người dùng thấy ngay tác động của cấu hình. */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Xem trước</p>
          <div className="mt-4 space-y-4">
            {/* Xem trước phần sidebar admin với màu nhấn chính. */}
            <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800" style={{ backgroundColor: toRgba(previewPrimaryColor, 0.1), borderColor: toRgba(previewPrimaryColor, 0.24) }}>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Sidebar Admin</p>
              <p className="mt-1 text-lg font-semibold" style={{ color: previewPrimaryColor }}>{(form.companyName || 'FPT').trim()} Admin</p>
            </div>
            {/* Xem trước khối thông tin doanh nghiệp cơ bản. */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Thông tin doanh nghiệp</p>
              <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{form.legalEntityName || 'Chưa cấu hình tên doanh nghiệp'}</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{form.taxCode || 'Chưa cấu hình mã số thuế'}</p>
            </div>
            {/* Xem trước tên ứng dụng sau khi ghép tên viết tắt và tên app. */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Tên ứng dụng</p>
              <p className="mt-1 text-lg font-semibold text-slate-800 dark:text-slate-100">
                {`${(form.companyName || 'FPT').trim()} ${(form.appName || 'Asset Management').trim()}`.trim()}
              </p>
            </div>
            {/* Xem trước thông tin liên hệ để kiểm tra nhanh dữ liệu hiển thị. */}
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
