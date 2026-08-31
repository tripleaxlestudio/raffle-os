import type { DrawSessionQueueItem } from '../../../application/draw/draw-session-queue.ts'
import type { AppMode } from '../../../domain/types/app-mode.ts'
import type { BadgeVariant } from '../../../shared/ui/Badge.tsx'
import { formatProductionDateTime } from '../../../shared/localization/production-locale.ts'

export type DrawSessionQueuePriority = 'action-required' | 'ready' | 'historical'

export interface DrawSessionQueuePresentation {
  readonly modeLabel: 'Latihan' | 'Live'
  readonly modeTone: 'practice' | 'live'
  readonly lifecycleLabel: string
  readonly lifecycleTone: BadgeVariant
  readonly updatedLabel: string
  readonly checkpointLabel: string
  readonly priority: DrawSessionQueuePriority
  readonly priorityLabel: string
  readonly actionLabel: string | null
  readonly relationLabel: string | null
  readonly historical: boolean
}

export interface DrawSessionQueueDeck {
  readonly key: string
  readonly eventName: string
  readonly categoryName: string
  readonly prizeName: string
  readonly winnerCount: number
  readonly sessions: Readonly<Partial<Record<AppMode, DrawSessionQueueItem>>>
  readonly defaultMode: AppMode
}

const operationalStatuses = new Set<DrawSessionQueueItem['session']['status']>(['draft', 'ready', 'drawing', 'pending-confirmation'])

const lifecycleLabels: Record<DrawSessionQueueItem['session']['status'], string> = {
  draft: 'Draf', ready: 'Siap', drawing: 'Presentasi sedang berjalan', 'pending-confirmation': 'Perlu keputusan', completed: 'Selesai', cancelled: 'Dibatalkan',
}

const lifecycleTones: Record<DrawSessionQueueItem['session']['status'], BadgeVariant> = {
  draft: 'neutral', ready: 'success', drawing: 'info', 'pending-confirmation': 'pending', completed: 'confirmed', cancelled: 'danger',
}

const relationLabels: Record<Exclude<DrawSessionQueueItem['relation'], 'valid'>, string> = {
  'missing-event': 'Relasi Acara tidak tersedia', 'missing-configuration': 'Konfigurasi undian tidak tersedia', 'missing-category': 'Kategori hadiah tidak tersedia',
}

const checkpointStageLabels: Record<string, string> = {
  countdown: 'Hitung mundur berlangsung', rolling: 'Presentasi pemenang berlangsung', reveal: 'Pengungkapan pemenang siap', 'pending-handoff': 'Presentasi selesai; siap dilanjutkan',
}

export function formatQueueTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Waktu pembaruan tidak tersedia'
  return formatProductionDateTime(date).replace(' pukul ', ' · ')
}

function priorityFor(item: DrawSessionQueueItem): DrawSessionQueuePriority {
  if (item.session.status === 'drawing' || item.session.status === 'pending-confirmation') return 'action-required'
  if (item.session.status === 'completed' || item.session.status === 'cancelled') return 'historical'
  return 'ready'
}

const sessionPriority: Record<DrawSessionQueueItem['session']['status'], number> = {
  drawing: 0, 'pending-confirmation': 1, ready: 2, draft: 3, completed: 4, cancelled: 5,
}

function preferredMode(items: readonly DrawSessionQueueItem[]): AppMode {
  return [...items].sort((left, right) => sessionPriority[left.session.status] - sessionPriority[right.session.status] || (left.session.mode === 'live' ? -1 : 1))[0]?.session.mode ?? 'practice'
}

function operationalRank(item: DrawSessionQueueItem): number {
  if (item.session.status === 'drawing') return 0
  if (item.session.status === 'pending-confirmation') return 1
  if (item.session.status === 'ready') return 2
  return 3
}

function queueDeckKey(item: DrawSessionQueueItem): string {
  return `${item.session.eventId}:${item.session.configurationId}:${item.category?.id ?? 'missing-category'}:${item.winnerCount}`
}

/**
 * Live Draw is a single operational workspace. Terminal sessions remain in
 * the queue result for Pending/History consumers, but must not become Live
 * Draw decks. A matching Practice session is retained only as the alternate
 * mode for the selected current draw.
 */
