import type { AlgorithmResult, DetectionMatch } from './types'

const BASE = 31
const MOD = 1_000_000_007

function computeHash(s: string, len: number): number {
  let hash = 0
  for (let i = 0; i < len; i++) {
    hash = (hash * BASE + s.charCodeAt(i)) % MOD
  }
  return hash
}

type ScanResult = { starts: number[]; comparisons: number }

function rkScan(text: string, pattern: string, patternHash: number): ScanResult {
  const n = text.length
  const m = pattern.length
  const starts: number[] = []
  let comparisons = 0

  // BASE^(m-1) mod MOD — dipakai untuk remove leading digit saat roll
  let highBase = 1
  for (let i = 0; i < m - 1; i++) {
    highBase = (highBase * BASE) % MOD
  }

  let windowHash = computeHash(text, m)

  for (let i = 0; i <= n - m; i++) {
    comparisons++
    if (windowHash === patternHash) {
      // verify char-by-char to rule out hash collision
      if (text.slice(i, i + m) === pattern) {
        starts.push(i)
      }
    }

    if (i < n - m) {
      // roll: remove text[i], add text[i+m]
      windowHash = (windowHash - text.charCodeAt(i) * highBase % MOD + MOD) % MOD
      windowHash = (windowHash * BASE + text.charCodeAt(i + m)) % MOD
    }
  }

  return { starts, comparisons }
}

export function findRabinKarpMatches(
  text: string,
  keywords: string[]
): AlgorithmResult {
  const startedAt = performance.now()
  const normalizedText = text.normalize('NFKC').toLowerCase()
  const matches: DetectionMatch[] = []
  let totalComparisons = 0

  for (const keyword of keywords) {
    const pattern = keyword.normalize('NFKC').toLowerCase()
    if (pattern.length === 0 || pattern.length > normalizedText.length) continue

    const patternHash = computeHash(pattern, pattern.length)
    const { starts, comparisons } = rkScan(normalizedText, pattern, patternHash)
    totalComparisons += comparisons

    for (const s of starts) {
      matches.push({
        keyword,
        matchedText: text.slice(s, s + pattern.length),
        algorithm: 'Rabin-Karp',
        startIndex: s,
        endIndex: s + pattern.length,
        comparisons,
      })
    }
  }

  return {
    algorithm: 'Rabin-Karp',
    matches,
    count: matches.length,
    executionTimeMs: performance.now() - startedAt,
    comparisons: totalComparisons,
  }
}
