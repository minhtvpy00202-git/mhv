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
  const audioContextRef = useRef(null)

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
    } catch {}
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
    if (!isAuthenticated || !connected || !user?.userId) return undefined
    const unsubscribe = subscribe(`/topic/users/${user.userId}/chat-notifications`, (payload) => {
      if (Number(payload?.senderId) === Number(user.userId)) {
        return
      }
      const senderName = payload?.senderName || 'Người dùng'
      const messagePreview = payload?.messagePreview || 'Bạn có tin nhắn mới.'
      const ticketId = payload?.ticketId
      toast.info(`Tin nhắn mới từ ${senderName}`, {
        icon: '💬',
        autoClose: 5000,
      })
      playSound()
      showBrowserNotification(`Tin nhắn mới từ ${senderName}`, messagePreview)
      window.dispatchEvent(new CustomEvent('mhv-chat-notification', {
        detail: {
          ...payload,
          ticketPath: user.role === 'TechSupport'
            ? `/tech/tickets/${ticketId}`
            : user.role === 'Admin'
              ? `/admin/tickets/${ticketId}`
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
