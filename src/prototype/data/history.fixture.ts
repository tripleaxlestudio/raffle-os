import type { PrototypeHistoryFixture } from '../operator-types.ts'
import { redrawFixture } from './redraw.fixture.ts'

const sessions = Object.freeze([
  Object.freeze({
    category: 'Grand Prize',
    dateTime: '29 Jul 2026, 21:18:42 WIB',
    id: 'DRAW-GP-001',
    mode: 'Live',
    operator: 'Rina Hartono',
    prize: 'Electric Scooter',
    status: 'Confirmed with replacement',
    winnerCount: 10,
  }),
  Object.freeze({
    category: 'Door Prize',
    dateTime: '29 Jul 2026, 20:44:10 WIB',
    id: 'DRAW-DP-004',
    mode: 'Live',
    operator: 'Rina Hartono',
    prize: 'Smart Watch',
    status: 'Confirmed',
    winnerCount: 6,
  }),
  Object.freeze({
    category: 'Grand Prize',
    dateTime: '29 Jul 2026, 18:05:00 WIB',
    id: 'PRACTICE-GP-003',
    mode: 'Practice',
    operator: 'Arif Nugroho',
    prize: 'Electric Scooter',
    status: 'Practice complete',
    winnerCount: 10,
  }),
])

const winners = Object.freeze([
  Object.freeze({
    checkIn: 'Checked in',
    group: 'Jakarta Chapter',
    participantName: 'Alya Pranoto',
    status: 'confirmed',
    ticketNumber: '000784',
  }),
  Object.freeze({
    checkIn: 'Checked in',
    group: 'Bandung Chapter',
    participantName: 'Bima Raharja',
    replacementTicket: '035118',
    status: 'cancelled',
    ticketNumber: '004216',
  }),
  Object.freeze({
    checkIn: 'Checked in',
    group: 'Bali Chapter',
    participantName: 'Farhan Akbar',
    status: 'replaced',
    ticketNumber: '035118',
  }),
  Object.freeze({
    checkIn: 'Checked in',
    group: 'Surabaya Chapter',
    participantName: 'Citra Maheswari',
    status: 'confirmed',
    ticketNumber: '010039',
  }),
])

const auditEntries = Object.freeze([
  Object.freeze({
    action: 'Draw opened',
    actor: 'Rina Hartono',
    detail: 'Grand Prize Session 1 opened for static review.',
    timestamp: '29 Jul 2026, 21:15:02 WIB',
  }),
  Object.freeze({
    action: 'Results reviewed',
    actor: 'Rina Hartono',
    detail: 'Ten predetermined winner rows displayed.',
    timestamp: '29 Jul 2026, 21:16:11 WIB',
  }),
  Object.freeze({
    action: 'Winner confirmed',
    actor: 'Rina Hartono',
    detail: 'Prototype ticket 000784 marked Confirmed.',
    timestamp: '29 Jul 2026, 21:16:45 WIB',
  }),
  Object.freeze({
    action: 'Winner cancelled',
    actor: 'Rina Hartono',
    detail: 'Prototype ticket 004216 retained as Cancelled.',
    timestamp: '29 Jul 2026, 21:17:20 WIB',
  }),
  Object.freeze({
    action: 'Redraw reason recorded',
    actor: 'Rina Hartono',
    detail: 'Participant absent shown as the redraw reason.',
    timestamp: '29 Jul 2026, 21:17:31 WIB',
  }),
  Object.freeze({
    action: 'Replacement previewed',
    actor: 'Rina Hartono',
    detail: 'Ticket 004216 linked visually to ticket 035118.',
    timestamp: '29 Jul 2026, 21:17:55 WIB',
  }),
])

export const historyFixture: PrototypeHistoryFixture = Object.freeze({
  auditEntries,
  sessions,
  winners,
  sessionDetail: Object.freeze({
    configuration: Object.freeze([
      Object.freeze({ label: 'Category', value: 'Grand Prize' }),
      Object.freeze({ label: 'Prize', value: 'Electric Scooter' }),
      Object.freeze({ label: 'Winner count', value: '10' }),
      Object.freeze({ label: 'Check-in rule', value: 'Required' }),
      Object.freeze({ label: 'Winning rule', value: 'Once per event' }),
      Object.freeze({ label: 'Mode', value: 'Live prototype' }),
    ]),
    eligiblePoolSnapshot: 3814,
    relationship: redrawFixture.relationship,
    session: sessions[0],
  }),
})
