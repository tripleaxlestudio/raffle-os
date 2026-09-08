import type { LogCategory, LogEntry, LogLevel } from './log-types.ts'

export function formatTimeWithMs(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  const ms = String(date.getMilliseconds()).padStart(3, '0')
  return `${hours}:${minutes}:${seconds}.${ms}`
}

export function formatFullTimestamp(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day} ${formatTimeWithMs(date)}`
}

interface RawDummyLog {
  offsetSeconds: number
  level: LogLevel
  source: string
  category: LogCategory
  message: string
  metadata?: Record<string, string | number | boolean>
}

const RAW_INITIAL_LOGS: RawDummyLog[] = [
  {
    offsetSeconds: 0,
    level: 'info',
    source: 'App',
    category: 'App',
    message: 'KOCOKAN started (Operator Shell v1.0.0-rc2)',
    metadata: { env: 'production', userAgent: 'OperatorDesktop/Chrome122', memoryLimitMb: 1024 },
  },
  {
    offsetSeconds: 0.057,
    level: 'info',
    source: 'Storage/IndexedDB',
    category: 'Storage',
    message: 'Database opened successfully: kocokan-db (schema v3)',
    metadata: { database: 'kocokan-db', version: 3, storeCount: 8 },
  },
  {
    offsetSeconds: 0.112,
    level: 'debug',
    source: 'Storage/IndexedDB',
    category: 'Storage',
    message: 'Storage quota check: 184.2 MB used of 2048 MB reserved pool',
    metadata: { usedBytes: 193146880, quotaBytes: 2147483648, usagePercent: 8.99 },
  },
  {
    offsetSeconds: 0.245,
    level: 'info',
    source: 'Recovery',
    category: 'Recovery',
    message: 'Startup recovery check completed: no interrupted draw session detected',
    metadata: { interruptedSessions: 0, pendingRolls: 0 },
  },
  {
    offsetSeconds: 0.818,
    level: 'info',
    source: 'Event',
    category: 'Event',
    message: 'Active event loaded: Panggung Seni Dirgahayu 01 (ID: evt_001)',
    metadata: { eventId: 'evt_001', venue: 'Main Grand Ballroom', timeZone: 'Asia/Jakarta' },
  },
  {
    offsetSeconds: 1.22,
    level: 'debug',
    source: 'Event',
    category: 'Event',
    message: 'Event schedule validated: 4 planned tiers, 18 total prize slots',
  },
  {
    offsetSeconds: 1.45,
    level: 'info',
    source: 'Audio',
    category: 'Audio',
    message: 'Audio synthesizer engine initialized with Web Audio API',
    metadata: { sampleRate: 48000, state: 'running', channels: 2 },
  },
  {
    offsetSeconds: 1.62,
    level: 'debug',
    source: 'Audio',
    category: 'Audio',
    message: 'Audio soundbank cached: 8 procedural synthesis presets loaded',
  },
  {
    offsetSeconds: 2.333,
    level: 'info',
    source: 'Audience/Channel',
    category: 'Audience',
    message: 'BroadcastChannel established: kocokan-audience-bridge',
    metadata: { channelName: 'kocokan-audience-bridge', role: 'publisher' },
  },
  {
    offsetSeconds: 2.517,
    level: 'info',
    source: 'Audience',
    category: 'Audience',
    message: 'Audience Display connected: primary viewport active',
    metadata: { displayId: 'audience-main', resolution: '1920x1080', refreshRateHz: 60, latencyMs: 12 },
  },
  {
    offsetSeconds: 2.89,
    level: 'debug',
    source: 'Audience/Sync',
    category: 'Audience',
    message: 'Audience Display configuration acknowledged with zero diff',
    metadata: { layoutTheme: 'kocokan', motionReduced: false },
  },
  {
    offsetSeconds: 3.102,
    level: 'info',
    source: 'Import',
    category: 'Import',
    message: 'Previous staging import cache verified',
    metadata: { stagedRows: 300, invalidRows: 0 },
  },
  {
    offsetSeconds: 3.331,
    level: 'info',
    source: 'Participants',
    category: 'Participants',
    message: 'Participant dataset loaded: 300 records in local memory cache',
    metadata: { totalCount: 300, checkedInCount: 294, excludedCount: 0 },
  },
  {
    offsetSeconds: 3.84,
    level: 'debug',
    source: 'Participants/Audit',
    category: 'Participants',
    message: 'Participant ticket string invariants verified: leading zeros preserved',
    metadata: { sampleVerified: 50, zeroPaddedTickets: 300 },
  },
  {
    offsetSeconds: 4.12,
    level: 'debug',
    source: 'Draw/Preflight',
    category: 'Draw',
    message: 'Draw engine preflight check: Web Crypto CSPRNG ready',
    metadata: { cryptoAvailable: true, algorithm: 'crypto.getRandomValues' },
  },
  {
    offsetSeconds: 5.122,
    level: 'info',
    source: 'Draw/Pool',
    category: 'Draw',
    message: 'Eligible pool calculated: 287 participants for Tier 1 (Grand Prize)',
    metadata: { categoryId: 'cat_grand', totalPool: 287, checkinRequired: true, priorWinnersExcluded: 0 },
  },
  {
    offsetSeconds: 5.41,
    level: 'debug',
    source: 'Draw/Pool',
    category: 'Draw',
    message: 'Pool hash digest computed: sha256-d7a8f19bc301',
    metadata: { poolSize: 287, hash: 'd7a8f19bc301' },
  },
  {
    offsetSeconds: 6.889,
    level: 'info',
    source: 'Draw',
    category: 'Draw',
    message: 'Live draw session created: session_live_042',
    metadata: { sessionId: 'session_live_042', mode: 'live', tier: 'Grand Prize', targetWinners: 6 },
  },
  {
    offsetSeconds: 6.902,
    level: 'debug',
    source: 'Draw/Random',
    category: 'Draw',
    message: 'Winner selection completed: 6 slots securely selected via Web Crypto',
    metadata: { slotsCount: 6, selectionEntropyBytes: 48, candidatePoolSize: 287 },
  },
  {
    offsetSeconds: 7.104,
    level: 'info',
    source: 'Audience/Publish',
    category: 'Audience',
    message: 'Rolling state published to Audience Display',
    metadata: { sessionId: 'session_live_042', sequence: 101, transitionMs: 4000 },
  },
  {
    offsetSeconds: 7.21,
    level: 'debug',
    source: 'Audio/Playback',
    category: 'Audio',
    message: 'Triggered audio cue: drumroll-suspense-loop (duration: 4000ms)',
  },
  {
    offsetSeconds: 8.445,
    level: 'warning',
    source: 'Audience/Ack',
    category: 'Audience',
    message: 'Display acknowledgement delayed: 1840 ms',
    metadata: {
      eventId: 'evt_001',
      displayId: 'audience-main',
      sequence: 101,
      latencyMs: 1840,
      thresholdMs: 1000,
    },
  },
  {
    offsetSeconds: 9.021,
    level: 'info',
    source: 'Audience/Publish',
    category: 'Audience',
    message: 'Winner reveal state published for 6 slots',
    metadata: { sequence: 102, revealDelayPerSlotMs: 800 },
  },
  {
    offsetSeconds: 9.35,
    level: 'debug',
    source: 'Audio/Playback',
    category: 'Audio',
    message: 'Triggered audio cue: victory-fanfare',
  },
  {
    offsetSeconds: 10.272,
    level: 'info',
    source: 'Result',
    category: 'Result',
    message: '6 winner slots confirmed by Operator',
    metadata: { drawSessionId: 'session_live_042', confirmedAt: '14:35:48', confirmedBy: 'Operator' },
  },
  {
    offsetSeconds: 10.882,
    level: 'error',
    source: 'Storage/IndexedDB',
    category: 'Storage',
    message: 'Failed to persist display configuration: QuotaExceededError simulated on secondary cache',
    metadata: { store: 'display_config_history', errorType: 'QuotaExceededError', code: 22, retryAttempted: true },
  },
  {
    offsetSeconds: 11.205,
    level: 'info',
    source: 'Storage/IndexedDB',
    category: 'Storage',
    message: 'Storage fallback cache applied: display configuration saved in primary store',
    metadata: { store: 'active_display_config', status: 'healthy' },
  },
  {
    offsetSeconds: 12.11,
    level: 'debug',
    source: 'Audience/Heartbeat',
    category: 'Audience',
    message: 'Heartbeat ping: round-trip latency 8ms',
    metadata: { pingSeq: 14, rttMs: 8 },
  },
  {
    offsetSeconds: 13.04,
    level: 'info',
    source: 'Export',
    category: 'Export',
    message: 'Audit log snapshot prepared for export',
    metadata: { snapshotBytes: 4210, recordCount: 29 },
  },
  {
    offsetSeconds: 13.88,
    level: 'debug',
    source: 'Draw/Pool',
    category: 'Draw',
    message: 'Recalculating eligible pool for Tier 2: excluding 6 confirmed winners',
    metadata: { previousPool: 287, confirmedExcluded: 6, newEligiblePool: 281 },
  },
  {
    offsetSeconds: 14.502,
    level: 'info',
    source: 'Draw/Pool',
    category: 'Draw',
    message: 'Eligible pool ready: 281 participants for Tier 2 (Hiburan)',
    metadata: { categoryId: 'cat_hiburan', totalPool: 281 },
  },
  {
    offsetSeconds: 15.21,
    level: 'warning',
    source: 'Audio/Playback',
    category: 'Audio',
    message: 'Audio buffer underrun detected during rapid cue transition: 12ms stutter',
    metadata: { bufferSize: 1024, underrunSamples: 576, latencyImpactMs: 12 },
  },
  {
    offsetSeconds: 15.75,
    level: 'debug',
    source: 'App',
    category: 'App',
    message: 'Garbage collection completed: heap size 36.4 MB',
    metadata: { heapUsedMb: 36.4, heapTotalMb: 48.2 },
  },
  {
    offsetSeconds: 16.32,
    level: 'info',
    source: 'Audience/Sync',
    category: 'Audience',
    message: 'Audience Display resolution change detected: window resized to 1920x1080',
    metadata: { innerWidth: 1920, innerHeight: 1080, aspectRatio: '16:9' },
  },
  {
    offsetSeconds: 17.15,
    level: 'debug',
    source: 'Draw/Session',
    category: 'Draw',
    message: 'Practice mode dry-run initiated: 3 dummy slots',
    metadata: { practiceSession: 'session_prac_091', slots: 3, isolatedFromAudit: true },
  },
  {
    offsetSeconds: 17.82,
    level: 'debug',
    source: 'Draw/Random',
    category: 'Draw',
    message: 'Practice draw selection completed: zero impact on live pool',
    metadata: { practiceSession: 'session_prac_091', persistedToLiveHistory: false },
  },
  {
    offsetSeconds: 18.24,
    level: 'info',
    source: 'Event',
    category: 'Event',
    message: 'Operator note logged: Stage announcer on schedule',
  },
  {
    offsetSeconds: 19.01,
    level: 'warning',
    source: 'Recovery',
    category: 'Recovery',
    message: 'Session state checkpoint took longer than expected: 142ms',
    metadata: { durationMs: 142, warningThresholdMs: 100 },
  },
  {
    offsetSeconds: 19.66,
    level: 'info',
    source: 'Storage/IndexedDB',
    category: 'Storage',
    message: 'IndexedDB transaction committed: session_prac_091 cleaned up',
  },
  {
    offsetSeconds: 20.31,
    level: 'debug',
    source: 'Audience/Heartbeat',
    category: 'Audience',
    message: 'Heartbeat ping: round-trip latency 11ms',
    metadata: { pingSeq: 15, rttMs: 11 },
  },
  {
    offsetSeconds: 21.14,
    level: 'error',
    source: 'Audience/Connection',
    category: 'Audience',
    message: 'Secondary preview target unreachable: ws://localhost:8765 timed out',
    metadata: { target: 'auxiliary-streamer', timeoutMs: 3000, primaryChannelOk: true },
  },
  {
    offsetSeconds: 21.89,
    level: 'info',
    source: 'Audience',
    category: 'Audience',
    message: 'Primary BroadcastChannel remained intact: Audience Display operating normally',
    metadata: { channelHealth: 'optimal', activeListeners: 1 },
  },
  {
    offsetSeconds: 22.45,
    level: 'debug',
    source: 'Participants/Cache',
    category: 'Participants',
    message: 'Participant lookup table re-indexed: search queries responding in < 1ms',
  },
  {
    offsetSeconds: 23.12,
    level: 'info',
    source: 'App',
    category: 'App',
    message: 'System telemetry heartbeat healthy: uptime 23 minutes',
    metadata: { uptimeSeconds: 1380, errorCount: 2, warnCount: 3 },
  },
]

export function generateInitialDummyLogs(baseTime: Date): LogEntry[] {
  return RAW_INITIAL_LOGS.map((raw, index) => {
    const entryDate = new Date(baseTime.getTime() + raw.offsetSeconds * 1000)
    return {
      id: `log-init-${index + 1}`,
      timestamp: formatTimeWithMs(entryDate),
      fullTimestamp: formatFullTimestamp(entryDate),
      level: raw.level,
      source: raw.source,
      category: raw.category,
      message: raw.message,
      metadata: raw.metadata,
    }
  })
}

export interface SimulatedTemplate {
  level: LogLevel
  source: string
  category: LogCategory
  message: string
  metadata?: Record<string, string | number | boolean>
}

export const SIMULATED_LOG_POOL: SimulatedTemplate[] = [
  {
    level: 'debug',
    source: 'Audience/Heartbeat',
    category: 'Audience',
    message: 'Display heartbeat acknowledged: latency 9ms',
    metadata: { pingId: 1048, latencyMs: 9, channel: 'kocokan-display' },
  },
  {
    level: 'info',
    source: 'Audio',
    category: 'Audio',
    message: 'Audio playback completed for cue: ambient-pad',
    metadata: { cueId: 'ambient-pad', durationMs: 6200 },
  },
  {
    level: 'debug',
    source: 'Storage/IndexedDB',
    category: 'Storage',
    message: 'Auto-checkpoint completed: 0 dirty records pending',
    metadata: { committedTx: 1, durationMs: 4 },
  },
  {
    level: 'info',
    source: 'Audience/Sync',
    category: 'Audience',
    message: 'Broadcast state confirmed by 1 active receiver',
    metadata: { activeReceivers: 1, lastSyncSequence: 204 },
  },
  {
    level: 'debug',
    source: 'Draw/Preflight',
    category: 'Draw',
    message: 'Verified candidate pool consistency with active session parameters',
    metadata: { candidateCount: 281, status: 'consistent' },
  },
  {
    level: 'warning',
    source: 'Audience/Ack',
    category: 'Audience',
    message: 'Heartbeat ping response delayed: 240ms',
    metadata: { delayMs: 240, channel: 'kocokan-audience-bridge', thresholdMs: 150 },
  },
  {
    level: 'debug',
    source: 'App',
    category: 'App',
    message: 'Memory heap check: 38.2 MB / 1024 MB reserved',
    metadata: { heapUsedMb: 38.2, maxMb: 1024 },
  },
  {
    level: 'info',
    source: 'Event',
    category: 'Event',
    message: 'Event schedule check: Tier 2 scheduled to begin in 5 minutes',
    metadata: { nextTier: 'Hiburan', scheduledTime: '14:45:00' },
  },
  {
    level: 'debug',
    source: 'Draw/Random',
    category: 'Draw',
    message: 'Entropy pool reseeded from Web Crypto API',
    metadata: { entropyBytes: 64, generator: 'WebCrypto' },
  },
  {
    level: 'info',
    source: 'Recovery',
    category: 'Recovery',
    message: 'Recovery checkpoint recorded: state hash match confirmed',
    metadata: { checkpointId: 'chk_918', verified: true },
  },
  {
    level: 'warning',
    source: 'Storage/IndexedDB',
    category: 'Storage',
    message: 'Background compaction delayed due to active user interaction',
    metadata: { delayedByMs: 500, currentOperation: 'log-view' },
  },
  {
    level: 'error',
    source: 'Audience/Channel',
    category: 'Audience',
    message: 'Temporary message drop detected on secondary diagnostic channel',
    metadata: { droppedPacketSeq: 88, channel: 'diag-bus', retransmitSuccess: true },
  },
]

let simulationCounter = 0

export function generateNextSimulatedEntry(now: Date = new Date()): LogEntry {
  simulationCounter += 1
  const template = SIMULATED_LOG_POOL[simulationCounter % SIMULATED_LOG_POOL.length]
  return {
    id: `log-sim-${Date.now()}-${simulationCounter}`,
    timestamp: formatTimeWithMs(now),
    fullTimestamp: formatFullTimestamp(now),
    level: template.level,
    source: template.source,
    category: template.category,
    message: template.message,
    metadata: template.metadata,
  }
}
