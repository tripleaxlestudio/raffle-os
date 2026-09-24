import {
  DEFAULT_PRESENTATION_SETTINGS,
  ROLLING_DURATIONS_SECONDS,
  type RollingDurationSeconds,
} from '../settings/presentation-settings.types.ts'
import { failure, success, type Result } from '../shared/result.ts'

export const DRAW_PRESENTATION_MODES = [
  'instant-reveal',
  'random-number-roll',
] as const

export const DRAW_REVEAL_MODES = ['all-together', 'sequential'] as const
/** @deprecated Retained only to parse persisted configurations from before manual-only rolling. */
export const DRAW_ROLL_STOP_MODES = ['timed', 'manual'] as const

export const DRAW_ROLL_SPEED_PER_SECOND_MIN = 1
export const DRAW_ROLL_SPEED_PER_SECOND_MAX = 30
export const DEFAULT_DRAW_ROLL_SPEED_PER_SECOND = 12

export type DrawPresentationMode = (typeof DRAW_PRESENTATION_MODES)[number]
export type DrawRevealMode = (typeof DRAW_REVEAL_MODES)[number]
export type DrawRollStopMode = (typeof DRAW_ROLL_STOP_MODES)[number]

export interface DrawPresentationConfiguration {
  readonly presentationMode: DrawPresentationMode
  /** @deprecated Persisted for backward compatibility. Runtime rolling is always manual. */
  readonly rollStopMode: DrawRollStopMode
  /** @deprecated Persisted for backward compatibility and ignored by rolling runtime. */
  readonly rollDurationSeconds: RollingDurationSeconds
  readonly rollSpeedPerSecond: number
  readonly revealMode: DrawRevealMode
}

export const DEFAULT_DRAW_PRESENTATION_CONFIGURATION: DrawPresentationConfiguration = Object.freeze({
  presentationMode: 'instant-reveal',
  rollStopMode: 'manual',
  rollDurationSeconds: DEFAULT_PRESENTATION_SETTINGS.rollingDurationSeconds,
  rollSpeedPerSecond: DEFAULT_DRAW_ROLL_SPEED_PER_SECOND,
  revealMode: 'all-together',
})

const isOneOf = <T extends string>(values: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && values.includes(value as T)

const isRollDuration = (value: unknown): value is RollingDurationSeconds =>
  typeof value === 'number' && Number.isInteger(value) && ROLLING_DURATIONS_SECONDS.includes(value as RollingDurationSeconds)

const isRollSpeed = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  Number.isFinite(value) &&
  value >= DRAW_ROLL_SPEED_PER_SECOND_MIN &&
  value <= DRAW_ROLL_SPEED_PER_SECOND_MAX

export function resolveDrawPresentationConfiguration(
  value: Partial<DrawPresentationConfiguration> | undefined,
): DrawPresentationConfiguration {
  const presentationMode: DrawPresentationMode =
    value?.presentationMode === 'random-number-roll'
      ? 'random-number-roll'
      : 'instant-reveal'

  return Object.freeze({
    presentationMode,
    rollStopMode: 'manual',
    rollDurationSeconds: DEFAULT_PRESENTATION_SETTINGS.rollingDurationSeconds,
    rollSpeedPerSecond: DEFAULT_DRAW_ROLL_SPEED_PER_SECOND,
    revealMode: 'all-together',
  })
}

export function validateDrawPresentationConfiguration(
  value: unknown,
): Result<DrawPresentationConfiguration> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return failure('invalid-draw-presentation', 'Draw presentation configuration is invalid.')
  }

  const candidate = value as Record<string, unknown>
  if (!isOneOf(DRAW_PRESENTATION_MODES, candidate.presentationMode)) {
    return failure('invalid-presentation-mode', 'Presentation mode is unsupported.')
  }
  if (candidate.rollStopMode !== undefined && !isOneOf(DRAW_ROLL_STOP_MODES, candidate.rollStopMode)) {
    return failure('invalid-roll-stop-mode', 'Roll stop mode is unsupported.')
  }
  if (candidate.rollDurationSeconds !== undefined && !isRollDuration(candidate.rollDurationSeconds)) {
    return failure('invalid-roll-duration', 'Roll duration must use a supported duration.')
  }
  if (candidate.rollSpeedPerSecond !== undefined && !isRollSpeed(candidate.rollSpeedPerSecond)) {
    return failure('invalid-roll-speed', `Roll speed must be an integer from ${DRAW_ROLL_SPEED_PER_SECOND_MIN} through ${DRAW_ROLL_SPEED_PER_SECOND_MAX} per second.`)
  }
  if (candidate.revealMode !== undefined && !isOneOf(DRAW_REVEAL_MODES, candidate.revealMode)) {
    return failure('invalid-reveal-mode', 'Reveal mode is unsupported.')
  }

  return success(Object.freeze({
    presentationMode: candidate.presentationMode,
    rollStopMode: 'manual',
    rollDurationSeconds: DEFAULT_PRESENTATION_SETTINGS.rollingDurationSeconds,
    rollSpeedPerSecond: DEFAULT_DRAW_ROLL_SPEED_PER_SECOND,
    revealMode: 'all-together',
  }))
}

export function normalizeDrawPresentationConfiguration(
  value: Partial<DrawPresentationConfiguration> | undefined,
): DrawPresentationConfiguration {
  const resolved = resolveDrawPresentationConfiguration(value)
  const validation = validateDrawPresentationConfiguration(resolved)
  if (!validation.ok) {
    throw new Error(validation.error.message)
  }
  return validation.value
}
