import type {
  AuditRecordId,
  EventId,
} from '../shared/identifiers.ts'
import type { IsoTimestamp } from '../shared/timestamps.ts'

export type AuditAction =
  | 'event-created'
  | 'event-status-changed'
  | 'draw-session-started'
  | 'draw-session-completed'
  | 'draw-session-cancelled'
  | 'winner-confirmed'
  | 'winner-cancelled'
  | 'redraw-recorded'

export type AuditActor =
  | {
      readonly type: 'operator'
      readonly name: string
    }
  | {
      readonly type: 'system'
    }

export type AuditDetailValue =
  | null
  | boolean
  | number
  | string
  | bigint
  | readonly AuditDetailValue[]
  | {
      readonly [key: string]: AuditDetailValue
    }

export interface AuditRecord {
  readonly id: AuditRecordId
  readonly eventId: EventId
  readonly action: AuditAction
  readonly actor: AuditActor
  readonly detail: AuditDetailValue
  readonly timestamp: IsoTimestamp
}

export const AUDIT_RECORD_POLICY = 'append-only' as const

export function isStructuredCloneSafeAuditDetail(
  value: unknown,
  ancestors: Set<object> = new Set<object>(),
): value is AuditDetailValue {
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'string' ||
    typeof value === 'bigint'
  ) {
    return true
  }

  if (typeof value === 'number') {
    return true
  }

  if (typeof value !== 'object') {
    return false
  }

  if (ancestors.has(value)) {
    return false
  }

  ancestors.add(value)

  if (Array.isArray(value)) {
    const isSafe = value.every((item) =>
      isStructuredCloneSafeAuditDetail(item, ancestors),
    )
    ancestors.delete(value)
    return isSafe
  }

  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    ancestors.delete(value)
    return false
  }

  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') {
      return false
    }

    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !('value' in descriptor)) {
      ancestors.delete(value)
      return false
    }

    if (
      !isStructuredCloneSafeAuditDetail(
        descriptor.value,
        ancestors,
      )
    ) {
      ancestors.delete(value)
      return false
    }
  }

  ancestors.delete(value)
  return true
}
