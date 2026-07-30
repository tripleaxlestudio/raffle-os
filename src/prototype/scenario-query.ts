import type {
  PrototypeDrawMode,
  PrototypeDrawSetupScenario,
  PrototypeImportStep,
  PrototypeLiveDrawStage,
  PrototypeLiveDrawState,
} from './operator-types.ts'

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
  return `/participants?step=${step}`
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
