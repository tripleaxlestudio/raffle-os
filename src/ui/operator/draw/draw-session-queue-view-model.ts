import type { DrawSessionQueueItem } from '../../../application/draw/draw-session-queue.ts'
import type { BadgeVariant } from '../../../shared/ui/Badge.tsx'

export type DrawSessionQueuePriority = 'action-required' | 'ready' | 'historical'

export interface DrawSessionQueuePresentation {
  readonly modeLabel: 'Practice' | 'Live'
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

const lifecycleLabels: Record<DrawSessionQueueItem['session']['status'], string> = {
  draft: 'Draft', ready: 'Ready', drawing: 'Presentation in progress', 'pending-confirmation': 'Decision required', completed: 'Completed', cancelled: 'Cancelled',
}

const lifecycleTones: Record<DrawSessionQueueItem['session']['status'], BadgeVariant> = {
  draft: 'neutral', ready: 'success', drawing: 'info', 'pending-confirmation': 'pending', completed: 'confirmed', cancelled: 'danger',
}

const relationLabels: Record<Exclude<DrawSessionQueueItem['relation'], 'valid'>, string> = {
  'missing-event': 'Event relation unavailable', 'missing-configuration': 'Draw configuration unavailable', 'missing-category': 'Prize category unavailable',
}

const checkpointStageLabels: Record<string, string> = {
  countdown: 'Countdown in progress', rolling: 'Winner presentation in progress', reveal: 'Winner reveal ready', 'pending-handoff': 'Presentation complete; handoff ready',
}

export function formatQueueTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Updated time unavailable'
  const formatted = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(date)
  return formatted.replace(', ', ' · ')
}

function priorityFor(item: DrawSessionQueueItem): DrawSessionQueuePriority {
  if (item.session.status === 'drawing' || item.session.status === 'pending-confirmation') return 'action-required'
  if (item.session.status === 'completed' || item.session.status === 'cancelled') return 'historical'
  return 'ready'
}

function priorityLabel(priority: DrawSessionQueuePriority): string {
  if (priority === 'action-required') return 'Action required'
  if (priority === 'historical') return 'Historical sessions'
  return 'Ready sessions'
}

function checkpointLabel(item: DrawSessionQueueItem): string {
  if (item.session.status === 'drawing') return item.checkpoint === null ? 'Presentation in progress; resume available' : checkpointStageLabels[item.checkpoint.stage] ?? 'Presentation recovery available'
  if (item.session.status === 'pending-confirmation') return 'Presentation complete; waiting for operator decision'
  if (item.session.status === 'completed') return 'Presentation and operator decision complete'
  if (item.session.status === 'cancelled') return 'Session cancelled; official history preserved'
  if (item.session.status === 'draft') return 'Draw setup is not ready'
  return 'Ready to start presentation'
}

function actionLabel(item: DrawSessionQueueItem): string | null {
  if (item.action === null) return null
  if (item.action.kind === 'setup') return 'Open Draw Setup'
  if (item.action.kind === 'run') return item.session.status === 'drawing' ? 'Resume presentation' : item.session.mode === 'live' ? 'Start Live' : 'Start Practice'
  if (item.action.kind === 'pending') return 'Review Pending Results'
  return 'Open History'
}

export function presentDrawSessionQueueItem(item: DrawSessionQueueItem): DrawSessionQueuePresentation {
  const priority = priorityFor(item)
  return { modeLabel: item.session.mode === 'live' ? 'Live' : 'Practice', modeTone: item.session.mode === 'live' ? 'live' : 'practice', lifecycleLabel: lifecycleLabels[item.session.status], lifecycleTone: lifecycleTones[item.session.status], updatedLabel: formatQueueTimestamp(item.session.updatedAt), checkpointLabel: checkpointLabel(item), priority, priorityLabel: priorityLabel(priority), actionLabel: actionLabel(item), relationLabel: item.relation === 'valid' ? null : relationLabels[item.relation], historical: priority === 'historical' }
}

export function groupDrawSessionQueueItems(items: readonly DrawSessionQueueItem[]): Readonly<Record<DrawSessionQueuePriority, readonly DrawSessionQueueItem[]>> {
  return { 'action-required': items.filter((item) => priorityFor(item) === 'action-required'), ready: items.filter((item) => priorityFor(item) === 'ready'), historical: items.filter((item) => priorityFor(item) === 'historical') }
}
