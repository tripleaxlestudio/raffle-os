import { describe, expect, it } from 'vitest'
import {
  parsePublicDisplaySnapshot,
  projectPublicDisplaySnapshot,
  publicSnapshotToProtocolState,
  serializePublicDisplaySnapshot,
  type PresentationProjectionSource,
} from './public-projection.ts'
import { parseEnvelope, PROTOCOL_VERSION } from './protocol.ts'

const session = '00000000-0000-4000-8000-000000000001' as never
const timestamp = '2026-08-05T00:00:00.000Z' as never

const source = (overrides: Record<string, unknown> = {}): PresentationProjectionSource => ({
  drawSessionId: session,
  stage: 'standby',
  blackoutRequested: false,
  mode: 'live',
  ...overrides,
} as PresentationProjectionSource)

const result = {
  drawSessionId: session,
  winners: [
    { sequence: 1, ticketNumber: '00042', winnerId: 'internal-winner-1', name: 'Private Name', isCheckedIn: true, group: 'VIP', notes: 'private', candidate: true, eligibility: 'internal', filter: 'internal' },
    { sequence: 2, ticketNumber: '42', winnerId: 'internal-winner-2' },
  ],
}

describe('public display projection privacy boundary', () => {
  it('projects standby using only the public whitelist', () => {
    const projection = projectPublicDisplaySnapshot(source({ participant: { name: 'Private Name' }, operatorControls: { start: true }, result }))
    expect(projection).toEqual({ drawSessionId: session, stage: 'standby', blackoutRequested: false, mode: 'live' })
    expect(Object.keys(projection).sort()).toEqual(['blackoutRequested', 'drawSessionId', 'mode', 'stage'])
  })

  it('projects minimum countdown metadata and orthogonal blackout state', () => {
    const projection = projectPublicDisplaySnapshot(source({ stage: 'countdown', stageStartedAt: timestamp, countdownValue: 2, blackoutRequested: true, result }))
    expect(projection).toEqual({ drawSessionId: session, stage: 'countdown', stageStartedAt: timestamp, countdownValue: 2, blackoutRequested: true, mode: 'live' })
  })

  it('projects rolling without candidate or participant data', () => {
    const projection = projectPublicDisplaySnapshot(source({ stage: 'rolling', stageStartedAt: timestamp, result, presentationConfiguration: { winnerCount: 6, rollSpeedPerSecond: 12, rollStopMode: 'manual', rollDurationSeconds: 8, revealMode: 'all-together' }, presentationSeed: 'safe-presentation-seed' }))
    expect(projection).not.toHaveProperty('ticketNumbers')
    expect(projection).toMatchObject({ rollingSlotCount: 6, rollSpeedPerSecond: 12, rollStopMode: 'manual', rollDurationSeconds: 8, presentationSeed: 'safe-presentation-seed', revealMode: 'all-together' })
    expect(JSON.stringify(projection)).not.toMatch(/winnerId|name|isCheckedIn|group|notes|candidate|eligibility|filter|operatorControls/)
  })

  it('normalizes legacy timed rolling metadata to manual for the Audience state', () => {
    const projection = projectPublicDisplaySnapshot(source({ stage: 'rolling', stageStartedAt: timestamp, result, presentationConfiguration: { winnerCount: 2, rollSpeedPerSecond: 20, rollStopMode: 'timed', rollDurationSeconds: 5, revealMode: 'sequential' }, presentationSeed: 'legacy-timed-seed' }))
    expect(projection).toMatchObject({ stage: 'rolling', rollStopMode: 'manual', rollSpeedPerSecond: 20, revealMode: 'sequential' })
  })

  it('projects reveal and safe pending handoff with exact public tickets only', () => {
    const reveal = projectPublicDisplaySnapshot(source({ stage: 'reveal', stageStartedAt: timestamp, result }))
    const pending = projectPublicDisplaySnapshot(source({ stage: 'pending-handoff', stageStartedAt: timestamp, result }))
    expect(reveal.ticketNumbers).toEqual(['00042', '42'])
    expect(pending.stage).toBe('pending-handoff')
    expect(pending).not.toHaveProperty('confirmed')
    expect(JSON.stringify(reveal)).not.toMatch(/winnerId|name|isCheckedIn|group|notes|candidate|eligibility|filter/)
  })

  it('maps ready to standby and keeps Practice/Live as the only mode distinction', () => {
    expect(projectPublicDisplaySnapshot(source({ stage: 'ready', mode: 'practice' }))).toEqual({ drawSessionId: session, stage: 'standby', blackoutRequested: false, mode: 'practice' })
  })

  it('retains authoritative next-draw identity and winner quantity through ready snapshots', () => {
    const projection = projectPublicDisplaySnapshot(source({ stage: 'ready', eventName: '24th K-Link Indonesia Anniversary', prizeCategory: 'Door Prize', prizeName: 'K-Ion Nano Premium 5', winnerCount: 10 }))
    expect(projection).toMatchObject({ stage: 'standby', eventName: '24th K-Link Indonesia Anniversary', prizeCategory: 'Door Prize', prizeName: 'K-Ion Nano Premium 5', winnerCount: 10 })
    const roundTrip = parsePublicDisplaySnapshot(JSON.parse(serializePublicDisplaySnapshot(projection)), session)
    expect(roundTrip).toMatchObject({ prizeCategory: 'Door Prize', prizeName: 'K-Ion Nano Premium 5', winnerCount: 10 })
    expect(publicSnapshotToProtocolState(roundTrip)).toMatchObject({ prizeCategory: 'Door Prize', prizeName: 'K-Ion Nano Premium 5', winnerCount: 10 })
  })

  it('rejects empty, malformed, and non-string tickets through the typed boundary', () => {
    expect(() => projectPublicDisplaySnapshot(source({ stage: 'reveal', stageStartedAt: timestamp, result: { ...result, winners: [{ sequence: 1, ticketNumber: '' }] } }))).toThrowError(expect.objectContaining({ code: 'invalid-ticket' }))
    expect(() => projectPublicDisplaySnapshot(source({ stage: 'reveal', stageStartedAt: timestamp, result: { ...result, winners: [{ sequence: 1, ticketNumber: 42 }] } }))).toThrowError(expect.objectContaining({ code: 'invalid-ticket' }))
    expect(() => projectPublicDisplaySnapshot(source({ stage: 'reveal', stageStartedAt: 'not-a-date', result }))).toThrowError(expect.objectContaining({ code: 'invalid-source' }))
  })

  it('rejects cross-session results and parsed snapshots', () => {
    const otherSession = '00000000-0000-4000-8000-000000000002'
    expect(() => projectPublicDisplaySnapshot(source({ stage: 'reveal', stageStartedAt: timestamp, result: { ...result, drawSessionId: otherSession } }))).toThrowError(expect.objectContaining({ code: 'session-mismatch', expectedSession: session, receivedSession: otherSession }))
    const projection = projectPublicDisplaySnapshot(source())
    expect(() => parsePublicDisplaySnapshot(projection, otherSession as never)).toThrowError(expect.objectContaining({ code: 'session-mismatch' }))
  })

  it('freezes and detaches the result from later source mutation', () => {
    const mutable = { ...result, winners: result.winners.map((winner) => ({ ...winner })) }
    const projection = projectPublicDisplaySnapshot(source({ stage: 'reveal', stageStartedAt: timestamp, result: mutable }))
    mutable.winners[0]!.ticketNumber = 'changed'
    expect(Object.isFrozen(projection)).toBe(true)
    expect(Object.isFrozen(projection.ticketNumbers)).toBe(true)
    expect(projection.ticketNumbers).toEqual(['00042', '42'])
  })

  it('round-trips exact ticket strings and produces a protocol-valid public state', () => {
    const projection = projectPublicDisplaySnapshot(source({ stage: 'reveal', stageStartedAt: timestamp, result }))
    const roundTrip = parsePublicDisplaySnapshot(JSON.parse(serializePublicDisplaySnapshot(projection)), session)
    expect(roundTrip.ticketNumbers).toEqual(['00042', '42'])
    expect(roundTrip.ticketNumbers?.[0]).not.toBe(roundTrip.ticketNumbers?.[1])
    const protocolResult = parseEnvelope({
      protocolVersion: PROTOCOL_VERSION,
      messageId: 'projection-message',
      sender: { kind: 'operator', id: 'operator-1' },
      scope: { eventId: 'event-1', displayId: 'display-1' },
      drawSessionId: session,
      epoch: 1,
      sequence: 1,
      emittedAt: timestamp,
      message: publicSnapshotToProtocolState(projection),
    })
    expect(protocolResult.ok).toBe(true)
    expect(() => parsePublicDisplaySnapshot({ ...projection, name: 'private' })).toThrowError(expect.objectContaining({ code: 'invalid-public-snapshot' }))
  })
})

