import { findBoyerMooreMatches } from '../algorithms/boyerMoore'
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

const SCAN_CACHE_LIMIT = 750
const scanCache = new Map<string, ScanTextResult>()

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

function createScanCacheKey(text: string, keywords: string[], options: ScanTextOptions) {
  return [
    text,
    keywords.join('\u001f'),
    options.fuzzyThreshold ?? '',
    options.includeExactKeywordMatches ? '1' : '0',
  ].join('\u001e')
}

function getCachedResult(cacheKey: string) {
  const cached = scanCache.get(cacheKey)
  if (!cached) return null

  scanCache.delete(cacheKey)
  scanCache.set(cacheKey, cached)

  return {
    ...cached,
    executionTimeMs: 0,
    results: cached.results.map((result) => ({ ...result, executionTimeMs: 0 })),
  }
}

function setCachedResult(cacheKey: string, result: ScanTextResult) {
  if (scanCache.size >= SCAN_CACHE_LIMIT) {
    const firstKey = scanCache.keys().next().value
    if (firstKey) scanCache.delete(firstKey)
  }

  scanCache.set(cacheKey, result)
}

export function scanTextForJudol(
  text: string,
  keywords: string[],
  options: ScanTextOptions = {},
): ScanTextResult {
  const startedAt = nowMs()
  const normalizedKeywords = normalizeKeywordList(keywords)
  const cacheKey = createScanCacheKey(text, normalizedKeywords, options)
  const cached = getCachedResult(cacheKey)

  if (cached) return cached

  const regexResult = findJudolPatternMatches(text)
  const weightedResult = findWeightedLevenshteinMatches(text, normalizedKeywords, {
    threshold: options.fuzzyThreshold,
    includeExact: options.includeExactKeywordMatches,
  })
  const bmResult = findBoyerMooreMatches(text, normalizedKeywords)
  const matches = dedupeMatches([...regexResult.matches, ...weightedResult.matches, ...bmResult.matches])
  const results = [regexResult, weightedResult, bmResult]

  const result = {
    matches,
    results,
    totalMatches: matches.length,
    executionTimeMs: nowMs() - startedAt,
  }

  setCachedResult(cacheKey, result)
  return result
}
