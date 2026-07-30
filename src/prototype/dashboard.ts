import type {
  AppMode,
  DisplayConnectionStatus,
} from '../domain/types/index.ts'
import type { ReadinessChecklistItem } from '../shared/components/ReadinessChecklist.tsx'
import type { SummaryListItem } from '../shared/components/SummaryList.tsx'

export type DashboardPrototypeScenario = 'ready' | 'attention'

interface DashboardEventSummary {
  name: string
  schedule: string
  venue: string
}

interface DashboardMetric {
  detail: string
  label: string
  tone: 'neutral' | 'success' | 'warning' | 'info'
  value: string
}

interface DashboardRecentActivity {
  detail: string
  label: string
  ticketNumber: string
  timestamp: string
}

export interface DashboardPrototypeData {
  connectionStatus: DisplayConnectionStatus
  event: DashboardEventSummary
  metrics: readonly DashboardMetric[]
  mode: AppMode
  nextDraw: readonly SummaryListItem[]
  readiness: readonly ReadinessChecklistItem[]
  recentActivity: readonly DashboardRecentActivity[]
  scenario: DashboardPrototypeScenario
  status: {
    badge: string
    description: string
    title: string
    tone: 'success' | 'warning' | 'info'
  }
}

export const dashboardPrototypeFixtures = {
  ready: {
    scenario: 'ready',
    mode: 'practice',
    connectionStatus: 'connected',
    event: {
      name: 'Nusantara Tech Gala 2026',
      schedule: '30 July 2026 · 19:00 WIB',
      venue: 'Merak Grand Ballroom, Jakarta',
    },
    status: {
      tone: 'success',
      badge: 'Ready for rehearsal',
      title: 'All critical systems are ready',
      description:
        'Participant data, prize configuration, and the Audience Display are prepared for a Practice run.',
    },
    metrics: [
      {
        label: 'Participants',
        value: '4,820',
        detail: 'Validated prototype records',
        tone: 'info',
      },
      {
        label: 'Checked in',
        value: '3,946',
        detail: '81.9% of participants',
        tone: 'success',
      },
      {
        label: 'Prizes configured',
        value: '8',
        detail: '5 draws remaining',
        tone: 'neutral',
      },
      {
        label: 'Completed draws',
        value: '3',
        detail: '12 confirmed winners',
        tone: 'neutral',
      },
    ],
    readiness: [
      {
        label: 'Participant data',
        detail: '4,820 records passed prototype validation',
        status: 'ready',
      },
      {
        label: 'Prize configuration',
        detail: 'Grand Prize is configured for one winner',
        status: 'ready',
      },
      {
        label: 'Audience Display',
        detail: 'Display preview is connected at 1920 × 1080',
        status: 'ready',
      },
      {
        label: 'Operator rehearsal',
        detail: 'Practice checklist was reviewed at 18:35 WIB',
        status: 'ready',
      },
    ],
    nextDraw: [
      { label: 'Category', value: 'Grand Prize' },
      { label: 'Prize', value: 'Electric Scooter' },
      { label: 'Winner count', value: '1 winner' },
      { label: 'Eligible pool', value: '3,814 tickets' },
      { label: 'Winning rule', value: 'Once per event' },
    ],
    recentActivity: [
      {
        timestamp: '18:42 WIB',
        label: 'Door Prize · Wireless Headphones',
        detail: 'Confirmed in the static prototype',
        ticketNumber: '000784',
      },
      {
        timestamp: '18:28 WIB',
        label: 'Early Bird Prize · Smartwatch',
        detail: 'Confirmed in the static prototype',
        ticketNumber: '004216',
      },
      {
        timestamp: '18:10 WIB',
        label: 'Event rehearsal completed',
        detail: 'Practice presentation only',
        ticketNumber: '001039',
      },
    ],
  },
  attention: {
    scenario: 'attention',
    mode: 'live',
    connectionStatus: 'disconnected',
    event: {
      name: 'Nusantara Tech Gala 2026',
      schedule: '30 July 2026 · 19:00 WIB',
      venue: 'Merak Grand Ballroom, Jakarta',
    },
    status: {
      tone: 'warning',
      badge: 'Action required',
      title: 'Resolve two readiness checks before going Live',
      description:
        'The Audience Display is offline and the latest participant update still needs operator review.',
    },
    metrics: [
      {
        label: 'Participants',
        value: '4,820',
        detail: '24 records need review',
        tone: 'warning',
      },
      {
        label: 'Checked in',
        value: '3,946',
        detail: '81.9% of participants',
        tone: 'success',
      },
      {
        label: 'Prizes configured',
        value: '8',
        detail: '5 draws remaining',
        tone: 'neutral',
      },
      {
        label: 'Completed draws',
        value: '3',
        detail: '12 confirmed winners',
        tone: 'neutral',
      },
    ],
    readiness: [
      {
        label: 'Participant data',
        detail: '24 prototype rows are flagged for operator review',
        status: 'warning',
      },
      {
        label: 'Prize configuration',
        detail: 'Grand Prize is configured for one winner',
        status: 'ready',
      },
      {
        label: 'Audience Display',
        detail: 'No public display connection is available',
        status: 'offline',
      },
      {
        label: 'Operator rehearsal',
        detail: 'Practice checklist was reviewed at 18:35 WIB',
        status: 'ready',
      },
    ],
    nextDraw: [
      { label: 'Category', value: 'Grand Prize' },
      { label: 'Prize', value: 'Electric Scooter' },
      { label: 'Winner count', value: '1 winner' },
      { label: 'Eligible pool', value: 'Pending review' },
      { label: 'Winning rule', value: 'Once per event' },
    ],
    recentActivity: [
      {
        timestamp: '18:48 WIB',
        label: 'Participant review requested',
        detail: '24 static rows marked for review',
        ticketNumber: '000024',
      },
      {
        timestamp: '18:42 WIB',
        label: 'Door Prize · Wireless Headphones',
        detail: 'Confirmed in the static prototype',
        ticketNumber: '000784',
      },
      {
        timestamp: '18:28 WIB',
        label: 'Early Bird Prize · Smartwatch',
        detail: 'Confirmed in the static prototype',
        ticketNumber: '004216',
      },
    ],
  },
} as const satisfies Record<
  DashboardPrototypeScenario,
  DashboardPrototypeData
>

export function resolveDashboardPrototypeScenario(
  searchParams: URLSearchParams,
): DashboardPrototypeScenario {
  return searchParams.get('scenario') === 'attention' ? 'attention' : 'ready'
}

export function getDashboardPrototype(
  scenario: DashboardPrototypeScenario,
): DashboardPrototypeData {
  return dashboardPrototypeFixtures[scenario]
}
