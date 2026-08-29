import { useEffect, useState } from 'react'
import axiosClient from '../api/axiosClient'
import { resolveBackendMediaUrl } from '../utils/mediaUrl'

function AuthenticatedInquiryImage({ src, alt = 'Ảnh trao đổi', className = '' }) {
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
    return <div className={`rounded-xl bg-slate-100 p-4 text-sm text-slate-500 ${className}`}>Không thể tải ảnh.</div>
  }
  if (state.source !== src || !state.objectUrl) {
    return <div className={`rounded-xl bg-slate-100 p-4 text-sm text-slate-500 ${className}`}>Đang tải ảnh...</div>
  }
  return <img src={state.objectUrl} alt={alt} className={className} />
}

export default AuthenticatedInquiryImage