export function selectCurrentOperationalQueueItems(items: readonly DrawSessionQueueItem[]): readonly DrawSessionQueueItem[] {
  const operational = items.filter((item) => operationalStatuses.has(item.session.status))
  const liveOperational = operational.filter((item) => item.session.mode === 'live')
  const candidates = liveOperational.length > 0 ? liveOperational : operational
  const current = [...candidates].sort((left, right) => operationalRank(left) - operationalRank(right) || right.session.updatedAt.localeCompare(left.session.updatedAt) || left.session.id.localeCompare(right.session.id))[0]
  if (current === undefined) return []

  const currentKey = queueDeckKey(current)
  return [...new Set([current.session.mode, current.session.mode === 'live' ? 'practice' : 'live'])]
    .map((mode) => operational
      .filter((item) => item.session.mode === mode && queueDeckKey(item) === currentKey)
      .sort((left, right) => operationalRank(left) - operationalRank(right) || right.session.updatedAt.localeCompare(left.session.updatedAt) || left.session.id.localeCompare(right.session.id))[0])
    .filter((item): item is DrawSessionQueueItem => item !== undefined)
}

function priorityLabel(priority: DrawSessionQueuePriority): string {
  if (priority === 'action-required') return 'Perlu tindakan'
  if (priority === 'historical') return 'Sesi riwayat'
  return 'Sesi siap'
}

function checkpointLabel(item: DrawSessionQueueItem): string {
  if (item.session.status === 'drawing') return item.checkpoint === null ? 'Presentasi sedang berjalan; dapat dilanjutkan' : checkpointStageLabels[item.checkpoint.stage] ?? 'Pemulihan presentasi tersedia'
  if (item.session.status === 'pending-confirmation') return 'Presentasi selesai; menunggu keputusan Operator'
  if (item.session.status === 'completed') return 'Presentasi dan keputusan Operator selesai'
  if (item.session.status === 'cancelled') return 'Sesi dibatalkan; Riwayat resmi dipertahankan'
  if (item.session.status === 'draft') return 'Pengaturan Undian belum siap'
  return 'Siap memulai presentasi'
}

function actionLabel(item: DrawSessionQueueItem): string | null {
  if (item.action === null) return null
  if (item.action.kind === 'setup') return 'Buka Pengaturan Undian'
  if (item.action.kind === 'run') return item.session.status === 'drawing' ? 'Lanjutkan presentasi' : item.session.mode === 'live' ? 'Mulai Live' : 'Mulai Latihan'
  if (item.action.kind === 'pending') return 'Tinjau Hasil'
  return 'Buka Riwayat'
}

export function presentDrawSessionQueueItem(item: DrawSessionQueueItem): DrawSessionQueuePresentation {
  const priority = priorityFor(item)
  return { modeLabel: item.session.mode === 'live' ? 'Live' : 'Latihan', modeTone: item.session.mode === 'live' ? 'live' : 'practice', lifecycleLabel: lifecycleLabels[item.session.status], lifecycleTone: lifecycleTones[item.session.status], updatedLabel: formatQueueTimestamp(item.session.updatedAt), checkpointLabel: checkpointLabel(item), priority, priorityLabel: priorityLabel(priority), actionLabel: actionLabel(item), relationLabel: item.relation === 'valid' ? null : relationLabels[item.relation], historical: priority === 'historical' }
}

export function groupDrawSessionQueueItems(items: readonly DrawSessionQueueItem[]): Readonly<Record<DrawSessionQueuePriority, readonly DrawSessionQueueItem[]>> {
  return { 'action-required': items.filter((item) => priorityFor(item) === 'action-required'), ready: items.filter((item) => priorityFor(item) === 'ready'), historical: items.filter((item) => priorityFor(item) === 'historical') }
}

export function groupDrawSessionQueueDecks(items: readonly DrawSessionQueueItem[]): readonly DrawSessionQueueDeck[] {
  const decks = new Map<string, DrawSessionQueueItem[]>()
  for (const item of items) {
    const key = queueDeckKey(item)
    const current = decks.get(key)
    if (current === undefined) decks.set(key, [item])
    else current.push(item)
  }
  return [...decks].map(([key, deckItems]) => {
    const first = deckItems[0]
    const sessions = Object.fromEntries(deckItems.map((item) => [item.session.mode, item])) as Partial<Record<AppMode, DrawSessionQueueItem>>
    return { key, eventName: first?.event?.name ?? 'Acara tidak tersedia', categoryName: first?.category?.name ?? 'Kategori hadiah tidak tersedia', prizeName: first?.category?.prizeName ?? 'Hadiah terkait tidak tersedia', winnerCount: first?.winnerCount ?? 0, sessions, defaultMode: preferredMode(deckItems) }
  })
}
