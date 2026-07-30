export interface InvariantViolation {
  readonly code: string
  readonly message: string
}

export type Result<T, E = InvariantViolation> =
  | {
      readonly ok: true
      readonly value: T
    }
  | {
      readonly ok: false
      readonly error: E
    }

export function success<T>(value: T): Result<T> {
  return { ok: true, value }
}

export function failure(
  code: string,
  message: string,
): Result<never> {
  return {
    error: { code, message },
    ok: false,
  }
}
