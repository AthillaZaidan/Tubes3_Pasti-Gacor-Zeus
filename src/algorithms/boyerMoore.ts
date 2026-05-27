import type { AlgorithmResult } from './types'

function buildBadCharTable(pattern: string): Map<string, number> {
  const table = new Map<string, number>()
  for (let i = 0; i < pattern.length; i++) {
    table.set(pattern[i], i)
  }
  return table
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
