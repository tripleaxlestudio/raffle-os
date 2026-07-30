import type {
  PrototypePendingResultsFixture,
  PrototypePendingResultsScenario,
  PrototypeResultStatus,
  PrototypeWinnerRecord,
} from '../operator-types.ts'

const winnerIdentities = Object.freeze([
  Object.freeze({
    checkIn: 'Checked in',
    group: 'Jakarta Chapter',
    participantName: 'Alya Pranoto',
    ticketNumber: '000784',
  }),
  Object.freeze({
    checkIn: 'Checked in',
    group: 'Bandung Chapter',
    participantName: 'Bima Raharja',
    ticketNumber: '004216',
  }),
  Object.freeze({
    checkIn: 'Checked in',
    group: 'Surabaya Chapter',
    participantName: 'Citra Maheswari',
    ticketNumber: '010039',
  }),
  Object.freeze({
    checkIn: 'Not checked in',
    group: 'Jakarta Chapter',
    participantName: 'Dimas Santoso',
    ticketNumber: '018742',
  }),
  Object.freeze({
    checkIn: 'Checked in',
    group: 'Medan Chapter',
    participantName: 'Elena Wijaya',
    ticketNumber: '021507',
  }),
  Object.freeze({
    checkIn: 'Checked in',
    group: 'Bali Chapter',
    participantName: 'Farhan Akbar',
    ticketNumber: '035118',
  }),
  Object.freeze({
    checkIn: 'Checked in',
    group: 'Makassar Chapter',
    participantName: 'Gita Anggraini',
    ticketNumber: '041625',
  }),
  Object.freeze({
    checkIn: 'Checked in',
    group: 'Yogyakarta Chapter',
    participantName: 'Hadi Permana',
    ticketNumber: '052903',
  }),
  Object.freeze({
    checkIn: 'Checked in',
    group: 'Semarang Chapter',
    participantName: 'Intan Kurnia',
    ticketNumber: '067144',
  }),
  Object.freeze({
    checkIn: 'Checked in',
    group: 'Palembang Chapter',
    participantName: 'Joko Aditya',
    ticketNumber: '089330',
  }),
])

function createWinners(
  statuses: readonly PrototypeResultStatus[],
): readonly PrototypeWinnerRecord[] {
  return Object.freeze(
    winnerIdentities.map((winner, index) =>
      Object.freeze({
        ...winner,
        replacementTicket:
          statuses[index] === 'cancelled' ? '035118' : undefined,
        status: statuses[index] ?? 'pending',
      }),
    ),
  )
}

function createFixture(
  scenario: PrototypePendingResultsScenario,
  statuses: readonly PrototypeResultStatus[],
  summaryCounts: {
    readonly cancelled: number
    readonly confirmed: number
    readonly pending: number
  },
): PrototypePendingResultsFixture {
  return Object.freeze({
    scenario,
    summary: Object.freeze({
      cancelled: summaryCounts.cancelled,
      confirmed: summaryCounts.confirmed,
      drawSession: 'Grand Prize Session 1',
      eligiblePoolSnapshot: 3814,
      pending: summaryCounts.pending,
      prize: 'Electric Scooter',
      winnerCount: 10,
    }),
    winners: createWinners(statuses),
  })
}

export const pendingResultsFixtures = Object.freeze({
  pending: createFixture(
    'pending',
    Object.freeze(Array.from({ length: 10 }, () => 'pending' as const)),
    { cancelled: 0, confirmed: 0, pending: 10 },
  ),
  partial: createFixture(
    'partial',
    Object.freeze([
      'confirmed',
      'cancelled',
      'confirmed',
      'pending',
      'confirmed',
      'replaced',
      'pending',
      'confirmed',
      'pending',
      'pending',
    ]),
    { cancelled: 1, confirmed: 5, pending: 4 },
  ),
  confirmed: createFixture(
    'confirmed',
    Object.freeze(Array.from({ length: 10 }, () => 'confirmed' as const)),
    { cancelled: 0, confirmed: 10, pending: 0 },
  ),
})
