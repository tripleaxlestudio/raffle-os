export type FullscreenState = 'unsupported' | 'windowed' | 'entering' | 'fullscreen' | 'exiting' | 'denied' | 'failed'

export type FullscreenDocument = {
  readonly fullscreenEnabled?: boolean
  readonly fullscreenElement?: Element | null
  readonly addEventListener: (type: 'fullscreenchange', listener: () => void) => void
  readonly removeEventListener: (type: 'fullscreenchange', listener: () => void) => void
  readonly exitFullscreen?: () => Promise<void>
}

export type FullscreenTarget = Element & { readonly requestFullscreen?: () => Promise<void> }

export type FullscreenController = {
  readonly getState: () => FullscreenState
  readonly isSupported: () => boolean
  readonly enter: () => Promise<FullscreenState>
  readonly exit: () => Promise<FullscreenState>
  readonly subscribe: (listener: () => void) => () => void
  readonly close: () => void
}

export function createFullscreenController(options: { readonly document?: FullscreenDocument; readonly target?: FullscreenTarget }): FullscreenController {
  const documentLike = options.document ?? (typeof document === 'undefined' ? undefined : document)
  const supported = documentLike !== undefined && documentLike.fullscreenEnabled !== false && options.target?.requestFullscreen !== undefined && documentLike.exitFullscreen !== undefined
  let state: FullscreenState = supported ? 'windowed' : 'unsupported'
  let closed = false
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach((listener) => { try { listener() } catch { /* display controls are isolated */ } })
  const onChange = () => {
    if (closed || !supported) return
    state = documentLike?.fullscreenElement === options.target ? 'fullscreen' : 'windowed'
    notify()
  }
  documentLike?.addEventListener('fullscreenchange', onChange)

  return {
    getState: () => state,
    isSupported: () => supported,
    async enter() {
      if (!supported || closed) return state
      if (documentLike?.fullscreenElement === options.target || state === 'fullscreen') return state
      state = 'entering'
      notify()
      try {
        await options.target?.requestFullscreen?.()
        state = documentLike?.fullscreenElement === options.target ? 'fullscreen' : 'fullscreen'
      } catch (cause: unknown) {
        state = cause instanceof DOMException && cause.name === 'NotAllowedError' ? 'denied' : 'failed'
      }
      notify()
      return state
    },
    async exit() {
      if (!supported || closed || (documentLike?.fullscreenElement === null && state !== 'fullscreen')) return state
      state = 'exiting'
      notify()
      try {
        await documentLike?.exitFullscreen?.()
        state = 'windowed'
      } catch {
        state = 'failed'
      }
      notify()
      return state
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    close() {
      if (closed) return
      closed = true
      documentLike?.removeEventListener('fullscreenchange', onChange)
      listeners.clear()
    },
  }
}
