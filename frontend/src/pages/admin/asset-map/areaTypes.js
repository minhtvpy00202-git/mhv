export const CUSTOM_AREA_TYPE_KEY = '__custom__'

export const AREA_TYPE_GROUP_PRESETS = [
  {
    key: 'WORKSPACE_TRAINING',
    label: 'Không gian Làm việc & Đào tạo',
    description: 'Các không gian làm việc, họp hành, giảng dạy và đào tạo.',
  },
  {
    key: 'SPECIALIZED_OPERATION',
    label: 'Không gian Chuyên dụng & Vận hành',
    description: 'Các khu kỹ thuật, kho, y tế và khu vận hành chuyên trách.',
  },
  {
    key: 'AMENITY_COMMUNICATION',
    label: 'Không gian Tiện ích & Giao tiếp',
    description: 'Các khu đón tiếp, sinh hoạt chung, ăn uống và tổ chức sự kiện.',
  },
  {
    key: 'COMMON_CIRCULATION',
    label: 'Không gian Chung & Lưu thông',
    description: 'Các khu vực lưu thông và không gian chung vẫn có thể chứa tài sản cố định.',
  },
  {
    key: 'OUTDOOR',
    label: 'Không gian Ngoài trời',
    description: 'Các khu vực sân bãi, cổng, bãi xe và khuôn viên ngoài trời.',
  },
]

