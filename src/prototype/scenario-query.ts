import type { PrototypeImportStep } from './operator-types.ts'

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
