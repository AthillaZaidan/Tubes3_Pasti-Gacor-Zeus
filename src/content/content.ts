import contentStyles from '../styles/content.css?inline'

type PopupCommand = {
  type: 'JUDOL_SCAN' | 'JUDOL_CLEAR' | 'JUDOL_SET_BLUR'
  blur?: boolean
}

const STYLE_ID = 'judol-detector-content-styles'
const TOOLTIP_ID = 'judol-detector-tooltip'
const HIGHLIGHT_SELECTOR = '.judol-highlight'

const demoDetections = [
  {
    text: 'MAXWIN234',
    algorithm: 'RegEx',
    count: 6,
    executionTimeMs: 1.2,
  },
  {
    text: 'H0KI88',
    algorithm: 'Weighted Levenshtein',
    count: 4,
    executionTimeMs: 2.4,
  },
]

function shouldSkipTag(tagName: string) {
  return (
    tagName === 'SCRIPT' ||
    tagName === 'STYLE' ||
    tagName === 'NOSCRIPT' ||
    tagName === 'TEXTAREA' ||
    tagName === 'INPUT'
  )
}

function findTextIndex(source: string, pattern: string) {
  if (pattern.length === 0 || source.length < pattern.length) return -1

  for (let start = 0; start <= source.length - pattern.length; start += 1) {
    let matched = true

    for (let offset = 0; offset < pattern.length; offset += 1) {
      if (source[start + offset] !== pattern[offset]) {
        matched = false
        break
      }
    }

    if (matched) return start
  }

  return -1
}

function ensureContentStyles() {
  if (document.getElementById(STYLE_ID)) return

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = contentStyles
  document.documentElement.append(style)
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
  tooltip.innerHTML = `
    <strong>${target.dataset.keyword ?? 'Unknown keyword'}</strong>
    <span>${target.dataset.algorithm ?? 'Unknown algorithm'} · ${target.dataset.count ?? '0'} matches</span>
    <em>${target.dataset.time ?? '0 ms'}</em>
  `
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

function applyDemoHighlights() {
  ensureContentStyles()
  clearHighlights()

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      if (shouldSkipTag(parent.tagName)) return NodeFilter.FILTER_REJECT

      const text = node.textContent ?? ''
      const hasDetection = demoDetections.some((item) => findTextIndex(text, item.text) >= 0)
      return hasDetection ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
    },
  })

  const nodes: Text[] = []
  while (walker.nextNode()) nodes.push(walker.currentNode as Text)

  nodes.forEach((node) => {
    let currentNode: Text | null = node

    demoDetections.forEach((detection) => {
      if (!currentNode) return
      const text = currentNode.textContent ?? ''
      const index = findTextIndex(text, detection.text)
      if (index < 0) return

      const range = document.createRange()
      range.setStart(currentNode, index)
      range.setEnd(currentNode, index + detection.text.length)

      const highlight = document.createElement('span')
      highlight.className = 'judol-highlight'
      highlight.dataset.keyword = detection.text
      highlight.dataset.algorithm = detection.algorithm
      highlight.dataset.count = String(detection.count)
      highlight.dataset.time = `${detection.executionTimeMs} ms`
      highlight.addEventListener('mousemove', (event) => showTooltip(highlight, event))
      highlight.addEventListener('mouseleave', hideTooltip)

      range.surroundContents(highlight)
      currentNode = highlight.nextSibling instanceof Text ? highlight.nextSibling : null
    })
  })
}

function setBlur(enabled: boolean) {
  document.querySelectorAll<HTMLElement>(HIGHLIGHT_SELECTOR).forEach((node) => {
    node.dataset.judolBlur = String(enabled)
  })
}

ensureContentStyles()

function isPopupCommand(message: unknown): message is PopupCommand {
  if (!message || typeof message !== 'object') return false
  return 'type' in message
}

chrome.runtime?.onMessage?.addListener((message) => {
  if (!isPopupCommand(message)) return

  if (message.type === 'JUDOL_SCAN') applyDemoHighlights()
  if (message.type === 'JUDOL_CLEAR') clearHighlights()
  if (message.type === 'JUDOL_SET_BLUR') setBlur(Boolean(message.blur))
})
