import { Send } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'
import { useAuth } from '../context/AuthContext'
import useWebSocket from '../hooks/useWebSocket'

function formatMessageTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function TicketChatBox({ ticketId }) {
  const { token, user } = useAuth()
  const { connected, subscribe, publish } = useWebSocket(token)
  const [messages, setMessages] = useState([])
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  const loadMessages = useCallback(async () => {
    if (!ticketId) return
    try {
      const response = await axiosClient.get(`/api/tickets/${ticketId}/chats`)
      setMessages(response.data || [])
    } catch (error) {
      const message = error?.response?.data?.message || 'Không tải được lịch sử chat.'
      toast.error(message)
    }
  }, [ticketId])

  useEffect(() => {
    if (!ticketId) return
    let mounted = true
    const loadInitialMessages = async () => {
      setLoading(true)
      try {
        const response = await axiosClient.get(`/api/tickets/${ticketId}/chats`)
        if (mounted) {
          setMessages(response.data || [])
        }
      } catch (error) {
        const message = error?.response?.data?.message || 'Không tải được lịch sử chat.'
        toast.error(message)
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }
    loadInitialMessages()
    return () => {
      mounted = false
    }
  }, [ticketId])

  useEffect(() => {
    if (!connected || !ticketId) return undefined
    const unsubscribe = subscribe(`/topic/tickets/${ticketId}`, (incoming) => {
      setMessages((prev) => {
        if (!incoming?.id) return prev
        if (prev.some((item) => item.id === incoming.id)) return prev
        return [...prev, incoming]
      })
    })
    return () => unsubscribe()
  }, [connected, subscribe, ticketId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length])

  const normalizedMessages = useMemo(
    () =>
      messages.map((message) => ({
        ...message,
        isMine: Number(message.senderId) === Number(user?.userId),
        timeText: formatMessageTime(message.createdAt),
      })),
    [messages, user?.userId],
  )

  const handleSendMessage = (event) => {
    event.preventDefault()
    if (!content.trim() || !ticketId) return
    if (!connected) {
      toast.error('Kết nối realtime chưa sẵn sàng, vui lòng thử lại sau vài giây.')
      return
    }
    publish(`/app/chat/${ticketId}`, {
      ticketId: Number(ticketId),
      content: content.trim(),
    })
    setContent('')
    inputRef.current?.focus()
    setTimeout(() => {
      loadMessages()
    }, 600)
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-800 md:text-base">Trao đổi xử lý sự cố</h3>
        <p className="mt-1 text-xs text-slate-500">Ticket #{ticketId}</p>
        <p className={`mt-1 text-xs ${connected ? 'text-emerald-600' : 'text-amber-600'}`}>
          {connected ? 'Realtime: đã kết nối' : 'Realtime: đang kết nối...'}
        </p>
      </header>

      <div className="h-[55vh] min-h-[360px] overflow-y-auto bg-slate-50 px-3 py-3 md:h-[60vh] md:px-4">
        {loading && <p className="text-center text-sm text-slate-500">Đang tải tin nhắn...</p>}
        {!loading && normalizedMessages.length === 0 && (
          <p className="text-center text-sm text-slate-500">Chưa có tin nhắn nào. Hãy bắt đầu cuộc trao đổi.</p>
        )}

        <div className="space-y-2">
          {normalizedMessages.map((message) => (
            <div key={message.id} className={`flex ${message.isMine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm md:max-w-[70%] ${
                  message.isMine ? 'bg-fptOrange text-white' : 'bg-slate-200 text-slate-800'
                }`}
              >
                <p className={`mb-1 text-[11px] ${message.isMine ? 'text-orange-100' : 'text-slate-600'}`}>
                  {message.isMine ? 'Bạn' : `User #${message.senderId}`} · {message.timeText}
                </p>
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      <form onSubmit={handleSendMessage} className="border-t border-slate-200 p-3 md:p-4">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={2}
            placeholder="Nhập nội dung trao đổi..."
            className="min-h-[44px] flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-fptOrange"
          />
          <button
            type="submit"
            disabled={!content.trim() || !connected}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-fptOrange text-white hover:bg-fptOrangeDark disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Send size={18} />
          </button>
        </div>
      </form>
    </section>
  )
}

export default memo(TicketChatBox)
