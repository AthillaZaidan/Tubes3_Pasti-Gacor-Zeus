const algorithmStats = [
  { name: 'KMP', matches: 9, time: '0.8 ms', widthClass: 'w-[86%]' },
  { name: 'Boyer-Moore', matches: 7, time: '0.6 ms', widthClass: 'w-[72%]' },
  { name: 'RegEx', matches: 14, time: '1.2 ms', widthClass: 'w-full' },
  { name: 'Weighted', matches: 4, time: '2.4 ms', widthClass: 'w-[46%]' },
]

const keywordStats = [
  ['MAXWIN234', 6],
  ['GACOR99', 5],
  ['H0KI88', 4],
  ['SLOT99', 3],
] as const

const panelClass =
  'rounded-[20px] border border-[#262626] bg-[#141414]/90 shadow-[0_18px_48px_rgba(0,0,0,0.26)]'

export function Popup() {
  async function sendCommand(message: Record<string, unknown>) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab.id) return
    await chrome.tabs.sendMessage(tab.id, message)
  }

  async function handleRescan() {
    await sendCommand({ type: 'JUDOL_SCAN' })
  }

  async function handleBlurChange(enabled: boolean) {
    await sendCommand({ type: 'JUDOL_SET_BLUR', blur: enabled })
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
          Active
        </span>
      </header>

      <section className="grid grid-cols-2 gap-2.5" aria-label="Scan summary">
        <article className={`${panelClass} grid min-h-[92px] gap-2 p-4`}>
          <span className="text-xs leading-[1.2] text-[#999999]">Total keywords</span>
          <strong className="text-[34px] leading-[0.95]">27</strong>
        </article>
        <article className={`${panelClass} grid min-h-[92px] gap-2 p-4`}>
          <span className="text-xs leading-[1.2] text-[#999999]">Execution</span>
          <strong className="text-[34px] leading-[0.95]">38 ms</strong>
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
            className="min-h-[34px] cursor-pointer rounded-full border-0 bg-white px-[13px] text-[13px] font-bold text-black outline-offset-3 focus-visible:outline-2 focus-visible:outline-[#0099ff]"
          >
            Rescan
          </button>
        </div>

        <div className="grid gap-2.5">
          {algorithmStats.map((item) => (
            <div className="grid gap-2" key={item.name}>
              <div className="flex items-baseline justify-between gap-3">
                <strong className="text-sm">{item.name}</strong>
                <span className="text-xs leading-[1.2] text-[#999999]">
                  {item.matches} matches · {item.time}
                </span>
              </div>
              <div
                className="relative h-2.5 overflow-hidden rounded-full bg-[#1c1c1c]"
                aria-hidden="true"
              >
                <div
                  className={`h-full rounded-full bg-linear-to-r from-[#6a4cf5] to-[#ff5577] ${item.widthClass}`}
                />
              </div>
            </div>
          ))}
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
          {keywordStats.map(([keyword, count]) => (
            <div
              className="flex min-h-[38px] items-center justify-between gap-3 rounded-xl bg-[#1c1c1c] px-3"
              key={keyword}
            >
              <span className="text-[13px] font-bold">{keyword}</span>
              <strong className="grid size-7 place-items-center rounded-full bg-white text-xs text-black">
                {count}
              </strong>
            </div>
          ))}
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
          />
        </label>
      </section>
    </main>
  )
}
