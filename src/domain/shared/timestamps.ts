import {
  failure,
  success,
  type Result,
} from './result.ts'

declare const isoTimestampBrand: unique symbol

export type IsoTimestamp = string & {
  readonly [isoTimestampBrand]: 'IsoTimestamp'
}

const utcIsoPattern =
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?Z$/

export function isIsoTimestamp(value: unknown): value is IsoTimestamp {
  if (typeof value !== 'string') {
    return false
  }

  const match = utcIsoPattern.exec(value)
  if (match === null) {
    return false
  }

  const fraction = (match[2] ?? '').padEnd(3, '0')
  const normalized = `${match[1]}.${fraction}Z`
  const parsedDate = new Date(normalized)

  return (
    Number.isFinite(parsedDate.getTime()) &&
    parsedDate.toISOString() === normalized
  )
}

export function parseIsoTimestamp(
  value: unknown,
): Result<IsoTimestamp> {
  if (!isIsoTimestamp(value)) {
    return failure(
      'invalid-iso-timestamp',
      'Timestamp must be a valid ISO 8601 UTC string ending in Z.',
    )
  }

  return success(value)
}

export function isoTimestampFromDate(date: Date): Result<IsoTimestamp> {
  if (!Number.isFinite(date.getTime())) {
    return failure(
      'invalid-date',
      'A valid Date is required to create an ISO timestamp.',
    )
  }

  return parseIsoTimestamp(date.toISOString())
}
