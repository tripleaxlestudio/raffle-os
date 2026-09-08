import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UiThemeContext } from '../../shared/ui/ui-theme.ts'
import { DisplayDesignerPrototypePage } from './DisplayDesignerPrototypePage.tsx'
import { applyDisplayThemePreset, DEFAULT_DISPLAY_APPEARANCE, type DisplayAppearanceConfiguration } from '../../domain/display/display-configuration.types.ts'

const managedDisplayMocks = vi.hoisted(() => ({ open: vi.fn(() => 'opened' as const) }))

vi.mock('../../infrastructure/browser/managed-audience-display.ts', () => ({
  openManagedAudienceDisplay: managedDisplayMocks.open,
}))

const writeClipboardText = vi.fn(async (text: string) => { void text })

beforeEach(() => {
  managedDisplayMocks.open.mockClear()
  writeClipboardText.mockClear()
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: writeClipboardText },
  })
})

function renderPage(onSave = vi.fn(async (appearance: DisplayAppearanceConfiguration) => { void appearance })) {
  return { onSave, ...render(<UiThemeContext.Provider value="kocokan"><div data-ui-theme="kocokan"><DisplayDesignerPrototypePage onSave={onSave} /></div></UiThemeContext.Provider>) }
}

describe('DisplayDesignerPrototypePage', () => {
  it('opens the Audience share modal with the current-origin display URL and closes it', async () => {
    const user = userEvent.setup()
    renderPage()

    const trigger = screen.getByRole('button', { name: 'Bagikan Tampilan' })
    await user.click(trigger)

    const dialog = screen.getByRole('dialog', { name: 'Bagikan Tampilan Audiens' })
    expect(within(dialog).getByLabelText('URL Tampilan Audiens')).toHaveValue(`${window.location.origin}/display`)
    expect(within(dialog).getByText('Tidak tersedia')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Tutup' }))
    expect(screen.queryByRole('dialog', { name: 'Bagikan Tampilan Audiens' })).not.toBeInTheDocument()
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('copies the dynamic Audience URL from the current origin', async () => {
    const user = userEvent.setup()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeClipboardText },
    })
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Bagikan Tampilan' }))

    const dialog = screen.getByRole('dialog', { name: 'Bagikan Tampilan Audiens' })
    await user.click(within(dialog).getByRole('button', { name: 'Salin link Tampilan Audiens' }))

    expect(writeClipboardText).toHaveBeenCalledWith(`${window.location.origin}/display`)
    expect(await within(dialog).findByText('Link disalin')).toBeInTheDocument()
  })

  it('opens the production display route through the managed Audience launcher', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Bagikan Tampilan' }))

    const dialog = screen.getByRole('dialog', { name: 'Bagikan Tampilan Audiens' })
    await user.click(within(dialog).getByRole('button', { name: 'Buka Tampilan' }))

    expect(managedDisplayMocks.open).toHaveBeenCalledWith('/display')
  })

  it('shows the positive overlay helper for the selected transparent background', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Transparan' }))
    await user.click(screen.getByRole('button', { name: 'Bagikan Tampilan' }))

    expect(screen.getByText('Mode transparan aktif — siap digunakan sebagai overlay Browser Input.')).toBeInTheDocument()
  })

  it('closes the Audience share modal with Escape', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Bagikan Tampilan' }))

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: 'Bagikan Tampilan Audiens' })).not.toBeInTheDocument()
  })

  it('batches picker input into one preview write per frame and commits only when the interaction ends', async () => {
    const callbacks: FrameRequestCallback[] = []
    const requestFrame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callbacks.push(callback)
      return callbacks.length
    })
    const cancelFrame = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)
    const user = userEvent.setup()

    try {
      const { container, onSave } = renderPage()
      const picker = screen.getByLabelText('Warna Utama picker')
      const preview = container.querySelector('.audience-display-page[data-audience-preview="true"]')

      fireEvent.input(picker, { target: { value: '#111111' } })
      fireEvent.input(picker, { target: { value: '#222222' } })
      fireEvent.input(picker, { target: { value: '#334455' } })

      expect(requestFrame).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('button', { name: 'Simpan & Terapkan' })).toBeDisabled()
      expect(screen.getByText('Tersimpan')).toBeInTheDocument()
      expect(onSave).not.toHaveBeenCalled()

      callbacks[0]?.(16)
      expect(preview).toHaveStyle({ '--display-primary': '#334455', '--accent': '#334455' })

      fireEvent.change(picker, { target: { value: '#334455' } })
      expect(cancelFrame).not.toHaveBeenCalled()
      expect(screen.getByText('Draft belum disimpan')).toBeInTheDocument()
      expect(onSave).not.toHaveBeenCalled()

      await user.click(screen.getByRole('button', { name: 'Simpan & Terapkan' }))
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ colors: expect.objectContaining({ primary: '#334455' }) }))
    } finally {
      requestFrame.mockRestore()
      cancelFrame.mockRestore()
    }
  })

  it('renders the share action in the preview footer and keeps only the production badge in the header actions', () => {
    renderPage()

    expect(screen.getByRole('heading', { level: 1, name: 'Pengaturan Tampilan' })).toBeInTheDocument()
    for (const title of ['Logo', 'Tema', 'Warna', 'Gaya Teks', 'Style Box Kocokan', 'Background', 'Countdown', 'Tipografi']) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    }
    const headerActions = document.querySelector('.kc-display-designer__header-actions')
    const previewToolbar = document.querySelector('.kc-display-designer__preview-toolbar')
    expect(headerActions).not.toBeNull()
    expect(previewToolbar).not.toBeNull()
    expect(within(headerActions as HTMLElement).queryByRole('button')).not.toBeInTheDocument()
    expect(within(headerActions as HTMLElement).getByText('PRODUCTION')).toBeInTheDocument()
    expect(within(previewToolbar as HTMLElement).getByRole('button', { name: 'Bagikan Tampilan' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Buka Tampilan Audiens' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Pratinjau')).toHaveValue('standby')
    expect(document.querySelector('.kc-display-preview--shared .audience-stage')).toHaveAttribute('data-audience-state', 'standby')
  })

  it('updates countdown draft controls immediately and saves their normalized contract', async () => {
    const user = userEvent.setup()
    const { container, onSave } = renderPage()
    await user.selectOptions(screen.getByLabelText('Pratinjau'), 'countdown')
    expect(container.querySelector('.countdown-stage')).not.toBeNull()

    await user.click(screen.getByRole('button', { name: 'Countdown Outline' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Warna Angka' }), { target: { value: '#00FFAA' } })
    fireEvent.change(screen.getByRole('slider', { name: 'Ukuran Angka' }), { target: { value: '120' } })
    await user.click(screen.getByRole('switch', { name: 'Tampilkan Label Countdown' }))
    await user.click(screen.getByRole('button', { name: 'Sedikit Bawah' }))

    const preview = container.querySelector('.audience-display-page[data-audience-preview="true"]')
    expect(preview).toHaveAttribute('data-countdown-preset', 'outline')
    expect(preview).toHaveAttribute('data-countdown-label-visible', 'false')
    expect(preview).toHaveStyle({ '--countdown-number-color': '#00FFAA', '--countdown-number-scale': '1.2', '--countdown-position-offset': '6vh' })
    expect(onSave).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Simpan & Terapkan' }))
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({ countdownStyle: { preset: 'outline', numberColor: '#00FFAA', numberScale: 1.2, labelVisible: false, position: 'lower' } })
  })

  it('applies a built-in global font and optional countdown override only after save', async () => {
    const user = userEvent.setup()
    const { container, onSave } = renderPage()
    await user.selectOptions(screen.getByLabelText('Pratinjau'), 'countdown')
    await user.click(screen.getByRole('button', { name: 'Font Arial / Sans' }))
    await user.click(screen.getByRole('button', { name: 'Mono' }))
    expect(container.querySelector('.audience-display-page')).toHaveStyle({ '--display-font-family': 'Arial, Helvetica, sans-serif' })
    expect(onSave).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Simpan & Terapkan' }))
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({ typography: { fontSource: 'builtin', fontFamily: 'arial' }, countdownStyle: { fontFamilyOverride: 'mono' } })
  })

  it('updates the preview as a local draft and resets to the currently saved values', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.selectOptions(screen.getByLabelText('Pratinjau'), 'one')
    expect(screen.getByText('Grand Prize')).toBeInTheDocument()
    expect(document.querySelector('.kc-display-preview--shared .audience-draw-header__meta strong')).toHaveTextContent('1 Pemenang')
    expect(screen.getAllByText('Pemenang')).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Kanan Bawah' }))
    expect(screen.getByRole('button', { name: 'Kanan Bawah' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Outline' }))
    expect(screen.getByRole('button', { name: 'Outline' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Reset Perubahan' }))
    expect(screen.getByLabelText('Pratinjau')).toHaveValue('standby')
    expect(screen.getByRole('button', { name: 'Kiri Atas' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('does not publish an unsaved draft and applies it only after save', async () => {
    const user = userEvent.setup()
    const { onSave } = renderPage()
    await user.click(screen.getByRole('button', { name: 'Kanan Bawah' }))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText('Draft belum disimpan')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Simpan & Terapkan' }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({ logo: { position: 'bottom-right' } })
    expect(await screen.findByText('Tersimpan')).toBeInTheDocument()
  })

  it('renders Standby through the shared production Audience presentation using draft appearance', () => {
    const onSave = vi.fn(async (appearance: DisplayAppearanceConfiguration) => { void appearance })
    const initialAppearance = applyDisplayThemePreset(DEFAULT_DISPLAY_APPEARANCE, 'light')
    const { container } = render(<UiThemeContext.Provider value="kocokan"><div data-ui-theme="kocokan"><DisplayDesignerPrototypePage initialAppearance={initialAppearance} onSave={onSave} previewEventName="Panggung Seni" previewEventSubtitle="Dirgahayu 81" /></div></UiThemeContext.Provider>)

    const sharedPresentation = container.querySelector('.production-preview__viewport > .audience-display-page[data-audience-preview="true"]')
    expect(screen.getByLabelText('Pratinjau')).toHaveValue('standby')
    expect(sharedPresentation).not.toBeNull()
    expect(sharedPresentation?.querySelector('.standby-stage')).not.toBeNull()
    expect(sharedPresentation).toHaveTextContent('Panggung Seni')
    expect(sharedPresentation).toHaveTextContent('Dirgahayu 81')
    expect(sharedPresentation).toHaveTextContent('Tampilan siap')
    expect(sharedPresentation).toHaveTextContent('Menunggu undian berikutnya')
    expect(sharedPresentation).toHaveTextContent('Undian aktif')
    expect(sharedPresentation).toHaveTextContent('Pengumuman pemenang')
    expect(sharedPresentation).not.toHaveTextContent('SIAP UNTUK DIMULAI')
    expect(sharedPresentation).not.toHaveTextContent('Mohon arahkan perhatian ke layar utama.')

    expect(sharedPresentation).toHaveAttribute('data-display-theme', 'light')
    expect(sharedPresentation).toHaveStyle('--display-background: #F5F1E8')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('routes every supported preview state through the shared Audience stage components', async () => {
    const user = userEvent.setup()
    const { container } = renderPage()
    const preview = () => container.querySelector('.kc-display-preview--shared .audience-display-page[data-audience-preview="true"]')

    expect(preview()?.querySelector('.audience-stage')).toHaveAttribute('data-audience-state', 'standby')
    expect(preview()?.querySelector('.standby-stage')).not.toBeNull()

    await user.selectOptions(screen.getByLabelText('Pratinjau'), 'rolling')
    expect(preview()?.querySelector('.audience-stage')).toHaveAttribute('data-audience-state', 'rolling')
    expect(preview()?.querySelector('.rolling-stage')).not.toBeNull()

    await user.selectOptions(screen.getByLabelText('Pratinjau'), 'three')
    expect(preview()?.querySelector('.audience-stage')).toHaveAttribute('data-audience-state', 'reveal')
    expect(preview()?.querySelector('.winner-stage')).not.toBeNull()
    expect(preview()?.querySelector('[data-winner-count="3"]')).not.toBeNull()

    await user.selectOptions(screen.getByLabelText('Pratinjau'), 'confirmed')
    expect(preview()?.querySelector('.audience-stage')).toHaveAttribute('data-audience-state', 'confirmed')
    expect(preview()?.querySelector('.winner-stage')).not.toBeNull()
    expect(preview()?.querySelectorAll('[data-verification-status="confirmed"]')).toHaveLength(3)
    expect(preview()?.querySelector('.kc-display-preview__content')).toBeNull()
  })

  it('returns the temporary preview state to Standby after remount', async () => {
    const user = userEvent.setup()
    const firstRender = renderPage()

    await user.selectOptions(screen.getByLabelText('Pratinjau'), 'rolling')
    expect(screen.getByLabelText('Pratinjau')).toHaveValue('rolling')
    firstRender.unmount()

    renderPage()
    expect(screen.getByLabelText('Pratinjau')).toHaveValue('standby')
    expect(document.querySelector('.kc-display-preview--shared .audience-stage')).toHaveAttribute('data-audience-state', 'standby')
  })

  it('applies draft text tokens to the shared Standby root without publishing', async () => {
    const user = userEvent.setup()
    const { container, onSave } = renderPage()
    await user.selectOptions(screen.getByLabelText('Pratinjau'), 'standby')

    fireEvent.change(screen.getByRole('textbox', { name: 'Warna Teks' }), { target: { value: '#FF0000' } })

    const sharedPresentation = container.querySelector('.production-preview__viewport > .audience-display-page[data-audience-preview="true"]')
    expect(sharedPresentation).toHaveStyle({
      '--display-text': '#FF0000',
      '--text-primary': '#FF0000',
      '--text-secondary': 'color-mix(in srgb, #FF0000 78%, transparent)',
      '--text-muted': 'color-mix(in srgb, #FF0000 64%, transparent)',
    })
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText('Draft belum disimpan')).toBeInTheDocument()
  })

  it('saves the exact draft appearance after preset defaults and manual overrides are resolved', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn(async (appearance: DisplayAppearanceConfiguration) => { void appearance })
    renderPage(onSave)

    await user.click(screen.getByRole('button', { name: /Light/ }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Warna Teks' }), { target: { value: '#FF0000' } })
    await user.click(screen.getByRole('button', { name: 'Simpan & Terapkan' }))

    const light = applyDisplayThemePreset(DEFAULT_DISPLAY_APPEARANCE, 'light')
    expect(onSave).toHaveBeenCalledWith({
      ...light,
      colors: { ...light.colors, text: '#FF0000' },
    })
  })
})
