export const CUSTOM_AREA_TYPE_KEY = '__custom__'

export const AREA_TYPE_PRESETS = [
  {
    key: 'ROOM',
    label: 'Phòng',
    defaultHasAsset: true,
    tone: 'bg-violet-100 text-violet-700 border-violet-200',
    dot: '#7C3AED',
    description: 'Phòng hoặc khu chức năng có thể dùng để định vị tài sản.',
  },
  {
    key: 'TRAINING_AREA',
    label: 'Sân tập',
    defaultHasAsset: true,
    tone: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    dot: '#0891B2',
    description: 'Khu vực sinh hoạt, luyện tập hoặc sân chức năng có thể gắn tài sản.',
  },
  {
    key: 'WAREHOUSE',
    label: 'Kho',
    defaultHasAsset: true,
    tone: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    dot: '#4F46E5',
    description: 'Khu vực kho hoặc nơi lưu trữ vật tư, thiết bị.',
  },
  {
    key: 'OFFICE',
    label: 'Văn phòng',
    defaultHasAsset: true,
    tone: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    dot: '#059669',
    description: 'Khu vực làm việc hoặc phòng ban có thể quản lý tài sản.',
  },
  {
    key: 'LAB',
    label: 'Phòng thí nghiệm',
    defaultHasAsset: true,
    tone: 'bg-blue-100 text-blue-700 border-blue-200',
    dot: '#2563EB',
    description: 'Phòng chức năng chuyên môn, thường có thiết bị đi kèm.',
  },
  {
    key: 'MEDICAL_ROOM',
    label: 'Phòng y tế',
    defaultHasAsset: true,
    tone: 'bg-rose-100 text-rose-700 border-rose-200',
    dot: '#E11D48',
    description: 'Phòng y tế hoặc chăm sóc sức khỏe có thể chứa tài sản chuyên dụng.',
  },
  {
    key: 'CORRIDOR',
    label: 'Hành lang',
    defaultHasAsset: false,
    tone: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: '#64748B',
    description: 'Khu vực lưu thông, thường không dùng để định vị tài sản.',
  },
  {
    key: 'STAIR',
    label: 'Cầu thang',
    defaultHasAsset: false,
    tone: 'bg-stone-100 text-stone-700 border-stone-200',
    dot: '#78716C',
    description: 'Khu vực di chuyển theo tầng, thường không dùng để lưu trữ tài sản.',
  },
  {
    key: 'ELEVATOR',
    label: 'Thang máy',
    defaultHasAsset: false,
    tone: 'bg-zinc-100 text-zinc-700 border-zinc-200',
    dot: '#71717A',
    description: 'Khu vực thang máy hoặc giếng thang, không phải điểm gắn tài sản.',
  },
  {
    key: 'RESTROOM',
    label: 'Nhà vệ sinh',
    defaultHasAsset: false,
    tone: 'bg-sky-100 text-sky-700 border-sky-200',
    dot: '#0284C7',
    description: 'Khu vệ sinh hoặc tiện ích công cộng, thường không định vị tài sản.',
  },
  {
    key: 'GATE',
    label: 'Cổng',
    defaultHasAsset: false,
    tone: 'bg-amber-100 text-amber-700 border-amber-200',
    dot: '#D97706',
    description: 'Khu vực cổng, lối ra vào hoặc kiểm soát truy cập.',
  },
  {
    key: 'ROAD',
    label: 'Đường',
    defaultHasAsset: false,
    tone: 'bg-neutral-100 text-neutral-700 border-neutral-200',
    dot: '#737373',
    description: 'Đường nội bộ hoặc trục lưu thông ngoài trời.',
  },
  {
    key: 'PARKING',
    label: 'Bãi đỗ xe',
    defaultHasAsset: false,
    tone: 'bg-orange-100 text-orange-700 border-orange-200',
    dot: '#EA580C',
    description: 'Bãi xe hoặc khu vực đỗ phương tiện.',
  },
  {
    key: 'RESTRICTED',
    label: 'Khu cấm',
    defaultHasAsset: false,
    tone: 'bg-red-100 text-red-700 border-red-200',
    dot: '#DC2626',
    description: 'Khu kỹ thuật hoặc khu vực hạn chế truy cập.',
  },
]

