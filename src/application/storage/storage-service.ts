import type { EventSettings, LocalAsset } from '../../domain/settings/event-settings.types.ts'
import type { RaffleOSDatabase } from '../../infrastructure/persistence/db.ts'
import { signalProductionWorkspaceChanged } from '../../app/workspace/ProductionWorkspaceContext.tsx'
import type {
  BackupPreviewSummary,
  KocokanBackupData,
  KocokanBackupEnvelope,
  SerializedEventSettings,
  SerializedLocalAsset,
  StorageStatistics,
} from './storage-types.ts'

export type Result<T, E = string> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E }

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const clampedIndex = Math.min(i, sizes.length - 1)
  const value = bytes / Math.pow(k, clampedIndex)
  return `${value.toFixed(value < 10 && clampedIndex > 0 ? 1 : 0)} ${sizes[clampedIndex]}`
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export function base64ToBlob(base64: string, type: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type })
}

export async function calculateDatabaseStorageBytes(database: RaffleOSDatabase): Promise<number> {
  let totalBytes = 0
  for (const table of database.tables) {
    const records = await table.toArray()
    for (const record of records) {
      const json = JSON.stringify(record)
      totalBytes += new TextEncoder().encode(json).length
      if (table.name === 'event_settings') {
        const settings = record as EventSettings
        if (settings.logo?.blob) totalBytes += settings.logo.blob.size
        if (settings.background?.blob) totalBytes += settings.background.blob.size
        if (settings.revealCue?.blob) totalBytes += settings.revealCue.blob.size
      }
    }
  }
  return totalBytes
}

export async function readStorageStatistics(database: RaffleOSDatabase): Promise<StorageStatistics> {
  const readiness = await database.checkReadiness()
  if (!readiness.ok) {
    return {
      databaseStatus: 'error',
      databaseError: readiness.reason,
      eventCount: 0,
      participantCount: 0,
      officialHistoryCount: 0,
      storageBytes: 0,
      formattedStorageSize: '0 B',
    }
  }

  const [eventCount, participantCount, officialHistoryCount, storageBytes] = await Promise.all([
    database.events.count(),
    database.participants.count(),
    database.draw_sessions.where('mode').equals('live').count(),
    calculateDatabaseStorageBytes(database),
  ])

  return {
    databaseStatus: 'ready',
    eventCount,
    participantCount,
    officialHistoryCount,
    storageBytes,
    formattedStorageSize: formatBytes(storageBytes),
  }
}

export function generateBackupFilename(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  return `Kocokan-Backup-${year}-${month}-${day}-${hours}${minutes}.kocokan.json`
}

async function serializeEventSettings(settings: EventSettings): Promise<SerializedEventSettings> {
  let logo: SerializedLocalAsset | undefined
  if (settings.logo?.blob) {
    logo = {
      name: settings.logo.name,
      type: settings.logo.type,
      size: settings.logo.size,
      base64: await blobToBase64(settings.logo.blob),
    }
  }

  let background: SerializedLocalAsset | undefined
  if (settings.background?.blob) {
    background = {
      name: settings.background.name,
      type: settings.background.type,
      size: settings.background.size,
      base64: await blobToBase64(settings.background.blob),
    }
  }

  let revealCue: SerializedLocalAsset | undefined
  if (settings.revealCue?.blob) {
    revealCue = {
      name: settings.revealCue.name,
      type: settings.revealCue.type,
      size: settings.revealCue.size,
      base64: await blobToBase64(settings.revealCue.blob),
    }
  }

  return {
    ...settings,
    logo,
    background,
    revealCue,
  }
}

function deserializeEventSettings(serialized: SerializedEventSettings): EventSettings {
  let logo: LocalAsset | undefined
  if (serialized.logo?.base64) {
    logo = {
      name: serialized.logo.name,
      type: serialized.logo.type,
      size: serialized.logo.size,
      blob: base64ToBlob(serialized.logo.base64, serialized.logo.type),
    }
  }

  let background: LocalAsset | undefined
  if (serialized.background?.base64) {
    background = {
      name: serialized.background.name,
      type: serialized.background.type,
      size: serialized.background.size,
      blob: base64ToBlob(serialized.background.base64, serialized.background.type),
    }
  }

  let revealCue: LocalAsset | undefined
  if (serialized.revealCue?.base64) {
    revealCue = {
      name: serialized.revealCue.name,
      type: serialized.revealCue.type,
      size: serialized.revealCue.size,
      blob: base64ToBlob(serialized.revealCue.base64, serialized.revealCue.type),
    }
  }

  return {
    ...serialized,
    logo,
    background,
    revealCue,
  }
}

