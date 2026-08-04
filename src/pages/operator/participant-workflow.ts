export type ParticipantWorkflow = 'production' | 'prototype'

export function resolveParticipantWorkflow(searchParams: URLSearchParams): ParticipantWorkflow {
  return searchParams.get('workflow') === 'prototype' ? 'prototype' : 'production'
}
