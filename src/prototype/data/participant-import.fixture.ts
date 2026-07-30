import type {
  PrototypeColumnMapping,
  PrototypeImportFile,
  PrototypeImportSummary,
  PrototypeParticipantImportFixture,
  PrototypeParticipantRow,
  PrototypeSourceColumn,
  PrototypeValidationIssue,
} from '../operator-types.ts'

const importFile = Object.freeze({
  fileName: 'nusantara-tech-gala-participants.xlsx',
  fileSize: '284 KB',
  fileType: 'XLSX',
  sheetName: 'Event Participants',
  totalRows: 1_250,
} satisfies PrototypeImportFile)

const sourceColumns = Object.freeze([
  Object.freeze({
    heading: 'Ticket ID',
    samples: Object.freeze(['000123', '004216', '010039']),
  }),
  Object.freeze({
    heading: 'Full Name',
    samples: Object.freeze(['Alya Pranoto', 'Bima Raharja', 'Citra Halim']),
  }),
  Object.freeze({
    heading: 'Email Address',
    samples: Object.freeze([
      'alya@example.test',
      'bima@example.test',
      'citra@example.test',
    ]),
  }),
  Object.freeze({
    heading: 'Mobile Number',
    samples: Object.freeze(['0812 0000 0123', '0813 0000 4216']),
  }),
  Object.freeze({
    heading: 'Department',
    samples: Object.freeze(['Engineering', 'Operations', 'Product']),
  }),
  Object.freeze({
    heading: 'Attendance',
    samples: Object.freeze(['Checked in', 'Not checked in']),
  }),
] satisfies readonly PrototypeSourceColumn[])

const mappings = Object.freeze([
  Object.freeze({
    targetField: 'Ticket Number',
    requirement: 'required',
    sourceColumn: 'Ticket ID',
    sourcePreview: Object.freeze(['000123', '004216', '010039']),
  }),
  Object.freeze({
    targetField: 'Participant Name',
    requirement: 'optional',
    sourceColumn: 'Full Name',
    sourcePreview: Object.freeze([
      'Alya Pranoto',
      'Bima Raharja',
      'Citra Halim',
    ]),
  }),
  Object.freeze({
    targetField: 'Email',
    requirement: 'optional',
    sourceColumn: 'Email Address',
    sourcePreview: Object.freeze([
      'alya@example.test',
      'bima@example.test',
    ]),
  }),
  Object.freeze({
    targetField: 'Phone',
    requirement: 'optional',
    sourceColumn: 'Mobile Number',
    sourcePreview: Object.freeze(['0812 0000 0123', '0813 0000 4216']),
  }),
  Object.freeze({
    targetField: 'Group',
    requirement: 'optional',
    sourceColumn: 'Department',
    sourcePreview: Object.freeze(['Engineering', 'Operations']),
  }),
  Object.freeze({
    targetField: 'Check-in Status',
    requirement: 'optional',
    sourceColumn: null,
    sourcePreview: Object.freeze(['Checked in', 'Not checked in']),
  }),
] satisfies readonly PrototypeColumnMapping[])

const whitespaceIssue = Object.freeze({
  code: 'whitespace-normalized',
  message: 'Leading and trailing whitespace was removed for preview.',
  severity: 'normalization',
} satisfies PrototypeValidationIssue)

const duplicateIssue = Object.freeze({
  code: 'duplicate-ticket',
  message: 'Ticket duplicates the value first shown on row 93.',
  severity: 'warning',
} satisfies PrototypeValidationIssue)

const emptyTicketIssue = Object.freeze({
  code: 'empty-ticket',
  message: 'Ticket Number is empty.',
  severity: 'error',
} satisfies PrototypeValidationIssue)

const missingNameIssue = Object.freeze({
  code: 'missing-name',
  message: 'Participant Name is optional; this blank value remains valid.',
  severity: 'warning',
} satisfies PrototypeValidationIssue)

const malformedEmailIssue = Object.freeze({
  code: 'malformed-email',
  message: 'Email does not match the expected address format.',
  severity: 'error',
} satisfies PrototypeValidationIssue)

const participantRows = Object.freeze([
  Object.freeze({
    rowNumber: 2,
    ticketNumber: '000123',
    participantName: 'Alya Pranoto',
    email: 'alya@example.test',
    group: 'Engineering',
    status: 'valid',
    issues: Object.freeze([]),
  }),
  Object.freeze({
    rowNumber: 15,
    ticketNumber: '004216',
    participantName: 'Bima Raharja',
    email: 'bima@example.test',
    group: 'Operations',
    status: 'valid',
    issues: Object.freeze([whitespaceIssue]),
  }),
  Object.freeze({
    rowNumber: 93,
    ticketNumber: '010039',
    participantName: 'Citra Halim',
    email: 'citra@example.test',
    group: 'Product',
    status: 'valid',
    issues: Object.freeze([]),
  }),
  Object.freeze({
    rowNumber: 128,
    ticketNumber: '010039',
    participantName: 'Citra Halim',
    email: 'citra@example.test',
    group: 'Product',
    status: 'duplicate',
    issues: Object.freeze([duplicateIssue]),
  }),
  Object.freeze({
    rowNumber: 306,
    ticketNumber: '',
    participantName: 'Damar Wijaya',
    email: 'damar@example.test',
    group: 'Finance',
    status: 'invalid',
    issues: Object.freeze([emptyTicketIssue]),
  }),
  Object.freeze({
    rowNumber: 712,
    ticketNumber: '002910',
    participantName: '',
    email: 'guest@example.test',
    group: 'Community',
    status: 'valid',
    issues: Object.freeze([missingNameIssue]),
  }),
  Object.freeze({
    rowNumber: 948,
    ticketNumber: '008745',
    participantName: 'Farah Utami',
    email: 'farah.example.test',
    group: 'Design',
    status: 'invalid',
    issues: Object.freeze([malformedEmailIssue]),
  }),
] satisfies readonly PrototypeParticipantRow[])

const importSummary = Object.freeze({
  totalRows: 1_250,
  validRows: 1_186,
  duplicateRows: 32,
  invalidRows: 32,
  mappedFields: Object.freeze([
    'Ticket Number ← Ticket ID',
    'Participant Name ← Full Name',
    'Email ← Email Address',
    'Phone ← Mobile Number',
    'Group ← Department',
  ]),
  eventTarget: 'Nusantara Tech Gala 2026',
  strategy: 'replace',
  strategyLabel: 'Replace existing participant dataset',
} satisfies PrototypeImportSummary)

export const participantImportFixture = Object.freeze({
  file: importFile,
  sourceColumns,
  mappings,
  rows: participantRows,
  summary: importSummary,
} satisfies PrototypeParticipantImportFixture)
