import { describe, expect, it } from 'vitest'
import { getProductionSetupProgress, productionSetupStageUnlocked, deriveProductionSetupReadiness, type ProductionSetupReadiness } from './production-setup-readiness.ts'

const stages = (overrides: Partial<ProductionSetupReadiness> = {}): ProductionSetupReadiness => ({ event: false, prize: false, participants: false, displaySettings: false, drawSetup: false, ...overrides })

describe('production setup readiness', () => {
  it('unlocks only the next stage while preserving completed stages', () => {
    const readiness = stages({ event: true, prize: true, participants: true })
    expect([0, 1, 2, 3, 4].map((index) => productionSetupStageUnlocked(readiness, index))).toEqual([true, true, true, true, false])
    expect(getProductionSetupProgress(readiness)).toEqual({ completedIndex: 2, nextIndex: 3 })
  })

  it('restores a mature event as fully configured from persisted records', () => {
    const category = { name: 'Grand Prize', prizeName: 'Trip', eventId: 'event' } as never
    const participant = { eventId: 'event', ticketNumber: '0001' } as never
    const configuration = { id: 'configuration' } as never
    const session = { configurationId: 'configuration', status: 'ready' } as never
    expect(deriveProductionSetupReadiness({ hasCurrentEvent: true, categories: [category], participants: [participant], displayConfiguration: { eventId: 'event' } as never, configurations: [configuration], sessions: [session] })).toEqual({ event: true, prize: true, participants: true, displaySettings: true, drawSetup: true })
  })
})
