import { useCallback, useMemo, useRef, useState } from 'react'
import { toast } from 'react-toastify'
import axiosClient from '../../../api/axiosClient'

export const ALL_ROOMS_ID = '__ALL__'

function isStorageWarehouse(location) {
  const typeKey = String(location?.areaTypeKey || '').trim().toLowerCase()
  const typeLabel = String(location?.areaTypeLabel || '').trim().toLowerCase()
  const roomName = String(location?.roomName || '').trim().toLowerCase()
  return (
    typeKey.includes('warehouse')
    || typeLabel.includes('warehouse')
    || typeLabel.includes('kho')
    || roomName === 'kho'
  )
}

function normalizeOverview(locationId, data) {
  if (!data) return null
  return {
    ...data,
    locationId: String(locationId) === ALL_ROOMS_ID ? ALL_ROOMS_ID : data.locationId,
    locationName: String(locationId) === ALL_ROOMS_ID
      ? (data.locationName || 'Tất cả phòng')
      : data.locationName,
    roomCount: data.roomCount ?? undefined,
    stocks: data.stocks || [],
    issueHistory: data.issueHistory || [],
    requestHistory: data.requestHistory || [],
  }
}

export default function useLocationOverview({ locations }) {
  const [selectedRoomId, setSelectedRoomId] = useState(ALL_ROOMS_ID)
  const [roomOverviewLoading, setRoomOverviewLoading] = useState(false)
  const [roomOverview, setRoomOverview] = useState(null)
  const overviewCacheRef = useRef(new Map())
  const loadRequestRef = useRef(0)

  const roomOptions = useMemo(() => (
    [...locations]
      .filter((location) => !isStorageWarehouse(location))
      .sort((a, b) => a.roomName.localeCompare(b.roomName, 'vi'))
  ), [locations])

  const invalidateOverviewCache = useCallback((locationId) => {
    if (locationId) {
      overviewCacheRef.current.delete(String(locationId))
    }
    overviewCacheRef.current.delete(ALL_ROOMS_ID)
  }, [])

  const loadAllRoomsOverview = useCallback(async ({ force = false } = {}) => {
    const cacheKey = ALL_ROOMS_ID
    if (!force && overviewCacheRef.current.has(cacheKey)) {
      setRoomOverview(overviewCacheRef.current.get(cacheKey))
      return
    }

    const requestId = loadRequestRef.current + 1
    loadRequestRef.current = requestId
    setRoomOverviewLoading(true)
    try {
      const response = await axiosClient.get('/api/assets/consumables/rooms-overview')
      if (requestId !== loadRequestRef.current) return

      const overview = normalizeOverview(ALL_ROOMS_ID, {
        ...response.data,
        locationId: ALL_ROOMS_ID,
        locationName: 'Tất cả phòng',
        roomCount: response.data?.roomCount ?? roomOptions.length,
      })
      overviewCacheRef.current.set(cacheKey, overview)
      setRoomOverview(overview)
    } catch (error) {
      if (requestId !== loadRequestRef.current) return
      const message = error?.response?.data?.message || 'Không thể tải dữ liệu vật tư theo phòng.'
      toast.error(message)
    } finally {
      if (requestId === loadRequestRef.current) {
        setRoomOverviewLoading(false)
      }
    }
  }, [roomOptions.length])

  const loadRoomOverview = useCallback(async (locationId, { force = false } = {}) => {
    if (!locationId) {
      setRoomOverview(null)
      return
    }

    const cacheKey = String(locationId)
    if (!force && overviewCacheRef.current.has(cacheKey)) {
      setRoomOverview(overviewCacheRef.current.get(cacheKey))
      return
    }

    if (cacheKey === ALL_ROOMS_ID) {
      await loadAllRoomsOverview({ force })
      return
    }

    const requestId = loadRequestRef.current + 1
    loadRequestRef.current = requestId
    setRoomOverviewLoading(true)
    try {
      const response = await axiosClient.get(`/api/assets/locations/${locationId}/consumables`)
      if (requestId !== loadRequestRef.current) return

      const overview = normalizeOverview(locationId, response.data)
      overviewCacheRef.current.set(cacheKey, overview)
      setRoomOverview(overview)
    } catch (error) {
      if (requestId !== loadRequestRef.current) return
      const message = error?.response?.data?.message || 'Không thể tải dữ liệu vật tư theo phòng.'
      toast.error(message)
    } finally {
      if (requestId === loadRequestRef.current) {
        setRoomOverviewLoading(false)
      }
    }
  }, [loadAllRoomsOverview])

  const handleRoomChange = useCallback(async (locationId) => {
    const nextLocationId = String(locationId || '')
    if (!nextLocationId) {
      setSelectedRoomId('')
      setRoomOverview(null)
      return
    }
    if (nextLocationId === String(selectedRoomId) && overviewCacheRef.current.has(nextLocationId)) {
      setRoomOverview(overviewCacheRef.current.get(nextLocationId))
      return
    }
    setSelectedRoomId(nextLocationId)
    await loadRoomOverview(nextLocationId)
  }, [loadRoomOverview, selectedRoomId])

  const ensureRoomLoaded = useCallback(async () => {
    const locationId = selectedRoomId || ALL_ROOMS_ID
    if (!selectedRoomId) {
      setSelectedRoomId(ALL_ROOMS_ID)
    }
    if (!roomOverview || String(roomOverview.locationId || '') !== String(locationId)) {
      await loadRoomOverview(locationId)
    }
  }, [selectedRoomId, roomOverview, loadRoomOverview])

  const refreshRoomOverview = useCallback(async (locationId = selectedRoomId) => {
    if (!locationId) return
    invalidateOverviewCache(locationId)
    await loadRoomOverview(locationId, { force: true })
  }, [invalidateOverviewCache, loadRoomOverview, selectedRoomId])

  return {
    selectedRoomId,
    setSelectedRoomId,
    roomOverview,
    roomOverviewLoading,
    roomOptions,
    loadRoomOverview,
    refreshRoomOverview,
    handleRoomChange,
    ensureRoomLoaded,
  }
}
