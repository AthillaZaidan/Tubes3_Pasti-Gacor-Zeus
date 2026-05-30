import keywordText from '../../keywords/keyword.txt?raw'
import type {
  AlgorithmResult,
  DetectionMatch,
  MatchAlgorithm,
  OcrSummary,
} from '../algorithms/types'
import { parseKeywordText, scanTextForJudol } from './scanner'
import contentStyles from '../styles/content.css?inline'
import { scanVisibleImagesForJudol } from '../ocr/imageScanner'

type PopupCommand = {
  type: 'JUDOL_SCAN' | 'JUDOL_CLEAR' | 'JUDOL_SET_BLUR' | 'JUDOL_SET_ALGORITHM_FILTER'
  blur?: boolean
  includeOcr?: boolean
  algorithms?: MatchAlgorithm[]
}

type ScanSummary = {
  totalMatches: number
  executionTimeMs: number
  algorithmCounts: Partial<Record<MatchAlgorithm, number>>
  algorithmExecutionTimes: Partial<Record<MatchAlgorithm, number>>
  keywordCounts: Record<string, number>
  ocr?: OcrSummary
}

const STYLE_ID = 'judol-detector-content-styles'
const TOOLTIP_ID = 'judol-detector-tooltip'
const HIGHLIGHT_SELECTOR = '.judol-highlight'
const OCR_IMAGE_SELECTOR = '.judol-ocr-image'
const keywords = parseKeywordText(keywordText)
let currentTextBlurEnabled = false
let activeAlgorithmFilter: MatchAlgorithm[] = []
let lastIncludeOcr = false

type FilteredScan = {
  matches: DetectionMatch[]
  totalMatches: number
  algorithmCounts: Partial<Record<MatchAlgorithm, number>>
  keywordCounts: Record<string, number>
  algorithmLabels: Map<string, string>
  filterLabel: string | null
}

function ensureContentStyles() {
  if (document.getElementById(STYLE_ID)) return

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = contentStyles
  document.documentElement.append(style)
}

function shouldSkipTag(tagName: string) {
  return (
    tagName === 'SCRIPT' ||
    tagName === 'STYLE' ||
    tagName === 'NOSCRIPT' ||
    tagName === 'TEXTAREA' ||
    tagName === 'INPUT'
  )
}

function hasHiddenAncestor(element: HTMLElement) {
  let current: HTMLElement | null = element

  while (current && current !== document.body) {
    const style = window.getComputedStyle(current)

    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.visibility === 'collapse' ||
      style.opacity === '0'
    ) {
      return true
    }

    current = current.parentElement
  }

  return false
}

function isRenderedTextParent(element: HTMLElement) {
  if (!element.isConnected) return false
  if (hasHiddenAncestor(element)) return false
  return element.getClientRects().length > 0 || element.getBoundingClientRect().width > 0
}

function createTooltip() {
  let tooltip = document.getElementById(TOOLTIP_ID)

  if (!tooltip) {
    tooltip = document.createElement('div')
    tooltip.id = TOOLTIP_ID
    tooltip.className = 'judol-tooltip'
    tooltip.hidden = true
    document.documentElement.append(tooltip)
  }

  return tooltip
}

function showTooltip(target: HTMLElement, event: MouseEvent) {
  const tooltip = createTooltip()
  tooltip.replaceChildren()

  const keyword = document.createElement('strong')
  keyword.textContent = target.dataset.keyword ?? 'Unknown keyword'

  const metadata = document.createElement('span')
  metadata.textContent = `${target.dataset.algorithm ?? 'Unknown algorithm'} · ${
    target.dataset.count ?? '0'
  } matches`

  const time = document.createElement('em')
  time.textContent = target.dataset.time ?? '0 ms'

  tooltip.append(keyword, metadata, time)
  tooltip.hidden = false
  tooltip.style.left = `${Math.min(event.clientX + 14, window.innerWidth - 300)}px`
  tooltip.style.top = `${Math.min(event.clientY + 14, window.innerHeight - 120)}px`
}

