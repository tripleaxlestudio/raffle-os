import { describe, expect, it } from 'vitest'
import { getDisplayConnectionStatus, setDisplayConnectionStatus, subscribeDisplayConnectionStatus, syncAudiencePresenceConnectionStatus } from '../../application/display-transport/connection-status.ts'

describe('production Audience connection status source', () => {
  it('changes only from Audience presence, not snapshot acknowledgement', () => {
    const key = 'phase8-settings-presence-source'
    setDisplayConnectionStatus(key, 'waiting')
    const notifications: string[] = []
    const unsubscribe = subscribeDisplayConnectionStatus(key, () => notifications.push(getDisplayConnectionStatus(key)))

    expect(getDisplayConnectionStatus(key)).toBe('waiting')

    syncAudiencePresenceConnectionStatus(key, 'connected')
    expect(getDisplayConnectionStatus(key)).toBe('connected')
    syncAudiencePresenceConnectionStatus(key, 'waiting')
    expect(getDisplayConnectionStatus(key)).toBe('waiting')
    expect(notifications).toEqual(['connected', 'waiting'])
    unsubscribe()
  })
})
