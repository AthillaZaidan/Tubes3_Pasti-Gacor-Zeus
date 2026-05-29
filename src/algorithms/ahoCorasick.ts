import type { AlgorithmResult, DetectionMatch } from './types'

type TrieNode = {
  children: Map<string, TrieNode>
  failure: TrieNode | null
  outputs: string[]
}

function nowMs() {
  return performance.now()
}

function createNode(): TrieNode {
  return {
    children: new Map(),
    failure: null,
    outputs: [],
  }
}

function buildTrie(keywords: string[]) {
  const root = createNode()

  for (const keyword of keywords) {
    const trimmed = keyword.trim()
    if (trimmed.length === 0) continue

    let node = root
    for (const char of trimmed) {
      let next = node.children.get(char)
      if (!next) {
        next = createNode()
        node.children.set(char, next)
      }
      node = next
    }

    node.outputs.push(trimmed)
  }

  return root
}

function buildFailureLinks(root: TrieNode) {
  const queue: TrieNode[] = []
  root.failure = root

  for (const child of root.children.values()) {
    child.failure = root
    queue.push(child)
  }

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) continue

    for (const [char, child] of current.children.entries()) {
      let fallback = current.failure

      while (fallback && fallback !== root && !fallback.children.has(char)) {
        fallback = fallback.failure
      }

      if (fallback && fallback.children.has(char) && fallback.children.get(char) !== child) {
        child.failure = fallback.children.get(char) ?? root
      } else {
        child.failure = root
      }

      if (child.failure.outputs.length > 0) {
        child.outputs.push(...child.failure.outputs)
      }

      queue.push(child)
    }
  }
}

export function findAhoCorasickMatches(text: string, keywords: string[]): AlgorithmResult {
  const startedAt = nowMs()
  const matches: DetectionMatch[] = []
  let comparisons = 0

  const normalizedText = text.toLowerCase()
  const normalizedKeywords = keywords.map((keyword) => keyword.trim().toLowerCase())
  const root = buildTrie(normalizedKeywords)
  buildFailureLinks(root)

  let node = root

  for (let index = 0; index < normalizedText.length; index += 1) {
    const char = normalizedText[index]

    while (node !== root && !node.children.has(char)) {
      node = node.failure ?? root
      comparisons += 1
    }

    const next = node.children.get(char)
    if (next) {
      node = next
      comparisons += 1
    } else {
      node = root
    }

    if (node.outputs.length === 0) continue

    for (const keyword of node.outputs) {
      const startIndex = index - keyword.length + 1
      if (startIndex < 0) continue

      matches.push({
        keyword,
        matchedText: text.slice(startIndex, startIndex + keyword.length),
        algorithm: 'Aho-Corasick',
        startIndex,
        endIndex: startIndex + keyword.length,
      })
    }
  }

  return {
    algorithm: 'Aho-Corasick',
    matches,
    count: matches.length,
    executionTimeMs: nowMs() - startedAt,
    comparisons,
  }
}
