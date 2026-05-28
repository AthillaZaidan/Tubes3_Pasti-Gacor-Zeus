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
