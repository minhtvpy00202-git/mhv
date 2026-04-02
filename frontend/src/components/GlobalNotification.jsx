import { memo, useEffect } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../context/AuthContext'
import useWebSocket from '../hooks/useWebSocket'

function GlobalNotification() {
  const { token, isAuthenticated } = useAuth()
  const { connected, subscribe } = useWebSocket(token)

  useEffect(() => {
    if (!isAuthenticated || !connected) return undefined
    const unsubscribe = subscribe('/topic/notifications', (payload) => {
      const type = payload?.type || ''
      const message = payload?.message || 'Có cập nhật sự cố mới.'
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
      toast(message, { icon: '🔔', autoClose: 5000 })
    })
    return () => unsubscribe()
  }, [connected, isAuthenticated, subscribe])

  return null
}

export default memo(GlobalNotification)