it('round trips only the public prize image reference and rejects non-string references', () => {
  const projection = projectPublicDisplaySnapshot(source({ prizeImageAssetId: 'asset-public', participant: { name: 'Private Name', notes: 'secret' }, result }))
  const restored = parsePublicDisplaySnapshot(JSON.parse(serializePublicDisplaySnapshot(projection)))
  expect(restored.prizeImageAssetId).toBe('asset-public')
  expect(publicSnapshotToProtocolState(restored)).toMatchObject({ prizeImageAssetId: 'asset-public' })
  const envelope = parseEnvelope({ protocolVersion: PROTOCOL_VERSION, messageId: 'image-message', sender: { kind: 'operator', id: 'operator-1' }, scope: { eventId: 'event-1', displayId: 'display-1' }, drawSessionId: session, epoch: 1, sequence: 1, emittedAt: timestamp, message: publicSnapshotToProtocolState(restored) })
  expect(envelope).toMatchObject({ ok: true, envelope: { message: { prizeImageAssetId: 'asset-public' } } })
  expect(JSON.stringify(restored)).not.toMatch(/Private Name|secret|participant|blob|base64/)
  expect(() => projectPublicDisplaySnapshot(source({ prizeImageAssetId: new Blob() }))).toThrow()
})

it.each(['countdown', 'rolling', 'reveal', 'pending-handoff'] as const)('removes the ready-only prize image reference from %s projection', (stage) => {
  const projection = projectPublicDisplaySnapshot(source({
    stage,
    stageStartedAt: timestamp,
    prizeImageAssetId: 'ready-only-asset',
    ...(stage === 'reveal' || stage === 'pending-handoff' ? { result } : {}),
  }))
  expect(projection).not.toHaveProperty('prizeImageAssetId')
  expect(publicSnapshotToProtocolState(projection)).not.toHaveProperty('prizeImageAssetId')
})
