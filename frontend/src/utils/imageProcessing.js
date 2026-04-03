const TARGET_IMAGE_BYTES = 700 * 1024
const MAX_IMAGE_DIMENSION = 1024

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

async function fileToBitmapOrImage(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      return {
        width: bitmap.width,
        height: bitmap.height,
        drawTo: (context, width, height) => context.drawImage(bitmap, 0, 0, width, height),
        dispose: () => bitmap.close?.(),
      }
    } catch {}
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({
        width: img.width,
        height: img.height,
        drawTo: (context, width, height) => context.drawImage(img, 0, 0, width, height),
        dispose: () => {},
      })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image-load-failed'))
    }
    img.src = url
  })
}

export async function compressImageForUpload(file) {
  const source = await fileToBitmapOrImage(file)

  let width = source.width
  let height = source.height
  const maxDimension = Math.max(width, height)
  if (maxDimension > MAX_IMAGE_DIMENSION) {
    const scale = MAX_IMAGE_DIMENSION / maxDimension
    width = Math.round(width * scale)
    height = Math.round(height * scale)
  }

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) {
    source.dispose()
    throw new Error('canvas-not-supported')
  }

  canvas.width = width
  canvas.height = height
  context.clearRect(0, 0, width, height)
  source.drawTo(context, width, height)
  source.dispose()

  const primary = await canvasToBlob(canvas, 0.72)
  if (primary && primary.size <= TARGET_IMAGE_BYTES) {
    return blobToDataUrl(primary)
  }

  const fallback = await canvasToBlob(canvas, 0.58)
  if (fallback) {
    return blobToDataUrl(fallback)
  }
  throw new Error('compress-failed')
}
