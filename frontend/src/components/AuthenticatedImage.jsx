import { useEffect, useState } from 'react'
import axiosClient from '../api/axiosClient'
import { resolveBackendMediaUrl } from '../utils/mediaUrl'

function AuthenticatedImage({ src, alt, className = '', ...props }) {
  const [loadState, setLoadState] = useState({ src: '', objectUrl: '', failed: false })
  const resolvedUrl = src ? resolveBackendMediaUrl(src) : ''
  const requiresAuthenticatedFetch = resolvedUrl.includes('/api/media/uploads/tickets/')
  const isDirectUrl = Boolean(resolvedUrl) && !requiresAuthenticatedFetch

  useEffect(() => {
    let active = true
    let nextObjectUrl = ''
    if (!src || isDirectUrl) return () => {}

    axiosClient.get(resolvedUrl, { responseType: 'blob' })
      .then((response) => {
        if (!active) return
        nextObjectUrl = URL.createObjectURL(response.data)
        setLoadState({ src, objectUrl: nextObjectUrl, failed: false })
      })
      .catch(() => {
        if (active) setLoadState({ src, objectUrl: '', failed: true })
      })

    return () => {
      active = false
      if (nextObjectUrl) URL.revokeObjectURL(nextObjectUrl)
    }
  }, [isDirectUrl, resolvedUrl, src])

  if (isDirectUrl) {
    return <img src={resolvedUrl} alt={alt} className={className} {...props} />
  }

  if (loadState.src === src && loadState.failed) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 p-4 text-center text-sm text-slate-500 ${className}`}>
        Không thể tải ảnh hoặc bạn không có quyền xem.
      </div>
    )
  }

  if (loadState.src !== src || !loadState.objectUrl) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 p-4 text-sm text-slate-500 ${className}`}>
        Đang tải ảnh...
      </div>
    )
  }

  return <img src={loadState.objectUrl} alt={alt} className={className} {...props} />
}

export default AuthenticatedImage
