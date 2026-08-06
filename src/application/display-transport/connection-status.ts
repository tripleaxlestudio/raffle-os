export type DisplayConnectionStatus = 'setup-required' | 'waiting' | 'connected' | 'reconnecting' | 'unavailable' | 'publication-failed'

const statuses = new Map<string, DisplayConnectionStatus>()
const listeners = new Map<string, Set<() => void>>()

export function getDisplayConnectionStatus(key: string): DisplayConnectionStatus {
  return statuses.get(key) ?? 'waiting'
}

export function setDisplayConnectionStatus(key: string, status: DisplayConnectionStatus): void {
  statuses.set(key, status)
  listeners.get(key)?.forEach((listener) => listener())
}

export function subscribeDisplayConnectionStatus(key: string, listener: () => void): () => void {
  const keyListeners = listeners.get(key) ?? new Set<() => void>()
  keyListeners.add(listener)
  listeners.set(key, keyListeners)
  return () => {
    keyListeners.delete(listener)
    if (keyListeners.size === 0) listeners.delete(key)
  }
}
