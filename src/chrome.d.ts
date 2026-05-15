declare const chrome: {
  runtime?: {
    onMessage?: {
      addListener: (callback: (message: unknown) => void) => void
    }
  }
  tabs: {
    query: (queryInfo: {
      active: boolean
      currentWindow: boolean
    }) => Promise<Array<{ id?: number }>>
    sendMessage: (tabId: number, message: Record<string, unknown>) => Promise<unknown>
  }
}
