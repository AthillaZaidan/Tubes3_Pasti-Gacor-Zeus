import * as Tesseract from 'tesseract.js'
import type { ScanTextResult } from '../content/scanner'
import { scanTextForJudol } from '../content/scanner'

export type OcrImageMatch = {
  image: HTMLImageElement
  scanResult: ScanTextResult
}

export type OcrImageScanResult = {
  matches: OcrImageMatch[]
  scannedImages: number
  skippedImages: number
  executionTimeMs: number
}

const OCR_IMAGE_LIMIT = 48
const MIN_IMAGE_AREA = 80 * 80
const IMAGE_CACHE_LIMIT = 240
const OCR_TARGET_MAX_EDGE = 1600
const OCR_TARGET_MIN_EDGE = 640
const OCR_CANVAS_BORDER = 16
const OCR_LOCAL_THRESHOLD_BIAS = 10
const imageTextCache = new Map<string, string>()
let workerPromise: Promise<Tesseract.Worker> | null = null

function nowMs() {
  return performance.now()
}

function getWorker() {
  workerPromise ??= Tesseract.createWorker('eng', Tesseract.OEM.LSTM_ONLY, {
    logger: () => undefined,
  }).then(async (worker) => {
    await worker.setParameters({
      tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
      preserve_interword_spaces: '1',
      user_defined_dpi: '300',
    })

    return worker
  })

  return workerPromise
}

function isVisibleElement(element: Element) {
  const rect = element.getBoundingClientRect()
  const style = window.getComputedStyle(element)
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom >= 0 &&
    rect.right >= 0 &&
    rect.top <= window.innerHeight &&
    rect.left <= window.innerWidth &&
    rect.width * rect.height >= MIN_IMAGE_AREA &&
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0'
  )
}

function isVisibleImage(image: HTMLImageElement) {
  return (
    image.complete &&
    image.naturalWidth > 0 &&
    image.naturalHeight > 0 &&
    isVisibleElement(image)
  )
}

function getImageCacheKey(image: HTMLImageElement) {
  return [image.currentSrc || image.src, image.naturalWidth, image.naturalHeight].join('\u001f')
}

function getCachedText(cacheKey: string) {
  const text = imageTextCache.get(cacheKey)
  if (text === undefined) return null

  imageTextCache.delete(cacheKey)
  imageTextCache.set(cacheKey, text)

  return text
}

function setCachedText(cacheKey: string, text: string) {
  if (imageTextCache.size >= IMAGE_CACHE_LIMIT) {
    const firstKey = imageTextCache.keys().next().value
    if (firstKey) imageTextCache.delete(firstKey)
  }

  imageTextCache.set(cacheKey, text)
}

function getImageArea(image: HTMLImageElement) {
  const rect = image.getBoundingClientRect()
  return rect.width * rect.height
}

function getVisibleImages() {
  return Array.from(document.images)
    .filter(isVisibleImage)
    .sort((left, right) => getImageArea(right) - getImageArea(left))
    .slice(0, OCR_IMAGE_LIMIT)
}

function getOcrScale(image: HTMLImageElement) {
  const maxEdge = Math.max(image.naturalWidth, image.naturalHeight)

  if (maxEdge <= 0) return 1
  if (maxEdge < OCR_TARGET_MIN_EDGE) return Math.min(4, OCR_TARGET_MIN_EDGE / maxEdge)
  if (maxEdge > OCR_TARGET_MAX_EDGE) return OCR_TARGET_MAX_EDGE / maxEdge
  return 1
}

