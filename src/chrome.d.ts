declare const chrome: {
  runtime: {
    getURL: (path: string) => string
    onMessage?: {
      addListener: (
        callback: (
          message: unknown,
          sender: unknown,
          sendResponse: (response?: unknown) => void,
        ) => boolean | void,
      ) => void
    }
  }
  tabs: {
    query: (queryInfo: {
      active: boolean
      currentWindow: boolean
    }) => Promise<Array<{ id?: number; url?: string }>>
    sendMessage: (tabId: number, message: Record<string, unknown>) => Promise<unknown>
  }
  scripting: {
    executeScript: (injection: {
      target: { tabId: number }
      files: string[]
    }) => Promise<unknown>
  }
  storage: {
    local: {
      get: (keys: string[]) => Promise<Record<string, unknown>>
      set: (items: Record<string, unknown>) => Promise<void>
    }
  }
}
