import type { AlgorithmResult, DetectionMatch } from './types'

function buildBadCharTable(pattern: string): Map<string, number> {
  const table = new Map<string, number>()
  for (let i = 0; i < pattern.length; i++) {
    table.set(pattern[i], i)
  }
  return table
}

type ScanResult = { starts: number[]; comparisons: number }

function bmScan(text: string, pattern: string, table: Map<string, number>): ScanResult {
  const starts: number[] = []
  const n = text.length
  const m = pattern.length
  let s = 0
  let comparisons = 0

  while (s <= n - m) {
    let j = m - 1

    while (j >= 0 && pattern[j] === text[s + j]) {
      comparisons++
      j--
    }

    if (j < 0) {
      starts.push(s)
      s += m
    } else {
      comparisons++ // the mismatch
      const badCharShift = j - (table.get(text[s + j]) ?? -1)
      s += Math.max(1, badCharShift)
    }
  }

  return { starts, comparisons }
}

export function findBoyerMooreMatches(
  _text: string,
  _keywords: string[]
): AlgorithmResult {
  return {
    algorithm: 'Boyer-Moore',
    matches: [],
    count: 0,
    executionTimeMs: 0,
    comparisons: 0,
  }
}