function hideTooltip() {
  const tooltip = document.getElementById(TOOLTIP_ID)
  if (tooltip) tooltip.hidden = true
}

function clearHighlights() {
  document.querySelectorAll<HTMLElement>(HIGHLIGHT_SELECTOR).forEach((node) => {
    node.replaceWith(document.createTextNode(node.textContent ?? ''))
  })
  document.querySelectorAll<HTMLElement>(OCR_IMAGE_SELECTOR).forEach((node) => {
    node.classList.remove('judol-ocr-image')
    delete node.dataset.keyword
    delete node.dataset.algorithm
    delete node.dataset.count
    delete node.dataset.time
    delete node.dataset.judolBlur
  })
  hideTooltip()
}

function getVisibleTextNodes() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      const text = node.textContent

      if (!parent || !text || text.trim().length === 0) return NodeFilter.FILTER_REJECT
      if (shouldSkipTag(parent.tagName)) return NodeFilter.FILTER_REJECT
      if (parent.closest(HIGHLIGHT_SELECTOR)) return NodeFilter.FILTER_REJECT
      if (!isRenderedTextParent(parent)) return NodeFilter.FILTER_REJECT
      if (parent.closest(`#${TOOLTIP_ID}`)) return NodeFilter.FILTER_REJECT

      return NodeFilter.FILTER_ACCEPT
    },
  })
  const nodes: Text[] = []

  while (walker.nextNode()) {
    nodes.push(walker.currentNode as Text)
  }

  return nodes
}

function getResultForMatch(results: AlgorithmResult[], match: DetectionMatch) {
  return results.find((result) => result.algorithm === match.algorithm)
}

function createHighlight(match: DetectionMatch, results: AlgorithmResult[]) {
  const highlight = document.createElement('span')
  const algorithmResult = getResultForMatch(results, match)

  highlight.className = 'judol-highlight'
  highlight.textContent = match.matchedText
  highlight.dataset.keyword = match.keyword
  highlight.dataset.algorithm = match.algorithm
  highlight.dataset.count = String(algorithmResult?.count ?? 1)
  highlight.dataset.time = `${(algorithmResult?.executionTimeMs ?? 0).toFixed(2)} ms`
  highlight.dataset.judolBlur = String(currentTextBlurEnabled)
  highlight.addEventListener('mousemove', (event) => showTooltip(highlight, event))
  highlight.addEventListener('mouseleave', hideTooltip)

  return highlight
}

function getMatchKey(match: DetectionMatch) {
  return `${match.startIndex}:${match.endIndex}`
}

function applyAlgorithmFilter(
  scanResult: ReturnType<typeof scanTextForJudol>,
  algorithms: MatchAlgorithm[],
): FilteredScan {
  const matches: DetectionMatch[] = []
  const algorithmCounts: Partial<Record<MatchAlgorithm, number>> = {}
  const keywordCounts: Record<string, number> = {}
  const algorithmLabels = new Map<string, string>()
  const selected = new Set(algorithms)

  if (selected.size === 0) {
    for (const result of scanResult.results) {
      algorithmCounts[result.algorithm] =
        (algorithmCounts[result.algorithm] ?? 0) + result.count
    }

    for (const match of scanResult.matches) {
      keywordCounts[match.keyword] = (keywordCounts[match.keyword] ?? 0) + 1
    }

    return {
      matches: scanResult.matches,
      totalMatches: scanResult.totalMatches,
      algorithmCounts,
      keywordCounts,
      algorithmLabels,
      filterLabel: null,
    }
  }

  const label = Array.from(selected).join(' + ')
  const groups = new Map<string, { match: DetectionMatch; algorithms: Set<MatchAlgorithm> }>()

  for (const result of scanResult.results) {
    if (!selected.has(result.algorithm)) continue

    for (const match of result.matches) {
      const key = getMatchKey(match)
      const existing = groups.get(key)

      if (existing) {
        existing.algorithms.add(result.algorithm)
        continue
      }

      groups.set(key, { match, algorithms: new Set([result.algorithm]) })
    }
  }

  for (const group of groups.values()) {
    let hasAll = true

    for (const algorithm of selected) {
      if (!group.algorithms.has(algorithm)) {
        hasAll = false
        break
      }
    }

    if (!hasAll) continue

    const key = getMatchKey(group.match)
    matches.push(group.match)
    algorithmLabels.set(key, label)
    keywordCounts[group.match.keyword] = (keywordCounts[group.match.keyword] ?? 0) + 1

    for (const algorithm of selected) {
      algorithmCounts[algorithm] = (algorithmCounts[algorithm] ?? 0) + 1
    }
  }

  matches.sort((left, right) => left.startIndex - right.startIndex)

  return {
    matches,
    totalMatches: matches.length,
    algorithmCounts,
    keywordCounts,
    algorithmLabels,
    filterLabel: label,
  }
}

