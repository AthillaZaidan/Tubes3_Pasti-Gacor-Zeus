import { useCallback, useEffect, useMemo, useState } from 'react'
import type { MatchAlgorithm, OcrSummary } from '../algorithms/types'

type ScanSummary = {
  totalMatches: number
  executionTimeMs: number
  algorithmCounts: Partial<Record<MatchAlgorithm, number>>
  algorithmExecutionTimes: Partial<Record<MatchAlgorithm, number>>
  keywordCounts: Record<string, number>
  ocr?: OcrSummary
}

type ScanResponse = {
  ok?: boolean
  summary?: ScanSummary
}

const algorithms: MatchAlgorithm[] = ['RegEx', 'Boyer-Moore', 'Rabin-Karp', 'Weighted-Levenshtein']
const SUMMARY_STORAGE_PREFIX = 'judol:lastScanSummary:'
const OCR_ENABLED_STORAGE_KEY = 'judol:ocrEnabled'
const panelClass =
  'rounded-[20px] border border-[#262626] bg-[#141414]/90 shadow-[0_18px_48px_rgba(0,0,0,0.26)]'

function emptySummary(): ScanSummary {
  return {
    totalMatches: 0,
    executionTimeMs: 0,
    algorithmCounts: {},
    algorithmExecutionTimes: {},
    keywordCounts: {},
  }
}

function isScanResponse(value: unknown): value is ScanResponse {
  return Boolean(value && typeof value === 'object' && 'ok' in value)
}

function isScanSummary(value: unknown): value is ScanSummary {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'totalMatches' in value &&
      'executionTimeMs' in value &&
      'algorithmCounts' in value &&
      'algorithmExecutionTimes' in value &&
      'keywordCounts' in value,
  )
}

function formatAlgorithmName(algorithm: MatchAlgorithm) {
  return algorithm === 'Weighted-Levenshtein' ? 'Weighted' : algorithm
}

function getTopKeywords(keywordCounts: Record<string, number>) {
  return Object.entries(keywordCounts)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
}

