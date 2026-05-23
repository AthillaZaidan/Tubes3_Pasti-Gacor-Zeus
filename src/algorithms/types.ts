export type MatchAlgorithm =
  | 'KMP'
  | 'Boyer-Moore'
  | 'RegEx'
  | 'Weighted-Levenshtein'
  | 'Aho-Corasick'
  | 'Rabin-Karp'

export type DetectionMatch = {
  keyword: string
  matchedText: string
  algorithm: MatchAlgorithm
  startIndex: number
  endIndex: number
  score?: number
  comparisons?: number
}

export type AlgorithmResult = {
  algorithm: MatchAlgorithm
  matches: DetectionMatch[]
  count: number
  executionTimeMs: number
  comparisons?: number
}

export type OcrSummary = {
  enabled: boolean
  scannedImages: number
  matchedImages: number
  skippedImages: number
  executionTimeMs: number
}
