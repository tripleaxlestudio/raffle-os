export interface ExternalWindow {
  opener: unknown
  focus(): void
}

export interface ExternalLinkHost {
  open(url: string, target: string): ExternalWindow | null
}

export type ExternalLinkOpenResult = 'opened' | 'blocked'

export function openExternalLink(url: string, host: ExternalLinkHost = window): ExternalLinkOpenResult {
  let openedWindow: ExternalWindow | null
  try {
    openedWindow = host.open(url, '_blank')
  } catch {
    return 'blocked'
  }
  if (openedWindow === null) return 'blocked'
  try {
    openedWindow.opener = null
  } catch {
    // Some browser hosts expose opener as read-only.
  }
  try {
    openedWindow.focus()
  } catch {
    // Opening succeeded; inability to focus is non-fatal.
  }
  return 'opened'
}
