import { ImagePlus, Mic, Minus, Pause, Play, Send, Square, X } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'react-toastify'
import axiosClient from '../api/axiosClient'
import { useAuth } from '../context/AuthContext'
import useWebSocket from '../hooks/useWebSocket'
import { formatVietnamTime, getServerDateTimeMs } from '../utils/datetime'
import { compressImageToBlob } from '../utils/imageProcessing'
import { resolveBackendMediaUrl } from '../utils/mediaUrl'

function formatMessageTime(value) {
  return formatVietnamTime(value, '')
}

function formatAudioDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00'
  const wholeSeconds = Math.floor(seconds)
  const minutes = String(Math.floor(wholeSeconds / 60)).padStart(2, '0')
  const remainingSeconds = String(wholeSeconds % 60).padStart(2, '0')
  return `${minutes}:${remainingSeconds}`
}

const IMG_PREFIX = '[[IMG]]'
const AUDIO_PREFIX = '[[AUDIO]]'
const INITIAL_CHAT_LIMIT = Number(import.meta.env.VITE_CHAT_INITIAL_LIMIT) || 40
function resolveMediaUrl(url) {
  return resolveBackendMediaUrl(url)
}

function parseMessage(message) {
  if (message?.mediaType && message?.mediaUrl) {
    return { type: message.mediaType, value: resolveMediaUrl(message.mediaUrl) }
  }
  const content = message?.content || ''
  if (content.startsWith(IMG_PREFIX)) {
    return { type: 'image', value: resolveMediaUrl(content.slice(IMG_PREFIX.length)) }
  }
  if (content.startsWith(AUDIO_PREFIX)) {
    return { type: 'audio', value: resolveMediaUrl(content.slice(AUDIO_PREFIX.length)) }
  }
  return { type: 'text', value: content }
}

function appendRetryQuery(url, retryKey) {
  if (!url) return ''
  if (!retryKey) return url
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}chat_media_retry=${retryKey}`
}

function ResilientChatImage({ src, alt }) {
  const [retryKey, setRetryKey] = useState(0)
  const [attempts, setAttempts] = useState(0)

  useEffect(() => {
    setRetryKey(0)
    setAttempts(0)
  }, [src])

  const displaySrc = useMemo(() => appendRetryQuery(src, retryKey), [src, retryKey])

  return (
    <img
      src={displaySrc}
      alt={alt}
      className="max-h-64 w-full rounded-lg object-contain"
      onError={() => {
        if (attempts >= 2) return
        const nextAttempt = attempts + 1
        setAttempts(nextAttempt)
        window.setTimeout(() => {
          setRetryKey(Date.now())
        }, nextAttempt * 900)
      }}
    />
  )
}

function VoiceMessagePlayer({ src, isMine }) {
  const audioRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return undefined

    const handleLoadedMetadata = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
    }
    const handleTimeUpdate = () => {
      setCurrentTime(Number.isFinite(audio.currentTime) ? audio.currentTime : 0)
    }
    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
    }
    const handlePause = () => setIsPlaying(false)
    const handlePlay = () => setIsPlaying(true)

    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('play', handlePlay)

    return () => {
      audio.pause()
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('play', handlePlay)
    }
  }, [src])

  const togglePlayback = async () => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
      return
    }
    try {
      await audio.play()
    } catch {
      toast.error('Không thể phát ghi âm.')
    }
  }

  const shownTime = isPlaying ? currentTime : duration
  const waveformBars = [18, 28, 22, 34]

  return (
    <div
      className={`flex min-w-[180px] items-center gap-3 rounded-2xl px-3 py-2 ${
        isMine ? 'bg-orange-100/20' : 'bg-white/70'
      }`}
    >
      <audio ref={audioRef} preload="metadata" src={src} />
      <button
        type="button"
        onClick={togglePlayback}
        className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${
          isMine ? 'bg-white text-fptOrange' : 'bg-blue-500 text-white'
        }`}
      >
        {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
      </button>
      <div className="flex items-end gap-1">
        {waveformBars.map((height, index) => (
          <span
            key={`${height}-${index}`}
            className={`w-1.5 rounded-full transition-all duration-200 ${
              isMine ? 'bg-white/90' : 'bg-blue-500'
            } ${isPlaying ? 'opacity-100' : 'opacity-70'}`}
            style={{
              height: `${height}px`,
              transform: isPlaying && index % 2 === 0 ? 'scaleY(0.75)' : 'scaleY(1)',
            }}
          />
        ))}
      </div>
      <span className={`text-sm font-semibold ${isMine ? 'text-white' : 'text-slate-700'}`}>
        {formatAudioDuration(shownTime)}
      </span>
    </div>
  )
}

