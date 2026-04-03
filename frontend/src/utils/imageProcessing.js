const TARGET_IMAGE_BYTES = 700 * 1024
const MAX_IMAGE_DIMENSION = 1600

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

export async function compressImageForUpload(file) {
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
  const qualitySteps = [0.86, 0.76, 0.66, 0.56, 0.46]

  for (let cycle = 0; cycle < 4; cycle += 1) {
    canvas.width = workingWidth
    canvas.height = workingHeight
    context.clearRect(0, 0, workingWidth, workingHeight)
    context.drawImage(image, 0, 0, workingWidth, workingHeight)

    for (const quality of qualitySteps) {
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
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  if (!bestBlob) {
    return rawDataUrl
  }
  return blobToDataUrl(bestBlob)
}
