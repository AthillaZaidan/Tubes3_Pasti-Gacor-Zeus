import type { AlgorithmResult, DetectionMatch } from './types'

type WeightedLevenshteinOptions = {
  threshold?: number
  visualSubstitutionCost?: number
  substitutionCost?: number
  insertionCost?: number
  deletionCost?: number
}

type WeightedDistanceResult = {
  distance: number
  similarity: number
}

const DEFAULT_THRESHOLD = 0.78
const DEFAULT_VISUAL_SUBSTITUTION_COST = 0.25
const DEFAULT_SUBSTITUTION_COST = 1
const DEFAULT_INSERTION_COST = 1
const DEFAULT_DELETION_COST = 1

const VISUAL_GROUPS = [
  ['o', '0', 'ο', 'о'],
  ['a', '4', 'α', 'а'],
  ['i', '1', 'l', '|', 'ı'],
  ['e', '3', 'ε'],
  ['s', '5', '$'],
  ['b', '8'],
  ['g', '6', '9'],
  ['t', '7'],
]

const TOKEN_PATTERN = /[\p{L}\p{N}_$|]+/giu

function nowMs() {
  return performance.now()
}

function normalizeChar(char: string) {
  return char.normalize('NFKC').toLowerCase()
}

function normalizeText(text: string) {
  return text.normalize('NFKC').toLowerCase()
}

function areVisuallySimilar(left: string, right: string) {
  const normalizedLeft = normalizeChar(left)
  const normalizedRight = normalizeChar(right)

  if (normalizedLeft === normalizedRight) return true

  for (const group of VISUAL_GROUPS) {
    let hasLeft = false
    let hasRight = false

    for (const char of group) {
      if (char === normalizedLeft) hasLeft = true
      if (char === normalizedRight) hasRight = true
    }

    if (hasLeft && hasRight) return true
  }

  return false
}

export function getVisualSubstitutionCost(
  left: string,
  right: string,
  options: WeightedLevenshteinOptions = {},
) {
  const visualCost = options.visualSubstitutionCost ?? DEFAULT_VISUAL_SUBSTITUTION_COST
  const substitutionCost = options.substitutionCost ?? DEFAULT_SUBSTITUTION_COST

  if (normalizeChar(left) === normalizeChar(right)) return 0
  return areVisuallySimilar(left, right) ? visualCost : substitutionCost
}

export function calculateWeightedLevenshtein(
  source: string,
  target: string,
  options: WeightedLevenshteinOptions = {},
): WeightedDistanceResult {
  const normalizedSource = Array.from(normalizeText(source))
  const normalizedTarget = Array.from(normalizeText(target))
  const insertionCost = options.insertionCost ?? DEFAULT_INSERTION_COST
  const deletionCost = options.deletionCost ?? DEFAULT_DELETION_COST
  const rowCount = normalizedSource.length + 1
  const columnCount = normalizedTarget.length + 1
  const distances: number[][] = Array.from({ length: rowCount }, () =>
    Array.from({ length: columnCount }, () => 0),
  )

  for (let row = 1; row < rowCount; row += 1) {
    distances[row][0] = row * deletionCost
  }

  for (let column = 1; column < columnCount; column += 1) {
    distances[0][column] = column * insertionCost
  }

  for (let row = 1; row < rowCount; row += 1) {
    for (let column = 1; column < columnCount; column += 1) {
      const substitution = getVisualSubstitutionCost(
        normalizedSource[row - 1],
        normalizedTarget[column - 1],
        options,
      )

      distances[row][column] = Math.min(
        distances[row - 1][column] + deletionCost,
        distances[row][column - 1] + insertionCost,
        distances[row - 1][column - 1] + substitution,
      )
    }
  }

  const distance = distances[normalizedSource.length][normalizedTarget.length]
  const maxLength = Math.max(normalizedSource.length, normalizedTarget.length, 1)
  const similarity = Math.max(0, 1 - distance / maxLength)

  return { distance, similarity }
}

function getCandidateTokens(text: string) {
  const tokens: Array<{ text: string; startIndex: number; endIndex: number }> = []

  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const matchedText = match[0]
    const startIndex = match.index

    if (startIndex === undefined) continue
    tokens.push({
      text: matchedText,
      startIndex,
      endIndex: startIndex + matchedText.length,
    })
  }

  return tokens
}

function isLengthComparable(left: string, right: string) {
  return Math.abs(Array.from(left).length - Array.from(right).length) <= 2
}

export function findWeightedLevenshteinMatches(
  text: string,
  keywords: string[],
  options: WeightedLevenshteinOptions = {},
): AlgorithmResult {
  const startedAt = nowMs()
  const threshold = options.threshold ?? DEFAULT_THRESHOLD
  const matches: DetectionMatch[] = []
  const tokens = getCandidateTokens(text)

  for (const keyword of keywords) {
    for (const token of tokens) {
      if (!isLengthComparable(keyword, token.text)) continue

      const result = calculateWeightedLevenshtein(keyword, token.text, options)
      if (result.similarity < threshold || result.similarity === 1) continue

      matches.push({
        keyword,
        matchedText: token.text,
        algorithm: 'Weighted-Levenshtein',
        startIndex: token.startIndex,
        endIndex: token.endIndex,
        score: result.similarity,
      })
    }
  }

  return {
    algorithm: 'Weighted-Levenshtein',
    matches,
    count: matches.length,
    executionTimeMs: nowMs() - startedAt,
  }
}