export const AREA_TYPE_PRESETS = [
  {
    key: 'OFFICE_DEPARTMENT',
    label: 'Văn phòng / Phòng ban',
    areaGroupKey: 'WORKSPACE_TRAINING',
    areaGroupLabel: 'Không gian Làm việc & Đào tạo',
    tone: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    dot: '#059669',
    description: 'Dùng cho phòng Marketing, phòng Giám đốc, phòng Kế toán hoặc phòng Giáo viên.',
  },
  {
    key: 'MEETING_ROOM',
    label: 'Phòng họp / Thảo luận',
    areaGroupKey: 'WORKSPACE_TRAINING',
    areaGroupLabel: 'Không gian Làm việc & Đào tạo',
    tone: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    dot: '#0891B2',
    description: 'Meeting room, phòng họp hội đồng hoặc không gian thảo luận nhóm.',
  },
  {
    key: 'CLASSROOM_TRAINING',
    label: 'Phòng học / Không gian đào tạo',
    areaGroupKey: 'WORKSPACE_TRAINING',
    areaGroupLabel: 'Không gian Làm việc & Đào tạo',
    tone: 'bg-violet-100 text-violet-700 border-violet-200',
    dot: '#7C3AED',
    description: 'Dùng cho lớp học ở trường hoặc phòng training nội bộ, onboarding ở công ty.',
  },
  {
    key: 'STORAGE_WAREHOUSE',
    label: 'Kho lưu trữ',
    areaGroupKey: 'SPECIALIZED_OPERATION',
    areaGroupLabel: 'Không gian Chuyên dụng & Vận hành',
    tone: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    dot: '#4F46E5',
    description: 'Kho vật tư, kho văn phòng phẩm hoặc kho thiết bị.',
  },
  {
    key: 'TECH_SERVER_ROOM',
    label: 'Phòng Kỹ thuật / Máy chủ',
    areaGroupKey: 'SPECIALIZED_OPERATION',
    areaGroupLabel: 'Không gian Chuyên dụng & Vận hành',
    tone: 'bg-red-100 text-red-700 border-red-200',
    dot: '#DC2626',
    description: 'Phòng Server, trạm điện hoặc khu kỹ thuật chuyên trách vận hành.',
  },
  {
    key: 'LAB_RD',
    label: 'Phòng Thí nghiệm / R&D',
    areaGroupKey: 'SPECIALIZED_OPERATION',
    areaGroupLabel: 'Không gian Chuyên dụng & Vận hành',
    tone: 'bg-blue-100 text-blue-700 border-blue-200',
    dot: '#2563EB',
    description: 'Phòng Lab trường học hoặc phòng nghiên cứu sản phẩm của công ty.',
  },
  {
    key: 'MEDICAL_ROOM',
    label: 'Phòng Y tế',
    areaGroupKey: 'SPECIALIZED_OPERATION',
    areaGroupLabel: 'Không gian Chuyên dụng & Vận hành',
    tone: 'bg-rose-100 text-rose-700 border-rose-200',
    dot: '#E11D48',
    description: 'Khu vực y tế, chăm sóc sức khỏe hoặc sơ cứu.',
  },
  {
    key: 'LOBBY_RECEPTION',
    label: 'Sảnh / Khu vực lễ tân',
    areaGroupKey: 'AMENITY_COMMUNICATION',
    areaGroupLabel: 'Không gian Tiện ích & Giao tiếp',
    tone: 'bg-amber-100 text-amber-700 border-amber-200',
    dot: '#D97706',
    description: 'Lobby, tiền sảnh hoặc nơi đón tiếp khách.',
  },
  {
    key: 'PANTRY_DINING',
    label: 'Khu vực ăn uống / Pantry',
    areaGroupKey: 'AMENITY_COMMUNICATION',
    areaGroupLabel: 'Không gian Tiện ích & Giao tiếp',
    tone: 'bg-orange-100 text-orange-700 border-orange-200',
    dot: '#EA580C',
    description: 'Nhà ăn sinh viên, căn tin hoặc khu vực pha trà, cà phê cho nhân viên.',
  },
  {
    key: 'EVENT_HALL',
    label: 'Khu vực sự kiện / Hội trường',
    areaGroupKey: 'AMENITY_COMMUNICATION',
    areaGroupLabel: 'Không gian Tiện ích & Giao tiếp',
    tone: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
    dot: '#C026D3',
    description: 'Nơi tổ chức sinh hoạt chung, hội thảo, sự kiện hoặc hội trường.',
  },
  {
    key: 'CORRIDOR_BALCONY',
    label: 'Hành lang / Ban công',
    areaGroupKey: 'COMMON_CIRCULATION',
    areaGroupLabel: 'Không gian Chung & Lưu thông',
    tone: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: '#64748B',
    description: 'Không gian chung và lưu thông, thường có camera, đèn, điều hòa hoặc thiết bị PCCC cố định.',
  },
  {
    key: 'STAIR_ELEVATOR',
    label: 'Cầu thang / Thang máy',
    areaGroupKey: 'COMMON_CIRCULATION',
    areaGroupLabel: 'Không gian Chung & Lưu thông',
    tone: 'bg-stone-100 text-stone-700 border-stone-200',
    dot: '#78716C',
    description: 'Khu vực di chuyển theo tầng, vẫn có thể chứa nhiều tài sản cố định như camera hoặc thiết bị an toàn.',
  },
  {
    key: 'RESTROOM',
    label: 'Nhà vệ sinh',
    areaGroupKey: 'COMMON_CIRCULATION',
    areaGroupLabel: 'Không gian Chung & Lưu thông',
    tone: 'bg-sky-100 text-sky-700 border-sky-200',
    dot: '#0284C7',
    description: 'Không gian tiện ích chung, vẫn có thể phát sinh thiết bị cố định phục vụ vận hành.',
  },
  {
    key: 'PARKING',
    label: 'Bãi đỗ xe',
    areaGroupKey: 'OUTDOOR',
    areaGroupLabel: 'Không gian Ngoài trời',
    tone: 'bg-lime-100 text-lime-700 border-lime-200',
    dot: '#65A30D',
    description: 'Khu vực gửi xe, trông xe hoặc đỗ phương tiện.',
  },
  {
    key: 'OUTDOOR_CAMPUS',
    label: 'Sân bãi / Khuôn viên',
    areaGroupKey: 'OUTDOOR',
    areaGroupLabel: 'Không gian Ngoài trời',
    tone: 'bg-teal-100 text-teal-700 border-teal-200',
    dot: '#0F766E',
    description: 'Bao gồm sân tập, sân bóng, sân sinh hoạt chung hoặc khuôn viên ngoài trời.',
  },
  {
    key: 'GATE_GUARD',
    label: 'Cổng / Trạm gác',
    areaGroupKey: 'OUTDOOR',
    areaGroupLabel: 'Không gian Ngoài trời',
    tone: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    dot: '#CA8A04',
    description: 'Cổng ra vào, chốt bảo vệ hoặc trạm gác kiểm soát truy cập.',
  },
]

const PRESET_BY_KEY = new Map(AREA_TYPE_PRESETS.map((preset) => [preset.key, preset]))
const GROUP_BY_KEY = new Map(AREA_TYPE_GROUP_PRESETS.map((group) => [group.key, group]))

