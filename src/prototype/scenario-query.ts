import type {
  AudienceQueryState,
  AudienceWinnerCount,
  PublicAudienceScenario,
} from './audience-types.ts'
import { audienceFixtures } from './data/audience.fixture.ts'
import type {
  PrototypeDrawMode,
  PrototypeDrawSetupScenario,
  PrototypeHistoryView,
  PrototypeImportStep,
  PrototypeLiveDrawStage,
  PrototypeLiveDrawState,
  PrototypePendingResultsScenario,
  PrototypeRedrawSelection,
  PrototypeResultsPanel,
  PrototypeSettingsSection,
} from './operator-types.ts'

export interface AudienceScenarioQuery {
  readonly count: AudienceWinnerCount
  readonly state: AudienceQueryState
}

function resolveAudienceWinnerCount(
  value: string | null,
): AudienceWinnerCount {
  switch (value) {
    case '6':
      return 6
    case '10':
      return 10
    case '20':
      return 20
    case '1':
    default:
      return 1
  }
}

export function resolveAudienceScenarioQuery(
  searchParams: URLSearchParams,
): AudienceScenarioQuery {
  const count = resolveAudienceWinnerCount(searchParams.get('count'))

  switch (searchParams.get('state')) {
    case 'countdown':
      return { count, state: 'countdown' }
    case 'rolling':
      return { count, state: 'rolling' }
    case 'reveal':
      return { count, state: 'reveal' }
    case 'confirmed':
      return { count, state: 'confirmed' }
    case 'blackout':
      return { count, state: 'blackout' }
    case 'disconnected':
      return { count, state: 'disconnected' }
    case 'standby':
    default:
      return { count, state: 'standby' }
  }
}

export function getAudienceScenarioFixture({
  count,
  state,
}: AudienceScenarioQuery): PublicAudienceScenario {
  switch (state) {
    case 'countdown':
      return audienceFixtures.countdown
    case 'rolling':
      return audienceFixtures.rolling
    case 'reveal':
      return audienceFixtures.reveal[count]
    case 'confirmed':
      return audienceFixtures.confirmed[count]
    case 'blackout':
      return audienceFixtures.blackout
    case 'disconnected':
      return audienceFixtures.disconnected
    case 'standby':
      return audienceFixtures.standby
  }
}

export const prototypeImportSteps = [
  'upload',
  'mapping',
  'validation',
  'summary',
] as const satisfies readonly PrototypeImportStep[]

export function resolvePrototypeImportStep(
  searchParams: URLSearchParams,
): PrototypeImportStep {
  switch (searchParams.get('step')) {
    case 'mapping':
      return 'mapping'
    case 'validation':
      return 'validation'
    case 'summary':
      return 'summary'
    case 'upload':
    default:
      return 'upload'
  }
}

export function getPrototypeImportStepPath(step: PrototypeImportStep) {
  return `/participants?workflow=prototype&step=${step}`
}

export interface PrototypeDrawSetupQuery {
  mode: PrototypeDrawMode
  scenario: PrototypeDrawSetupScenario
}

export interface PrototypeLiveDrawQuery {
  mode: PrototypeDrawMode
  stage: PrototypeLiveDrawStage
  state: PrototypeLiveDrawState
}

export function resolvePrototypeDrawMode(
  value: string | null,
): PrototypeDrawMode {
  return value === 'live' ? 'live' : 'practice'
}

export function resolvePrototypeDrawSetupQuery(
  searchParams: URLSearchParams,
): PrototypeDrawSetupQuery {
  return {
    mode: resolvePrototypeDrawMode(searchParams.get('mode')),
    scenario:
      searchParams.get('scenario') === 'insufficient'
        ? 'insufficient'
        : 'ready',
  }
}

export function resolvePrototypeLiveDrawQuery(
  searchParams: URLSearchParams,
): PrototypeLiveDrawQuery {
  return {
    mode: resolvePrototypeDrawMode(searchParams.get('mode')),
    state: searchParams.get('state') === 'running' ? 'running' : 'ready',
    stage:
      searchParams.get('stage') === 'rolling' ? 'rolling' : 'countdown',
  }
}

export function getPrototypeDrawSetupPath({
  mode,
  scenario,
}: PrototypeDrawSetupQuery) {
  return `/draw/setup?mode=${mode}&scenario=${scenario}`
}

export function getPrototypeLiveDrawPath({
  mode,
  stage,
  state,
}: PrototypeLiveDrawQuery) {
  const stageQuery = state === 'running' ? `&stage=${stage}` : ''
  return `/draw/live?state=${state}&mode=${mode}${stageQuery}`
}

export interface PrototypePendingResultsQuery {
  panel: PrototypeResultsPanel
  scenario: PrototypePendingResultsScenario
  selection: PrototypeRedrawSelection
}

export function resolvePrototypePendingResultsQuery(
  searchParams: URLSearchParams,
): PrototypePendingResultsQuery {
  const scenarioValue = searchParams.get('scenario')
  const panelValue = searchParams.get('panel')

  return {
    scenario:
      scenarioValue === 'partial' || scenarioValue === 'confirmed'
        ? scenarioValue
        : 'pending',
    panel:
      panelValue === 'redraw' || panelValue === 'replacement'
        ? panelValue
        : 'summary',
    selection:
      searchParams.get('selection') === 'multiple'
        ? 'multiple'
        : 'single',
  }
}

export function getPrototypePendingResultsPath({
  panel = 'summary',
  scenario = 'pending',
  selection = 'single',
}: Partial<PrototypePendingResultsQuery> = {}) {
  if (panel === 'summary') {
    return `/draw/results?scenario=${scenario}`
  }

  const selectionQuery =
    panel === 'redraw' ? `&selection=${selection}` : ''
  return `/draw/results?scenario=${scenario}&panel=${panel}${selectionQuery}`
}

export function resolvePrototypeHistoryView(
  searchParams: URLSearchParams,
): PrototypeHistoryView {
  switch (searchParams.get('view')) {
    case 'winners':
      return 'winners'
    case 'audit':
      return 'audit'
    case 'session-detail':
      return 'session-detail'
    case 'sessions':
    default:
      return 'sessions'
  }
}

export function resolvePrototypeSettingsSection(
  searchParams: URLSearchParams,
): PrototypeSettingsSection {
  switch (searchParams.get('section')) {
    case 'presentation':
      return 'presentation'
    case 'audio':
      return 'audio'
    case 'display':
      return 'display'
    case 'branding':
    default:
      return 'branding'
  }
}
