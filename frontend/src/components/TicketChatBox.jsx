import { ImagePlus, Mic, Minus, Send, Square, X } from 'lucide-react'
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

const IMG_PREFIX = '[[IMG]]'
const AUDIO_PREFIX = '[[AUDIO]]'
const TARGET_IMAGE_BYTES = 700 * 1024
const MAX_IMAGE_DIMENSION = 1600

function parseMessage(content) {
  if (!content) return { type: 'text', value: '' }
  if (content.startsWith(IMG_PREFIX)) {
    return { type: 'image', value: content.slice(IMG_PREFIX.length) }
  }
  if (content.startsWith(AUDIO_PREFIX)) {
    return { type: 'audio', value: content.slice(AUDIO_PREFIX.length) }
  }
  return { type: 'text', value: content }
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality)
  })
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('read-failed'))
    reader.readAsDataURL(blob)
  })
}

async function compressImageFile(file) {
  const rawDataUrl = await blobToDataUrl(file)
  const image = await new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image-load-failed'))
    img.src = rawDataUrl
  })

  let width = image.width
  let height = image.height
  const maxDimension = Math.max(width, height)
  if (maxDimension > MAX_IMAGE_DIMENSION) {
    const scale = MAX_IMAGE_DIMENSION / maxDimension
    width = Math.round(width * scale)
    height = Math.round(height * scale)
  }

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) {
    return rawDataUrl
  }

  let bestBlob = null
  let workingWidth = width
  let workingHeight = height

  for (let cycle = 0; cycle < 6; cycle += 1) {
    canvas.width = workingWidth
    canvas.height = workingHeight
    context.clearRect(0, 0, workingWidth, workingHeight)
    context.drawImage(image, 0, 0, workingWidth, workingHeight)

    for (let quality = 0.88; quality >= 0.38; quality -= 0.1) {
      const blob = await canvasToBlob(canvas, quality)
      if (!blob) continue
      bestBlob = blob
      if (blob.size <= TARGET_IMAGE_BYTES) {
        return blobToDataUrl(blob)
      }
    }

    if (workingWidth < 500 || workingHeight < 500) {
      break
    }
    workingWidth = Math.round(workingWidth * 0.82)
    workingHeight = Math.round(workingHeight * 0.82)
  }

  if (!bestBlob) {
    return rawDataUrl
  }
  return blobToDataUrl(bestBlob)
}

function TicketChatBox({ ticketId, onClose }) {
  const { token, user } = useAuth()
  const { connected, subscribe } = useWebSocket(token)
  const [messages, setMessages] = useState([])
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const mediaStreamRef = useRef(null)

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
        parsed: parseMessage(message.content),
      })),
    [messages, user?.userId],
  )

  const publishMessage = useCallback(async (messageContent) => {
    if (!messageContent || !ticketId) return
    try {
      const response = await axiosClient.post(`/api/tickets/${ticketId}/chats`, {
        ticketId: Number(ticketId),
        content: messageContent,
      })
      const saved = response.data
      if (saved?.id) {
        setMessages((prev) => {
          if (prev.some((item) => item.id === saved.id)) {
            return prev
          }
          return [...prev, saved]
        })
      }
    } catch (error) {
      const message = error?.response?.data?.message || 'Gửi tin nhắn thất bại.'
      toast.error(message)
    }
  }, [ticketId])

  const handleSendMessage = (event) => {
    event.preventDefault()
    if (!content.trim()) return
    void publishMessage(content.trim())
    setContent('')
    inputRef.current?.focus()
  }

  const handleSelectImage = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const compressedDataUrl = await compressImageFile(file)
      if (!compressedDataUrl) {
        toast.error('Không xử lý được ảnh.')
        return
      }
      void publishMessage(`${IMG_PREFIX}${compressedDataUrl}`)
    } catch {
      toast.error('Không thể nén ảnh để gửi.')
    }
  }

  const handleToggleRecording = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop()
      setRecording(false)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      const recorder = new MediaRecorder(stream)
      const chunks = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' })
        if (blob.size > 2 * 1024 * 1024) {
          toast.error('File ghi âm vượt quá 2MB.')
        } else {
          const reader = new FileReader()
          reader.onload = () => {
            const dataUrl = String(reader.result || '')
            if (dataUrl) {
              void publishMessage(`${AUDIO_PREFIX}${dataUrl}`)
            }
          }
          reader.readAsDataURL(blob)
        }
        stream.getTracks().forEach((track) => track.stop())
        mediaStreamRef.current = null
        mediaRecorderRef.current = null
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch {
      toast.error('Không thể truy cập microphone.')
    }
  }

  return (
    <section
      className={`fixed bottom-4 right-4 z-40 w-[min(92vw,390px)] rounded-2xl border border-slate-200 bg-white shadow-2xl ${
        minimized ? 'h-auto' : 'h-[min(80vh,620px)]'
      }`}
    >
      <header className="flex items-start justify-between border-b border-slate-200 px-4 py-3">
        <div>
        <h3 className="text-sm font-semibold text-slate-800 md:text-base">Trao đổi xử lý sự cố</h3>
        <p className="mt-1 text-xs text-slate-500">Ticket #{ticketId}</p>
        <p className={`mt-1 text-xs ${connected ? 'text-emerald-600' : 'text-amber-600'}`}>
          {connected ? 'Realtime: đã kết nối' : 'Realtime: đang kết nối...'}
        </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMinimized((prev) => !prev)}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <Minus size={16} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      {!minimized && (
        <>
      <div className="h-[calc(100%-170px)] min-h-[240px] overflow-y-auto bg-slate-50 px-3 py-3">
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
                {message.parsed.type === 'image' && (
                  <img src={message.parsed.value} alt="chat-img" className="max-h-64 w-full rounded-lg object-contain" />
                )}
                {message.parsed.type === 'audio' && (
                  <audio controls className="w-full">
                    <source src={message.parsed.value} />
                  </audio>
                )}
                {message.parsed.type === 'text' && (
                  <p className="whitespace-pre-wrap break-words">{message.parsed.value}</p>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      <form onSubmit={handleSendMessage} className="border-t border-slate-200 p-3 md:p-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleSelectImage}
          className="hidden"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleSelectImage}
          className="hidden"
        />
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ImagePlus size={14} />
            Ảnh
          </button>
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ImagePlus size={14} />
            Chụp ảnh
          </button>
          <button
            type="button"
            onClick={handleToggleRecording}
            className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold ${
              recording
                ? 'border-red-500 bg-red-50 text-red-700'
                : 'border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {recording ? <Square size={14} /> : <Mic size={14} />}
            {recording ? 'Dừng ghi âm' : 'Ghi âm'}
          </button>
        </div>
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
      </>
      )}
    </section>
  )
}

export default memo(TicketChatBox)
