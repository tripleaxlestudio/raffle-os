import type {
  PrototypeAudiencePreview,
  PrototypeLiveDrawFixture,
  PrototypeSystemCheck,
} from '../operator-types.ts'
import { drawSetupFixtures } from './draw-setup.fixture.ts'

const ticketStream = Object.freeze([
  '000123',
  '004216',
  '010039',
  '018742',
  '021507',
])

function createAudiencePreview(
  stateLabel: string,
  tickets: readonly string[] = Object.freeze([]),
): PrototypeAudiencePreview {
  const configuration = drawSetupFixtures.ready.configuration

  return Object.freeze({
    eventName: configuration.eventName,
    prizeName: configuration.prizeName,
    resolution: '1920 × 1080',
    stateLabel,
    tickets,
    winnerCount: configuration.winnerCount,
  })
}

const systemChecks = Object.freeze([
  Object.freeze({
    detail: '4,820 deterministic prototype records are available.',
    label: 'Participant data',
    status: 'ready',
  }),
  Object.freeze({
    detail: 'Static rules are present; no eligibility engine is running.',
    label: 'Eligibility configuration',
    status: 'ready',
  }),
  Object.freeze({
    detail: 'Operator preview only; no display connection is attempted.',
    label: 'Audience Display',
    status: 'warning',
  }),
  Object.freeze({
    detail: 'Countdown and rolling values are fixed presentation data.',
    label: 'Presentation sequence',
    status: 'ready',
  }),
  Object.freeze({
    detail: 'Explicit confirmation is required to advance this prototype.',
    label: 'Operator confirmation',
    status: 'warning',
  }),
]) satisfies readonly PrototypeSystemCheck[]

export const liveDrawFixture = Object.freeze({
  audiencePreviews: Object.freeze({
    ready: createAudiencePreview('STANDBY — READY'),
    countdown: createAudiencePreview('COUNTDOWN — 3'),
    rolling: createAudiencePreview('ROLLING PREVIEW', ticketStream),
  }),
  configuration: drawSetupFixtures.ready.configuration,
  eligibility: drawSetupFixtures.ready.eligibility,
  presentation: drawSetupFixtures.ready.presentation,
  staticCountdownValue: '3',
  systemChecks,
  ticketStream,
}) satisfies PrototypeLiveDrawFixture
