import {
  failure,
  success,
  type Result,
} from './result.ts'

declare const identifierBrand: unique symbol

type Identifier<Name extends string> = string & {
  readonly [identifierBrand]: Name
}

export type EventId = Identifier<'EventId'>
export type ParticipantId = Identifier<'ParticipantId'>
export type PrizeCategoryId = Identifier<'PrizeCategoryId'>
export type DrawConfigurationId = Identifier<'DrawConfigurationId'>
export type DrawSessionId = Identifier<'DrawSessionId'>
export type WinnerRecordId = Identifier<'WinnerRecordId'>
export type RedrawRecordId = Identifier<'RedrawRecordId'>
export type AuditRecordId = Identifier<'AuditRecordId'>
export type CommandId = Identifier<'CommandId'>
export type DisplayConfigurationId =
  Identifier<'DisplayConfigurationId'>

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function createIdentifier<Name extends string>(): Identifier<Name> {
  return crypto.randomUUID() as Identifier<Name>
}

function parseIdentifier<Name extends string>(
  value: unknown,
  identifierName: Name,
): Result<Identifier<Name>> {
  if (typeof value !== 'string' || !uuidPattern.test(value)) {
    return failure(
      'invalid-identifier',
      `${identifierName} must be a valid UUID string.`,
    )
  }

  return success(value as Identifier<Name>)
}

export function createEventId(): EventId {
  return createIdentifier<'EventId'>()
}

export function parseEventId(value: unknown): Result<EventId> {
  return parseIdentifier(value, 'EventId')
}

export function createParticipantId(): ParticipantId {
  return createIdentifier<'ParticipantId'>()
}

export function parseParticipantId(
  value: unknown,
): Result<ParticipantId> {
  return parseIdentifier(value, 'ParticipantId')
}

export function createPrizeCategoryId(): PrizeCategoryId {
  return createIdentifier<'PrizeCategoryId'>()
}

export function parsePrizeCategoryId(
  value: unknown,
): Result<PrizeCategoryId> {
  return parseIdentifier(value, 'PrizeCategoryId')
}

export function createDrawConfigurationId(): DrawConfigurationId {
  return createIdentifier<'DrawConfigurationId'>()
}

export function parseDrawConfigurationId(
  value: unknown,
): Result<DrawConfigurationId> {
  return parseIdentifier(value, 'DrawConfigurationId')
}

export function createDrawSessionId(): DrawSessionId {
  return createIdentifier<'DrawSessionId'>()
}

export function parseDrawSessionId(
  value: unknown,
): Result<DrawSessionId> {
  return parseIdentifier(value, 'DrawSessionId')
}

export function createWinnerRecordId(): WinnerRecordId {
  return createIdentifier<'WinnerRecordId'>()
}

export function parseWinnerRecordId(
  value: unknown,
): Result<WinnerRecordId> {
  return parseIdentifier(value, 'WinnerRecordId')
}

export function createRedrawRecordId(): RedrawRecordId {
  return createIdentifier<'RedrawRecordId'>()
}

export function parseRedrawRecordId(
  value: unknown,
): Result<RedrawRecordId> {
  return parseIdentifier(value, 'RedrawRecordId')
}

export function createAuditRecordId(): AuditRecordId {
  return createIdentifier<'AuditRecordId'>()
}

export function parseAuditRecordId(
  value: unknown,
): Result<AuditRecordId> {
  return parseIdentifier(value, 'AuditRecordId')
}

export function createDisplayConfigurationId(): DisplayConfigurationId {
  return createIdentifier<'DisplayConfigurationId'>()
}

export function parseDisplayConfigurationId(
  value: unknown,
): Result<DisplayConfigurationId> {
  return parseIdentifier(value, 'DisplayConfigurationId')
}
