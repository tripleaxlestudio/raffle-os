import { beforeEach, describe, expect, it } from 'vitest'
import {
  buildFeedbackReview,
  buildGoogleFormPrefillUrl,
  validateFeedbackDraft,
  type FeedbackDraft,
  type FeedbackMetadata,
} from './feedback-report.ts'
import { GOOGLE_FORM_BASE_URL, GOOGLE_FORM_ENTRIES } from '../../config/feedback.ts'

const draft: FeedbackDraft = {
  reportType: 'Bug',
  title: 'Modal gagal dibuka & layar kosong',
  category: 'Operator UI',
  severity: 'Mengganggu workflow',
  happened: 'Modal tidak muncul setelah tombol diklik.',
  expected: 'Modal laporan tampil tanpa mengubah halaman.',
  reproduction: '1. Buka Dukungan\n2. Klik Laporkan Masalah\n3. Amati layar',
}

const metadata: FeedbackMetadata = {
  appVersion: '0.1.0',
  userAgent: 'Mozilla/5.0 Test Browser',
  origin: 'http://127.0.0.1:47882',
}

beforeEach(() => localStorage.clear())

describe('feedback report builder', () => {
  it('uses the authoritative Google Form base URL and entry IDs', () => {
    expect(GOOGLE_FORM_BASE_URL).toBe('https://docs.google.com/forms/d/e/1FAIpQLSckueKJdrR111voEETSbQoE9zKRnAvLdtM6gUMXlE1845mYFg/viewform')
    expect(GOOGLE_FORM_ENTRIES).toEqual({
      reportType: 'entry.2126261945',
      title: 'entry.1812280332',
      category: 'entry.393791348',
      severity: 'entry.415338700',
      happened: 'entry.313987746',
      expected: 'entry.1710802415',
      reproduction: 'entry.1492394220',
      appVersion: 'entry.1278727189',
      userAgent: 'entry.548231307',
      origin: 'entry.1284846782',
    })
  })

  it('validates every required field', () => {
    expect(validateFeedbackDraft({ reportType: '', title: ' ', category: '', severity: '', happened: '', expected: '', reproduction: '' })).toEqual({
      reportType: 'Field ini wajib diisi.',
      title: 'Field ini wajib diisi.',
      category: 'Field ini wajib diisi.',
      severity: 'Field ini wajib diisi.',
      happened: 'Field ini wajib diisi.',
      expected: 'Field ini wajib diisi.',
      reproduction: 'Field ini wajib diisi.',
    })
  })

  it('maps every explicit field to the configured Google Form entry', () => {
    const result = buildGoogleFormPrefillUrl({ baseUrl: GOOGLE_FORM_BASE_URL, draft, entries: GOOGLE_FORM_ENTRIES, maxUrlLength: 8_000, metadata })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const parsed = new URL(result.url)
    expect(parsed.origin + parsed.pathname).toBe(GOOGLE_FORM_BASE_URL)
    expect(parsed.searchParams.get('usp')).toBe('pp_url')
    expect(parsed.searchParams.get(GOOGLE_FORM_ENTRIES.reportType)).toBe(draft.reportType)
    expect(parsed.searchParams.get(GOOGLE_FORM_ENTRIES.title)).toBe(draft.title)
    expect(parsed.searchParams.get(GOOGLE_FORM_ENTRIES.category)).toBe(draft.category)
    expect(parsed.searchParams.get(GOOGLE_FORM_ENTRIES.severity)).toBe(draft.severity)
    expect(parsed.searchParams.get(GOOGLE_FORM_ENTRIES.happened)).toBe(draft.happened)
    expect(parsed.searchParams.get(GOOGLE_FORM_ENTRIES.expected)).toBe(draft.expected)
    expect(parsed.searchParams.get(GOOGLE_FORM_ENTRIES.reproduction)).toBe(draft.reproduction)
    expect(parsed.searchParams.get(GOOGLE_FORM_ENTRIES.appVersion)).toBe(metadata.appVersion)
    expect(parsed.searchParams.get(GOOGLE_FORM_ENTRIES.userAgent)).toBe(metadata.userAgent)
    expect(parsed.searchParams.get(GOOGLE_FORM_ENTRIES.origin)).toBe(metadata.origin)
    expect(result.review).toContain('Apa yang terjadi?')
    expect(result.review).toContain('Kocokan: 0.1.0')
  })

  it('uses only explicit metadata and never reads sensitive browser storage', () => {
    localStorage.setItem('participant-name', 'SANGAT-RAHASIA-PESERTA')
    localStorage.setItem('ticket-number', '00000999')
    localStorage.setItem('event-name', 'EVENT-PRIVAT')

    const result = buildGoogleFormPrefillUrl({ baseUrl: GOOGLE_FORM_BASE_URL, draft, entries: GOOGLE_FORM_ENTRIES, maxUrlLength: 8_000, metadata })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(`${result.review}\n${result.url}`).not.toContain('SANGAT-RAHASIA-PESERTA')
    expect(`${result.review}\n${result.url}`).not.toContain('00000999')
    expect(`${result.review}\n${result.url}`).not.toContain('EVENT-PRIVAT')
    expect(`${result.review}\n${result.url}`).not.toContain('IndexedDB')
    expect(`${result.review}\n${result.url}`).not.toContain('WebSocket')
  })

  it('rejects an empty or invalid Google Form destination', () => {
    expect(buildGoogleFormPrefillUrl({ baseUrl: '', draft, entries: GOOGLE_FORM_ENTRIES, maxUrlLength: 8_000, metadata })).toMatchObject({ ok: false, code: 'missing-destination' })
    expect(buildGoogleFormPrefillUrl({ baseUrl: 'not a url', draft, entries: GOOGLE_FORM_ENTRIES, maxUrlLength: 8_000, metadata })).toMatchObject({ ok: false, code: 'invalid-destination' })
    expect(buildGoogleFormPrefillUrl({ baseUrl: 'http://example.com/form', draft, entries: GOOGLE_FORM_ENTRIES, maxUrlLength: 8_000, metadata })).toMatchObject({ ok: false, code: 'invalid-destination' })
  })

  it('rejects missing or invalid entry mappings', () => {
    expect(buildGoogleFormPrefillUrl({ baseUrl: GOOGLE_FORM_BASE_URL, draft, entries: { ...GOOGLE_FORM_ENTRIES, title: '' }, maxUrlLength: 8_000, metadata })).toMatchObject({ ok: false, code: 'invalid-entry-mapping' })
    expect(buildGoogleFormPrefillUrl({ baseUrl: GOOGLE_FORM_BASE_URL, draft, entries: { ...GOOGLE_FORM_ENTRIES, origin: 'origin' }, maxUrlLength: 8_000, metadata })).toMatchObject({ ok: false, code: 'invalid-entry-mapping' })
  })

  it('rejects an encoded URL over the configured limit', () => {
    const result = buildGoogleFormPrefillUrl({ baseUrl: GOOGLE_FORM_BASE_URL, draft: { ...draft, happened: 'panjang '.repeat(300) }, entries: GOOGLE_FORM_ENTRIES, maxUrlLength: 300, metadata })
    expect(result).toMatchObject({ ok: false, code: 'url-too-long' })
  })

  it('marks unavailable metadata without inventing values', () => {
    const result = buildGoogleFormPrefillUrl({ baseUrl: GOOGLE_FORM_BASE_URL, draft, entries: GOOGLE_FORM_ENTRIES, maxUrlLength: 8_000, metadata: { appVersion: '', userAgent: '', origin: '' } })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const parsed = new URL(result.url)
    expect(parsed.searchParams.get(GOOGLE_FORM_ENTRIES.appVersion)).toBe('Tidak tersedia')
    expect(parsed.searchParams.get(GOOGLE_FORM_ENTRIES.userAgent)).toBe('Tidak tersedia')
    expect(parsed.searchParams.get(GOOGLE_FORM_ENTRIES.origin)).toBe('Tidak tersedia')
    expect(buildFeedbackReview(draft, { appVersion: '', userAgent: '', origin: '' })).toContain('Kocokan: Tidak tersedia\nUser agent: Tidak tersedia\nOrigin: Tidak tersedia')
  })
})
