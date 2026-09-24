import { failure, success, type Result } from '../shared/result.ts'

export const COUNTDOWN_DURATIONS_SECONDS = [3, 5, 10] as const
export const ROLLING_DURATIONS_SECONDS = [5, 8, 12] as const
export const REVEAL_STYLES = ['ticket-spotlight', 'instant-reveal', 'sequential-reveal'] as const
export const CELEBRATION_EFFECTS = ['confetti-burst', 'light-sweep', 'none'] as const
export const WINNER_LAYOUTS = ['adaptive-operator-preview', 'single-hero', 'compact-grid'] as const

export type CountdownDurationSeconds = (typeof COUNTDOWN_DURATIONS_SECONDS)[number]
export type RollingDurationSeconds = (typeof ROLLING_DURATIONS_SECONDS)[number]
export type RevealStyle = (typeof REVEAL_STYLES)[number]
export type CelebrationEffect = (typeof CELEBRATION_EFFECTS)[number]
export type WinnerLayoutPreference = (typeof WINNER_LAYOUTS)[number]

export interface PresentationSettings {
  readonly countdownDurationSeconds: CountdownDurationSeconds
  readonly rollingDurationSeconds: RollingDurationSeconds
  readonly revealStyle: RevealStyle
  readonly celebrationEffect: CelebrationEffect
  readonly respectReducedMotion: boolean
  readonly winnerLayoutPreference: WinnerLayoutPreference
}

export const DEFAULT_PRESENTATION_SETTINGS: PresentationSettings = {
  countdownDurationSeconds: 3,
  rollingDurationSeconds: 8,
  revealStyle: 'ticket-spotlight',
  celebrationEffect: 'confetti-burst',
  respectReducedMotion: true,
  winnerLayoutPreference: 'adaptive-operator-preview',
}

const isOneOf = <T extends string>(values: readonly T[], value: unknown): value is T => typeof value === 'string' && values.includes(value as T)
const isDuration = (values: readonly number[], value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value) && value > 0 && value <= 60 && values.includes(value)

export function validatePresentationSettings(value: unknown): Result<PresentationSettings> {
  if (typeof value !== 'object' || value === null) return failure('invalid-presentation-settings', 'Presentation settings are invalid.')
  const candidate = value as Record<string, unknown>
  if (!isDuration(COUNTDOWN_DURATIONS_SECONDS, candidate.countdownDurationSeconds)) return failure('invalid-countdown-duration', 'Countdown duration is unsupported.')
  if (!isDuration(ROLLING_DURATIONS_SECONDS, candidate.rollingDurationSeconds)) return failure('invalid-rolling-duration', 'Rolling duration is unsupported.')
  if (!isOneOf(REVEAL_STYLES, candidate.revealStyle)) return failure('invalid-reveal-style', 'Reveal style is unsupported.')
  if (!isOneOf(CELEBRATION_EFFECTS, candidate.celebrationEffect)) return failure('invalid-celebration-effect', 'Celebration effect is unsupported.')
  if (typeof candidate.respectReducedMotion !== 'boolean') return failure('invalid-reduced-motion', 'Reduced-motion preference is invalid.')
  if (!isOneOf(WINNER_LAYOUTS, candidate.winnerLayoutPreference)) return failure('invalid-winner-layout', 'Winner layout preference is unsupported.')
  return success({
    countdownDurationSeconds: candidate.countdownDurationSeconds as CountdownDurationSeconds,
    rollingDurationSeconds: candidate.rollingDurationSeconds as RollingDurationSeconds,
    revealStyle: candidate.revealStyle,
    celebrationEffect: candidate.celebrationEffect,
    respectReducedMotion: candidate.respectReducedMotion,
    winnerLayoutPreference: candidate.winnerLayoutPreference,
  })
}
