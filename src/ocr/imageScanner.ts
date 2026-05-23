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

const OCR_IMAGE_LIMIT = 6
const MIN_IMAGE_AREA = 80 * 80
const IMAGE_CACHE_LIMIT = 80
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
    })

    return worker
  })

  return workerPromise
}

function isVisibleImage(image: HTMLImageElement) {
  const rect = image.getBoundingClientRect()
  const style = window.getComputedStyle(image)

  return (
    image.complete &&
    image.naturalWidth > 0 &&
    image.naturalHeight > 0 &&
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

function getVisibleImages() {
  return Array.from(document.images).filter(isVisibleImage).slice(0, OCR_IMAGE_LIMIT)
}

async function recognizeImage(image: HTMLImageElement) {
  const cacheKey = getImageCacheKey(image)
  const cachedText = getCachedText(cacheKey)
  if (cachedText !== null) return cachedText

  const worker = await getWorker()
  const result = await worker.recognize(image)
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
      const text = await recognizeImage(image)
      scannedImages += 1

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