export async function createBackup(
  database: RaffleOSDatabase,
  appVersion = '0.1.0',
): Promise<KocokanBackupEnvelope> {
  await database.openSupported()

  const [
    events,
    participants,
    prizeCategories,
    drawConfigurations,
    displayConfigurations,
    rawEventSettings,
    drawSessions,
    winnerRecords,
    redrawRecords,
    redrawRequests,
    auditRecords,
    preferences,
    presentationCheckpoints,
    commandReceipts,
  ] = await Promise.all([
    database.events.toArray(),
    database.participants.toArray(),
    database.prize_categories.toArray(),
    database.draw_configurations.toArray(),
    database.display_configurations.toArray(),
    database.event_settings.toArray(),
    database.draw_sessions.toArray(),
    database.winner_records.toArray(),
    database.redraw_records.toArray(),
    database.redraw_requests.toArray(),
    database.audit_records.toArray(),
    database.preferences.toArray(),
    database.presentation_checkpoints.toArray(),
    database.command_receipts.toArray(),
  ])

  const serializedEventSettings: SerializedEventSettings[] = await Promise.all(
    rawEventSettings.map((s) => serializeEventSettings(s)),
  )

  const backupData: KocokanBackupData = {
    events,
    participants,
    prizeCategories,
    drawConfigurations,
    displayConfigurations,
    eventSettings: serializedEventSettings,
    drawSessions,
    winnerRecords,
    redrawRecords,
    redrawRequests,
    auditRecords,
    preferences,
    presentationCheckpoints,
    commandReceipts,
  }

  return {
    format: 'kocokan-backup',
    version: 1,
    createdAt: new Date().toISOString(),
    appVersion,
    data: backupData,
  }
}

