import { describe, expect, it } from 'vitest'
import { createProtocolEnvelope, type ProtocolEnvelope } from './protocol.ts'
import { decodeDisplayWireEnvelope, encodeDisplayWireEnvelope, MAX_PUBLIC_ASSET_BYTES } from './wire-codec.ts'

function envelope(blob = new Blob(['public-logo'], { type: 'image/png' })): ProtocolEnvelope {
  return createProtocolEnvelope({
    sender: { kind: 'operator', id: 'operator-wire' },
    scope: { eventId: 'event-wire', displayId: 'display-wire' },
    drawSessionId: '00000000-0000-4000-8000-000000000001',
    epoch: 1,
    sequence: 1,
    emittedAt: '2026-09-08T00:00:00.000Z',
    message: { type: 'display-state', stage: 'standby', blackoutRequested: false, logo: { type: 'image/png', blob } },
  })
}

describe('display WebSocket wire codec', () => {
  it('round-trips bounded public image blobs without embedding their bytes in JSON', async () => {
    const assets = new Map<string, Blob>()
    const wire = await encodeDisplayWireEnvelope(envelope(), async ({ id, blob }) => { assets.set(id, blob) })
    expect(wire).not.toContain('public-logo')
    expect(wire).toContain('__raffleOsPublicAsset')
    const decoded = await decodeDisplayWireEnvelope(wire, async ({ id }) => assets.get(id) ?? Promise.reject(new Error('missing asset')))
    expect(decoded.message).toMatchObject({ type: 'display-state', logo: { type: 'image/png' } })
    if (decoded.message.type !== 'display-state') throw new Error('Expected display state.')
    expect(await decoded.message.logo?.blob.text()).toBe('public-logo')
  })

  it('rejects oversized public assets before upload', async () => {
    const oversized = new Blob([new Uint8Array(MAX_PUBLIC_ASSET_BYTES + 1)], { type: 'image/png' })
    await expect(encodeDisplayWireEnvelope(envelope(oversized), async () => undefined)).rejects.toThrow(/5 MB/)
  })

  it('retains strict public-envelope validation', async () => {
    const invalid = { ...envelope(), message: { type: 'display-state', stage: 'standby', blackoutRequested: false, notes: 'private' } } as unknown as ProtocolEnvelope
    await expect(encodeDisplayWireEnvelope(invalid, async () => undefined)).rejects.toThrow(/invalid display envelope/i)
  })
})
