import type {
  PrototypeAudiencePreview,
  PrototypeDrawConfiguration,
  PrototypeDrawSetupFixture,
  PrototypeEligibilitySummary,
  PrototypePresentationSequence,
} from '../operator-types.ts'

const presentationSequence = Object.freeze({
  audioCue: 'Grand reveal cue (silent prototype)',
  celebrationEffect: 'Confetti burst (visual only)',
  countdownEnabled: true,
  countdownSeconds: 5,
  reducedMotionSafe: true,
  revealStyle: 'Spotlight reveal',
  rollingSeconds: 8,
}) satisfies PrototypePresentationSequence

const readyConfiguration = Object.freeze({
  category: 'Grand Prize',
  eventName: 'Nusantara Tech Gala 2026',
  internalNote: 'Confirm stage manager clearance before presentation.',
  prizeName: 'Electric Scooter',
  winnerCount: 1,
  winningFrequency: 'event',
  winningFrequencyLabel: 'Once per event',
}) satisfies PrototypeDrawConfiguration

const insufficientConfiguration = Object.freeze({
  ...readyConfiguration,
  winnerCount: 20,
}) satisfies PrototypeDrawConfiguration

const readyEligibility = Object.freeze({
  checkedInParticipants: 3_946,
  eligibleParticipants: 3_814,
  excludedPreviousWinners: 64,
  participantGroup: 'All checked-in participants',
  requestedWinners: 1,
  totalParticipants: 4_820,
}) satisfies PrototypeEligibilitySummary

const insufficientEligibility = Object.freeze({
  checkedInParticipants: 16,
  eligibleParticipants: 12,
  excludedPreviousWinners: 4,
  participantGroup: 'VIP finalists',
  requestedWinners: 20,
  totalParticipants: 4_820,
}) satisfies PrototypeEligibilitySummary

function createAudiencePreview(
  configuration: PrototypeDrawConfiguration,
  stateLabel: string,
): PrototypeAudiencePreview {
  return Object.freeze({
    eventName: configuration.eventName,
    prizeName: configuration.prizeName,
    resolution: '1920 × 1080',
    stateLabel,
    tickets: Object.freeze([]),
    winnerCount: configuration.winnerCount,
  })
}

export const drawSetupFixtures = Object.freeze({
  ready: Object.freeze({
    audiencePreview: createAudiencePreview(
      readyConfiguration,
      'READY FOR REVIEW',
    ),
    configuration: readyConfiguration,
    eligibility: readyEligibility,
    presentation: presentationSequence,
    scenario: 'ready',
  }),
  insufficient: Object.freeze({
    audiencePreview: createAudiencePreview(
      insufficientConfiguration,
      'SETUP BLOCKED',
    ),
    configuration: insufficientConfiguration,
    eligibility: insufficientEligibility,
    presentation: presentationSequence,
    scenario: 'insufficient',
  }),
}) satisfies Readonly<
  Record<'ready' | 'insufficient', PrototypeDrawSetupFixture>
>