export function downloadBackupFile(envelope: KocokanBackupEnvelope, filename?: string): void {
  const name = filename ?? generateBackupFilename(new Date(envelope.createdAt))
  const json = JSON.stringify(envelope, null, 2)
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

export function validateBackupEnvelope(rawText: string): Result<KocokanBackupEnvelope, string> {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawText)
  } catch {
    return { ok: false, error: 'File bukan format JSON yang valid.' }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, error: 'Data backup tidak valid (harus berupa objek JSON).' }
  }

  const envelope = parsed as Record<string, unknown>

  if (envelope.format !== 'kocokan-backup') {
    return {
      ok: false,
      error: 'Format backup tidak dikenali. File harus memiliki atribut format "kocokan-backup".',
    }
  }

  if (envelope.version !== 1) {
    return {
      ok: false,
      error: `Versi backup ${String(envelope.version)} tidak didukung. Versi yang didukung saat ini: 1.`,
    }
  }

  if (typeof envelope.createdAt !== 'string' || Number.isNaN(Date.parse(envelope.createdAt))) {
    return { ok: false, error: 'Timestamp backup (createdAt) tidak valid.' }
  }

  if (typeof envelope.data !== 'object' || envelope.data === null) {
    return { ok: false, error: 'Konten data backup (data) tidak ditemukan.' }
  }

  const data = envelope.data as Record<string, unknown>
  const requiredArrayKeys = [
    'events',
    'participants',
    'prizeCategories',
    'drawConfigurations',
    'displayConfigurations',
    'drawSessions',
    'winnerRecords',
    'redrawRecords',
    'auditRecords',
    'preferences',
  ]

  for (const key of requiredArrayKeys) {
    if (!Array.isArray(data[key])) {
      return { ok: false, error: `Koleksi data "${key}" harus berupa array.` }
    }
  }

  // 1. Validate Events
  const eventIds = new Set<string>()
  for (const item of data.events as unknown[]) {
    if (typeof item !== 'object' || item === null) {
      return { ok: false, error: 'Terdapat entitas Event yang tidak valid.' }
    }
    const event = item as Record<string, unknown>
    if (typeof event.id !== 'string' || event.id.trim().length === 0) {
      return { ok: false, error: 'ID Acara harus berupa string tidak kosong.' }
    }
    if (typeof event.name !== 'string' || event.name.trim().length === 0) {
      return { ok: false, error: `Acara "${event.id}" memiliki nama yang kosong.` }
    }
    eventIds.add(event.id)
  }

  // 2. Validate Participants
  const participantTicketPairs = new Set<string>()
  for (const item of data.participants as unknown[]) {
    if (typeof item !== 'object' || item === null) {
      return { ok: false, error: 'Terdapat data peserta yang tidak valid.' }
    }
    const p = item as Record<string, unknown>
    if (typeof p.id !== 'string' || p.id.trim().length === 0) {
      return { ok: false, error: 'ID Peserta harus berupa string.' }
    }
    if (typeof p.eventId !== 'string' || !eventIds.has(p.eventId)) {
      return { ok: false, error: `Peserta "${p.id}" mengacu pada Acara yang tidak ada dalam backup.` }
    }
    if (typeof p.ticketNumber !== 'string') {
      return {
        ok: false,
        error: `Nomor tiket peserta "${p.id}" harus berupa string (leading zero harus dipertahankan).`,
      }
    }
    if (p.ticketNumber.trim().length === 0) {
      return { ok: false, error: `Nomor tiket peserta "${p.id}" tidak boleh kosong.` }
    }
    const pairKey = `${p.eventId}:${p.ticketNumber}`
    if (participantTicketPairs.has(pairKey)) {
      return {
        ok: false,
        error: `Nomor tiket duplikat "${p.ticketNumber}" ditemukan pada Acara "${p.eventId}".`,
      }
    }
    participantTicketPairs.add(pairKey)
  }

  // 3. Validate PrizeCategories
  const categoryIds = new Set<string>()
  for (const item of data.prizeCategories as unknown[]) {
    if (typeof item !== 'object' || item === null) {
      return { ok: false, error: 'Terdapat kategori hadiah yang tidak valid.' }
    }
    const c = item as Record<string, unknown>
    if (typeof c.id !== 'string' || c.id.trim().length === 0) {
      return { ok: false, error: 'ID Kategori Hadiah harus berupa string.' }
    }
    if (typeof c.eventId !== 'string' || !eventIds.has(c.eventId)) {
      return { ok: false, error: `Kategori hadiah "${c.id}" mengacu pada Acara yang tidak ada.` }
    }
    categoryIds.add(c.id)
  }

  // 4. Validate DrawSessions
  const sessionIds = new Set<string>()
  for (const item of data.drawSessions as unknown[]) {
    if (typeof item !== 'object' || item === null) {
      return { ok: false, error: 'Terdapat sesi undian yang tidak valid.' }
    }
    const s = item as Record<string, unknown>
    if (typeof s.id !== 'string' || s.id.trim().length === 0) {
      return { ok: false, error: 'ID Sesi Undian harus berupa string.' }
    }
    if (typeof s.eventId !== 'string' || !eventIds.has(s.eventId)) {
      return { ok: false, error: `Sesi undian "${s.id}" mengacu pada Acara yang tidak ada.` }
    }
    if (s.mode !== 'practice' && s.mode !== 'live') {
      return { ok: false, error: `Mode sesi undian "${s.id}" harus "practice" atau "live".` }
    }
    sessionIds.add(s.id)
  }

  // 5. Validate WinnerRecords
  for (const item of data.winnerRecords as unknown[]) {
    if (typeof item !== 'object' || item === null) {
      return { ok: false, error: 'Terdapat rekor pemenang yang tidak valid.' }
    }
    const w = item as Record<string, unknown>
    if (typeof w.id !== 'string' || w.id.trim().length === 0) {
      return { ok: false, error: 'ID Pemenang harus berupa string.' }
    }
    if (typeof w.ticketNumber !== 'string') {
      return { ok: false, error: `Nomor tiket pemenang "${w.id}" harus berupa string.` }
    }
    if (typeof w.drawSessionId !== 'string' || !sessionIds.has(w.drawSessionId)) {
      return { ok: false, error: `Pemenang "${w.id}" mengacu pada sesi undian yang tidak ada.` }
    }
  }

  return { ok: true, value: parsed as KocokanBackupEnvelope }
}

