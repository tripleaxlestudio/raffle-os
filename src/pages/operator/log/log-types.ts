export type LogLevel = 'error' | 'warning' | 'info' | 'debug'

export type LogCategory =
  | 'App'
  | 'Storage'
  | 'Event'
  | 'Participants'
  | 'Import'
  | 'Audience'
  | 'Draw'
  | 'Result'
  | 'Audio'
  | 'Export'
  | 'Recovery'

export const LOG_CATEGORIES: LogCategory[] = [
  'App',
  'Storage',
  'Event',
  'Participants',
  'Import',
  'Audience',
  'Draw',
  'Result',
  'Audio',
  'Export',
  'Recovery',
]

export interface LogEntry {
  id: string
  timestamp: string
  fullTimestamp: string
  level: LogLevel
  source: string
  category: LogCategory
  message: string
  metadata?: Record<string, string | number | boolean>
}

export interface LogFilterState {
  levels: Record<LogLevel, boolean>
  category: LogCategory | 'ALL'
  search: string
}