function normalizeSpaces(value) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

export function normalizeAreaTypeLabel(label) {
  return normalizeSpaces(label)
}

export function slugifyAreaTypeLabel(label) {
  return normalizeAreaTypeLabel(label)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'custom-area'
}

export function isCustomAreaTypeKey(areaTypeKey) {
  const normalizedKey = normalizeSpaces(areaTypeKey)
  return normalizedKey === CUSTOM_AREA_TYPE_KEY || /^CUSTOM:/i.test(normalizedKey)
}

function resolveCatalogKey(entry) {
  return normalizeSpaces(entry?.typeKey || entry?.key).toUpperCase()
}

function resolveCatalogLabel(entry) {
  return normalizeAreaTypeLabel(entry?.label)
}

function resolveCatalogDescription(entry) {
  return normalizeAreaTypeLabel(entry?.description)
}

function resolveCatalogGroupKey(entry) {
  return normalizeSpaces(entry?.areaGroupKey || entry?.groupKey).toUpperCase()
}

function resolveCatalogGroupLabel(entry) {
  const normalizedLabel = normalizeAreaTypeLabel(entry?.areaGroupLabel || entry?.groupLabel)
  if (normalizedLabel) return normalizedLabel
  const presetGroup = GROUP_BY_KEY.get(resolveCatalogGroupKey(entry))
  return presetGroup?.label || 'Nhóm khác'
}

function toCatalogEntry(entry) {
  if (!entry) return null
  return {
    typeKey: resolveCatalogKey(entry),
    label: resolveCatalogLabel(entry),
    areaGroupKey: resolveCatalogGroupKey(entry),
    areaGroupLabel: resolveCatalogGroupLabel(entry),
    description: resolveCatalogDescription(entry),
    builtIn: entry?.builtIn !== false,
  }
}

export function getAreaTypePreset(areaTypeKey, catalogOptions = AREA_TYPE_PRESETS) {
  const normalizedKey = normalizeSpaces(areaTypeKey).toUpperCase()
  if (!normalizedKey) return null

  const catalogMatch = (catalogOptions || [])
    .map(toCatalogEntry)
    .find((entry) => entry?.typeKey === normalizedKey)
  if (catalogMatch) {
    return catalogMatch
  }

  const fallbackPreset = PRESET_BY_KEY.get(normalizedKey)
  return fallbackPreset
    ? {
      typeKey: fallbackPreset.key,
      label: fallbackPreset.label,
      areaGroupKey: fallbackPreset.areaGroupKey,
      areaGroupLabel: fallbackPreset.areaGroupLabel,
      description: fallbackPreset.description,
      builtIn: true,
    }
    : null
}

function buildCustomAreaTypeMeta(label, areaGroupLabel = 'Nhóm khác') {
  const normalizedLabel = normalizeAreaTypeLabel(label)
  return {
    key: `custom:${slugifyAreaTypeLabel(normalizedLabel)}`,
    filterKey: `type:${slugifyAreaTypeLabel(normalizedLabel)}`,
    label: normalizedLabel || 'Loại khu vực khác',
    areaGroupLabel: normalizeAreaTypeLabel(areaGroupLabel) || 'Nhóm khác',
    tone: 'bg-orange-100 text-orange-700 border-orange-200',
    dot: '#F97316',
    description: 'Loại khu vực do người dùng tự đặt tên để mô tả đúng thực tế vận hành.',
  }
}

function buildPresetMeta(preset) {
  const visualPreset = PRESET_BY_KEY.get(preset.typeKey || preset.key)
  return {
    key: String(preset.typeKey || preset.key || '').toLowerCase(),
    filterKey: `type:${String(preset.typeKey || preset.key || '').toLowerCase()}`,
    label: resolveCatalogLabel(preset),
    areaGroupKey: resolveCatalogGroupKey(preset),
    areaGroupLabel: resolveCatalogGroupLabel(preset),
    tone: visualPreset?.tone || 'bg-orange-100 text-orange-700 border-orange-200',
    dot: visualPreset?.dot || '#F97316',
    description: resolveCatalogDescription(preset) || 'Loại khu vực dùng để mô tả và phân loại không gian trong hệ thống.',
  }
}