export function Popup() {
  const [summary, setSummary] = useState<ScanSummary>(emptySummary)
  const [status, setStatus] = useState('Ready')
  const [isScanning, setIsScanning] = useState(false)
  const [storageKey, setStorageKey] = useState<string | null>(null)
  const [ocrEnabled, setOcrEnabled] = useState(false)

  const topKeywords = useMemo(() => getTopKeywords(summary.keywordCounts), [summary.keywordCounts])
  const maxAlgorithmCount = Math.max(
    1,
    ...algorithms.map((algorithm) => summary.algorithmCounts[algorithm] ?? 0),
  )

  const getActiveTab = useCallback(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    return tab
  }, [])

  const getActiveTabId = useCallback(async () => {
    const tab = await getActiveTab()
    return tab.id
  }, [getActiveTab])

  const getActiveTabStorageKey = useCallback(async () => {
    const tab = await getActiveTab()

    if (!tab.url) return null

    try {
      const url = new URL(tab.url)
      return `${SUMMARY_STORAGE_PREFIX}${url.origin}${url.pathname}`
    } catch {
      return `${SUMMARY_STORAGE_PREFIX}${tab.url}`
    }
  }, [getActiveTab])

  useEffect(() => {
    async function restoreLastSummary() {
      const key = await getActiveTabStorageKey()

      if (!key) {
        setSummary(emptySummary())
        setStatus('Ready')
        return
      }

      setStorageKey(key)

      const stored = await chrome.storage.local.get([key])
      const value = stored[key]

      if (!isScanSummary(value)) {
        setSummary(emptySummary())
        setStatus('Ready')
        return
      }

      setSummary(value)
      setStatus(value.totalMatches > 0 ? 'Detected' : 'Clean')
    }

    void restoreLastSummary()
  }, [getActiveTabStorageKey])

  useEffect(() => {
    async function restoreOcrPreference() {
      const stored = await chrome.storage.local.get([OCR_ENABLED_STORAGE_KEY])
      setOcrEnabled(stored[OCR_ENABLED_STORAGE_KEY] === true)
    }

    void restoreOcrPreference()
  }, [])

  async function injectContentScript(tabId: number) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    })
  }

  async function sendCommand(message: Record<string, unknown>) {
    const tabId = await getActiveTabId()
    if (!tabId) throw new Error('No active tab')

    try {
      return await chrome.tabs.sendMessage(tabId, message)
    } catch {
      await injectContentScript(tabId)
      return chrome.tabs.sendMessage(tabId, message)
    }
  }

  async function handleRescan() {
    setIsScanning(true)
    setStatus('Scanning')

    try {
      const response = await sendCommand({ type: 'JUDOL_SCAN', includeOcr: ocrEnabled })

      if (isScanResponse(response) && response.summary) {
        setSummary(response.summary)
        const key = storageKey ?? (await getActiveTabStorageKey())
        if (key) await chrome.storage.local.set({ [key]: response.summary })
        setStatus(response.summary.totalMatches > 0 ? 'Detected' : 'Clean')
      } else {
        setStatus('No response')
      }
    } catch {
      setStatus('Scan failed')
    } finally {
      setIsScanning(false)
    }
  }

  async function handleBlurChange(enabled: boolean) {
    try {
      await sendCommand({ type: 'JUDOL_SET_BLUR', blur: enabled })
      setStatus(enabled ? 'Blur on' : 'Blur off')
    } catch {
      setStatus('Blur failed')
    }
  }

  async function handleOcrChange(enabled: boolean) {
    setOcrEnabled(enabled)
    await chrome.storage.local.set({ [OCR_ENABLED_STORAGE_KEY]: enabled })
    setStatus(enabled ? 'OCR on' : 'OCR off')
  }

  return (
    <main className="grid min-h-[560px] gap-3.5 bg-[radial-gradient(circle_at_80%_0%,rgba(212,77,240,0.22),transparent_28%),radial-gradient(circle_at_15%_18%,rgba(255,122,61,0.14),transparent_25%),#090909] p-[18px] text-white">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="m-0 text-xs leading-[1.2] font-medium text-[#999999]">
            Judol Detector
          </p>
          <h1 className="mt-1 mb-0 text-[34px] leading-[0.95] font-bold tracking-normal">
            Scan results
          </h1>
        </div>
        <span className="rounded-full bg-[#22c55e] px-[11px] py-2 text-xs font-extrabold text-[#061b0d]">
          {status}
        </span>
      </header>

      <section className="grid grid-cols-2 gap-2.5" aria-label="Scan summary">
        <article className={`${panelClass} grid min-h-[92px] gap-2 p-4`}>
          <span className="text-xs leading-[1.2] text-[#999999]">Total matches</span>
          <strong className="text-[34px] leading-[0.95]">{summary.totalMatches}</strong>
        </article>
        <article className={`${panelClass} grid min-h-[92px] gap-2 p-4`}>
          <span className="text-xs leading-[1.2] text-[#999999]">Execution</span>
          <strong className="text-[34px] leading-[0.95]">
            {summary.executionTimeMs.toFixed(0)} ms
          </strong>
        </article>
      </section>

      <section className={`${panelClass} grid gap-4 p-4`}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="m-0 text-lg leading-[1.1] font-bold tracking-normal">
            Algorithm matches
          </h2>
          <button
            type="button"
            onClick={handleRescan}
            disabled={isScanning}
            className="min-h-[34px] cursor-pointer rounded-full border-0 bg-white px-[13px] text-[13px] font-bold text-black outline-offset-3 focus-visible:outline-2 focus-visible:outline-[#0099ff] disabled:cursor-wait disabled:opacity-60"
          >
            {isScanning ? 'Scanning' : 'Rescan'}
          </button>
        </div>

        <div className="grid gap-2.5">
          {algorithms.map((algorithm) => {
            const count = summary.algorithmCounts[algorithm] ?? 0
            const time = summary.algorithmExecutionTimes[algorithm] ?? 0
            const width = `${Math.max(4, (count / maxAlgorithmCount) * 100)}%`

            return (
              <div className="grid gap-2" key={algorithm}>
                <div className="flex items-baseline justify-between gap-3">
                  <strong className="text-sm">{formatAlgorithmName(algorithm)}</strong>
                  <span className="text-xs leading-[1.2] text-[#999999]">
                    {count} matches · {time.toFixed(2)} ms
                  </span>
                </div>
                <div
                  className="relative h-2.5 overflow-hidden rounded-full bg-[#1c1c1c]"
                  aria-hidden="true"
                >
                  <div
                    className="h-full rounded-full bg-linear-to-r from-[#6a4cf5] to-[#ff5577]"
                    style={{ width }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className={`${panelClass} grid gap-4 p-4`}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="m-0 text-lg leading-[1.1] font-bold tracking-normal">
            Keyword comparison
          </h2>
          <span className="text-xs leading-[1.2] text-[#999999]">Live</span>
        </div>

        <div className="grid gap-2.5">
          {topKeywords.length === 0 ? (
            <p className="m-0 rounded-xl bg-[#1c1c1c] px-3 py-3 text-[13px] text-[#999999]">
              Click Rescan to collect page matches.
            </p>
          ) : (
            topKeywords.map(([keyword, count]) => (
              <div
                className="flex min-h-[38px] items-center justify-between gap-3 rounded-xl bg-[#1c1c1c] px-3"
                key={keyword}
              >
                <span className="text-[13px] font-bold">{keyword}</span>
                <strong className="grid size-7 place-items-center rounded-full bg-white text-xs text-black">
                  {count}
                </strong>
              </div>
            ))
          )}
        </div>
      </section>

      <section
        className={`${panelClass} grid gap-px overflow-hidden p-0`}
        aria-label="Detection controls"
      >
        <label className="flex min-h-12 items-center justify-between gap-3 bg-[#141414] px-4 text-sm font-bold">
          <span>Blur detected text</span>
          <input
            className="h-[22px] w-[38px] accent-[#0099ff] outline-offset-3 focus-visible:outline-2 focus-visible:outline-[#0099ff]"
            type="checkbox"
            onChange={(event) => handleBlurChange(event.currentTarget.checked)}
          />
        </label>
        <label className="flex min-h-12 items-center justify-between gap-3 bg-[#141414] px-4 text-sm font-bold">
          <span>OCR image scan</span>
          <input
            className="h-[22px] w-[38px] accent-[#0099ff] outline-offset-3 focus-visible:outline-2 focus-visible:outline-[#0099ff]"
            type="checkbox"
            checked={ocrEnabled}
            onChange={(event) => void handleOcrChange(event.currentTarget.checked)}
          />
        </label>
        {summary.ocr ? (
          <div className="grid gap-1 bg-[#141414] px-4 py-3 text-xs text-[#999999]">
            <div className="flex items-center justify-between gap-3">
              <span>OCR scanned</span>
              <strong className="text-white">
                {summary.ocr.scannedImages} images · {summary.ocr.executionTimeMs.toFixed(0)} ms
              </strong>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>OCR detected</span>
              <strong className="text-white">
                {summary.ocr.matchedImages} matched · {summary.ocr.skippedImages} skipped
              </strong>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  )
}
