import keywordText from '../../keywords/keyword.txt?raw'
import type { AlgorithmResult, DetectionMatch, MatchAlgorithm } from '../algorithms/types'
import { parseKeywordText, scanTextForJudol } from './scanner'
import contentStyles from '../styles/content.css?inline'

type PopupCommand = {
  type: 'JUDOL_SCAN' | 'JUDOL_CLEAR' | 'JUDOL_SET_BLUR'
  blur?: boolean
}

type ScanSummary = {
  totalMatches: number
  executionTimeMs: number
  algorithmCounts: Partial<Record<MatchAlgorithm, number>>
  algorithmExecutionTimes: Partial<Record<MatchAlgorithm, number>>
  keywordCounts: Record<string, number>
}

const STYLE_ID = 'judol-detector-content-styles'
const TOOLTIP_ID = 'judol-detector-tooltip'
const HIGHLIGHT_SELECTOR = '.judol-highlight'
const keywords = parseKeywordText(keywordText)

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
  highlight.addEventListener('mousemove', (event) => showTooltip(highlight, event))
  highlight.addEventListener('mouseleave', hideTooltip)

  return highlight
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
) {
  const fragment = document.createDocumentFragment()
  let cursor = 0

  for (const match of matches) {
    if (cursor < match.startIndex) {
      fragment.append(document.createTextNode(text.slice(cursor, match.startIndex)))
    }

    fragment.append(createHighlight(match, results))
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

function mergeScanSummary(summary: ScanSummary, result: ReturnType<typeof scanTextForJudol>) {
  summary.totalMatches += result.totalMatches
  summary.executionTimeMs += result.executionTimeMs

  for (const algorithmResult of result.results) {
    summary.algorithmCounts[algorithmResult.algorithm] =
      (summary.algorithmCounts[algorithmResult.algorithm] ?? 0) + algorithmResult.count
    summary.algorithmExecutionTimes[algorithmResult.algorithm] =
      (summary.algorithmExecutionTimes[algorithmResult.algorithm] ?? 0) +
      algorithmResult.executionTimeMs
  }

  for (const match of result.matches) {
    summary.keywordCounts[match.keyword] = (summary.keywordCounts[match.keyword] ?? 0) + 1
  }
}

function highlightTextNode(node: Text, summary: ScanSummary) {
  const text = node.textContent ?? ''
  const scanResult = scanTextForJudol(text, keywords, { includeExactKeywordMatches: true })
  const matches = getNonOverlappingMatches(scanResult.matches)

  mergeScanSummary(summary, scanResult)
  if (matches.length === 0) return
  replaceTextNodeWithHighlights(node, text, matches, scanResult.results)
}

function scanPage() {
  ensureContentStyles()
  clearHighlights()

  const summary = emptyScanSummary()

  for (const node of getVisibleTextNodes()) {
    highlightTextNode(node, summary)
  }

  return summary
}

function setBlur(enabled: boolean) {
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
    sendResponse({ ok: true, summary: scanPage() })
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
