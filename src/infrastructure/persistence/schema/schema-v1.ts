export const SCHEMA_VERSION_1 = 1 as const

export const SCHEMA_V1 = {
  audit_records:
    'id, eventId, action, timestamp, [eventId+timestamp]',
  display_configurations: 'id, &eventId',
  draw_configurations: 'id, eventId, prizeCategoryId',
  draw_sessions:
    'id, eventId, configurationId, mode, status, createdAt',
  events: 'id, name, status, createdAt',
  participants:
    'id, eventId, ticketNumber, &[eventId+ticketNumber], isCheckedIn, group',
  preferences: 'key',
  prize_categories: 'id, eventId, displayOrder',
  redraw_records:
    'id, eventId, drawSessionId, &originalWinnerRecordId, replacementWinnerRecordId, createdAt',
  winner_records:
    'id, eventId, prizeCategoryId, drawSessionId, participantId, ticketNumber, status, sequenceNumber, &[drawSessionId+sequenceNumber], [eventId+status], [eventId+prizeCategoryId+status]',
} as const

export const SCHEMA_V1_STORE_NAMES = [
  'events',
  'participants',
  'prize_categories',
  'draw_configurations',
  'display_configurations',
  'draw_sessions',
  'winner_records',
  'redraw_records',
  'audit_records',
  'preferences',
] as const

export const SCHEMA_VERSION_2 = 2 as const
export const SCHEMA_V2 = {
  presentation_checkpoints: 'drawSessionId, stage, persistedAt',
} as const

export const SCHEMA_VERSION_3 = 3 as const
export const SCHEMA_V3 = {
  command_receipts:
    '&commandId, drawSessionId, operation, [drawSessionId+operation], status, createdAt, committedAt',
} as const

export type SchemaV1StoreName =
  (typeof SCHEMA_V1_STORE_NAMES)[number]
