const TARGET_IMAGE_BYTES = 700 * 1024
const MAX_IMAGE_DIMENSION = 1280

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

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image-load-failed'))
    }
    img.src = url
  })
}

export async function compressImageForUpload(file) {
  const image = await fileToImage(file)

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
    return blobToDataUrl(file)
  }

  canvas.width = width
  canvas.height = height
  context.clearRect(0, 0, width, height)
  context.drawImage(image, 0, 0, width, height)

  const primary = await canvasToBlob(canvas, 0.78)
  if (primary && primary.size <= TARGET_IMAGE_BYTES) {
    return blobToDataUrl(primary)
  }

  const fallback = await canvasToBlob(canvas, 0.6)
  if (fallback) {
    return blobToDataUrl(fallback)
  }
  return blobToDataUrl(file)
}
