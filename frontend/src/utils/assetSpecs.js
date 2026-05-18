function sanitizeEntries(entries = []) {
  return entries
    .map((entry) => ({
      name: String(entry?.name || '').trim(),
      value: String(entry?.value || '').trim(),
      isCustom: Boolean(entry?.isCustom),
    }))
    .filter((entry) => entry.name || entry.value)
}

export function parseSpecsToEntries(specs, templateKeys = []) {
  if (!specs) return []
  try {
    const parsed = typeof specs === 'string' ? JSON.parse(specs) : specs
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return []
    const normalizedTemplateKeys = Array.isArray(templateKeys)
      ? templateKeys.map((key) => String(key || '').trim()).filter(Boolean)
      : []
    const templateLookup = new Set(normalizedTemplateKeys)
    return Object.entries(parsed)
      .map(([name, value]) => ({
        name: String(name || '').trim(),
        value: String(value || '').trim(),
        isCustom: !templateLookup.has(String(name || '').trim()),
      }))
      .filter((entry) => entry.name && entry.value)
  } catch {
    return []
  }
}

export function mergeSpecEntries(templateKeys = [], existingEntries = []) {
  const sanitizedExisting = sanitizeEntries(existingEntries)
  const normalizedTemplateKeys = Array.isArray(templateKeys)
    ? templateKeys.map((key) => String(key || '').trim()).filter(Boolean)
    : []
  const suggestedLookup = new Set(normalizedTemplateKeys)

  const mergedSuggested = normalizedTemplateKeys.map((key) => {
    const existing = sanitizedExisting.find((entry) => entry.name === key)
    return {
      name: key,
      value: existing?.value || '',
      isCustom: false,
    }
  })

  const customEntries = sanitizedExisting.filter((entry) => entry.isCustom)

  return [...mergedSuggested, ...customEntries]
}

export function normalizeSpecTemplates(specTemplates = []) {
  return Array.isArray(specTemplates)
    ? specTemplates
      .map((item) => String(item || '').trim())
      .filter(Boolean)
    : []
}

export function stringifySpecs(entries = []) {
  const sanitizedExisting = sanitizeEntries(entries)
  const specsObject = sanitizedExisting.reduce((accumulator, entry) => {
    if (entry.name && entry.value) {
      accumulator[entry.name] = entry.value
    }
    return accumulator
  }, {})

  return JSON.stringify(specsObject)
}
