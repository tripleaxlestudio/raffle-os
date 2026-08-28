import { describe, expect, it } from 'vitest'
import type { PresentationProjectionSource } from './public-projection.ts'
import { createAudienceController } from './audience-controller.ts'
import { createOperatorPublisher } from './operator-publisher.ts'
import { createInMemoryTransportPair } from './transport.ts'
import { createProtocolEnvelope, type ProtocolScope } from './protocol.ts'

const scope: ProtocolScope = {
  eventId: '81111111-1111-4111-8111-111111111111',
  displayId: '82222222-2222-4222-8222-222222222222',
}
const sessionId = '83333333-3333-4333-8333-333333333333' as never
const timestamp = '2026-08-28T00:00:00.000Z' as never

function source(stage: 'countdown' | 'rolling' | 'reveal' | 'pending-handoff', blackoutRequested = false): PresentationProjectionSource {
  return {
    drawSessionId: sessionId,
    stage,
    stageStartedAt: timestamp,
    blackoutRequested,
    mode: 'live',
    eventName: 'Recovery Gala',
    presentationConfiguration: {
      winnerCount: 2,
      presentationMode: 'random-number-roll',
      rollSpeedPerSecond: 12,
      rollStopMode: 'timed',
      rollDurationSeconds: 8,
      revealMode: 'all-together',
    },
    result: {
      drawSessionId: sessionId,
      winners: [
        { sequence: 1, ticketNumber: '00042', status: 'confirmed' },
        { sequence: 2, ticketNumber: '42', status: 'pending' },
      ],
    },
    verificationState: 'in-progress',
  }
}

const clock = () => ({ now: () => timestamp })

describe('Phase 10.6 Audience reconnect integration', () => {
  it('lets a reloaded Operator replace standby with the same authoritative persisted result', () => {
    const channel = 'phase10-operator-reload'
    const [firstOperatorTransport, audienceTransport] = createInMemoryTransportPair(channel)
    const audience = createAudienceController({ transport: audienceTransport, scope })
    const firstPublisher = createOperatorPublisher({ transport: firstOperatorTransport, scope, senderId: 'operator-before-reload', epoch: 10, heartbeatIntervalMs: 0, clock: clock() })
    firstPublisher.start(source('reveal'))
    expect(audience.getState()).toMatchObject({ snapshot: { stage: 'reveal', ticketNumbers: ['00042', '42'] } })

    firstPublisher.close()
    const [reloadedOperatorTransport] = createInMemoryTransportPair(channel)
    const reloadedPublisher = createOperatorPublisher({ transport: reloadedOperatorTransport, scope, senderId: 'operator-after-reload', epoch: 20, heartbeatIntervalMs: 0, clock: clock() })
    reloadedPublisher.start(source('reveal'))

    expect(audience.getState()).toMatchObject({
      kind: 'snapshot',
      snapshot: { drawSessionId: sessionId, stage: 'reveal', ticketNumbers: ['00042', '42'] },
    })
    expect(reloadedPublisher.getDiagnostics()).toMatchObject({ retainedPublicState: 'draw', sequence: 1 })

    audience.close()
    reloadedPublisher.close()
    audienceTransport.close()
  })

  it('restores the retained authoritative result when only the Audience reloads', () => {
    const channel = 'phase10-audience-reload'
    const [operatorTransport, firstAudienceTransport] = createInMemoryTransportPair(channel)
    const publisher = createOperatorPublisher({ transport: operatorTransport, scope, senderId: 'operator-stable', epoch: 30, heartbeatIntervalMs: 0, clock: clock() })
    publisher.start(source('pending-handoff', true))

    const firstAudience = createAudienceController({ transport: firstAudienceTransport, scope })
    expect(firstAudience.getState()).toMatchObject({ snapshot: { blackoutRequested: true, ticketNumbers: ['00042', '42'] } })
    firstAudience.close()

    const [, reloadedAudienceTransport] = createInMemoryTransportPair(channel)
    const reloadedAudience = createAudienceController({ transport: reloadedAudienceTransport, scope })
    expect(reloadedAudience.getState()).toMatchObject({
      kind: 'snapshot',
      snapshot: { stage: 'pending-handoff', blackoutRequested: true, ticketNumbers: ['00042', '42'] },
    })
    expect(publisher.getDiagnostics().retainedSnapshotResendCount).toBeGreaterThan(0)

    reloadedAudience.close()
    publisher.close()
    reloadedAudienceTransport.close()
    operatorTransport.close()
  })

  it('reconstructs the same public result when both Operator and Audience reload', () => {
    const channel = 'phase10-both-reload'
    const [firstOperatorTransport, firstAudienceTransport] = createInMemoryTransportPair(channel)
    const firstPublisher = createOperatorPublisher({ transport: firstOperatorTransport, scope, senderId: 'operator-first-runtime', epoch: 50, heartbeatIntervalMs: 0, clock: clock() })
    const firstAudience = createAudienceController({ transport: firstAudienceTransport, scope })
    firstPublisher.start(source('reveal'))
    expect(firstAudience.getState()).toMatchObject({ snapshot: { drawSessionId: sessionId, ticketNumbers: ['00042', '42'] } })
    firstAudience.close()
    firstPublisher.close()

    const [reloadedOperatorTransport, reloadedAudienceTransport] = createInMemoryTransportPair(channel)
    const reloadedPublisher = createOperatorPublisher({ transport: reloadedOperatorTransport, scope, senderId: 'operator-second-runtime', epoch: 60, heartbeatIntervalMs: 0, clock: clock() })
    reloadedPublisher.start(source('reveal'))
    const reloadedAudience = createAudienceController({ transport: reloadedAudienceTransport, scope })

    expect(reloadedAudience.getState()).toMatchObject({
      kind: 'snapshot',
      snapshot: {
        drawSessionId: sessionId,
        stage: 'reveal',
        ticketNumbers: ['00042', '42'],
        winnerStatuses: ['confirmed', 'pending'],
      },
    })

    reloadedAudience.close()
    reloadedPublisher.close()
    reloadedAudienceTransport.close()
    reloadedOperatorTransport.close()
  })

  it.each(['countdown', 'rolling', 'reveal', 'pending-handoff'] as const)(
    'enters disconnected-safe during %s and restores only the retained state after liveness returns',
    (stage) => {
      let expire: (() => void) | undefined
      const [operatorTransport, audienceTransport] = createInMemoryTransportPair(`phase10-disconnect-${stage}`)
      const audience = createAudienceController({
        transport: audienceTransport,
        scope,
        scheduleWatchdog: (callback) => { expire = callback; return 1 },
        cancelWatchdog: () => undefined,
        schedulePresenceHeartbeat: () => 1,
        cancelPresenceHeartbeat: () => undefined,
      })
      const publisher = createOperatorPublisher({ transport: operatorTransport, scope, senderId: `operator-${stage}`, epoch: 40, heartbeatIntervalMs: 0, clock: clock() })
      publisher.start(source(stage))
      const accepted = audience.getState()

      expire?.()
      expect(audience.getState()).toEqual({ kind: 'disconnected-safe', connection: 'disconnected-safe' })
      operatorTransport.publish(createProtocolEnvelope({
        sender: { kind: 'operator', id: `operator-${stage}` },
        scope,
        epoch: 40,
        sequence: 1,
        emittedAt: timestamp,
        message: { type: 'display-heartbeat' },
      }))
      expect(audience.getState()).toEqual(accepted)

      audience.close()
      publisher.close()
      audienceTransport.close()
      operatorTransport.close()
    },
  )
})
