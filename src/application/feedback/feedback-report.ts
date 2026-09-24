export const FEEDBACK_CATEGORIES = [
  'Operator UI',
  'Audience Display',
  'Undian',
  'Import Data',
  'History / Export',
  'Launcher / Installer',
  'Lainnya',
] as const

export const FEEDBACK_SEVERITIES = [
  'Minor',
  'Mengganggu workflow',
  'Blocker',
  'Crash',
] as const

export const FEEDBACK_REPORT_TYPES = [
  'Bug',
  'Feature Request',
  'General Feedback',
] as const

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number]
export type FeedbackSeverity = (typeof FEEDBACK_SEVERITIES)[number]
export type FeedbackReportType = (typeof FEEDBACK_REPORT_TYPES)[number]

export interface FeedbackDraft {
  readonly reportType: string
  readonly title: string
  readonly category: string
  readonly severity: string
  readonly happened: string
  readonly expected: string
  readonly reproduction: string
}

export interface FeedbackMetadata {
  readonly appVersion: string
  readonly userAgent: string
  readonly origin: string
}

export interface GoogleFormEntries {
  readonly reportType: string
  readonly title: string
  readonly category: string
  readonly severity: string
  readonly happened: string
  readonly expected: string
  readonly reproduction: string
  readonly appVersion: string
  readonly userAgent: string
  readonly origin: string
}

export type FeedbackDraftField = keyof FeedbackDraft
export type FeedbackValidationErrors = Partial<Record<FeedbackDraftField, string>>

export type FeedbackFormUrlResult =
  | { readonly ok: true; readonly review: string; readonly url: string }
  | { readonly ok: false; readonly code: 'invalid-form'; readonly errors: FeedbackValidationErrors }
  | { readonly ok: false; readonly code: 'missing-destination' | 'invalid-destination' | 'invalid-entry-mapping' | 'url-too-long'; readonly message: string }

const requiredMessage = 'Field ini wajib diisi.'

export function validateFeedbackDraft(draft: FeedbackDraft): FeedbackValidationErrors {
  const errors: FeedbackValidationErrors = {}
  if (!FEEDBACK_REPORT_TYPES.some((reportType) => reportType === draft.reportType)) errors.reportType = requiredMessage
  if (draft.title.trim() === '') errors.title = requiredMessage
  if (!FEEDBACK_CATEGORIES.some((category) => category === draft.category)) errors.category = requiredMessage
  if (!FEEDBACK_SEVERITIES.some((severity) => severity === draft.severity)) errors.severity = requiredMessage
  if (draft.happened.trim() === '') errors.happened = requiredMessage
  if (draft.expected.trim() === '') errors.expected = requiredMessage
  if (draft.reproduction.trim() === '') errors.reproduction = requiredMessage
  return errors
}

export function buildFeedbackReview(draft: FeedbackDraft, metadata: FeedbackMetadata): string {
  return [
    `Jenis laporan: ${draft.reportType}`,
    `Judul laporan: ${draft.title.trim()}`,
    `Kategori: ${draft.category}`,
    `Tingkat dampak: ${draft.severity}`,
    '',
    'Apa yang terjadi?',
    draft.happened.trim(),
    '',
    'Apa yang seharusnya terjadi?',
    draft.expected.trim(),
    '',
    'Langkah untuk mengulang masalah',
    draft.reproduction.trim(),
    '',
    'Informasi sistem',
    `Kocokan: ${availableOrUnknown(metadata.appVersion)}`,
    `User agent: ${availableOrUnknown(metadata.userAgent)}`,
    `Origin: ${availableOrUnknown(metadata.origin)}`,
  ].join('\n')
}

export function buildGoogleFormPrefillUrl({
  baseUrl,
  draft,
  entries,
  maxUrlLength,
  metadata,
}: {
  readonly baseUrl: string
  readonly draft: FeedbackDraft
  readonly entries: GoogleFormEntries
  readonly maxUrlLength: number
  readonly metadata: FeedbackMetadata
}): FeedbackFormUrlResult {
  const errors = validateFeedbackDraft(draft)
  if (Object.keys(errors).length > 0) return { ok: false, code: 'invalid-form', errors }
  if (baseUrl.trim() === '') return { ok: false, code: 'missing-destination', message: 'Google Form feedback belum dikonfigurasi.' }
  if (!Object.values(entries).every((entry) => /^entry\.\d+$/.test(entry))) {
    return { ok: false, code: 'invalid-entry-mapping', message: 'Konfigurasi field Google Form tidak lengkap atau tidak valid.' }
  }

  let formUrl: URL
  try {
    formUrl = new URL(baseUrl)
  } catch {
    return { ok: false, code: 'invalid-destination', message: 'Alamat Google Form feedback tidak valid.' }
  }
  if (formUrl.protocol !== 'https:') return { ok: false, code: 'invalid-destination', message: 'Google Form feedback harus menggunakan HTTPS.' }

  formUrl.searchParams.set('usp', 'pp_url')
  formUrl.searchParams.set(entries.reportType, draft.reportType)
  formUrl.searchParams.set(entries.title, draft.title.trim())
  formUrl.searchParams.set(entries.category, draft.category)
  formUrl.searchParams.set(entries.severity, draft.severity)
  formUrl.searchParams.set(entries.happened, draft.happened.trim())
  formUrl.searchParams.set(entries.expected, draft.expected.trim())
  formUrl.searchParams.set(entries.reproduction, draft.reproduction.trim())
  formUrl.searchParams.set(entries.appVersion, availableOrUnknown(metadata.appVersion))
  formUrl.searchParams.set(entries.userAgent, availableOrUnknown(metadata.userAgent))
  formUrl.searchParams.set(entries.origin, availableOrUnknown(metadata.origin))
  const url = formUrl.toString()
  if (url.length > maxUrlLength) {
    return {
      ok: false,
      code: 'url-too-long',
      message: 'Laporan terlalu panjang untuk dibuka dengan aman. Pendekkan detail masalah atau langkah reproduksi, lalu coba lagi.',
    }
  }
  return { ok: true, review: buildFeedbackReview(draft, metadata), url }
}

function availableOrUnknown(value: string): string {
  const trimmed = value.trim()
  return trimmed === '' ? 'Tidak tersedia' : trimmed
}
