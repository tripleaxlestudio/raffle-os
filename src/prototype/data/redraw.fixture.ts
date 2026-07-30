import type {
  PrototypeRedrawFixture,
  PrototypeRedrawReason,
} from '../operator-types.ts'

const singleOriginal = Object.freeze({
  checkIn: 'Checked in',
  group: 'Bandung Chapter',
  participantName: 'Bima Raharja',
  status: 'pending',
  ticketNumber: '004216',
} as const)

const secondOriginal = Object.freeze({
  checkIn: 'Not checked in',
  group: 'Jakarta Chapter',
  participantName: 'Dimas Santoso',
  status: 'pending',
  ticketNumber: '018742',
} as const)

const reasons = Object.freeze([
  'Participant absent',
  'Invalid ticket',
  'Ineligible participant',
  'Previous winner',
  'Operator error',
  'Other',
]) satisfies readonly PrototypeRedrawReason[]

export const redrawFixture: PrototypeRedrawFixture = Object.freeze({
  singleOriginal,
  multipleOriginals: Object.freeze([singleOriginal, secondOriginal]),
  reasons,
  relationship: Object.freeze({
    originalParticipant: 'Bima Raharja',
    originalTicket: '004216',
    reason: 'Participant absent',
    relationshipText:
      'Original ticket 004216 is shown as cancelled and linked to replacement ticket 035118.',
    replacementParticipant: 'Farhan Akbar',
    replacementTicket: '035118',
  }),
})
