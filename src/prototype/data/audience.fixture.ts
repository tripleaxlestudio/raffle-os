import type {
  AudienceWinnerCount,
  PublicAudienceBlackoutScenario,
  PublicAudienceConfirmedScenario,
  PublicAudienceCountdownScenario,
  PublicAudienceDisconnectedScenario,
  PublicAudiencePrizeContext,
  PublicAudienceRollingScenario,
  PublicAudienceStandbyScenario,
  PublicAudienceWinnerRevealScenario,
} from '../audience-types.ts'

const publicEvent = Object.freeze({
  eventName: 'Nusantara Tech Gala 2026',
  eventSubtitle: 'Celebrating ideas that move Indonesia forward',
  prizeCategory: 'Grand Prize',
  prizeLabel: 'Electric Scooter',
  prototypeStatic: true,
} satisfies PublicAudiencePrizeContext)

export const audienceTicketNumbers = Object.freeze([
  '000123',
  '000784',
  '004216',
  '010039',
  '018742',
  '021507',
  '035118',
  '041582',
  '052907',
  '063144',
  '074281',
  '085390',
  '096421',
  '107538',
  '118642',
  '129750',
  '140863',
  '151972',
  '163084',
  '174195',
] as const)

const winnerTicketsByCount = Object.freeze({
  1: Object.freeze(audienceTicketNumbers.slice(0, 1)),
  6: Object.freeze(audienceTicketNumbers.slice(0, 6)),
  10: Object.freeze(audienceTicketNumbers.slice(0, 10)),
  20: Object.freeze(audienceTicketNumbers.slice(0, 20)),
} satisfies Readonly<Record<AudienceWinnerCount, readonly string[]>>)

function createRevealFixture(
  layoutCount: AudienceWinnerCount,
): PublicAudienceWinnerRevealScenario {
  return Object.freeze({
    ...publicEvent,
    layoutCount,
    state: 'winner-reveal',
    statusMessage: 'Results under verification',
    ticketNumbers: winnerTicketsByCount[layoutCount],
  } satisfies PublicAudienceWinnerRevealScenario)
}

function createConfirmedFixture(
  layoutCount: AudienceWinnerCount,
): PublicAudienceConfirmedScenario {
  return Object.freeze({
    ...publicEvent,
    layoutCount,
    state: 'confirmed',
    statusMessage: 'Confirmed',
    ticketNumbers: winnerTicketsByCount[layoutCount],
  } satisfies PublicAudienceConfirmedScenario)
}

const standby = Object.freeze({
  ...publicEvent,
  message: 'Draw will begin shortly',
  state: 'standby',
} satisfies PublicAudienceStandbyScenario)

const countdown = Object.freeze({
  ...publicEvent,
  countdownValue: '3',
  message: 'Get ready',
  state: 'countdown',
} satisfies PublicAudienceCountdownScenario)

const rolling = Object.freeze({
  ...publicEvent,
  message: 'Drawing in progress',
  state: 'rolling',
  ticketNumbers: Object.freeze(audienceTicketNumbers.slice(0, 8)),
} satisfies PublicAudienceRollingScenario)

const blackout = Object.freeze({
  state: 'blackout',
} satisfies PublicAudienceBlackoutScenario)

const disconnected = Object.freeze({
  eventName: publicEvent.eventName,
  eventSubtitle: publicEvent.eventSubtitle,
  prizeCategory: publicEvent.prizeCategory,
  prizeLabel: publicEvent.prizeLabel,
  instruction: 'Please wait for the operator.',
  message: 'Display connection interrupted',
  state: 'disconnected',
} satisfies PublicAudienceDisconnectedScenario)

export const audienceFixtures = Object.freeze({
  blackout,
  confirmed: Object.freeze({
    1: createConfirmedFixture(1),
    6: createConfirmedFixture(6),
    10: createConfirmedFixture(10),
    20: createConfirmedFixture(20),
  }),
  countdown,
  disconnected,
  reveal: Object.freeze({
    1: createRevealFixture(1),
    6: createRevealFixture(6),
    10: createRevealFixture(10),
    20: createRevealFixture(20),
  }),
  rolling,
  standby,
})
