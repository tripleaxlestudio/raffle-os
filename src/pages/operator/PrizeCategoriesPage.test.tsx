import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import type { Event } from '../../domain/events/event.types.ts'
import type { PrizeCategory } from '../../domain/prizes/prize.types.ts'
import type { PrizeImageAsset } from '../../domain/prizes/prize-asset.types.ts'
import type { EventSetupProductionServices } from '../../infrastructure/composition/event-setup-production.ts'
import { PrizeCategoriesPage } from './PrizeCategoriesPage.tsx'

const eventId = '11111111-1111-4111-8111-111111111111' as Event['id']
const at = '2026-08-08T00:00:00.000Z' as Event['createdAt']
let event: Event

vi.mock('../../app/workspace/ProductionWorkspaceContext.tsx', () => ({
  signalProductionWorkspaceChanged: vi.fn(),
  useProductionWorkspace: () => ({
    status: 'ready',
    event,
    participantCount: 10,
    checkedInParticipantCount: 10,
    prizeCategoryCount: 1,
    liveSessionCount: 0,
    sessionCounts: { draft: 0, ready: 0, drawing: 0, 'pending-confirmation': 0, completed: 0, cancelled: 0 },
    unresolvedSession: null,
    currentMode: null,
    displayConfiguration: null,
    eventSettings: { eventId, displayName: 'Event Test', subtitle: '', primaryColor: '#000000', accentColor: '#ffffff', updatedAt: at },
  }),
}))