function TicketChatBox({ ticketId, onClose, embedded = false }) {
  const { token, user } = useAuth()
  const { connected, subscribe, publish } = useWebSocket(token)
  const [messages, setMessages] = useState([])
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [processingImage, setProcessingImage] = useState(false)
  const [sending, setSending] = useState(false)
  const [recording, setRecording] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const mediaStreamRef = useRef(null)
  const processingFallbackTimerRef = useRef(null)
  const syncInFlightRef = useRef(false)
  const postSendSyncTimerRef = useRef(null)

  useEffect(() => {
    return () => {
      if (processingFallbackTimerRef.current) {
        clearTimeout(processingFallbackTimerRef.current)
        processingFallbackTimerRef.current = null
      }
      if (postSendSyncTimerRef.current) {
        clearTimeout(postSendSyncTimerRef.current)
        postSendSyncTimerRef.current = null
      }
    }
  }, [])

  const syncMessages = useCallback(async ({ silent = false } = {}) => {
    if (!ticketId || syncInFlightRef.current) return
    syncInFlightRef.current = true
    if (!silent) {
      setLoading(true)
    }
    try {
      const response = await axiosClient.get(`/api/tickets/${ticketId}/chats`, {
        params: { limit: INITIAL_CHAT_LIMIT },
      })
      const incoming = Array.isArray(response.data) ? response.data : []
      setMessages((prev) => {
        if (!prev.length) {
          return incoming
        }
        const merged = new Map(prev.map((item) => [item.id, item]))
        incoming.forEach((item) => {
          merged.set(item.id, item)
        })
        return Array.from(merged.values()).sort(
          (a, b) => getServerDateTimeMs(a.createdAt) - getServerDateTimeMs(b.createdAt),
        )
      })
    } catch (error) {
      if (!silent) {
        const message = error?.response?.data?.message || 'Không tải được lịch sử chat.'
        toast.error(message)
      }
    } finally {
      syncInFlightRef.current = false
      if (!silent) {
        setLoading(false)
      }
    }
  }, [ticketId])

  const scheduleSyncAfterSend = useCallback(() => {
    if (postSendSyncTimerRef.current) {
      clearTimeout(postSendSyncTimerRef.current)
    }
    postSendSyncTimerRef.current = window.setTimeout(() => {
      void syncMessages({ silent: true })
    }, 1200)
  }, [syncMessages])

  const scheduleSyncAfterRealtimeMedia = useCallback(() => {
    if (postSendSyncTimerRef.current) {
      clearTimeout(postSendSyncTimerRef.current)
    }
    postSendSyncTimerRef.current = window.setTimeout(() => {
      void syncMessages({ silent: true })
    }, 2200)
  }, [syncMessages])

  useEffect(() => {
    void syncMessages()
  }, [syncMessages])

  useEffect(() => {
    if (!connected || !ticketId) return undefined
    const unsubscribe = subscribe(`/topic/users/${user?.userId}/tickets/${ticketId}`, (incoming) => {
      if (incoming?.mediaUrl || incoming?.mediaType) {
        scheduleSyncAfterRealtimeMedia()
      }
      setMessages((prev) => {
        if (!incoming?.id) return prev
        if (prev.some((item) => item.id === incoming.id)) return prev
        return [...prev, incoming]
      })
    })
    return () => unsubscribe()
  }, [connected, scheduleSyncAfterRealtimeMedia, subscribe, ticketId, user?.userId])

  useEffect(() => {
    if (!ticketId) return undefined
    const syncIntervalMs = connected ? 15000 : 4000
    const intervalId = window.setInterval(() => {
      void syncMessages({ silent: true })
    }, syncIntervalMs)
    return () => window.clearInterval(intervalId)
  }, [connected, syncMessages, ticketId])

  useEffect(() => {
    if (!connected) return
    void syncMessages({ silent: true })
  }, [connected, syncMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length])

  const normalizedMessages = useMemo(
    () =>
      messages.map((message) => ({
        ...message,
        isMine: Number(message.senderId) === Number(user?.userId),
        timeText: formatMessageTime(message.createdAt),
        parsed: parseMessage(message),
      })),
    [messages, user?.userId],
  )

  const sendFallbackMessage = useCallback(async (payload) => {
    const response = await axiosClient.post(`/api/tickets/${ticketId}/chats`, {
      ticketId: Number(ticketId),
      ...payload,
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
  }, [ticketId])

  const dispatchChatMessage = useCallback(async (payload) => {
    if (!ticketId) return false
    try {
      const sentViaRealtime = publish(`/app/chat/${ticketId}`, {
        ticketId: Number(ticketId),
        ...payload,
      })
      if (!sentViaRealtime) {
        await sendFallbackMessage(payload)
      } else {
        scheduleSyncAfterSend()
      }
      return true
    } catch (error) {
      const message = error?.response?.data?.message || 'Gửi tin nhắn thất bại.'
      toast.error(message)
      return false
    }
  }, [publish, scheduleSyncAfterSend, sendFallbackMessage, ticketId])

  const uploadChatMedia = useCallback(async (file) => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await axiosClient.post(`/api/tickets/${ticketId}/chats/media`, formData)
    if (!response.data?.mediaUrl || !response.data?.mediaType) {
      throw new Error('invalid-upload-response')
    }
    return response.data
  }, [ticketId])

  const handleSendMessage = async (event) => {
    event.preventDefault()
    if (!content.trim()) return
    const text = content.trim()
    setSending(true)
    const sent = await dispatchChatMessage({ content: text })
    setSending(false)
    if (sent) {
      setContent('')
      inputRef.current?.focus()
    }
  }

  const handleSelectImage = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setProcessingImage(true)
    processingFallbackTimerRef.current = setTimeout(() => {
      setProcessingImage(false)
      toast.error('Thiết bị xử lý ảnh quá lâu. Vui lòng thử ảnh khác hoặc chọn ảnh từ thư viện.')
    }, 12000)
    try {
      const compressedBlob = await compressImageToBlob(file)
      if (!compressedBlob) {
        toast.error('Không xử lý được ảnh.')
        return
      }
      setSending(true)
      const normalizedName = file.name?.replace(/\.[^.]+$/, '') || `chat-image-${Date.now()}`
      const uploadFile = new File([compressedBlob], `${normalizedName}.jpg`, { type: 'image/jpeg' })
      const uploaded = await uploadChatMedia(uploadFile)
      await dispatchChatMessage({
        mediaUrl: uploaded?.mediaUrl,
        mediaType: uploaded?.mediaType,
      })
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể upload ảnh để gửi.'
      toast.error(message)
    } finally {
      if (processingFallbackTimerRef.current) {
        clearTimeout(processingFallbackTimerRef.current)
        processingFallbackTimerRef.current = null
      }
      setSending(false)
      setProcessingImage(false)
    }
  }

  const handleOpenCamera = () => {
    cameraInputRef.current?.click()
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
        void (async () => {
          const blob = new Blob(chunks, { type: 'audio/webm' })
          try {
            if (blob.size > 2 * 1024 * 1024) {
              toast.error('File ghi âm vượt quá 2MB.')
              return
            }
            setSending(true)
            const uploadFile = new File([blob], `chat-audio-${Date.now()}.webm`, { type: 'audio/webm' })
            const uploaded = await uploadChatMedia(uploadFile)
            await dispatchChatMessage({
              mediaUrl: uploaded?.mediaUrl,
              mediaType: uploaded?.mediaType,
            })
          } catch (error) {
            const message = error?.response?.data?.message || 'Không thể upload ghi âm để gửi.'
            toast.error(message)
          } finally {
            setSending(false)
            stream.getTracks().forEach((track) => track.stop())
            mediaStreamRef.current = null
            mediaRecorderRef.current = null
          }
        })()
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
      className={
        embedded
          ? 'flex h-[calc(100vh-190px)] min-h-[540px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm'
          : `fixed bottom-4 right-4 z-40 flex w-[min(92vw,390px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl ${
              minimized ? 'h-auto' : 'h-[min(74vh,620px)] max-h-[calc(100vh-2rem)]'
            }`
      }
    >
      <header className="flex items-start justify-between border-b border-slate-200 px-4 py-3">
        <div>
        <h3 className="text-sm font-semibold text-slate-800 md:text-base">Trao đổi xử lý sự cố</h3>
        <p className="mt-1 text-xs text-slate-500">Ticket #{ticketId}</p>
        <p className={`mt-1 text-xs ${connected ? 'text-emerald-600' : 'text-amber-600'}`}>
          {connected ? 'Realtime: đã kết nối' : 'Realtime: chế độ dự phòng (đồng bộ tự động)'}
        </p>
        </div>
        {!embedded && <div className="flex items-center gap-1">
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
        </div>}
      </header>

      {(embedded || !minimized) && (
        <>
      <div className={`overflow-y-auto bg-slate-50 px-3 py-3 ${embedded ? 'flex-1 min-h-0' : 'flex-1 min-h-0'}`}>
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
                  <ResilientChatImage src={message.parsed.value} alt="chat-img" />
                )}
                {message.parsed.type === 'audio' && (
                  <VoiceMessagePlayer src={message.parsed.value} isMine={message.isMine} />
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

      <form onSubmit={handleSendMessage} className={`border-t border-slate-200 p-3 md:p-4 ${embedded ? 'bg-white' : ''}`}>
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
            disabled={processingImage || sending}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ImagePlus size={14} />
            Ảnh
          </button>
          <button
            type="button"
            onClick={handleOpenCamera}
            disabled={processingImage || sending}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ImagePlus size={14} />
            Chụp ảnh
          </button>
          <button
            type="button"
            onClick={handleToggleRecording}
            disabled={sending}
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
            disabled={!content.trim() || sending}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-fptOrange text-white hover:bg-fptOrangeDark disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Send size={18} />
          </button>
        </div>
        {(processingImage || sending) && (
          <p className="mt-2 text-xs text-slate-500">
            {processingImage ? 'Đang xử lý và upload ảnh...' : 'Đang gửi dữ liệu chat...'}
          </p>
        )}
      </form>
      </>
      )}
    </section>
  )
}

export default memo(TicketChatBox)
