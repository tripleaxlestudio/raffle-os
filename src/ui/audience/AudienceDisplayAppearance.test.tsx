import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { PublicDisplaySnapshot } from '../../application/display-transport/public-projection.ts'
import { DEFAULT_DISPLAY_APPEARANCE } from '../../domain/display/display-configuration.types.ts'
import type { TicketNumber } from '../../domain/participants/participant.types.ts'
import type { DrawSessionId } from '../../domain/shared/identifiers.ts'
import { AudiencePresentation } from './AudiencePresentation.tsx'

const snapshot: PublicDisplaySnapshot = {
  drawSessionId: '00000000-0000-4000-8000-000000000001' as DrawSessionId,
  stage: 'standby',
  blackoutRequested: false,
  appearance: DEFAULT_DISPLAY_APPEARANCE,
}

afterEach(() => cleanup())

describe('Audience saved display appearance', () => {
  it('applies the shared variables and default Kocokan logo without changing presentation state', () => {
    const { container } = render(<AudiencePresentation snapshot={snapshot} />)
    const page = container.querySelector('.audience-display-page')
    expect(page).toHaveAttribute('data-display-theme', 'default')
    expect(page).toHaveStyle({ '--display-primary': '#7567FF', '--draw-box-fill': '#21113E' })
    expect(screen.getByLabelText('Logo Kocokan')).toBeInTheDocument()
    expect(screen.getByText('Undian segera dimulai')).toBeInTheDocument()
  })

  it('uses an explicit appearance prop and does not depend on production runtime configuration', () => {
    const savedAppearance = {
      ...DEFAULT_DISPLAY_APPEARANCE,
      colors: { ...DEFAULT_DISPLAY_APPEARANCE.colors, text: '#22AA44' },
    }
    const draftAppearance = {
      ...DEFAULT_DISPLAY_APPEARANCE,
      colors: { ...DEFAULT_DISPLAY_APPEARANCE.colors, text: '#FF0000' },
    }
    const { container, rerender } = render(<AudiencePresentation snapshot={{ ...snapshot, appearance: undefined }} displayConfiguration={{ appearance: savedAppearance, safeAreaMargin: 48, blackoutAppearance: 'pure-black' }} />)
    const page = container.querySelector('.audience-display-page')
    expect(page).toHaveStyle({ '--display-text': '#22AA44', '--text-primary': '#22AA44' })

    rerender(<AudiencePresentation preview snapshot={{ ...snapshot, appearance: draftAppearance }} displayConfiguration={{ appearance: savedAppearance, safeAreaMargin: 48, blackoutAppearance: 'pure-black' }} />)
    expect(page).toHaveStyle({ '--display-text': '#FF0000', '--text-primary': '#FF0000' })
  })

  it('makes production roots transparent across every draw state and restores theme background in both directions', () => {
    const transparent = { ...DEFAULT_DISPLAY_APPEARANCE, theme: { preset: 'transparent' as const }, background: { type: 'transparent' as const, fit: 'cover' as const } }
    const theme = { ...DEFAULT_DISPLAY_APPEARANCE, theme: { preset: 'dark' as const }, background: { type: 'theme' as const, fit: 'cover' as const } }
    const { container, rerender, unmount } = render(<AudiencePresentation snapshot={{ ...snapshot, appearance: theme }} />)
    const expectTransparentRoots = () => {
      expect(container.querySelector('.audience-display-page')).toHaveAttribute('data-display-transparent', 'true')
      expect(container.querySelector('.audience-display-page')).toHaveStyle({ '--display-background': 'transparent' })
      expect(document.documentElement).toHaveAttribute('data-audience-transparent', 'true')
      expect(document.body).toHaveAttribute('data-audience-transparent', 'true')
    }

    expect(document.documentElement).not.toHaveAttribute('data-audience-transparent')
    rerender(<AudiencePresentation snapshot={{ ...snapshot, appearance: transparent }} />)
    expectTransparentRoots()

    const states: readonly PublicDisplaySnapshot[] = [
      { ...snapshot, stage: 'countdown', countdownValue: 3, appearance: transparent },
      { ...snapshot, stage: 'rolling', rollingSlotCount: 1, appearance: transparent },
      { ...snapshot, stage: 'reveal', ticketNumbers: ['00042' as TicketNumber], appearance: transparent },
      { ...snapshot, stage: 'pending-handoff', ticketNumbers: ['00042' as TicketNumber], winnerStatuses: ['confirmed'], verificationState: 'verified', appearance: transparent },
    ]
    for (const state of states) {
      rerender(<AudiencePresentation snapshot={state} />)
      expectTransparentRoots()
    }

    rerender(<AudiencePresentation snapshot={{ ...snapshot, appearance: theme }} />)
    expect(container.querySelector('.audience-display-page')).not.toHaveAttribute('data-display-transparent')
    expect(container.querySelector('.audience-display-page')).toHaveStyle({ '--display-background': '#1D1726' })
    expect(document.documentElement).not.toHaveAttribute('data-audience-transparent')

    rerender(<AudiencePresentation snapshot={{ ...snapshot, appearance: transparent }} />)
    expectTransparentRoots()
    unmount()
    expect(document.documentElement).not.toHaveAttribute('data-audience-transparent')
    expect(document.body).not.toHaveAttribute('data-audience-transparent')
  })

  it('does not make Operator preview roots transparent or render a production checkerboard', () => {
    const transparent = { ...DEFAULT_DISPLAY_APPEARANCE, theme: { preset: 'transparent' as const }, background: { type: 'transparent' as const, fit: 'cover' as const } }
    const { container } = render(<AudiencePresentation preview snapshot={{ ...snapshot, appearance: transparent }} />)
    expect(container.querySelector('.audience-display-page')).toHaveAttribute('data-display-transparent', 'true')
    expect(document.documentElement).not.toHaveAttribute('data-audience-transparent')
    expect(document.body).not.toHaveAttribute('data-audience-transparent')
    expect(container.querySelector('.audience-display-page')).not.toHaveClass('is-transparent')
  })

  it('keeps Countdown rendered with a product fallback when a custom font asset is unavailable', () => {
    const custom = { ...DEFAULT_DISPLAY_APPEARANCE, typography: { fontSource: 'custom' as const, fontFamily: 'kocokan' as const, fontWeight: 700 as const, customFontAssetId: 'missing-font', customFontFileName: 'missing.woff2' } }
    const countdown = { ...snapshot, stage: 'countdown' as const, stageStartedAt: '2026-01-01T00:00:00.000Z' as PublicDisplaySnapshot['stageStartedAt'], countdownValue: 3 as const, appearance: custom }
    const { container } = render(<AudiencePresentation snapshot={countdown} />)
    expect(container.querySelector('.countdown-stage__numeral')).toHaveTextContent('3')
    expect((container.querySelector('.audience-display-page') as HTMLElement).style.getPropertyValue('--display-font-family')).toContain('KocokanCustom-missing-font')
  })
})
