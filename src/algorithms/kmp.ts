import type { AlgorithmResult, DetectionMatch } from './types'

function nowMs() {
  return performance.now()
}

function buildFailureTable(pattern: string) {
  const table = Array.from({ length: pattern.length }, () => 0)
  let length = 0
  let index = 1

  while (index < pattern.length) {
    if (pattern[index] === pattern[length]) {
      length += 1
      table[index] = length
      index += 1
    } else if (length > 0) {
      length = table[length - 1]
    } else {
      table[index] = 0
      index += 1
    }
  }

  return table
}

function searchKmp(text: string, pattern: string) {
  const matches: number[] = []
  const failure = buildFailureTable(pattern)
  let comparisons = 0
  let textIndex = 0
  let patternIndex = 0

  while (textIndex < text.length) {
    comparisons += 1

    if (text[textIndex] === pattern[patternIndex]) {
      textIndex += 1
      patternIndex += 1

      if (patternIndex === pattern.length) {
        matches.push(textIndex - patternIndex)
        patternIndex = failure[patternIndex - 1]
      }
    } else if (patternIndex > 0) {
      patternIndex = failure[patternIndex - 1]
    } else {
      textIndex += 1
    }
  }

  return { matches, comparisons }
}

export function findKmpMatches(text: string, keywords: string[]): AlgorithmResult {
  const startedAt = nowMs()
  const matches: DetectionMatch[] = []
  let comparisons = 0
  const normalizedText = text.toLowerCase()

  for (const keyword of keywords) {
    const trimmed = keyword.trim()
    if (trimmed.length === 0) continue

    const normalizedKeyword = trimmed.toLowerCase()
    const result = searchKmp(normalizedText, normalizedKeyword)
    comparisons += result.comparisons

    for (const startIndex of result.matches) {
      matches.push({
        keyword: trimmed,
        matchedText: text.slice(startIndex, startIndex + normalizedKeyword.length),
        algorithm: 'KMP',
        startIndex,
        endIndex: startIndex + normalizedKeyword.length,
      })
    }
  }

  return {
    algorithm: 'KMP',
    matches,
    count: matches.length,
    executionTimeMs: nowMs() - startedAt,
    comparisons,
  }
}
