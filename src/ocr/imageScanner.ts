import * as Tesseract from 'tesseract.js'
import type { ScanTextResult } from '../content/scanner'
import { scanTextForJudol } from '../content/scanner'

export type OcrImageMatch = {
  image: HTMLElement
  scanResult: ScanTextResult
}

export type OcrImageScanResult = {
  matches: OcrImageMatch[]
  scannedImages: number
  skippedImages: number
  executionTimeMs: number
}

const CONTEXT_IMAGE_LIMIT = 96
const OCR_IMAGE_LIMIT = 24
const MIN_IMAGE_AREA = 80 * 80
const IMAGE_CACHE_LIMIT = 160
const CONTEXT_TEXT_LIMIT = 400
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

function isRecognizableImage(image: HTMLImageElement) {
  return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0
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

function getElementArea(element: Element) {
  const rect = element.getBoundingClientRect()
  return rect.width * rect.height
}

function hasCssBackgroundImage(element: Element) {
  const backgroundImage = window.getComputedStyle(element).backgroundImage
  return backgroundImage.includes('url(')
}

function getVisibleImageTargets() {
  const targets = new Set<HTMLElement>()

  for (const image of document.images) {
    if (isVisibleElement(image)) targets.add(image)
  }

  for (const element of document.body.querySelectorAll<HTMLElement>('*')) {
    if (targets.size >= CONTEXT_IMAGE_LIMIT * 2) break
    if (element instanceof HTMLImageElement) continue
    if (hasCssBackgroundImage(element) && isVisibleElement(element)) targets.add(element)
  }

  return Array.from(targets)
    .sort((left, right) => getElementArea(right) - getElementArea(left))
    .slice(0, CONTEXT_IMAGE_LIMIT)
}

function appendText(parts: string[], text: string | null | undefined) {
  const trimmed = text?.replace(/\s+/g, ' ').trim()
  if (trimmed) parts.push(trimmed)
}

function getNearbyContainer(image: HTMLElement) {
  return (
    image.closest('a, button, figure, article, li') ??
    image.parentElement?.closest('a, button, figure, article, li') ??
    image.parentElement
  )
}

function getFilenameFromSource(source: string) {
  try {
    const url = new URL(source)
    const filename = url.pathname.split('/').pop()
    return filename ? decodeURIComponent(filename) : ''
  } catch {
    const filename = source.split('/').pop()
    return filename ? decodeURIComponent(filename) : ''
  }
}

function getImageSourceText(image: HTMLElement) {
  if (image instanceof HTMLImageElement) {
    return getFilenameFromSource(image.currentSrc || image.src)
  }

  const backgroundImage = window.getComputedStyle(image).backgroundImage
  const filenames: string[] = []

  for (const match of backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
    appendText(filenames, getFilenameFromSource(match[1]))
  }

  return filenames.join(' ')
}

  const parts: string[] = []
  const container = getNearbyContainer(image)

  if (image instanceof HTMLImageElement) {
    appendText(parts, image.alt)
  }

  appendText(parts, image.title)
  appendText(parts, image.getAttribute('aria-label'))
  appendText(parts, getImageSourceText(image))

  if (container && container !== document.body) {
    appendText(parts, container.getAttribute('aria-label'))
    appendText(parts, container.textContent)
  }

  return parts.join(' ').slice(0, CONTEXT_TEXT_LIMIT)
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

  let recognizedImages = 0

  for (const image of getVisibleImageTargets()) {
    try {
      const contextText = getImageContextText(image)
      scannedImages += 1

      if (contextText.length > 0) {
        const contextScanResult = scanTextForJudol(contextText, keywords, {
          includeExactKeywordMatches: true,
        })

        if (contextScanResult.matches.length > 0) {
          matches.push({ image, scanResult: contextScanResult })
          continue
        }
      }

      if (!(image instanceof HTMLImageElement)) continue
      if (!isRecognizableImage(image)) continue
      if (recognizedImages >= OCR_IMAGE_LIMIT) continue

      recognizedImages += 1
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
