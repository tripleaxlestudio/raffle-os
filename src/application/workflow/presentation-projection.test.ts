import { describe, expect, it } from 'vitest'
import { projectLivePresentationResult } from './presentation-projection.ts'
import type { WinnerRecord } from '../../domain/winners/winner.types.ts'

const session = '00000000-0000-4000-8000-000000000001' as never
const base = { drawSessionId: session, eventId: '00000000-0000-4000-8000-000000000003', prizeCategoryId: '00000000-0000-4000-8000-000000000004', participantId: '00000000-0000-4000-8000-000000000005', status: 'pending', createdAt: '2026-08-05T00:00:00.000Z', updatedAt: '2026-08-05T00:00:00.000Z' } as const

describe('presentation projection', () => {
  it('orders official records by authoritative sequence and preserves strings', () => {
    const result = projectLivePresentationResult(session, [{ ...base, id: '00000000-0000-4000-8000-000000000007', sequenceNumber: 2, ticketNumber: '42' }, { ...base, id: '00000000-0000-4000-8000-000000000006', sequenceNumber: 1, ticketNumber: '00042' }] as unknown as WinnerRecord[])
    expect(result.winners.map((winner) => winner.ticketNumber)).toEqual(['00042', '42'])
  })

  it('rejects a broken sequence relationship', () => {
    expect(() => projectLivePresentationResult(session, [{ ...base, id: '00000000-0000-4000-8000-000000000006', sequenceNumber: 2, ticketNumber: '00042' }] as unknown as WinnerRecord[])).toThrow('relationship')
  })
})
