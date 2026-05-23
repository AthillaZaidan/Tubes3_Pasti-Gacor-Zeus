import { findJudolPatternMatches } from '../algorithms/regexMatcher'
import type { AlgorithmResult, DetectionMatch } from '../algorithms/types'
import { findWeightedLevenshteinMatches } from '../algorithms/weightedLevenshtein'

export type ScanTextOptions = {
  fuzzyThreshold?: number
  includeExactKeywordMatches?: boolean
}

export type ScanTextResult = {
  matches: DetectionMatch[]
  results: AlgorithmResult[]
  totalMatches: number
  executionTimeMs: number
}

function nowMs() {
  return performance.now()
}

function normalizeKeywordList(keywords: string[]) {
  const normalized: string[] = []

  for (const keyword of keywords) {
    const trimmed = keyword.trim()
    if (trimmed.length > 0) normalized.push(trimmed)
  }

  return normalized
}

function hasSameRange(left: DetectionMatch, right: DetectionMatch) {
  return left.startIndex === right.startIndex && left.endIndex === right.endIndex
}

function dedupeMatches(matches: DetectionMatch[]) {
  const deduped: DetectionMatch[] = []

  for (const match of matches) {
    const duplicate = deduped.some((existing) => hasSameRange(existing, match))
    if (!duplicate) deduped.push(match)
  }

  return deduped.sort((left, right) => left.startIndex - right.startIndex)
}

export function parseKeywordText(keywordText: string) {
  return normalizeKeywordList(keywordText.split(/\r?\n/g))
}

export function scanTextForJudol(
  text: string,
  keywords: string[],
  options: ScanTextOptions = {},
): ScanTextResult {
  const startedAt = nowMs()
  const normalizedKeywords = normalizeKeywordList(keywords)
  const regexResult = findJudolPatternMatches(text)
  const weightedResult = findWeightedLevenshteinMatches(text, normalizedKeywords, {
    threshold: options.fuzzyThreshold,
    includeExact: options.includeExactKeywordMatches,
  })
  const matches = dedupeMatches([...regexResult.matches, ...weightedResult.matches])
  const results = [regexResult, weightedResult]

  return {
    matches,
    results,
    totalMatches: matches.length,
    executionTimeMs: nowMs() - startedAt,
  }
}
