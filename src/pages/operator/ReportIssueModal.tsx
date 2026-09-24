import { useId, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_REPORT_TYPES,
  FEEDBACK_SEVERITIES,
  buildGoogleFormPrefillUrl,
  validateFeedbackDraft,
  type FeedbackDraft,
  type FeedbackDraftField,
  type FeedbackValidationErrors,
} from '../../application/feedback/feedback-report.ts'
import {
  GOOGLE_FORM_BASE_URL,
  GOOGLE_FORM_ENTRIES,
  GOOGLE_FORM_MAX_URL_LENGTH,
  KOCOKAN_APP_VERSION,
} from '../../config/feedback.ts'
import { openExternalLink, type ExternalLinkOpenResult } from '../../infrastructure/browser/external-link.ts'
import { Button, Icon, Input, Modal, Select } from '../../shared/ui/index.ts'
import { useUiClass } from '../../shared/ui/ui-theme.ts'

const initialDraft: FeedbackDraft = {
  reportType: 'Bug',
  title: '',
  category: '',
  severity: '',
  happened: '',
  expected: '',
  reproduction: '',
}

type ReportPreview = Readonly<{ review: string; title: string; url: string }>

interface ReportIssueModalProps {
  readonly onClose: () => void
  readonly open: boolean
  readonly openLink?: (url: string) => ExternalLinkOpenResult
}

