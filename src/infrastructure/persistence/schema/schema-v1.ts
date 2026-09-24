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

export const SCHEMA_VERSION_4 = 4 as const
export const SCHEMA_V4 = { event_settings: '&eventId, updatedAt' } as const

export const SCHEMA_VERSION_5 = 5 as const
export const SCHEMA_V5 = {
  draw_configurations: SCHEMA_V1.draw_configurations,
  draw_sessions: SCHEMA_V1.draw_sessions,
} as const

export const SCHEMA_VERSION_6 = 6 as const
export const SCHEMA_V6 = SCHEMA_V5

export const SCHEMA_VERSION_7 = 7 as const
export const SCHEMA_V7 = {
  redraw_requests:
    '&id, eventId, drawSessionId, status, [drawSessionId+status], createdAt, updatedAt',
} as const

export type SchemaV1StoreName =
  (typeof SCHEMA_V1_STORE_NAMES)[number]