export function previewBackup(envelope: KocokanBackupEnvelope): BackupPreviewSummary {
  const { data } = envelope
  const liveSessions = data.drawSessions.filter((s) => s.mode === 'live')
  return {
    createdAt: envelope.createdAt,
    appVersion: envelope.appVersion,
    version: envelope.version,
    eventCount: data.events.length,
    participantCount: data.participants.length,
    officialHistoryCount: liveSessions.length,
    totalSessionsCount: data.drawSessions.length,
  }
}

export async function executeRestore(
  database: RaffleOSDatabase,
  envelope: KocokanBackupEnvelope,
): Promise<void> {
  await database.openSupported()

  const { data } = envelope
  const reconstructedEventSettings: EventSettings[] = (data.eventSettings ?? []).map((s) =>
    deserializeEventSettings(s),
  )

  // Atomic replace-all within a single readwrite transaction across all tables
  await database.transaction('rw', database.tables, async () => {
    // 1. Clear all existing records from all stores
    for (const table of database.tables) {
      await table.clear()
    }

    // 2. Populate stores with validated backup data
    if (data.events.length > 0) {
      await database.events.bulkAdd([...data.events])
    }
    if (data.participants.length > 0) {
      await database.participants.bulkAdd([...data.participants])
    }
    if (data.prizeCategories.length > 0) {
      await database.prize_categories.bulkAdd([...data.prizeCategories])
    }
    if (data.drawConfigurations.length > 0) {
      await database.draw_configurations.bulkAdd([...data.drawConfigurations])
    }
    if (data.displayConfigurations.length > 0) {
      await database.display_configurations.bulkAdd([...data.displayConfigurations])
    }
    if (reconstructedEventSettings.length > 0) {
      await database.event_settings.bulkAdd(reconstructedEventSettings)
    }
    if (data.drawSessions.length > 0) {
      await database.draw_sessions.bulkAdd([...data.drawSessions])
    }
    if (data.winnerRecords.length > 0) {
      await database.winner_records.bulkAdd([...data.winnerRecords])
    }
    if (data.redrawRecords.length > 0) {
      await database.redraw_records.bulkAdd([...data.redrawRecords])
    }
    if (data.redrawRequests && data.redrawRequests.length > 0) {
      await database.redraw_requests.bulkAdd([...data.redrawRequests])
    }
    if (data.auditRecords.length > 0) {
      await database.audit_records.bulkAdd([...data.auditRecords])
    }
    if (data.preferences.length > 0) {
      await database.preferences.bulkAdd([...data.preferences])
    }
    if (data.presentationCheckpoints && data.presentationCheckpoints.length > 0) {
      await database.presentation_checkpoints.bulkAdd([...data.presentationCheckpoints])
    }
    if (data.commandReceipts && data.commandReceipts.length > 0) {
      await database.command_receipts.bulkAdd([...data.commandReceipts])
    }
  })

  // Invalidate and refresh application workspace
  signalProductionWorkspaceChanged()
}

export async function executeReset(database: RaffleOSDatabase): Promise<void> {
  await database.openSupported()

  // 1. Atomically clear all Dexie tables
  await database.transaction('rw', database.tables, async () => {
    for (const table of database.tables) {
      await table.clear()
    }
  })

  // 2. Safely clean only Kocokan-owned keys from localStorage
  try {
    if (typeof localStorage !== 'undefined') {
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (key.startsWith('raffle-os') || key.startsWith('kocokan'))) {
          keysToRemove.push(key)
        }
      }
      for (const key of keysToRemove) {
        localStorage.removeItem(key)
      }
    }
  } catch {
    // Gracefully handle environments where localStorage is restricted
  }

  // 3. Invalidate workspace and notify application
  signalProductionWorkspaceChanged()
}