export function ReportIssueModal({ onClose, open, openLink = openExternalLink }: ReportIssueModalProps) {
  const [draft, setDraft] = useState<FeedbackDraft>(initialDraft)
  const [errors, setErrors] = useState<FeedbackValidationErrors>({})
  const [notice, setNotice] = useState<string | null>(null)
  const [preview, setPreview] = useState<ReportPreview | null>(null)
  const metadata = useMemo(() => ({
    appVersion: KOCOKAN_APP_VERSION,
    origin: window.location.origin,
    userAgent: navigator.userAgent,
  }), [])

  function updateField(field: FeedbackDraftField, value: string) {
    setDraft((current) => ({ ...current, [field]: value }))
    setErrors((current) => current[field] === undefined ? current : { ...current, [field]: undefined })
    setNotice(null)
  }

  function closeModal() {
    setPreview(null)
    setNotice(null)
    onClose()
  }

  function reviewReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validationErrors = validateFeedbackDraft(draft)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      setNotice('Lengkapi semua field sebelum meninjau laporan.')
      return
    }

    const result = buildGoogleFormPrefillUrl({
      baseUrl: GOOGLE_FORM_BASE_URL,
      draft,
      entries: GOOGLE_FORM_ENTRIES,
      maxUrlLength: GOOGLE_FORM_MAX_URL_LENGTH,
      metadata,
    })
    if (!result.ok) {
      if (result.code === 'invalid-form') setErrors(result.errors)
      setNotice(result.code === 'invalid-form' ? 'Lengkapi semua field sebelum meninjau laporan.' : result.message)
      return
    }

    setErrors({})
    setNotice(null)
    setPreview({ review: result.review, title: draft.title.trim(), url: result.url })
  }

  function openReport() {
    if (preview === null) return
    if (openLink(preview.url) === 'blocked') {
      setNotice('Browser tidak dapat membuka Form Feedback. Izinkan pop-up untuk Kocokan, lalu coba lagi.')
      return
    }
    setNotice('Form feedback telah dibuka. Tinjau kembali lalu kirim laporan dari Google Forms.')
  }

  return (
    <Modal
      description={preview === null
        ? 'Isi detail tanpa data peserta atau informasi acara. Anda dapat meninjau laporan sebelum Form Feedback dibuka.'
        : 'Pastikan laporan tidak memuat data pribadi atau informasi acara sebelum membuka Form Feedback.'}
      eyebrow="Dukungan"
      footer={preview === null ? <>
        <Button onClick={closeModal} variant="secondary">Batal</Button>
        <Button form="report-issue-form" icon={<Icon name="ClipboardCheck" size={17} />} type="submit">Tinjau Laporan</Button>
      </> : <>
        <Button icon={<Icon name="ArrowLeft" size={17} />} onClick={() => { setPreview(null); setNotice(null) }} variant="secondary">Kembali</Button>
        <Button icon={<Icon name="ExternalLink" size={17} />} onClick={openReport}>Buka Form Feedback</Button>
      </>}
      headerIcon={<Icon name="LifeBuoy" />}
      headerIconTone="info"
      onClose={closeModal}
      open={open}
      showCloseButton={false}
      title="Laporkan Masalah"
    >
      {preview === null ? (
        <form className="kc-report-issue__form" id="report-issue-form" noValidate onSubmit={reviewReport}>
          {notice === null ? null : <ReportNotice message={notice} />}
          <Select label="Jenis laporan" onChange={(event) => updateField('reportType', event.target.value)} required value={draft.reportType}>
            {FEEDBACK_REPORT_TYPES.map((reportType) => <option key={reportType} value={reportType}>{reportType}</option>)}
          </Select>
          <Input
            autoComplete="off"
            error={errors.title}
            label="Judul masalah"
            maxLength={200}
            name="feedback-title"
            onChange={(event) => updateField('title', event.target.value)}
            placeholder="Ringkas masalah dalam satu kalimat"
            required
            value={draft.title}
          />
          <div className="kc-report-issue__selectors">
            <Select error={errors.category} label="Kategori" onChange={(event) => updateField('category', event.target.value)} required value={draft.category}>
              <option value="">Pilih kategori</option>
              {FEEDBACK_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
            </Select>
            <Select error={errors.severity} label="Tingkat dampak" onChange={(event) => updateField('severity', event.target.value)} required value={draft.severity}>
              <option value="">Pilih tingkat dampak</option>
              {FEEDBACK_SEVERITIES.map((severity) => <option key={severity} value={severity}>{severity}</option>)}
            </Select>
          </div>
          <ReportTextarea error={errors.happened} label="Apa yang terjadi?" maxLength={2_000} onChange={(event) => updateField('happened', event.target.value)} value={draft.happened} />
          <ReportTextarea error={errors.expected} label="Apa yang seharusnya terjadi?" maxLength={2_000} onChange={(event) => updateField('expected', event.target.value)} value={draft.expected} />
          <ReportTextarea error={errors.reproduction} label="Langkah untuk mengulang masalah" maxLength={2_500} onChange={(event) => updateField('reproduction', event.target.value)} placeholder={'1.\n2.\n3.'} value={draft.reproduction} />
        </form>
      ) : (
        <div className="kc-report-issue__review">
          {notice === null ? null : <ReportNotice message={notice} tone={notice.startsWith('Form feedback telah dibuka') ? 'info' : 'error'} />}
          <div className="kc-report-issue__review-title">
            <span>Judul laporan</span>
            <strong>{preview.title}</strong>
          </div>
          <div>
            <span className="kc-report-issue__review-label">Ringkasan laporan</span>
            <pre>{preview.review}</pre>
          </div>
          <p className="kc-report-issue__privacy-note"><Icon name="ShieldAlert" size={17} /> Kocokan hanya menambahkan versi aplikasi, user agent, dan origin. Laporan belum dikirim sampai Anda menekan Kirim di Google Forms.</p>
        </div>
      )}
    </Modal>
  )
}

function ReportTextarea({
  error,
  label,
  maxLength,
  onChange,
  placeholder,
  value,
}: {
  readonly error?: string
  readonly label: string
  readonly maxLength: number
  readonly onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void
  readonly placeholder?: string
  readonly value: string
}) {
  const ui = useUiClass()
  const id = useId()
  const errorId = `${id}-error`
  return (
    <label className={ui('ui-field')} htmlFor={id}>
      <span className={ui('ui-field__label')}>{label}</span>
      <textarea
        aria-describedby={error === undefined ? undefined : errorId}
        aria-invalid={error === undefined ? undefined : true}
        className={`${ui('ui-input')} kc-report-issue__textarea`}
        id={id}
        maxLength={maxLength}
        onChange={onChange}
        placeholder={placeholder}
        required
        value={value}
      />
      {error === undefined ? null : <span className={ui('ui-field__error')} id={errorId}>{error}</span>}
    </label>
  )
}

function ReportNotice({ message, tone = 'error' }: { readonly message: string; readonly tone?: 'error' | 'info' }) {
  return <div className={`kc-report-issue__notice kc-report-issue__notice--${tone}`} role={tone === 'error' ? 'alert' : 'status'}><Icon name={tone === 'error' ? 'TriangleAlert' : 'CircleAlert'} size={17} /><span>{message}</span></div>
}
