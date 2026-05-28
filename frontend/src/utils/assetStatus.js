export const itemizedStatusOptions = [
  { value: 'Sẵn sàng', label: 'Hoạt động tốt' },
  { value: 'Đang sử dụng', label: 'Đang cho mượn' },
  { value: 'Hỏng', label: 'Hỏng' },
  { value: 'Bảo trì', label: 'Đang sửa chữa' },
  { value: 'Thất lạc', label: 'Thất lạc' },
]

export const technicalStatusOptions = [
  { value: 'Hoạt động tốt', label: 'Hoạt động tốt' },
  { value: 'Hỏng', label: 'Hỏng' },
  { value: 'Thất lạc', label: 'Thất lạc' },
]

export const usageStatusOptions = [
  { value: 'Tại vị trí gốc', label: 'Tại vị trí gốc' },
  { value: 'Đang cho mượn', label: 'Đang cho mượn' },
]

export function getAssetStatusMeta(status) {
  const raw = String(status || '').trim()

  switch (raw) {
    case 'Sẵn sàng':
    case 'Hoạt động tốt':
      return {
        value: 'Sẵn sàng',
        label: 'Hoạt động tốt',
        tone: 'emerald',
      }
    case 'Đang sử dụng':
    case 'Đang cho mượn':
      return {
        value: 'Đang sử dụng',
        label: 'Đang cho mượn',
        tone: 'blue',
      }
    case 'Hỏng':
      return {
        value: 'Hỏng',
        label: 'Hỏng',
        tone: 'red',
      }
    case 'Bảo trì':
    case 'Đang sửa chữa':
      return {
        value: 'Bảo trì',
        label: 'Đang sửa chữa',
        tone: 'amber',
      }
    case 'Thất lạc':
      return {
        value: 'Thất lạc',
        label: 'Thất lạc',
        tone: 'slate',
      }
    default:
      return {
        value: raw || '',
        label: raw || '-',
        tone: 'slate',
      }
  }
}

export function getAssetStatusLabel(status, fallback = '-') {
  const meta = getAssetStatusMeta(status)
  return meta.label || fallback
}

export function getTechnicalStatusMeta(status) {
  const raw = String(status || '').trim()

  switch (raw) {
    case 'Sẵn sàng':
    case 'Hoạt động tốt':
      return {
        value: 'Hoạt động tốt',
        label: 'Hoạt động tốt',
        tone: 'emerald',
      }
    case 'Bảo trì':
    case 'Đang sửa chữa':
    case 'Hỏng':
      return {
        value: 'Hỏng',
        label: 'Hỏng',
        tone: 'red',
      }
    case 'Thất lạc':
      return {
        value: 'Thất lạc',
        label: 'Thất lạc',
        tone: 'slate',
      }
    default:
      return {
        value: raw || '',
        label: raw || '-',
        tone: 'slate',
      }
  }
}

export function getUsageStatusMeta(status) {
  const raw = String(status || '').trim()

  switch (raw) {
    case 'Đang sử dụng':
    case 'Đang cho mượn':
      return {
        value: 'Đang cho mượn',
        label: 'Đang cho mượn',
        tone: 'blue',
      }
    case 'Sẵn sàng':
    case 'Hoạt động tốt':
    case 'Tại vị trí gốc':
      return {
        value: 'Tại vị trí gốc',
        label: 'Tại vị trí gốc',
        tone: 'emerald',
      }
    default:
      return {
        value: raw || '',
        label: raw || '-',
        tone: 'slate',
      }
  }
}

export function getTechnicalStatusLabel(status, fallback = '-') {
  const meta = getTechnicalStatusMeta(status)
  return meta.label || fallback
}

export function getUsageStatusLabel(status, fallback = '-') {
  const meta = getUsageStatusMeta(status)
  return meta.label || fallback
}
