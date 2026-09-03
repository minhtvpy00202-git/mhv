import { useEffect, useState } from 'react'
import axiosClient from '../api/axiosClient'
import { resolveBackendMediaUrl } from '../utils/mediaUrl'

function AuthenticatedInquiryImage({ src, mediaType = 'image', alt = 'Ảnh trao đổi', className = '' }) {
  const [state, setState] = useState({ source: '', objectUrl: '', failed: false })

  useEffect(() => {
    let active = true
    let objectUrl = ''
    if (!src) return () => {}

    axiosClient.get(resolveBackendMediaUrl(src), { responseType: 'blob' })
      .then((response) => {
        if (!active) return
        objectUrl = URL.createObjectURL(response.data)
        setState({ source: src, objectUrl, failed: false })
      })
      .catch(() => {
        if (active) setState({ source: src, objectUrl: '', failed: true })
      })

    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [src])

  if (state.source === src && state.failed) {
    return <div className={`rounded-xl bg-slate-100 p-4 text-sm text-slate-500 ${className}`}>Không thể tải media.</div>
  }
  if (state.source !== src || !state.objectUrl) {
    return <div className={`rounded-xl bg-slate-100 p-4 text-sm text-slate-500 ${className}`}>Đang tải media...</div>
  }
  if (mediaType === 'audio') return <audio src={state.objectUrl} controls preload="metadata" className={className} />
  return <img src={state.objectUrl} alt={alt} className={className} />
}

export default AuthenticatedInquiryImage