function makeMockServices(initialCategories: PrizeCategory[] = [], initialAssets: PrizeImageAsset[] = []): EventSetupProductionServices {
  const categories: PrizeCategory[] = [...initialCategories]
  const assets = new Map<string, PrizeImageAsset>(initialAssets.map((a) => [a.id, a]))

  const prizeImages = {
    findById: vi.fn(async (id: string) => assets.get(id) ?? null),
    save: vi.fn(async (asset: { name: string; type: string; size: number; blob: Blob }) => {
      const id = `asset-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const record: PrizeImageAsset = { id, ...asset, createdAt: new Date().toISOString() }
      assets.set(id, record)
      return record
    }),
    delete: vi.fn(async (id: string) => {
      assets.delete(id)
    }),
    close: vi.fn(),
  }

  const service = {
    createCategory: vi.fn(async (draft: {
      eventId: Event['id']
      name: string
      prizeName: string
      description?: string
      sponsorName?: string
      displayOrder: number
      prizeImageAssetId?: string
    }) => {
      const id = `cat-${Date.now()}` as PrizeCategory['id']
      const newCat: PrizeCategory = {
        id,
        eventId: draft.eventId,
        name: draft.name,
        prizeName: draft.prizeName,
        description: draft.description,
        sponsorName: draft.sponsorName,
        displayOrder: draft.displayOrder,
        prizeImageAssetId: draft.prizeImageAssetId,
        createdAt: at,
      }
      categories.push(newCat)
      return newCat
    }),
    updateCategory: vi.fn(async (existing: PrizeCategory, draft: {
      name: string
      prizeName: string
      description?: string
      sponsorName?: string
      displayOrder: number
      prizeImageAssetId?: string
    }) => {
      const index = categories.findIndex((c) => c.id === existing.id)
      const updated: PrizeCategory = {
        ...existing,
        name: draft.name,
        prizeName: draft.prizeName,
        description: draft.description,
        sponsorName: draft.sponsorName,
        displayOrder: draft.displayOrder,
        prizeImageAssetId: draft.prizeImageAssetId,
      }
      if (index >= 0) categories[index] = updated
      return updated
    }),
    createEvent: vi.fn(),
    updateEvent: vi.fn(),
    activateEvent: vi.fn(),
    selectEvent: vi.fn(),
  }

  return {
    database: {} as never,
    events: {} as never,
    categories: {
      findByEventId: vi.fn(async () => [...categories]),
      create: vi.fn(),
      updateDraft: vi.fn(),
    } as never,
    preferences: {} as never,
    participants: {} as never,
    sessions: {} as never,
    prizeImages,
    open: vi.fn(async () => undefined),
    service,
  } as unknown as EventSetupProductionServices
}

describe('PrizeCategoriesPage image upload foundation', () => {
  beforeEach(() => {
    event = { id: eventId, name: 'Acara Undian Utama', status: 'ready', createdAt: at, updatedAt: at }
    vi.restoreAllMocks()
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => `blob:mock-${(blob as File).name ?? 'image'}`)
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  })

  it('1. creates a prize category without image', async () => {
    const user = userEvent.setup()
    const services = makeMockServices()

    render(
      <MemoryRouter>
        <PrizeCategoriesPage services={services} />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByLabelText('Nama kategori')).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText('Nama kategori'), 'Door Prize')
    await user.type(screen.getByLabelText('Nama hadiah'), 'Payung Lipat')
    await user.click(screen.getByRole('button', { name: 'Buat Kategori Hadiah' }))

    await waitFor(() => {
      expect(services.service.createCategory).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Door Prize',
          prizeName: 'Payung Lipat',
          prizeImageAssetId: undefined,
        }),
      )
    })
    expect(services.prizeImages.save).not.toHaveBeenCalled()
  })

  it('2. creates a prize category with valid image', async () => {
    const user = userEvent.setup()
    const services = makeMockServices()

    render(
      <MemoryRouter>
        <PrizeCategoriesPage services={services} />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByLabelText('Nama kategori')).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText('Nama kategori'), 'Grand Prize')
    await user.type(screen.getByLabelText('Nama hadiah'), 'Sepeda Motor')

    const file = new File(['image-content'], 'motor.png', { type: 'image/png' })
    const fileInput = screen.getByLabelText('Pilih gambar hadiah')
    await user.upload(fileInput, file)

    // Preview thumbnail and filename should be visible
    expect(screen.getByAltText('Pratinjau motor.png')).toBeInTheDocument()
    expect(screen.getByText('motor.png')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hapus' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Buat Kategori Hadiah' }))

    await waitFor(() => {
      expect(services.prizeImages.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'motor.png', type: 'image/png' }),
      )
      expect(services.service.createCategory).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Grand Prize',
          prizeName: 'Sepeda Motor',
          prizeImageAssetId: expect.any(String),
        }),
      )
    })
  })

  it('3. rejects unsupported MIME type and displays inline error', async () => {
    const services = makeMockServices()

    render(
      <MemoryRouter>
        <PrizeCategoriesPage services={services} />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByLabelText('Nama kategori')).toBeInTheDocument()
    })

    const invalidFile = new File(['document-content'], 'prize.pdf', { type: 'application/pdf' })
    const fileInput = screen.getByLabelText('Pilih gambar hadiah')
    fireEvent.change(fileInput, { target: { files: [invalidFile] } })

    expect(screen.getByRole('alert')).toHaveTextContent('Format file tidak didukung. Gunakan PNG, JPG, atau WebP.')
    expect(screen.queryByAltText(/Pratinjau/)).not.toBeInTheDocument()
    expect(services.prizeImages.save).not.toHaveBeenCalled()
  })

  it('4. rejects file larger than 5 MB and displays inline error', async () => {
    const services = makeMockServices()

    render(
      <MemoryRouter>
        <PrizeCategoriesPage services={services} />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByLabelText('Nama kategori')).toBeInTheDocument()
    })

    const largeFile = new File(['x'.repeat(100)], 'huge.png', { type: 'image/png' })
    Object.defineProperty(largeFile, 'size', { value: 6 * 1024 * 1024 })

    const fileInput = screen.getByLabelText('Pilih gambar hadiah')
    fireEvent.change(fileInput, { target: { files: [largeFile] } })

    expect(screen.getByRole('alert')).toHaveTextContent('Ukuran file melebihi batas maksimal 5 MB.')
    expect(screen.queryByAltText(/Pratinjau/)).not.toBeInTheDocument()
    expect(services.prizeImages.save).not.toHaveBeenCalled()
  })

  it('5. preserves and renders existing image after reload when entering edit mode', async () => {
    const user = userEvent.setup()
    const existingAsset: PrizeImageAsset = {
      id: 'asset-bike-1',
      name: 'sepeda-listrik.webp',
      type: 'image/webp',
      size: 2048,
      blob: new Blob(['data'], { type: 'image/webp' }),
      createdAt: at,
    }
    const existingCategory: PrizeCategory = {
      id: 'cat-1' as PrizeCategory['id'],
      eventId,
      name: 'Hadiah Utama',
      prizeName: 'Sepeda Listrik',
      displayOrder: 1,
      prizeImageAssetId: 'asset-bike-1',
      createdAt: at,
    }

    const services = makeMockServices([existingCategory], [existingAsset])

    render(
      <MemoryRouter>
        <PrizeCategoriesPage services={services} />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Sepeda Listrik')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Edit' }))

    await waitFor(() => {
      expect(screen.getByAltText('Pratinjau sepeda-listrik.webp')).toBeInTheDocument()
      expect(screen.getByText('sepeda-listrik.webp')).toBeInTheDocument()
    })
  })

  it('6. preserves existing image when editing other fields without changing image', async () => {
    const user = userEvent.setup()
    const existingAsset: PrizeImageAsset = {
      id: 'asset-tv-1',
      name: 'smart-tv.jpg',
      type: 'image/jpeg',
      size: 4096,
      blob: new Blob(['data'], { type: 'image/jpeg' }),
      createdAt: at,
    }
    const existingCategory: PrizeCategory = {
      id: 'cat-2' as PrizeCategory['id'],
      eventId,
      name: 'Hiburan',
      prizeName: 'Smart TV 43 Inch',
      displayOrder: 2,
      prizeImageAssetId: 'asset-tv-1',
      createdAt: at,
    }

    const services = makeMockServices([existingCategory], [existingAsset])

    render(
      <MemoryRouter>
        <PrizeCategoriesPage services={services} />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Smart TV 43 Inch')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Edit' }))

    await waitFor(() => {
      expect(screen.getByAltText('Pratinjau smart-tv.jpg')).toBeInTheDocument()
    })

    await user.clear(screen.getByLabelText('Nama hadiah'))
    await user.type(screen.getByLabelText('Nama hadiah'), 'Smart TV 50 Inch')

    await user.click(screen.getByRole('button', { name: 'Simpan perubahan' }))

    await waitFor(() => {
      expect(services.service.updateCategory).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          prizeName: 'Smart TV 50 Inch',
          prizeImageAssetId: 'asset-tv-1',
        }),
      )
    })
    expect(services.prizeImages.delete).not.toHaveBeenCalled()
  })

  it('7. allows replacing existing image with a new image and cleans up old asset', async () => {
    const user = userEvent.setup()
    const existingAsset: PrizeImageAsset = {
      id: 'old-asset-id',
      name: 'old-photo.jpg',
      type: 'image/jpeg',
      size: 1024,
      blob: new Blob(['old'], { type: 'image/jpeg' }),
      createdAt: at,
    }
    const existingCategory: PrizeCategory = {
      id: 'cat-3' as PrizeCategory['id'],
      eventId,
      name: 'Door Prize',
      prizeName: 'Kipas Angin',
      displayOrder: 3,
      prizeImageAssetId: 'old-asset-id',
      createdAt: at,
    }

    const services = makeMockServices([existingCategory], [existingAsset])

    render(
      <MemoryRouter>
        <PrizeCategoriesPage services={services} />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Kipas Angin')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Edit' }))

    await waitFor(() => {
      expect(screen.getByAltText('Pratinjau old-photo.jpg')).toBeInTheDocument()
    })

    const newFile = new File(['new-photo-bytes'], 'new-fan.png', { type: 'image/png' })
    const replaceInput = screen.getByLabelText('Ganti gambar hadiah')
    await user.upload(replaceInput, newFile)

    expect(screen.getByAltText('Pratinjau new-fan.png')).toBeInTheDocument()
    expect(screen.getByText('new-fan.png')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Simpan perubahan' }))

    await waitFor(() => {
      expect(services.prizeImages.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'new-fan.png', type: 'image/png' }),
      )
      expect(services.prizeImages.delete).toHaveBeenCalledWith('old-asset-id')
      expect(services.service.updateCategory).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          prizeImageAssetId: expect.any(String),
        }),
      )
    })
  })

  it('8. allows removing existing image and removes reference and asset', async () => {
    const user = userEvent.setup()
    const existingAsset: PrizeImageAsset = {
      id: 'asset-to-remove',
      name: 'to-remove.png',
      type: 'image/png',
      size: 1024,
      blob: new Blob(['remove'], { type: 'image/png' }),
      createdAt: at,
    }
    const existingCategory: PrizeCategory = {
      id: 'cat-4' as PrizeCategory['id'],
      eventId,
      name: 'Door Prize',
      prizeName: 'Dispenser',
      displayOrder: 4,
      prizeImageAssetId: 'asset-to-remove',
      createdAt: at,
    }

    const services = makeMockServices([existingCategory], [existingAsset])

    render(
      <MemoryRouter>
        <PrizeCategoriesPage services={services} />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Dispenser')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Edit' }))

    await waitFor(() => {
      expect(screen.getByAltText('Pratinjau to-remove.png')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Hapus' }))

    // Preview should be gone, "Pilih gambar" button returns
    expect(screen.queryByAltText(/Pratinjau/)).not.toBeInTheDocument()
    expect(screen.getByLabelText('Pilih gambar hadiah')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Simpan perubahan' }))

    await waitFor(() => {
      expect(services.prizeImages.delete).toHaveBeenCalledWith('asset-to-remove')
      expect(services.service.updateCategory).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          prizeImageAssetId: undefined,
        }),
      )
    })
  })

  it('9. revokes object URLs on unmount and on file change without leaving memory leaks', async () => {
    const user = userEvent.setup()
    const services = makeMockServices()

    const { unmount } = render(
      <MemoryRouter>
        <PrizeCategoriesPage services={services} />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByLabelText('Nama kategori')).toBeInTheDocument()
    })

    const file1 = new File(['bytes1'], 'img1.png', { type: 'image/png' })
    await user.upload(screen.getByLabelText('Pilih gambar hadiah'), file1)

    expect(URL.createObjectURL).toHaveBeenCalledWith(file1)

    const file2 = new File(['bytes2'], 'img2.png', { type: 'image/png' })
    await user.upload(screen.getByLabelText('Ganti gambar hadiah'), file2)

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-img1.png')

    unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-img2.png')
  })

  it('10. renders compact image card with metadata, object-fit contain, and helper text spacing', async () => {
    const user = userEvent.setup()
    const services = makeMockServices()

    render(
      <MemoryRouter>
        <PrizeCategoriesPage services={services} />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByLabelText('Nama kategori')).toBeInTheDocument()
    })

    // Verify initial helper text
    expect(
      screen.getByText('Opsional. PNG, JPG, atau WebP. Maks. 5 MB.'),
    ).toBeInTheDocument()

    // Upload portrait file with long name
    const file = new File(['portrait-bytes-large'], 'IMG_20260129_11114018_HDR_blender_extra_long_name.png', {
      type: 'image/png',
    })
    Object.defineProperty(file, 'size', { value: 2.4 * 1024 * 1024 })
    await user.upload(screen.getByLabelText('Pilih gambar hadiah'), file)

    // Verify card elements
    const img = screen.getByAltText(/Pratinjau IMG_20260129_11114018_HDR/)
    expect(img).toBeInTheDocument()
    expect(img).toHaveStyle({ objectFit: 'contain', maxWidth: '88px', maxHeight: '88px' })

    expect(
      screen.getByText('IMG_20260129_11114018_HDR_blender_extra_long_name.png'),
    ).toBeInTheDocument()
    expect(screen.getByText('PNG · 2.4 MB')).toBeInTheDocument()

    // Both action buttons must exist and have explicit labels
    expect(screen.getByText('Ganti')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hapus' })).toBeInTheDocument()
  })

  it('11. renders thumbnail for list items with image, text-only for items without image, and preserves order', async () => {
    const catWithImg: PrizeCategory = {
      id: 'cat-1' as never,
      eventId,
      name: 'Door Prize',
      prizeName: 'Blender',
      displayOrder: 1,
      prizeImageAssetId: 'asset-blender',
      createdAt: at,
    }
    const catWithoutImg: PrizeCategory = {
      id: 'cat-2' as never,
      eventId,
      name: 'Door Prize',
      prizeName: 'Rice Cooker',
      displayOrder: 2,
      createdAt: at,
    }
    const assetBlender: PrizeImageAsset = {
      id: 'asset-blender',
      name: 'blender.png',
      type: 'image/png',
      size: 1024,
      blob: new Blob(['blender-img'], { type: 'image/png' }),
      createdAt: at,
    }

    const services = makeMockServices([catWithImg, catWithoutImg], [assetBlender])

    render(
      <MemoryRouter>
        <PrizeCategoriesPage services={services} />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Blender')).toBeInTheDocument()
      expect(screen.getByText('Rice Cooker')).toBeInTheDocument()
    })

    // catWithImg has thumbnail
    await waitFor(() => {
      const thumb = screen.getByAltText('Thumbnail Blender')
      expect(thumb).toBeInTheDocument()
      expect(thumb).toHaveStyle({ objectFit: 'contain', maxWidth: '48px', maxHeight: '48px' })
    })

    // catWithoutImg does not have a thumbnail or broken image
    expect(screen.queryByAltText('Thumbnail Rice Cooker')).not.toBeInTheDocument()

    // Verify order is preserved
    const orders = screen.getAllByText(/Urutan \d/)
    expect(orders[0]).toHaveTextContent('Urutan 1')
    expect(orders[1]).toHaveTextContent('Urutan 2')
  })

  it('12. gracefully falls back to text-only if thumbnail asset fails to load, without crashing list', async () => {
    const brokenCat: PrizeCategory = {
      id: 'cat-broken' as never,
      eventId,
      name: 'Door Prize',
      prizeName: 'Toaster',
      displayOrder: 1,
      prizeImageAssetId: 'missing-asset-id',
      createdAt: at,
    }

    const services = makeMockServices([brokenCat])
    vi.mocked(services.prizeImages.findById).mockRejectedValue(new Error('IndexedDB read failure'))

    render(
      <MemoryRouter>
        <PrizeCategoriesPage services={services} />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Toaster')).toBeInTheDocument()
    })

    // Thumbnail should not be rendered
    expect(screen.queryByAltText(/Thumbnail/)).not.toBeInTheDocument()
    // List should remain functional and intact
    expect(screen.getByText('Urutan 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  })

  it('13. edit button on list item with thumbnail populates form and works normally', async () => {
    const user = userEvent.setup()

    const catWithImg: PrizeCategory = {
      id: 'cat-edit' as never,
      eventId,
      name: 'Grand Prize',
      prizeName: 'Sepeda Listrik',
      displayOrder: 3,
      prizeImageAssetId: 'asset-sepeda',
      createdAt: at,
    }
    const assetSepeda: PrizeImageAsset = {
      id: 'asset-sepeda',
      name: 'sepeda.png',
      type: 'image/png',
      size: 2048,
      blob: new Blob(['sepeda-img'], { type: 'image/png' }),
      createdAt: at,
    }

    const services = makeMockServices([catWithImg], [assetSepeda])

    render(
      <MemoryRouter>
        <PrizeCategoriesPage services={services} />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Sepeda Listrik')).toBeInTheDocument()
    })

    // Click edit on list item
    await user.click(screen.getByRole('button', { name: 'Edit' }))

    // Form should populate with category data and thumbnail preview
    await waitFor(() => {
      expect(screen.getByLabelText('Nama kategori')).toHaveValue('Grand Prize')
      expect(screen.getByLabelText('Nama hadiah')).toHaveValue('Sepeda Listrik')
      expect(screen.getByAltText('Pratinjau sepeda.png')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Simpan perubahan' })).toBeInTheDocument()
    })
  })
})
