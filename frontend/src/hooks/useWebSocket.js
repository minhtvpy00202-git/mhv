import { Client } from '@stomp/stompjs'
import { useCallback, useEffect, useRef, useState } from 'react'
import SockJS from 'sockjs-client/dist/sockjs'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const isLocalFrontendHost = ['localhost', '127.0.0.1'].includes(window.location.hostname)
const DEFAULT_LOCAL_BACKEND = 'http://localhost:8080'
const WS_BASE_URL = API_BASE_URL || (isLocalFrontendHost ? DEFAULT_LOCAL_BACKEND : window.location.origin)
const WS_URL = (
  import.meta.env.VITE_WS_URL
  || `${WS_BASE_URL}/ws`
).replace(/\/$/, '')
const SOCKJS_URL = (
  import.meta.env.VITE_SOCKJS_URL
  || `${WS_BASE_URL}/ws-sockjs`
).replace(/\/$/, '')
const WS_BROKER_URL = WS_URL.replace(/^http/i, 'ws')
const IS_NGROK_URL = /ngrok-free\.(app|dev)/i.test(WS_URL)

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
      message: `Đang kết nối websocket tới ${IS_NGROK_URL ? WS_BROKER_URL : SOCKJS_URL}${IS_NGROK_URL ? ' (ngrok mode: native ws)' : ''}`,
      wsUrl: IS_NGROK_URL ? WS_BROKER_URL : SOCKJS_URL,
    })

    const client = new Client({
      ...(IS_NGROK_URL
        ? { brokerURL: WS_BROKER_URL }
        : { webSocketFactory: () => new SockJS(SOCKJS_URL) }),
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
        wsUrl: IS_NGROK_URL ? WS_BROKER_URL : SOCKJS_URL,
      })
    }

    client.onStompError = (frame) => {
      setConnected(false)
      const errorCode = frame?.headers?.message || frame?.headers?.['content-type'] || 'STOMP_ERROR'
      const errorBody = frame?.body ? String(frame.body).slice(0, 300) : ''
      setConnectionDebug({
        status: 'stomp-error',
        message: `${errorCode}${errorBody ? ` | ${errorBody}` : ''}`,
        wsUrl: IS_NGROK_URL ? WS_BROKER_URL : SOCKJS_URL,
      })
    }

    client.onWebSocketClose = (event) => {
      setConnected(false)
      setConnectionDebug({
        status: 'ws-close',
        message: `WebSocket đóng kết nối (code=${event?.code ?? 'n/a'}, reason=${event?.reason || 'empty'})`,
        wsUrl: IS_NGROK_URL ? WS_BROKER_URL : SOCKJS_URL,
      })
    }

    client.onWebSocketError = (event) => {
      setConnected(false)
      setConnectionDebug({
        status: 'ws-error',
        message: `WebSocket error: ${event?.message || event?.type || 'unknown error'}`,
        wsUrl: IS_NGROK_URL ? WS_BROKER_URL : SOCKJS_URL,
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
