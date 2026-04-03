import { Client } from '@stomp/stompjs'
import { useCallback, useEffect, useRef, useState } from 'react'
import SockJS from 'sockjs-client/dist/sockjs'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const WS_URL = (
  import.meta.env.VITE_WS_URL
  || (API_BASE_URL ? `${API_BASE_URL}/ws` : `${window.location.origin}/ws`)
).replace(/\/$/, '')

export default function useWebSocket(token) {
  const clientRef = useRef(null)
  const [connected, setConnected] = useState(false)
  const [connectionDebug, setConnectionDebug] = useState({
    status: 'idle',
    message: '',
    wsUrl: WS_URL,
  })

  useEffect(() => {
    if (!token) {
      setConnected(false)
      setConnectionDebug({
        status: 'no-token',
        message: 'Chưa có token đăng nhập cho websocket.',
        wsUrl: WS_URL,
      })
      return undefined
    }

    setConnectionDebug({
      status: 'connecting',
      message: `Đang kết nối websocket tới ${WS_URL}`,
      wsUrl: WS_URL,
    })

    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      reconnectDelay: 5000,
      debug: () => {},
    })

    client.onConnect = () => {
      setConnected(true)
      setConnectionDebug({
        status: 'connected',
        message: 'Kết nối websocket thành công.',
        wsUrl: WS_URL,
      })
    }

    client.onStompError = (frame) => {
      setConnected(false)
      const errorCode = frame?.headers?.message || frame?.headers?.['content-type'] || 'STOMP_ERROR'
      const errorBody = frame?.body ? String(frame.body).slice(0, 300) : ''
      setConnectionDebug({
        status: 'stomp-error',
        message: `${errorCode}${errorBody ? ` | ${errorBody}` : ''}`,
        wsUrl: WS_URL,
      })
    }

    client.onWebSocketClose = (event) => {
      setConnected(false)
      setConnectionDebug({
        status: 'ws-close',
        message: `WebSocket đóng kết nối (code=${event?.code ?? 'n/a'}, reason=${event?.reason || 'empty'})`,
        wsUrl: WS_URL,
      })
    }

    client.onWebSocketError = (event) => {
      setConnected(false)
      setConnectionDebug({
        status: 'ws-error',
        message: `WebSocket error: ${event?.message || event?.type || 'unknown error'}`,
        wsUrl: WS_URL,
      })
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
    connectionDebug,
  }
}
