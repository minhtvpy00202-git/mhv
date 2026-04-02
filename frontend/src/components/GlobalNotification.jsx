import { memo, useEffect, useRef } from 'react'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'
import { useAuth } from '../context/AuthContext'
import useWebSocket from '../hooks/useWebSocket'

function GlobalNotification() {
  const { token, isAuthenticated, user } = useAuth()
  const { connected, subscribe } = useWebSocket(token)
  const initializedRef = useRef(false)
  const seenNotificationIdsRef = useRef(new Set())

  const showToastByType = (type, message) => {
    if (user?.role === 'TechSupport' && type !== 'TICKET_CREATED') {
      return
    }
    if (type === 'TICKET_CREATED') {
      toast.error(message, { icon: '🆕', autoClose: 5000 })
      return
    }
    if (type === 'TICKET_ASSIGNED') {
      toast.info(message, { icon: '🛠️', autoClose: 5000 })
      return
    }
    if (type === 'TICKET_RESOLVED') {
      toast.success(message, { icon: '✅', autoClose: 5000 })
      return
    }
    if (user?.role === 'Admin') {
      toast(message, { icon: '🔔', autoClose: 5000 })
    }
  }

  useEffect(() => {
    if (!isAuthenticated || !connected) return undefined
    const unsubscribe = subscribe('/topic/notifications', (payload) => {
      const type = payload?.type || ''
      const message = payload?.message || 'Có cập nhật sự cố mới.'
      showToastByType(type, message)
    })
    return () => unsubscribe()
  }, [connected, isAuthenticated, subscribe, user?.role])

  useEffect(() => {
    if (!isAuthenticated) return undefined
    let mounted = true
    const syncNotifications = async () => {
      try {
        const response = await axiosClient.get('/api/notifications', {
          params: { page: 0, size: 20 },
        })
        if (!mounted) return
        const items = response.data?.items || []
        if (!initializedRef.current) {
          items.forEach((item) => seenNotificationIdsRef.current.add(item.id))
          initializedRef.current = true
          return
        }
        const newItems = items.filter((item) => !seenNotificationIdsRef.current.has(item.id))
        newItems.forEach((item) => {
          seenNotificationIdsRef.current.add(item.id)
          if (connected && String(item.eventType || '').startsWith('TICKET_')) {
            return
          }
          const type = item.eventType || ''
          const message = item.message || 'Có thông báo mới.'
          showToastByType(type, message)
        })
      } catch {}
    }

    syncNotifications()
    const timer = setInterval(syncNotifications, 10000)
    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [connected, isAuthenticated, user?.role])

  return null
}

export default memo(GlobalNotification)
