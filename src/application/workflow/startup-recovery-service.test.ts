import { describe, expect, it, vi } from 'vitest'
import { resolveStartupRecovery, type StartupRecoveryServices } from './startup-recovery-service.ts'

const eventId = '11111111-1111-4111-8111-111111111111' as never
const event = {
  id: eventId,
  name: 'Annual Gala',
  status: 'ready',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
}

function services(overrides: Partial<StartupRecoveryServices> = {}): StartupRecoveryServices {
  return {
    open: vi.fn(async () => undefined),
    checkStorage: vi.fn(async () => ({ ok: true as const })),
    preferences: { get: vi.fn(async () => eventId) },
    events: { findById: vi.fn(async () => event) },
    sessions: { findByEventId: vi.fn(async () => []) },
    winners: { findByEventId: vi.fn(async () => []) },
    ...overrides,
  } as unknown as StartupRecoveryServices
}

describe('resolveStartupRecovery', () => {
  it('performs only read operations and returns normal boot when no work is unresolved', async () => {
    const input = services()
    const result = await resolveStartupRecovery(input)

    expect(result).toEqual({ kind: 'normal', targetPath: '/dashboard' })
    expect(input.checkStorage).toHaveBeenCalledTimes(1)
    expect(input.open).not.toHaveBeenCalled()
  })

  it('blocks boot safely when storage readiness fails', async () => {
    const input = services({ checkStorage: vi.fn(async () => ({ ok: false as const, code: 'unsupported-schema', reason: 'Schema is newer.' })) })

    await expect(resolveStartupRecovery(input)).resolves.toEqual({ kind: 'storage-failure', error: 'Schema is newer.' })
    expect(input.preferences.get).not.toHaveBeenCalled()
  })

  it('does not require optional recovery repositories when no session is unresolved', async () => {
    const input = services()
    const result = await resolveStartupRecovery(input)

    expect(result.kind).toBe('normal')
    expect(input.redraws).toBeUndefined()
    expect(input.receipts).toBeUndefined()
    expect(input.presentationCheckpoints).toBeUndefined()
  })
})
