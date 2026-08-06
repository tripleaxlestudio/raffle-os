import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import type { DrawAuthoringDraft, DrawAuthoringRecord } from '../../application/draw/draw-authoring.types.ts'
import type { DrawSetupProductionServices } from '../../application/draw/draw-setup-query.types.ts'
import { queryDrawReadiness } from '../../application/draw/draw-readiness-query.ts'
import type { DrawReadinessResult } from '../../application/draw/draw-readiness.types.ts'
import { DrawAuthoringError } from '../../application/draw/draw-authoring-errors.ts'
import { createDrawSetupProductionServices } from '../../infrastructure/composition/draw-command-production.ts'
import { PageHeader } from '../../shared/components/PageHeader.tsx'
import { StatusBanner } from '../../shared/components/StatusBanner.tsx'
import { Badge, Button, ButtonLink, Card, Checkbox, ConfirmationDialog, Input, Select } from '../../shared/ui/index.ts'
import { signalProductionWorkspaceChanged } from '../../app/workspace/ProductionWorkspaceContext.tsx'

type FormState = {
  eventId: string
  prizeCategoryId: string
  requestedWinners: string
  winningRule: string
  requireCheckIn: boolean
  eligibleGroupFilter: string
  mode: string
  configurationId?: string
  sessionId?: string
}

const emptyForm: FormState = { eventId: '', prizeCategoryId: '', requestedWinners: '1', winningRule: 'once-per-event', requireCheckIn: false, eligibleGroupFilter: '', mode: 'practice' }
const QUICK_WINNER_COUNTS = [1, 3, 6, 10, 20, 50] as const

function formFromRecord(record: DrawAuthoringRecord | null, eventId: string): FormState {
  if (record === null) return { ...emptyForm, eventId }
  return { eventId: record.event.id, prizeCategoryId: record.category.id, requestedWinners: String(record.configuration.requestedWinners), winningRule: record.configuration.winningRule, requireCheckIn: record.configuration.requireCheckIn, eligibleGroupFilter: record.configuration.eligibleGroupFilter ?? '', mode: record.session.mode, configurationId: record.configuration.id, sessionId: record.session.id }
}

function errorText(error: DrawAuthoringError): string {
  return error.message
}