function getNonOverlappingMatches(matches: DetectionMatch[]) {
  const selected: DetectionMatch[] = []
  let cursor = 0

  for (const match of matches) {
    if (match.startIndex < cursor) continue
    selected.push(match)
    cursor = match.endIndex
  }

  return selected
}

function replaceTextNodeWithHighlights(
  node: Text,
  text: string,
  matches: DetectionMatch[],
  results: AlgorithmResult[],
  algorithmLabels: Map<string, string>,
) {
  const fragment = document.createDocumentFragment()
  let cursor = 0

  for (const match of matches) {
    if (cursor < match.startIndex) {
      fragment.append(document.createTextNode(text.slice(cursor, match.startIndex)))
    }

    const highlight = createHighlight(match, results)
    const label = algorithmLabels.get(getMatchKey(match))
    if (label) highlight.dataset.algorithm = label
    fragment.append(highlight)
    cursor = match.endIndex
  }

  if (cursor < text.length) {
    fragment.append(document.createTextNode(text.slice(cursor)))
  }

  node.replaceWith(fragment)
}

function emptyScanSummary(): ScanSummary {
  return {
    totalMatches: 0,
    executionTimeMs: 0,
    algorithmCounts: {},
    algorithmExecutionTimes: {},
    keywordCounts: {},
  }
}

function mergeScanSummary(
  summary: ScanSummary,
  result: ReturnType<typeof scanTextForJudol>,
  filtered: FilteredScan,
) {
  summary.totalMatches += filtered.totalMatches
  summary.executionTimeMs += result.executionTimeMs

  for (const algorithmResult of result.results) {
    const filteredCount = filtered.algorithmCounts[algorithmResult.algorithm]
    summary.algorithmCounts[algorithmResult.algorithm] =
      (summary.algorithmCounts[algorithmResult.algorithm] ?? 0) + (filteredCount ?? 0)
    summary.algorithmExecutionTimes[algorithmResult.algorithm] =
      (summary.algorithmExecutionTimes[algorithmResult.algorithm] ?? 0) +
      algorithmResult.executionTimeMs
  }

  for (const [keyword, count] of Object.entries(filtered.keywordCounts)) {
    summary.keywordCounts[keyword] = (summary.keywordCounts[keyword] ?? 0) + count
  }
}

function markOcrImage(
  image: HTMLElement,
  result: ReturnType<typeof scanTextForJudol>,
  algorithmLabel: string | null,
) {
  const firstMatch = result.matches[0]
  const firstResult = result.results.find((algorithmResult) => {
    return algorithmResult.algorithm === firstMatch?.algorithm
  })

  image.classList.add('judol-ocr-image')
  image.dataset.keyword = firstMatch?.keyword ?? 'OCR match'
  image.dataset.algorithm = `OCR + ${algorithmLabel ?? firstMatch?.algorithm ?? 'scanner'}`
  image.dataset.count = String(result.totalMatches)
  image.dataset.time = `${(firstResult?.executionTimeMs ?? result.executionTimeMs).toFixed(2)} ms`
  image.dataset.judolBlur = 'true'
  image.onmousemove = (event) => showTooltip(image, event)
  image.onmouseleave = hideTooltip
}

