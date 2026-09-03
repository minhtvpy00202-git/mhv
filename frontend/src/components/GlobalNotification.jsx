import { memo, useCallback, useEffect, useRef } from 'react'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'
import { useAuth } from '../context/AuthContext'
import useWebSocket from '../hooks/useWebSocket'
import { getTechSupportTicketPath } from '../utils/navigation'

const NOTIFICATION_SESSION_STARTED_AT_KEY = 'mhv_notification_session_started_at'

function toTimestamp(value) {
  if (!value) return 0
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

function GlobalNotification() {
  const { token, isAuthenticated, user } = useAuth()
  const { connected, subscribe } = useWebSocket(token)
  const initializedRef = useRef(false)
  const seenNotificationIdsRef = useRef(new Set())
  const audioContextRef = useRef(null)

  const getNotificationSessionStartedAt = useCallback(() => {
    const rawValue = sessionStorage.getItem(NOTIFICATION_SESSION_STARTED_AT_KEY)
    const parsedValue = Number(rawValue)
    return Number.isFinite(parsedValue) ? parsedValue : 0
  }, [])

  const requestNotificationFeedRefresh = () => {
    window.dispatchEvent(new CustomEvent('mhv-notification-feed-refresh'))
  }

  const playSound = () => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      if (!AudioContextClass) return
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass()
      }
      const ctx = audioContextRef.current
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(880, ctx.currentTime)
      gainNode.gain.setValueAtTime(0.0001, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.01)
      gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2)
      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)
      oscillator.start()
      oscillator.stop(ctx.currentTime + 0.2)
    } catch {
      // Ignore sound failures on unsupported browsers.
    }
  }

  const showBrowserNotification = (title, body) => {
    if (!('Notification' in window)) return
    if (Notification.permission === 'granted') {
      new Notification(title, { body })
      return
    }
    if (Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }

  const showToastByType = useCallback((payload) => {
    const type = payload?.type || payload?.eventType || ''
    const message = payload?.message || 'Có thông báo mới.'
    const toastOptions = {
      icon: false,
      autoClose: 5000,
      toastId: payload?.notificationId ? `notification-${payload.notificationId}` : `${type}-${message}`,
    }

    if (type === 'TICKET_CREATED') {
      toast.error(message, toastOptions)
      return
    }
    if (type === 'TICKET_ASSIGNED') {
      toast.info(message, toastOptions)
      return
    }
    if (type === 'TICKET_RESOLVED') {
      toast.success(message, toastOptions)
      return
    }
    toast(message, toastOptions)
  }, [])

  const shouldToastRealtimeNotification = useCallback((payload) => {
    const sessionStartedAt = getNotificationSessionStartedAt()
    if (!sessionStartedAt) return true
    const notificationTimestamp = toTimestamp(payload?.timestamp || payload?.occurredAt)
    return notificationTimestamp >= sessionStartedAt
  }, [getNotificationSessionStartedAt])

  useEffect(() => {
    initializedRef.current = false
    seenNotificationIdsRef.current = new Set()
  }, [isAuthenticated, user?.userId])

  useEffect(() => {
    if (!isAuthenticated || !connected || !user?.userId) return undefined
    const unsubscribe = subscribe(`/topic/users/${user.userId}/notifications`, (payload) => {
      if (payload?.notificationId != null) {
        seenNotificationIdsRef.current.add(payload.notificationId)
      }
      if (shouldToastRealtimeNotification(payload)) {
        showToastByType(payload)
      }
      requestNotificationFeedRefresh()
    })
    return () => unsubscribe()
  }, [connected, isAuthenticated, shouldToastRealtimeNotification, showToastByType, subscribe, user?.userId])

  useEffect(() => {
    if (!isAuthenticated || !connected || !user?.userId) return undefined
    const unsubscribe = subscribe(`/topic/users/${user.userId}/chat-notifications`, (payload) => {
      if (Number(payload?.senderId) === Number(user.userId)) {
        return
      }
      const senderName = payload?.senderName || 'Người dùng'
      const messagePreview = payload?.messagePreview || 'Bạn có tin nhắn mới.'
      const ticketId = payload?.ticketId
      toast.info(`Tin nhắn mới từ ${senderName}`, {
        icon: false,
        autoClose: 5000,
      })
      playSound()
      showBrowserNotification(`Tin nhắn mới từ ${senderName}`, messagePreview)
      window.dispatchEvent(new CustomEvent('mhv-chat-notification', {
        detail: {
          ...payload,
          ticketPath: user.role === 'TechSupport'
            ? getTechSupportTicketPath(ticketId)
            : user.role === 'Admin' || user.role === 'ConsumableManager'
              ? `/admin/tickets`
              : `/mobile/tickets/${ticketId}`,
        },
      }))
    })
    return () => unsubscribe()
  }, [connected, isAuthenticated, subscribe, user?.role, user?.userId])

  useEffect(() => {
    if (!isAuthenticated) return undefined
    let mounted = true
    const syncNotifications = async () => {
      if (document.hidden) return
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
          if (shouldToastRealtimeNotification(item)) {
            showToastByType({
              notificationId: item.id,
              type: item.eventType || '',
              message: item.message || 'Có thông báo mới.',
              occurredAt: item.occurredAt,
            })
          }
        })
        if (newItems.length > 0) {
          requestNotificationFeedRefresh()
        }
      } catch {
        // Ignore background sync failures for notifications.
      }
    }

    if (connected) {
      return () => {
        mounted = false
      }
    }
    syncNotifications()
    const timer = setInterval(syncNotifications, 10000)
    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [connected, isAuthenticated, shouldToastRealtimeNotification, showToastByType])

  return null
}

export default memo(GlobalNotification)
