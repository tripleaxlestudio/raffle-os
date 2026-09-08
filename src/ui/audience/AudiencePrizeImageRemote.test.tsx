import { render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { DexiePrizeImageAssetRepository } from '../../infrastructure/persistence/repositories/prize-image-asset.repository.ts'
import { AudiencePrizeImage } from './AudiencePrizeImage.tsx'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('falls back to the local-runtime public asset endpoint when the browser profile has no prize image', async () => {
  vi.spyOn(DexiePrizeImageAssetRepository.prototype, 'findById').mockResolvedValue(null)
  const remoteBlob = new Blob(['remote-prize'], { type: 'image/png' })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => remoteBlob }))
  vi.stubGlobal('Image', class { src = ''; decode = vi.fn().mockResolvedValue(undefined); removeAttribute() {} })
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:remote-prize')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  render(<AudiencePrizeImage assetId="public-prize-id" prizeName="Hadiah Utama" />)
  expect(await screen.findByRole('img', { name: 'Hadiah: Hadiah Utama' })).toHaveAttribute('src', 'blob:remote-prize')
  expect(fetch).toHaveBeenCalledWith('/display-assets/public-prize-id')
})
