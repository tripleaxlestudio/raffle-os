import type {
  DisplayConfigurationId,
  EventId,
} from '../shared/identifiers.ts'
import {
  failure,
  success,
  type Result,
} from '../shared/result.ts'
import {
  isIsoTimestamp,
  type IsoTimestamp,
} from '../shared/timestamps.ts'

export interface TargetResolution {
  readonly width: number
  readonly height: number
}

export interface DisplayConfiguration {
  readonly id: DisplayConfigurationId
  readonly eventId: EventId
  readonly targetResolution: TargetResolution
  readonly safeAreaMargin: number
  readonly blackoutAppearance: 'pure-black'
  readonly createdAt: IsoTimestamp
  readonly updatedAt: IsoTimestamp
}

export function validateTargetResolution(
  value: unknown,
): Result<TargetResolution> {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('width' in value) ||
    !('height' in value)
  ) {
    return failure(
      'invalid-target-resolution',
      'Target resolution requires width and height.',
    )
  }

  const width = value.width
  const height = value.height
  if (
    typeof width !== 'number' ||
    typeof height !== 'number' ||
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 16384 ||
    height > 16384
  ) {
    return failure(
      'invalid-target-resolution',
      'Resolution dimensions must be positive integers up to 16384.',
    )
  }

  return success({ height, width })
}

export function validateSafeAreaMargin(
  value: unknown,
): Result<number> {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    return failure(
      'invalid-safe-area-margin',
      'Safe-area margin must be a non-negative finite number.',
    )
  }

  return success(value)
}

export function validateBlackoutAppearance(
  value: unknown,
): Result<'pure-black'> {
  if (value !== 'pure-black') {
    return failure(
      'invalid-blackout-appearance',
      'Only pure-black blackout is supported.',
    )
  }

  return success('pure-black')
}

export function validateDisplayConfiguration(
  configuration: DisplayConfiguration,
): Result<DisplayConfiguration> {
  if (!validateTargetResolution(configuration.targetResolution).ok) {
    return failure(
      'invalid-display-resolution',
      'Display configuration target resolution is invalid.',
    )
  }

  if (!validateSafeAreaMargin(configuration.safeAreaMargin).ok) {
    return failure(
      'invalid-display-safe-area',
      'Display configuration safe-area margin is invalid.',
    )
  }

  if (!validateBlackoutAppearance(configuration.blackoutAppearance).ok) {
    return failure(
      'invalid-display-blackout',
      'Display configuration blackout appearance is invalid.',
    )
  }

  if (
    !isIsoTimestamp(configuration.createdAt) ||
    !isIsoTimestamp(configuration.updatedAt)
  ) {
    return failure(
      'invalid-display-timestamp',
      'Display configuration timestamps must be valid ISO UTC values.',
    )
  }

  return success(configuration)
}
