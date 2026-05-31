/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import axiosClient from '../api/axiosClient'
import { DEFAULT_BRANDING } from '../config/branding'
import { darkenHexColor, hexToRgb, normalizeHexColor } from '../utils/brandingTheme'

const BrandingContext = createContext(null)

export function BrandingProvider({ children }) {
  const [branding, setBranding] = useState(DEFAULT_BRANDING)
  const [loading, setLoading] = useState(true)

  const refreshBranding = useCallback(async () => {
    try {
      const response = await axiosClient.get('/api/branding')
      setBranding(response.data || DEFAULT_BRANDING)
    } catch {
      setBranding(DEFAULT_BRANDING)
    } finally {
      setLoading(false)
    }
  }, [])

  const updateBranding = useCallback(async (payload) => {
    const response = await axiosClient.put('/api/branding', payload)
    const nextBranding = response.data || DEFAULT_BRANDING
    setBranding(nextBranding)
    return nextBranding
  }, [])

  useEffect(() => {
    void refreshBranding()
  }, [refreshBranding])

  useEffect(() => {
    const primaryColor = normalizeHexColor(branding.primaryColor, DEFAULT_BRANDING.primaryColor)
    const { r, g, b } = hexToRgb(primaryColor)
    const primaryDark = darkenHexColor(primaryColor)
    document.documentElement.style.setProperty('--brand-primary', primaryColor)
    document.documentElement.style.setProperty('--brand-primary-dark', primaryDark)
    document.documentElement.style.setProperty('--brand-primary-rgb', `${r} ${g} ${b}`)
  }, [branding.primaryColor])

  const value = useMemo(
    () => ({
      branding,
      loading,
      refreshBranding,
      updateBranding,
    }),
    [branding, loading, refreshBranding, updateBranding],
  )

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>
}

export function useBranding() {
  const context = useContext(BrandingContext)
  if (!context) {
    throw new Error('useBranding must be used within BrandingProvider')
  }
  return context
}
