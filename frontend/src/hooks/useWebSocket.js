import { Client } from '@stomp/stompjs'
import { useCallback, useEffect, useRef, useState } from 'react'
import SockJS from 'sockjs-client/dist/sockjs'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const WS_URL = (
  import.meta.env.VITE_WS_URL
  || (API_BASE_URL ? `${API_BASE_URL}/ws` : 'http://localhost:8080/ws')
).replace(/\/$/, '')

export default function useWebSocket(token) {
  const clientRef = useRef(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!token) {
      setConnected(false)
      return undefined
    }

    const isLocalHostWs = WS_URL.includes('localhost') || WS_URL.includes('127.0.0.1')
    const client = new Client({
      ...(isLocalHostWs
        ? { webSocketFactory: () => new SockJS(WS_URL) }
        : { brokerURL: WS_URL.replace(/^http/i, 'ws') }),
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      reconnectDelay: 5000,
      debug: () => {},
    })

    client.onConnect = () => {
      setConnected(true)
    }

    client.onStompError = () => {
      setConnected(false)
    }

    client.onWebSocketClose = () => {
      setConnected(false)
    }

    client.onWebSocketError = () => {
      setConnected(false)
    }

    client.activate()
    clientRef.current = client

    return () => {
      setConnected(false)
      if (clientRef.current?.active) {
        clientRef.current.deactivate()
      }
      clientRef.current = null
    }
  }, [token])

  const subscribe = useCallback((destination, onMessage) => {
    const client = clientRef.current
    if (!client || !client.connected) return () => {}
    const subscription = client.subscribe(destination, (message) => {
      try {
        onMessage(JSON.parse(message.body))
      } catch {
        onMessage(message.body)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const publish = useCallback((destination, body) => {
    const client = clientRef.current
    if (!client || !client.connected) return
    client.publish({
      destination,
      body: JSON.stringify(body),
    })
  }, [])

  return {
    connected,
    subscribe,
    publish,
  }
}