const PRESET_BY_KEY = new Map(
  AREA_TYPE_PRESETS.map((preset) => [preset.key, preset]),
)

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

function resolveCatalogDefaultHasAsset(entry) {
  return entry?.defaultHasAsset !== false
}

function toCatalogEntry(entry) {
  if (!entry) return null
  return {
    typeKey: resolveCatalogKey(entry),
    label: resolveCatalogLabel(entry),
    description: resolveCatalogDescription(entry),
    defaultHasAsset: resolveCatalogDefaultHasAsset(entry),
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
      description: fallbackPreset.description,
      defaultHasAsset: fallbackPreset.defaultHasAsset,
      builtIn: true,
    }
    : null
}

function buildCustomAreaTypeMeta(label, hasAsset) {
  const normalizedLabel = normalizeAreaTypeLabel(label)
  return {
    key: `custom:${slugifyAreaTypeLabel(normalizedLabel)}`,
    filterKey: `type:${slugifyAreaTypeLabel(normalizedLabel)}`,
    label: normalizedLabel || 'Loại khu vực khác',
    tone: hasAsset
      ? 'bg-orange-100 text-orange-700 border-orange-200'
      : 'bg-sky-100 text-sky-700 border-sky-200',
    dot: hasAsset ? '#F97316' : '#0284C7',
    description: hasAsset
      ? 'Loại khu vực do người dùng tự đặt tên và có thể dùng để gắn tài sản.'
      : 'Loại khu vực do người dùng tự đặt tên, chỉ phục vụ mô tả trên sơ đồ.',
  }
}

function buildPresetMeta(preset) {
  const visualPreset = PRESET_BY_KEY.get(preset.typeKey || preset.key)
  const defaultHasAsset = resolveCatalogDefaultHasAsset(preset)
  return {
    key: String(preset.typeKey || preset.key || '').toLowerCase(),
    filterKey: `type:${String(preset.typeKey || preset.key || '').toLowerCase()}`,
    label: resolveCatalogLabel(preset),
    tone: visualPreset?.tone || (defaultHasAsset
      ? 'bg-orange-100 text-orange-700 border-orange-200'
      : 'bg-sky-100 text-sky-700 border-sky-200'),
    dot: visualPreset?.dot || (defaultHasAsset ? '#F97316' : '#0284C7'),
    description: resolveCatalogDescription(preset)
      || (defaultHasAsset
        ? 'Loại khu vực có thể dùng để gắn tài sản.'
        : 'Loại khu vực mô tả trên sơ đồ, không dùng để gắn tài sản.'),
  }
}

function guessPresetAreaTypeKey(shape) {
  const normalizedName = normalizeAreaTypeLabel(shape?.roomName).toLowerCase()
  if (!normalizedName) {
    return shape?.hasAsset !== false ? 'ROOM' : null
  }

  if (/(hanh lang|corridor|hallway|loi di|sanh)/i.test(normalizedName)) return 'CORRIDOR'
  if (/(cau thang|thang bo|stair)/i.test(normalizedName)) return 'STAIR'
  if (/(thang may|elevator|lift)/i.test(normalizedName)) return 'ELEVATOR'
  if (/(ve sinh|toilet|wc|restroom)/i.test(normalizedName)) return 'RESTROOM'
  if (/(cong|gate|entrance|loi vao)/i.test(normalizedName)) return 'GATE'
  if (/(duong|street|road)/i.test(normalizedName)) return 'ROAD'
  if (/(bai do xe|parking)/i.test(normalizedName)) return 'PARKING'
  if (/(cam|restricted|server|dien|tu dien|ky thuat|maintenance|bao tri)/i.test(normalizedName)) return 'RESTRICTED'
  if (/(kho|storage|warehouse)/i.test(normalizedName)) return 'WAREHOUSE'
  if (/(van phong|office)/i.test(normalizedName)) return 'OFFICE'
  if (/(thi nghiem|lab)/i.test(normalizedName)) return 'LAB'
  if (/(y te|medical|clinic)/i.test(normalizedName)) return 'MEDICAL_ROOM'
  if (/(san|court|playground|field)/i.test(normalizedName)) return 'TRAINING_AREA'
  return shape?.hasAsset !== false ? 'ROOM' : null
}