function preprocessImageForOcr(image: HTMLImageElement) {
  const scale = getOcrScale(image)
  const sourceWidth = image.naturalWidth
  const sourceHeight = image.naturalHeight
  const scaledWidth = Math.max(1, Math.round(sourceWidth * scale))
  const scaledHeight = Math.max(1, Math.round(sourceHeight * scale))
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', { willReadFrequently: true })

  if (!context) return image

  canvas.width = scaledWidth + OCR_CANVAS_BORDER * 2
  canvas.height = scaledHeight + OCR_CANVAS_BORDER * 2
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, OCR_CANVAS_BORDER, OCR_CANVAS_BORDER, scaledWidth, scaledHeight)

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
  const { data } = imageData
  const grayscale = new Uint8ClampedArray(canvas.width * canvas.height)
  let min = 255
  let max = 0
  let sum = 0

  for (let dataIndex = 0, grayIndex = 0; dataIndex < data.length; dataIndex += 4, grayIndex += 1) {
    const alpha = data[dataIndex + 3] / 255
    const red = data[dataIndex] * alpha + 255 * (1 - alpha)
    const green = data[dataIndex + 1] * alpha + 255 * (1 - alpha)
    const blue = data[dataIndex + 2] * alpha + 255 * (1 - alpha)
    const gray = Math.round(0.299 * red + 0.587 * green + 0.114 * blue)

    grayscale[grayIndex] = gray
    min = Math.min(min, gray)
    max = Math.max(max, gray)
    sum += gray
  }

  const range = Math.max(1, max - min)
  const shouldInvert = sum / grayscale.length < 128

  for (let index = 0; index < grayscale.length; index += 1) {
    const stretched = Math.round(((grayscale[index] - min) / range) * 255)
    grayscale[index] = shouldInvert ? 255 - stretched : stretched
  }

  const integralWidth = canvas.width + 1
  const integral = new Float64Array(integralWidth * (canvas.height + 1))

  for (let y = 1; y <= canvas.height; y += 1) {
    let rowSum = 0
    for (let x = 1; x <= canvas.width; x += 1) {
      rowSum += grayscale[(y - 1) * canvas.width + (x - 1)]
      integral[y * integralWidth + x] = integral[(y - 1) * integralWidth + x] + rowSum
    }
  }

  const radius = Math.max(8, Math.round(Math.min(canvas.width, canvas.height) / 32))

  for (let y = 0; y < canvas.height; y += 1) {
    const top = Math.max(0, y - radius)
    const bottom = Math.min(canvas.height - 1, y + radius)

    for (let x = 0; x < canvas.width; x += 1) {
      const left = Math.max(0, x - radius)
      const right = Math.min(canvas.width - 1, x + radius)
      const area = (right - left + 1) * (bottom - top + 1)
      const localSum =
        integral[(bottom + 1) * integralWidth + (right + 1)] -
        integral[top * integralWidth + (right + 1)] -
        integral[(bottom + 1) * integralWidth + left] +
        integral[top * integralWidth + left]
      const threshold = localSum / area - OCR_LOCAL_THRESHOLD_BIAS
      const pixelIndex = y * canvas.width + x
      const dataIndex = pixelIndex * 4
      const binary = grayscale[pixelIndex] <= threshold ? 0 : 255

      data[dataIndex] = binary
      data[dataIndex + 1] = binary
      data[dataIndex + 2] = binary
      data[dataIndex + 3] = 255
    }
  }

  context.putImageData(imageData, 0, 0)
  return canvas
}

async function recognizeImage(image: HTMLImageElement) {
  const cacheKey = getImageCacheKey(image)
  const cachedText = getCachedText(cacheKey)
  if (cachedText !== null) return cachedText

  const worker = await getWorker()
  let source: HTMLImageElement | HTMLCanvasElement

  try {
    source = preprocessImageForOcr(image)
  } catch {
    source = image
  }

  const result = await worker.recognize(source)
  const text = result.data.text.trim()

  setCachedText(cacheKey, text)
  return text
}

export async function scanVisibleImagesForJudol(
  keywords: string[],
): Promise<OcrImageScanResult> {
  const startedAt = nowMs()
  const matches: OcrImageMatch[] = []
  let scannedImages = 0
  let skippedImages = 0

  for (const image of getVisibleImages()) {
    try {
      scannedImages += 1

      const text = await recognizeImage(image)

      if (text.length === 0) continue

      const scanResult = scanTextForJudol(text, keywords, {
        includeExactKeywordMatches: true,
      })

      if (scanResult.matches.length > 0) {
        matches.push({ image, scanResult })
      }
    } catch {
      skippedImages += 1
    }
  }

  return {
    matches,
    scannedImages,
    skippedImages,
    executionTimeMs: nowMs() - startedAt,
  }
}