export function DrawSetupPage({ services: suppliedServices }: { services?: DrawSetupProductionServices } = {}) {
  const services = useMemo(() => suppliedServices ?? createDrawSetupProductionServices(), [suppliedServices])
  const navigate = useNavigate()
  const handoffTriggerRef = useRef<HTMLButtonElement>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [record, setRecord] = useState<DrawAuthoringRecord | null>(null)
  const [categories, setCategories] = useState<DrawAuthoringRecord['category'][]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<DrawAuthoringError | null>(null)
  const [saved, setSaved] = useState(false)
  const [eventMissing, setEventMissing] = useState(false)
  const [readiness, setReadiness] = useState<DrawReadinessResult | null>(null)
  const [dirty, setDirty] = useState(false)
  const [confirmLive, setConfirmLive] = useState(false)
  const [handoffBusy, setHandoffBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await services.open()
      if (services.authoringService === undefined) { setError(new DrawAuthoringError('persistence-unavailable', 'Draw authoring services are unavailable.', { retryable: true })); return }
      const activeEventId = await services.preferences.get('activeEventId')
      const result = await services.authoringService.load({ eventId: activeEventId ?? undefined })
      if (!result.ok) { setError(result.error); return }
      setEventMissing(result.event === null)
      setCategories(result.categories as DrawAuthoringRecord['category'][])
      setRecord(result.record)
      setForm(formFromRecord(result.record, result.event?.id ?? activeEventId ?? ''))
      setDirty(false)
      if (result.record !== null && services.checkStorage !== undefined && services.checkCrypto !== undefined) setReadiness(await queryDrawReadiness(result.record.session.id, { ...services, checkStorage: services.checkStorage, checkCrypto: services.checkCrypto }))
      else setReadiness(null)
    } catch (cause: unknown) {
      setError(new DrawAuthoringError('read-failure', 'Authoritative Draw Setup data could not be read.', { retryable: true, cause }))
    } finally { setLoading(false) }
  }, [services])

  useEffect(() => { void Promise.resolve().then(load) }, [load])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setSaved(false); setError(null); setDirty(true); setForm((current) => ({ ...current, [key]: value }))
  }

  async function save() {
    if (saving) return
    setSaving(true); setSaved(false); setError(null)
    const draft: DrawAuthoringDraft = { ...form, eligibleGroupFilter: form.eligibleGroupFilter === '' ? null : form.eligibleGroupFilter }
    if (services.authoringService === undefined) { setError(new DrawAuthoringError('persistence-unavailable', 'Draw authoring services are unavailable.', { retryable: true })); setSaving(false); return }
    const result = await services.authoringService.save(draft)
    if (result.ok) { setRecord(result.record); setForm(formFromRecord(result.record, result.record.event.id)); setDirty(false); setSaved(true); signalProductionWorkspaceChanged(); if (services.checkStorage !== undefined && services.checkCrypto !== undefined) setReadiness(await queryDrawReadiness(result.record.session.id, { ...services, checkStorage: services.checkStorage, checkCrypto: services.checkCrypto })) }
    else setError(result.error)
    setSaving(false)
  }

  const selectedCategory = categories.find((category) => category.id === form.prizeCategoryId)
  const refreshReadiness = async () => {
    if (record === null || services.checkStorage === undefined || services.checkCrypto === undefined) return
    setReadiness(await queryDrawReadiness(record.session.id, { ...services, checkStorage: services.checkStorage, checkCrypto: services.checkCrypto }))
  }
  const handoff = async () => {
    if (handoffBusy || dirty || record === null || readiness?.state !== 'ready') return
    setHandoffBusy(true)
    const latest = services.checkStorage !== undefined && services.checkCrypto !== undefined ? await queryDrawReadiness(record.session.id, { ...services, checkStorage: services.checkStorage, checkCrypto: services.checkCrypto }) : readiness
    setReadiness(latest)
    if (latest.state === 'ready' && latest.data !== undefined) navigate(`/draw/run/${latest.data.session.id}`)
    setHandoffBusy(false)
  }

  if (loading) return <section className="draw-setup" aria-busy="true"><PageHeader eyebrow="Draw authoring" headingId="draw-setup-title" title="Draw Setup" description="Loading persisted Event and configuration…" /><StatusBanner badge="Loading" title="Preparing Draw Setup" tone="info">Configuration drafts are not active until they are saved.</StatusBanner></section>
  if (eventMissing || form.eventId === '') return <section className="draw-setup"><PageHeader eyebrow="Draw authoring" headingId="draw-setup-title" title="Draw Setup" description="No persisted Event is available" /><StatusBanner badge="Event required" title="Create or select an Event first" tone="warning">Draw Setup does not create demo Events or categories automatically.</StatusBanner><ButtonLink to="/events">Open Event management</ButtonLink>{error?.retryable ? <Button onClick={() => void load()}>Retry</Button> : null}</section>

  const started = record !== null && record.session.status !== 'ready'
  const readinessBlocked = readiness !== null && readiness.state !== 'ready'
  const eligibilityNotEvaluated = readiness?.state === 'session-conflict'
  const capacity = dirty ? undefined : readiness?.data
  const readinessTitle = readiness?.state === 'ready' ? 'Draw is ready for handoff' : readiness?.state === 'insufficient-capacity' ? 'Insufficient eligible capacity' : readiness?.state === 'session-conflict' ? 'Another Live session must be resolved' : readiness?.state === 'session-not-ready' ? 'Draw session is not ready' : readiness?.state === 'storage-unavailable' ? 'Local storage is unavailable' : readiness?.state === 'crypto-unavailable' ? 'Secure Web Crypto is unavailable' : readiness?.state === undefined ? 'Readiness has not been evaluated' : 'Draw handoff is blocked'
  const readinessBadge = readiness?.state === 'ready' ? 'Ready' : dirty ? 'Save required' : 'Blocked'
  const readinessTone = readiness?.state === 'ready' ? 'success' : dirty ? 'info' : 'warning'

  return <section aria-labelledby="draw-setup-title" className="draw-setup">
    <PageHeader eyebrow="Draw authoring" headingId="draw-setup-title" title="Draw Setup" description={record?.event.name ?? 'Create a persisted ready session'} />
    {saved ? <StatusBanner badge="Saved" title="Ready DrawSession persisted" tone="success">The values below were read back from local persistence. No winner, checkpoint, or started-draw audit was created.</StatusBanner> : null}
    {error ? <StatusBanner badge={error.retryable ? 'Retryable error' : 'Validation error'} title="Draw Setup could not be saved" tone="warning">{errorText(error)}{error.retryable ? ' You can retry without losing the form values.' : ''}</StatusBanner> : null}
    {started ? <StatusBanner badge="Locked" title="This DrawSession is not editable" tone="warning">The persisted session is {record?.session.status.replace('-', ' ')}. It was not reset to ready and its official data remains untouched.</StatusBanner> : null}
    {categories.length === 0 ? <StatusBanner badge="Category required" title="Create a PrizeCategory before configuring a draw" tone="warning"><ButtonLink to="/prize-categories">Open PrizeCategory management</ButtonLink></StatusBanner> : null}
    <Card className="draw-panel" padding="md">
      <form onSubmit={(event) => { event.preventDefault(); void save() }}>
        <section className="draw-setup-capacity-section" aria-labelledby="capacity-summary-title">
          <div className="draw-setup-section__heading"><div><p className="operator-eyebrow">Capacity</p><h2 id="capacity-summary-title">Eligible pool summary</h2></div></div>
          <dl aria-label="Eligible pool metrics" className="eligible-pool-metrics draw-setup-capacity-metrics">
            <div><dt>Total participants</dt><dd>{capacity?.totalParticipantCount ?? '—'}</dd></div>
            <div><dt>Checked-in participants</dt><dd>{capacity?.checkedInParticipantCount ?? '—'}</dd></div>
            <div><dt>Previous winners excluded</dt><dd>{capacity?.previousWinnerExcludedCount ?? '—'}</dd></div>
            <div className="eligible-pool-metrics__highlight"><dt>Eligible pool</dt><dd>{capacity?.authoritativeEligibleCount ?? '—'}</dd></div>
            <div className="eligible-pool-metrics__highlight eligible-pool-metrics__highlight--secondary"><dt>Requested winners</dt><dd>{capacity?.requestedWinnerCount ?? '—'}</dd></div>
          </dl>
          <div className="draw-setup-capacity-readiness">
            <StatusBanner badge={readinessBadge} title={readinessTitle} tone={readinessTone}>{dirty ? 'Save changes to evaluate eligibility and readiness.' : readiness?.state === 'ready' ? `Storage and secure Web Crypto are ready. ${readiness.data?.authoritativeEligibleCount} eligible participants are available for ${readiness.data?.requestedWinnerCount} requested winners.` : readiness?.reason ?? 'Readiness is being checked.'}{eligibilityNotEvaluated ? ' Eligibility was not evaluated because an active or pending Live session must be resolved first.' : null}{!dirty && readiness?.retryable ? ' Retry readiness after the underlying issue is corrected.' : null}</StatusBanner>
          </div>
        </section>
        <div className="draw-setup__layout">
          <div className="draw-setup__main">
            <section className="draw-setup-section" aria-labelledby="draw-identity-title">
              <div className="draw-setup-section__heading"><div><p className="operator-eyebrow">Draw identity</p><h2 id="draw-identity-title">Event and prize</h2></div><Badge variant={form.mode === 'live' ? 'live' : 'practice'}>{form.mode === 'live' ? 'LIVE' : 'PRACTICE'}</Badge></div>
              <div className="draw-field-grid">
                <Select label="Event" value={form.eventId} onChange={(event) => update('eventId', event.target.value)} disabled><option value={form.eventId}>{record?.event.name ?? form.eventId}</option></Select>
                <Select label="Prize category" value={form.prizeCategoryId} onChange={(event) => update('prizeCategoryId', event.target.value)} disabled={started}><option value="">Select a category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</Select>
                <Input label="Prize name" value={selectedCategory?.prizeName ?? ''} readOnly description="Prize name belongs to the persisted PrizeCategory." />
              </div>
            </section>
            <section className="draw-setup-section" aria-labelledby="winner-quantity-title">
              <div className="draw-setup-section__heading"><h2 id="winner-quantity-title">Winner quantity</h2><span className="draw-setup-section__hint">Saved to DrawConfiguration</span></div>
              <div className="winner-count-controls"><div className="winner-count-controls__presets"><div className="winner-count-choices" aria-label="Quick winner counts">{QUICK_WINNER_COUNTS.map((count) => <Button key={count} type="button" size="sm" variant={form.requestedWinners === String(count) ? 'primary' : 'secondary'} aria-pressed={form.requestedWinners === String(count)} onClick={() => update('requestedWinners', String(count))} disabled={started}>{count}</Button>)}</div><span className="draw-setup-section__hint">Choose a preset or enter 1–100. Save to recalculate readiness.</span></div><Input label="Custom winner count" type="number" min={1} max={100} step={1} value={form.requestedWinners} onChange={(event) => update('requestedWinners', event.target.value)} disabled={started} /></div>
            </section>
            <section className="draw-setup-section" aria-labelledby="eligibility-rules-title">
              <div className="draw-setup-section__heading"><h2 id="eligibility-rules-title">Eligibility rules</h2></div>
              <div className="eligibility-control-grid">
                <Select label="Winning rule" value={form.winningRule} onChange={(event) => update('winningRule', event.target.value)} disabled={started}><option value="once-per-event">Once per event</option><option value="once-per-category">Once per category</option><option value="allow-repeat">Allow repeat</option></Select>
                <Input label="Eligible group filter" value={form.eligibleGroupFilter} onChange={(event) => update('eligibleGroupFilter', event.target.value)} disabled={started} description="Leave empty to include all groups." />
                <Checkbox label="Require participant check-in" checked={form.requireCheckIn} onChange={(event) => update('requireCheckIn', event.target.checked)} disabled={started} description="Only checked-in participants are eligible." />
              </div>
            </section>
          </div>
          <div className="draw-setup__aside">
            <Card className="draw-setup-support-card" padding="md">
            <fieldset className="draw-mode-options"><legend>Authoring mode</legend><div className="draw-mode-options__list">
              <label className="draw-mode-option"><input id="draw-mode-practice" type="radio" name="draw-mode" value="practice" aria-labelledby="draw-mode-practice-label" aria-describedby="draw-mode-practice-description" checked={form.mode === 'practice'} onChange={() => update('mode', 'practice')} disabled={started} /><span className="draw-mode-option__copy"><strong id="draw-mode-practice-label">Practice</strong><small id="draw-mode-practice-description">Rehearsal only. No official result is created.</small></span></label>
              <label className="draw-mode-option"><input id="draw-mode-live" type="radio" name="draw-mode" value="live" aria-labelledby="draw-mode-live-label" aria-describedby="draw-mode-live-description" checked={form.mode === 'live'} onChange={() => update('mode', 'live')} disabled={started} /><span className="draw-mode-option__copy"><strong id="draw-mode-live-label">Live</strong><small id="draw-mode-live-description">Official session. Confirmation is required before starting.</small></span></label>
            </div></fieldset>
            <p>{form.mode === 'live' ? 'Live handoff leads to the official start gate. It does not start a draw here.' : 'Practice is rehearsal only and does not create official results.'} Mode is stored on the ready DrawSession; URL parameters cannot override it.</p>
            <div className="draw-setup-actions">
              <Button type="submit" size="lg" variant={record === null || dirty ? 'primary' : 'secondary'} isLoading={saving} disabled={started || form.prizeCategoryId === ''}>{record === null ? 'Save ready configuration' : 'Save changes'}</Button>
              {saved ? <ButtonLink size="lg" variant="secondary" to="/draw/live">Open Draw Sessions</ButtonLink> : null}
              {record !== null ? <Button ref={handoffTriggerRef} type="button" size="lg" variant={!dirty && !readinessBlocked && readiness !== null ? 'primary' : 'secondary'} disabled={saving || handoffBusy || dirty || readinessBlocked || readiness === null} isLoading={handoffBusy} onClick={() => { if (form.mode === 'live') setConfirmLive(true); else void handoff() }}>{form.mode === 'live' ? 'Continue to Live start gate' : 'Open Practice start gate'}</Button> : null}
              {readiness?.retryable ? <Button type="button" variant="secondary" onClick={() => void refreshReadiness()}>Retry readiness</Button> : null}
            </div>
            </Card>
          </div>
        </div>
      </form>
    </Card>
    <ConfirmationDialog open={confirmLive} title="Confirm Live handoff" confirmLabel="Confirm Live handoff" onCancel={() => { setConfirmLive(false); handoffTriggerRef.current?.focus() }} onConfirm={() => { setConfirmLive(false); void handoff() }} consequence={record === null || readiness?.data === undefined ? 'The persisted Live session will be revalidated before handoff.' : <span>Event: {readiness.data?.event.name}. Prize: {readiness.data?.category.prizeName}. Winners: {readiness.data?.requestedWinnerCount}. Eligible: {readiness.data?.authoritativeEligibleCount}. Mode: Live. This only opens the start gate; it does not select winners.</span>} />
  </section>
}