export function resolveAreaTypeMeta(shape, catalogOptions = AREA_TYPE_PRESETS) {
  const explicitPreset = getAreaTypePreset(shape?.areaTypeKey, catalogOptions)
  if (explicitPreset) {
    return buildPresetMeta(explicitPreset)
  }

  const explicitLabel = normalizeAreaTypeLabel(shape?.areaTypeLabel)
  if (explicitLabel) {
    return buildCustomAreaTypeMeta(explicitLabel, shape?.hasAsset !== false)
  }

  const guessedPresetKey = guessPresetAreaTypeKey(shape)
  const guessedPreset = guessedPresetKey ? getAreaTypePreset(guessedPresetKey, catalogOptions) : null
  if (guessedPreset) {
    return buildPresetMeta(guessedPreset)
  }

  return buildCustomAreaTypeMeta(
    shape?.hasAsset !== false ? 'Phòng' : 'Khu vực không chứa tài sản',
    shape?.hasAsset !== false,
  )
}

export function resolveAreaTypeDraft(shape, catalogOptions = AREA_TYPE_PRESETS) {
  const explicitPreset = getAreaTypePreset(shape?.areaTypeKey, catalogOptions)
  if (explicitPreset) {
    return {
      areaTypeKey: explicitPreset.typeKey,
      areaTypeLabel: explicitPreset.label,
    }
  }

  const explicitLabel = normalizeAreaTypeLabel(shape?.areaTypeLabel)
  if (explicitLabel) {
    return {
      areaTypeKey: shape?.areaTypeKey || `CUSTOM:${slugifyAreaTypeLabel(explicitLabel)}`,
      areaTypeLabel: explicitLabel,
    }
  }

  const guessedPresetKey = guessPresetAreaTypeKey(shape)
  const guessedPreset = guessedPresetKey ? getAreaTypePreset(guessedPresetKey, catalogOptions) : null
  if (guessedPreset) {
    return {
      areaTypeKey: guessedPreset.typeKey,
      areaTypeLabel: guessedPreset.label,
    }
  }

  return {
    areaTypeKey: '',
    areaTypeLabel: '',
  }
}

export function buildAreaTypePayload(areaTypeKey, areaTypeLabel, catalogOptions = AREA_TYPE_PRESETS) {
  const preset = getAreaTypePreset(areaTypeKey, catalogOptions)
  if (preset) {
    return {
      areaTypeKey: preset.typeKey,
      areaTypeLabel: preset.label,
    }
  }

  const normalizedLabel = normalizeAreaTypeLabel(areaTypeLabel)
  if (!normalizedLabel) {
    return {
      areaTypeKey: '',
      areaTypeLabel: '',
    }
  }

  return {
    areaTypeKey: `CUSTOM:${slugifyAreaTypeLabel(normalizedLabel)}`,
    areaTypeLabel: normalizedLabel,
  }
}

export function buildAreaTypeOptions(catalogOptions = AREA_TYPE_PRESETS, customOptions = []) {
  const options = [...(catalogOptions || [])
    .map(toCatalogEntry)
    .filter(Boolean)
    .map((preset) => ({
      key: preset.typeKey,
      label: preset.label,
      isCustom: !preset.builtIn,
      defaultHasAsset: preset.defaultHasAsset,
      builtIn: preset.builtIn,
    }))]

  const existingKeys = new Set(options.map((option) => option.key))
  const existingLabels = new Set(options.map((option) => option.label.toLowerCase()))

  ;(customOptions || []).forEach((option) => {
    const normalizedLabel = normalizeAreaTypeLabel(option?.label)
    const normalizedKey = normalizeSpaces(option?.key) || `CUSTOM:${slugifyAreaTypeLabel(normalizedLabel)}`
    if (!normalizedLabel || existingKeys.has(normalizedKey) || existingLabels.has(normalizedLabel.toLowerCase())) {
      return
    }
    existingKeys.add(normalizedKey)
    existingLabels.add(normalizedLabel.toLowerCase())
    options.push({
      key: normalizedKey,
      label: normalizedLabel,
      isCustom: true,
    })
  })

  options.sort((left, right) => left.label.localeCompare(right.label, 'vi'))

  return [
    ...options,
    {
      key: CUSTOM_AREA_TYPE_KEY,
      label: 'Thêm loại khác...',
      isCustom: true,
    },
  ]
}
