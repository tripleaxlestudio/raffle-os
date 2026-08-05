export interface HoldClock {
  setTimeout(callback: () => void, delayMs: number): ReturnType<typeof setTimeout>
  clearTimeout(handle: ReturnType<typeof setTimeout>): void
}

export interface HoldController {
  begin(): void
  cancel(): void
  dispose(): void
  readonly pending: boolean
}

export function createHoldController(
  onComplete: () => void | Promise<void>,
  clock: HoldClock = { setTimeout: (callback, delay) => globalThis.setTimeout(callback, delay), clearTimeout: (handle) => globalThis.clearTimeout(handle) },
  durationMs = 1500,
): HoldController {
  let timer: ReturnType<typeof setTimeout> | null = null
  let disposed = false
  let pending = false
  return {
    get pending() { return pending },
    begin() {
      if (disposed || pending || timer !== null) return
      timer = clock.setTimeout(() => {
        timer = null
        if (disposed) return
        pending = true
        void onComplete()
      }, durationMs)
    },
    cancel() {
      if (timer !== null) clock.clearTimeout(timer)
      timer = null
    },
    dispose() {
      disposed = true
      if (timer !== null) clock.clearTimeout(timer)
      timer = null
    },
  }
}
