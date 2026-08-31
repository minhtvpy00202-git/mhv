/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import axiosClient from '../api/axiosClient'
import { DEFAULT_BRANDING } from '../config/branding'
import { darkenHexColor, hexToRgb, normalizeHexColor } from '../utils/brandingTheme'

// Context dùng chung để toàn bộ ứng dụng đọc và cập nhật cấu hình thương hiệu từ một nơi duy nhất.
const BrandingContext = createContext(null)

// Provider bọc app để cấp branding, trạng thái loading và các hàm thao tác cho component con.
export function BrandingProvider({ children }) {
  // Lưu branding đang được áp dụng trong toàn ứng dụng, mặc định lấy từ cấu hình local.
  const [branding, setBranding] = useState(DEFAULT_BRANDING)
  // Đánh dấu lần tải branding đầu tiên từ backend đã xong hay chưa.
  const [loading, setLoading] = useState(true)

  // Gọi API lấy branding hiện tại từ backend và đồng bộ vào state context.
  const refreshBranding = useCallback(async () => {
    try {
      // API lấy cấu hình thương hiệu hiện đang được hệ thống sử dụng.
      const response = await axiosClient.get('/api/branding')
      // Nếu backend trả dữ liệu rỗng thì dùng fallback mặc định.
      setBranding(response.data || DEFAULT_BRANDING)
    } catch {
      // Nếu lỗi mạng hoặc backend lỗi, vẫn giữ app chạy bằng branding mặc định.
      setBranding(DEFAULT_BRANDING)
    } finally {
      // Kết thúc lần tải đầu tiên để các màn hình có thể mở khóa giao diện.
      setLoading(false)
    }
  }, [])

  // Gọi API cập nhật branding rồi đẩy dữ liệu mới xuống toàn bộ ứng dụng.
  const updateBranding = useCallback(async (payload) => {
    // API lưu cấu hình thương hiệu mới do admin nhập.
    const response = await axiosClient.put('/api/branding', payload)
    // Chuẩn bị branding mới trả về từ backend hoặc fallback nếu backend không trả body.
    const nextBranding = response.data || DEFAULT_BRANDING
    // Ghi branding mới vào state để toàn app đổi giao diện ngay lập tức.
    setBranding(nextBranding)
    // Trả kết quả cho component gọi hàm nếu cần dùng tiếp.
    return nextBranding
  }, [])

  // Khi provider mount lần đầu, tự động tải branding hiện tại từ backend.
  useEffect(() => {
    void refreshBranding()
  }, [refreshBranding])

  // Mỗi khi màu chủ đạo đổi, cập nhật CSS variables để toàn bộ theme phản ánh ngay màu mới.
  useEffect(() => {
    // Chuẩn hóa màu đầu vào để chắc chắn luôn có mã hex hợp lệ.
    const primaryColor = normalizeHexColor(branding.primaryColor, DEFAULT_BRANDING.primaryColor)
    // Tách màu hex sang RGB để dùng cho các hiệu ứng opacity trong CSS.
    const { r, g, b } = hexToRgb(primaryColor)
    // Tạo thêm bản màu tối hơn dùng cho hover hoặc trạng thái nhấn.
    const primaryDark = darkenHexColor(primaryColor)
    // Gán CSS variable màu chính để toàn bộ app có thể dùng thống nhất.
    document.documentElement.style.setProperty('--brand-primary', primaryColor)
    // Gán CSS variable màu đậm hơn cho các trạng thái hover/active.
    document.documentElement.style.setProperty('--brand-primary-dark', primaryDark)
    // Gán RGB thô để dùng trong các lớp cần opacity như rgba(var(--brand-primary-rgb), alpha).
    document.documentElement.style.setProperty('--brand-primary-rgb', `${r} ${g} ${b}`)
  }, [branding.primaryColor])

  // Gộp dữ liệu và các hàm thao tác thành value duy nhất để cấp qua context.
  const value = useMemo(
    () => ({
      branding,
      loading,
      refreshBranding,
      updateBranding,
    }),
    [branding, loading, refreshBranding, updateBranding],
  )

  // Bọc toàn bộ children bằng BrandingContext để các component con có thể truy cập useBranding().
  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>
}

// Hook tiện ích để đọc BrandingContext mà không phải gọi useContext trực tiếp ở nhiều nơi.
export function useBranding() {
  const context = useContext(BrandingContext)
  if (!context) {
    // Báo lỗi rõ ràng nếu hook bị dùng sai vị trí, ngoài phạm vi provider.
    throw new Error('useBranding must be used within BrandingProvider')
  }
  // Trả về branding và các hàm thao tác cho component đang gọi hook.
  return context
}