function guessPresetAreaTypeKey(shape) {
  const normalizedName = normalizeAreaTypeLabel(shape?.roomName).toLowerCase()
  if (!normalizedName) {
    return null
  }

  if (/(van phong|phong ban|marketing|ke toan|giam doc|giao vien|office|department)/i.test(normalizedName)) return 'OFFICE_DEPARTMENT'
  if (/(hop|meeting|thao luan|hoi dong)/i.test(normalizedName)) return 'MEETING_ROOM'
  if (/(lop|phong hoc|training|dao tao|onboarding|classroom)/i.test(normalizedName)) return 'CLASSROOM_TRAINING'
  if (/(kho|storage|warehouse|vat tu|van phong pham)/i.test(normalizedName)) return 'STORAGE_WAREHOUSE'
  if (/(server|may chu|tram dien|ky thuat|technical)/i.test(normalizedName)) return 'TECH_SERVER_ROOM'
  if (/(thi nghiem|lab|r&d|nghien cuu)/i.test(normalizedName)) return 'LAB_RD'
  if (/(y te|medical|clinic)/i.test(normalizedName)) return 'MEDICAL_ROOM'
  if (/(sanh|le tan|lobby|reception)/i.test(normalizedName)) return 'LOBBY_RECEPTION'
  if (/(pantry|can tin|nha an|an uong|cafe|ca phe)/i.test(normalizedName)) return 'PANTRY_DINING'
  if (/(hoi truong|su kien|event|hall)/i.test(normalizedName)) return 'EVENT_HALL'
  if (/(hanh lang|ban cong|corridor|hallway|loi di)/i.test(normalizedName)) return 'CORRIDOR_BALCONY'
  if (/(cau thang|thang may|elevator|lift|stair)/i.test(normalizedName)) return 'STAIR_ELEVATOR'
  if (/(ve sinh|toilet|wc|restroom)/i.test(normalizedName)) return 'RESTROOM'
  if (/(bai do xe|parking)/i.test(normalizedName)) return 'PARKING'
  if (/(san|court|playground|field|khuon vien|campus|duong|road|san truong)/i.test(normalizedName)) return 'OUTDOOR_CAMPUS'
  if (/(cong|tram gac|guard|gate|bao ve|entrance|loi vao)/i.test(normalizedName)) return 'GATE_GUARD'
  return null
}

export function resolveAreaTypeMeta(shape, catalogOptions = AREA_TYPE_PRESETS) {
  const explicitPreset = getAreaTypePreset(shape?.areaTypeKey, catalogOptions)
  if (explicitPreset) {
    return buildPresetMeta(explicitPreset)
  }

  const explicitLabel = normalizeAreaTypeLabel(shape?.areaTypeLabel)
  if (explicitLabel) {
    return buildCustomAreaTypeMeta(explicitLabel)
  }

  const guessedPresetKey = guessPresetAreaTypeKey(shape)
  const guessedPreset = guessedPresetKey ? getAreaTypePreset(guessedPresetKey, catalogOptions) : null
  if (guessedPreset) {
    return buildPresetMeta(guessedPreset)
  }

  return buildCustomAreaTypeMeta(
    'Loại khu vực khác',
  )
}

export function resolveAreaTypeDraft(shape, catalogOptions = AREA_TYPE_PRESETS) {
  const explicitPreset = getAreaTypePreset(shape?.areaTypeKey, catalogOptions)
  if (explicitPreset) {
    return {
      areaTypeKey: explicitPreset.typeKey,
      areaTypeLabel: explicitPreset.label,
      areaGroupKey: explicitPreset.areaGroupKey,
      areaGroupLabel: explicitPreset.areaGroupLabel,
    }
  }

  const explicitLabel = normalizeAreaTypeLabel(shape?.areaTypeLabel)
  if (explicitLabel) {
    return {
      areaTypeKey: shape?.areaTypeKey || `CUSTOM:${slugifyAreaTypeLabel(explicitLabel)}`,
      areaTypeLabel: explicitLabel,
      areaGroupKey: '',
      areaGroupLabel: '',
    }
  }

  const guessedPresetKey = guessPresetAreaTypeKey(shape)
  const guessedPreset = guessedPresetKey ? getAreaTypePreset(guessedPresetKey, catalogOptions) : null
  if (guessedPreset) {
    return {
      areaTypeKey: guessedPreset.typeKey,
      areaTypeLabel: guessedPreset.label,
      areaGroupKey: guessedPreset.areaGroupKey,
      areaGroupLabel: guessedPreset.areaGroupLabel,
    }
  }

  return {
    areaTypeKey: '',
    areaTypeLabel: '',
    areaGroupKey: '',
    areaGroupLabel: '',
  }
}