function highlightTextNode(node: Text, summary: ScanSummary) {
  const text = node.textContent ?? ''
  const scanResult = scanTextForJudol(text, keywords, { includeExactKeywordMatches: true })
  const filtered = applyAlgorithmFilter(scanResult, activeAlgorithmFilter)
  const matches = getNonOverlappingMatches(filtered.matches)

  mergeScanSummary(summary, scanResult, filtered)
  if (matches.length === 0) return
  replaceTextNodeWithHighlights(node, text, matches, scanResult.results, filtered.algorithmLabels)
}

async function scanPage(includeOcr = false) {
  lastIncludeOcr = includeOcr
  ensureContentStyles()
  clearHighlights()
  document.body.normalize()

  const summary = emptyScanSummary()

  for (const node of getVisibleTextNodes()) {
    highlightTextNode(node, summary)
  }

  if (includeOcr) {
    const ocrStartedAt = performance.now()
    const ocrResult = await scanVisibleImagesForJudol(keywords)

    for (const imageMatch of ocrResult.matches) {
      const filtered = applyAlgorithmFilter(imageMatch.scanResult, activeAlgorithmFilter)
      if (filtered.totalMatches === 0) continue

      mergeScanSummary(summary, imageMatch.scanResult, filtered)
      markOcrImage(imageMatch.image, imageMatch.scanResult, filtered.filterLabel)
    }

    summary.ocr = {
      enabled: true,
      scannedImages: ocrResult.scannedImages,
      matchedImages: ocrResult.matches.length,
      skippedImages: ocrResult.skippedImages,
      executionTimeMs: performance.now() - ocrStartedAt,
    }
    summary.executionTimeMs += ocrResult.executionTimeMs
  } else {
    summary.ocr = {
      enabled: false,
      scannedImages: 0,
      matchedImages: 0,
      skippedImages: 0,
      executionTimeMs: 0,
    }
  }

  return summary
}

function setBlur(enabled: boolean) {
  currentTextBlurEnabled = enabled

  document.querySelectorAll<HTMLElement>(HIGHLIGHT_SELECTOR).forEach((node) => {
    node.dataset.judolBlur = String(enabled)
  })
}

function isPopupCommand(message: unknown): message is PopupCommand {
  if (!message || typeof message !== 'object') return false
  return 'type' in message
}

ensureContentStyles()

chrome.runtime?.onMessage?.addListener((message, _sender, sendResponse) => {
  if (!isPopupCommand(message)) return false

  if (message.type === 'JUDOL_SCAN') {
    void scanPage(Boolean(message.includeOcr))
      .then((summary) => sendResponse({ ok: true, summary }))
      .catch(() => sendResponse({ ok: false, summary: emptyScanSummary() }))
    return true
  }

  if (message.type === 'JUDOL_SET_ALGORITHM_FILTER') {
    activeAlgorithmFilter = message.algorithms ?? []
    void scanPage(lastIncludeOcr)
      .then((summary) => sendResponse({ ok: true, summary }))
      .catch(() => sendResponse({ ok: false, summary: emptyScanSummary() }))
    return true
  }

  if (message.type === 'JUDOL_CLEAR') {
    clearHighlights()
    sendResponse({ ok: true, summary: emptyScanSummary() })
    return true
  }

  if (message.type === 'JUDOL_SET_BLUR') {
    setBlur(Boolean(message.blur))
    sendResponse({ ok: true })
    return true
  }

  return false
})
