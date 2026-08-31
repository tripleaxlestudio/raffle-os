export const AUDIENCE_DISPLAY_WINDOW_NAME = 'raffle-os-audience-display'

export interface ManagedAudienceWindow {
  readonly closed: boolean
  focus(): void
  opener: unknown
}

export interface AudienceWindowHost {
  open(url: string, target: string): ManagedAudienceWindow | null
}

export type AudienceDisplayOpenResult = 'opened' | 'focused' | 'blocked'

let managedWindow: ManagedAudienceWindow | null = null
let managedUrl: string | null = null

export function openManagedAudienceDisplay(
  url: string,
  host: AudienceWindowHost = window,
): AudienceDisplayOpenResult {
  if (managedWindow !== null && !managedWindow.closed && managedUrl === url) {
    managedWindow.focus()
    return 'focused'
  }

  const hadOpenManagedWindow = managedWindow !== null && !managedWindow.closed
  const openedWindow = host.open(url, AUDIENCE_DISPLAY_WINDOW_NAME)
  if (openedWindow === null) return 'blocked'

  managedWindow = openedWindow
  managedUrl = url
  try {
    openedWindow.opener = null
  } catch {
    // Some browsers expose opener as read-only. The display remains same-origin.
  }
  openedWindow.focus()
  return hadOpenManagedWindow ? 'focused' : 'opened'
}

export function resetManagedAudienceDisplayForTests(): void {
  managedWindow = null
  managedUrl = null
}
