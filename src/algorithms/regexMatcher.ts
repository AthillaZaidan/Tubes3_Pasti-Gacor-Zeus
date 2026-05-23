import type { AlgorithmResult, DetectionMatch } from './types'

const JUDOL_PATTERN = /(?<![\p{L}\p{N}_])[\p{L}]{2,}[0-9]{2,3}(?![\p{L}\p{N}_])/giu

function nowMs() {
  return performance.now()
}

export function findJudolPatternMatches(text: string): AlgorithmResult {
  const startedAt = nowMs()
  const matches: DetectionMatch[] = []

  for (const match of text.matchAll(JUDOL_PATTERN)) {
    const matchedText = match[0]
    const startIndex = match.index

    if (startIndex === undefined) continue

    matches.push({
      keyword: matchedText,
      matchedText,
      algorithm: 'RegEx',
      startIndex,
      endIndex: startIndex + matchedText.length,
    })
  }

  return {
    algorithm: 'RegEx',
    matches,
    count: matches.length,
    executionTimeMs: nowMs() - startedAt,
  }
}
