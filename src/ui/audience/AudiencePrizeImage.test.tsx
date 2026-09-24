import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DexiePrizeImageAssetRepository } from '../../infrastructure/persistence/repositories/prize-image-asset.repository.ts'
import { AudiencePresentation, AudienceUnavailablePresentation } from './AudiencePresentation.tsx'
import type { PublicDisplaySnapshot } from '../../application/display-transport/public-projection.ts'
import { parseTicketNumber } from '../../domain/participants/participant.invariants.ts'

const repository = new DexiePrizeImageAssetRepository()
const assets: string[] = []
let decode = vi.fn<() => Promise<void>>()

beforeEach(() => {
  decode = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('Image', class { src = ''; decode = decode; removeAttribute() {} })
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:prize-test')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  vi.spyOn(DexiePrizeImageAssetRepository.prototype, 'findById')
})

afterEach(async () => {
  cleanup()
  await Promise.all(assets.splice(0).map((id) => repository.delete(id)))
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function save() {
  const asset = await repository.save({ name: 'private-file-name.png', type: 'image/png', size: 5, blob: new Blob(['image'], { type: 'image/png' }) })
  assets.push(asset.id)
  return asset.id
}

function ticket() {
  const result = parseTicketNumber('00001')
  if (!result.ok) throw new Error('Invalid test ticket')
  return result.value
}

function snapshot(assetId?: string, stage: PublicDisplaySnapshot['stage'] = 'standby'): PublicDisplaySnapshot {
  return {
    drawSessionId: '00000000-0000-4000-8000-000000000001' as never,
    stage,
    ...(stage === 'standby' ? {} : { stageStartedAt: '2026-08-05T00:00:00.000Z' as never }),
    blackoutRequested: false,
    prizeName: 'Sepeda Listrik',
    prizeCategory: 'Grand Prize',
    prizeImageAssetId: assetId,
    winnerCount: 1,
    ...(stage === 'reveal' || stage === 'pending-handoff' ? { ticketNumbers: [ticket()] } : {}),
    ...(stage === 'rolling' ? { rollingSlotCount: 1 } : {}),
  }
}

it('resolves and renders the persisted image only on the next-draw standby screen', async () => {
  render(<AudiencePresentation snapshot={snapshot(await save())} />)
  expect(await screen.findByRole('img', { name: 'Hadiah: Sepeda Listrik' })).toHaveAttribute('src', 'blob:prize-test')
  expect(screen.getByText('Undian berikutnya')).toBeVisible()
  expect(screen.getByRole('heading', { name: 'Sepeda Listrik' })).toBeVisible()
  expect(screen.getByText('Grand Prize')).toBeVisible()
  expect(screen.getByText('1 Pemenang')).toBeVisible()
  expect(screen.getByText('Undian segera dimulai')).toBeVisible()
  expect(document.body).not.toHaveTextContent('private-file-name')
})

it('keeps standby text-only when no image reference exists', () => {
  render(<AudiencePresentation snapshot={snapshot()} />)
  expect(screen.queryByRole('img', { name: /Hadiah:/ })).toBeNull()
  expect(screen.getByRole('heading', { name: 'Sepeda Listrik' })).toBeVisible()
})

it.each(['missing', 'rejected', 'corrupt'] as const)('falls back to text-only standby for a %s asset', async (kind) => {
  if (kind === 'rejected') vi.mocked(DexiePrizeImageAssetRepository.prototype.findById).mockRejectedValue(new Error('storage'))
  if (kind === 'corrupt') decode.mockRejectedValue(new Error('decode'))
  render(<AudiencePresentation snapshot={snapshot(kind === 'corrupt' ? await save() : 'missing')} />)
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)) })
  expect(screen.queryByRole('img', { name: /Hadiah:/ })).toBeNull()
  expect(screen.getByRole('heading', { name: 'Sepeda Listrik' })).toBeVisible()
})

it.each(['countdown', 'rolling', 'reveal', 'pending-handoff'] as const)('does not resolve or render the image during %s', async (stage) => {
  render(<AudiencePresentation snapshot={{ ...snapshot(await save(), stage), ...(stage === 'pending-handoff' ? { winnerStatuses: ['confirmed'], verificationState: 'verified' as const } : {}) }} />)
  await act(async () => { await Promise.resolve() })
  expect(screen.queryByRole('img', { name: /Hadiah:/ })).toBeNull()
  expect(DexiePrizeImageAssetRepository.prototype.findById).not.toHaveBeenCalled()
})

it('hides the image in blackout and disconnected-safe', async () => {
  const view = render(<AudiencePresentation snapshot={{ ...snapshot(await save()), blackoutRequested: true }} />)
  expect(screen.queryByRole('img', { name: /Hadiah:/ })).toBeNull()
  view.rerender(<AudienceUnavailablePresentation state="disconnected-safe" />)
  expect(screen.queryByRole('img', { name: /Hadiah:/ })).toBeNull()
})

it('revokes the object URL when the ready prize changes and on unmount', async () => {
  const view = render(<AudiencePresentation snapshot={snapshot(await save())} />)
  await screen.findByRole('img', { name: 'Hadiah: Sepeda Listrik' })
  view.rerender(<AudiencePresentation snapshot={{ ...snapshot(await save()), prizeName: 'Sepeda Baru' }} />)
  await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(2))
  expect(screen.getByRole('img', { name: 'Hadiah: Sepeda Baru' })).toBeVisible()
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
  view.unmount()
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2)
})

it('suppresses a runtime image error without disturbing the ready screen', async () => {
  render(<AudiencePresentation snapshot={snapshot(await save())} />)
  fireEvent.error(await screen.findByRole('img', { name: 'Hadiah: Sepeda Listrik' }))
  expect(screen.queryByRole('img', { name: /Hadiah:/ })).toBeNull()
  expect(screen.getByRole('heading', { name: 'Sepeda Listrik' })).toBeVisible()
})

it('revokes a pending decode on unmount without publishing a late image', async () => {
  let finish: (() => void) | undefined
  decode.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve }))
  const view = render(<AudiencePresentation snapshot={snapshot(await save())} />)
  await waitFor(() => expect(decode).toHaveBeenCalled())
  view.unmount()
  await act(async () => { finish?.() })
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('img')).toBeNull()
})