export function buildAreaTypePayload(areaTypeKey, areaTypeLabel, catalogOptions = AREA_TYPE_PRESETS, areaGroupLabel = '') {
  const preset = getAreaTypePreset(areaTypeKey, catalogOptions)
  if (preset) {
    return {
      areaTypeKey: preset.typeKey,
      areaTypeLabel: preset.label,
      areaGroupKey: preset.areaGroupKey,
      areaGroupLabel: preset.areaGroupLabel,
    }
  }

  const normalizedLabel = normalizeAreaTypeLabel(areaTypeLabel)
  const normalizedGroupLabel = normalizeAreaTypeLabel(areaGroupLabel)
  if (!normalizedLabel) {
    return {
      areaTypeKey: '',
      areaTypeLabel: '',
      areaGroupKey: '',
      areaGroupLabel: '',
    }
  }

  return {
    areaTypeKey: `CUSTOM:${slugifyAreaTypeLabel(normalizedLabel)}`,
    areaTypeLabel: normalizedLabel,
    areaGroupKey: normalizedGroupLabel ? slugifyAreaTypeLabel(normalizedGroupLabel).toUpperCase() : '',
    areaGroupLabel: normalizedGroupLabel,
  }
}

export function buildAreaGroupOptions(catalogOptions = AREA_TYPE_PRESETS) {
  const options = [...(catalogOptions || [])
    .map(toCatalogEntry)
    .filter(Boolean)
    .map((entry) => ({
      key: entry.areaGroupKey,
      label: entry.areaGroupLabel,
    }))]

  const existingKeys = new Set()
  return options
    .filter((option) => {
      if (!option.key || existingKeys.has(option.key)) return false
      existingKeys.add(option.key)
      return true
    })
    .sort((left, right) => left.label.localeCompare(right.label, 'vi'))
}

export function buildAreaTypeOptions(catalogOptions = AREA_TYPE_PRESETS, customOptions = []) {
  const options = [...(catalogOptions || [])
    .map(toCatalogEntry)
    .filter(Boolean)
    .map((preset) => ({
      key: preset.typeKey,
      label: preset.label,
      areaGroupKey: preset.areaGroupKey,
      areaGroupLabel: preset.areaGroupLabel,
      isCustom: !preset.builtIn,
      builtIn: preset.builtIn,
    }))]

  const existingKeys = new Set(options.map((option) => option.key))
  const existingLabels = new Set(options.map((option) => option.label.toLowerCase()))

  ;(customOptions || []).forEach((option) => {
    const normalizedLabel = normalizeAreaTypeLabel(option?.label)
    const normalizedKey = normalizeSpaces(option?.key) || `CUSTOM:${slugifyAreaTypeLabel(normalizedLabel)}`
    const normalizedGroupLabel = normalizeAreaTypeLabel(option?.areaGroupLabel)
    const normalizedGroupKey = normalizeSpaces(option?.areaGroupKey) || (normalizedGroupLabel ? slugifyAreaTypeLabel(normalizedGroupLabel).toUpperCase() : '')
    if (!normalizedLabel || existingKeys.has(normalizedKey) || existingLabels.has(normalizedLabel.toLowerCase())) {
      return
    }
    existingKeys.add(normalizedKey)
    existingLabels.add(normalizedLabel.toLowerCase())
    options.push({
      key: normalizedKey,
      label: normalizedLabel,
      areaGroupKey: normalizedGroupKey,
      areaGroupLabel: normalizedGroupLabel || 'Nhóm khác',
      isCustom: true,
    })
  })

  options.sort((left, right) => {
    const groupDelta = String(left.areaGroupLabel || '').localeCompare(String(right.areaGroupLabel || ''), 'vi')
    if (groupDelta !== 0) return groupDelta
    return left.label.localeCompare(right.label, 'vi')
  })

  return [
    ...options,
    {
      key: CUSTOM_AREA_TYPE_KEY,
      label: 'Thêm loại khác...',
      areaGroupKey: '',
      areaGroupLabel: '',
      isCustom: true,
    },
  ]
}
