export function normalizeHexColor(value, fallback = '#f27025') {
  const color = String(value || '').trim()
  return /^#([0-9a-fA-F]{6})$/.test(color) ? color : fallback
}

export function hexToRgb(color) {
  const normalized = normalizeHexColor(color)
  const hex = normalized.slice(1)
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  }
}

export function toRgba(color, alpha) {
  const { r, g, b } = hexToRgb(color)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function darkenHexColor(color, amount = 0.14) {
  const { r, g, b } = hexToRgb(color)
  const darken = (channel) => Math.max(0, Math.round(channel * (1 - amount)))
  const toHex = (value) => value.toString(16).padStart(2, '0')
  return `#${toHex(darken(r))}${toHex(darken(g))}${toHex(darken(b))}`
}
