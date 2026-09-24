import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { PHASE8_SETUP_DATASETS, readPhase8Setup, resetPhase8Setup, seedPhase8Setup, type Phase8SetupDatasetId, type Phase8SetupReadback } from '../infrastructure/persistence/seed/phase8-setup.ts'
import { DEFAULT_DATABASE_NAME, RaffleOSDatabase } from '../infrastructure/persistence/db.ts'
import { Button, Card } from '../shared/ui/index.ts'
import { PageHeader } from '../shared/components/PageHeader.tsx'
import { StatusBanner } from '../shared/components/StatusBanner.tsx'

const confirmationText = `DELETE ${DEFAULT_DATABASE_NAME}`

export function Phase8SetupPage() {
  const [dataset, setDataset] = useState<Phase8SetupDatasetId>('ready-basic')
  const [database, setDatabase] = useState(() => new RaffleOSDatabase())
  const [confirmation, setConfirmation] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [readback, setReadback] = useState<Phase8SetupReadback | null>(null)
  const [status, setStatus] = useState<'idle' | 'working' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const selected = useMemo(() => PHASE8_SETUP_DATASETS.find((item) => item.id === dataset) ?? PHASE8_SETUP_DATASETS[0], [dataset])

  async function resetAndLoad() {
    if (status === 'working' || !acknowledged || confirmation !== confirmationText) return
    setStatus('working'); setMessage(null); setReadback(null)
    try {
      await resetPhase8Setup(database, { databaseName: DEFAULT_DATABASE_NAME, acknowledgePermanentDataLoss: true, confirmationText })
      const nextDatabase = new RaffleOSDatabase()
      setDatabase(nextDatabase)
      setReadback(dataset === 'empty-workspace' ? await readPhase8Setup(nextDatabase, dataset) : await seedPhase8Setup(nextDatabase, dataset))
      setStatus('success')
    } catch (cause: unknown) {
      setStatus('error'); setMessage(cause instanceof Error ? cause.message : 'Development setup could not be completed safely.')
    }
  }

  return <main className="dev-setup" aria-labelledby="dev-setup-title">
    <PageHeader eyebrow="Development / testing only" headingId="dev-setup-title" title="Product test setup" description="Deterministic local datasets for owner-driven testing. This route is not part of ordinary production operation." />
    <StatusBanner badge="Development only" title="Local data reset and fixture loading" tone="warning">Reset permanently deletes the local Raffle OS database. Every dataset is written through the validated production seed transaction.</StatusBanner>
    <div className="setup-grid">
      <Card padding="md"><h2>Choose a named dataset</h2><label className="ui-field"><span className="ui-field__label">Dataset</span><select className="ui-input" value={dataset} onChange={(event) => setDataset(event.target.value as Phase8SetupDatasetId)} disabled={status === 'working'}>{PHASE8_SETUP_DATASETS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><p>{selected.description}</p><p>Dataset identity: <code>{selected.id}</code></p></Card>
      <Card padding="md"><h2>Confirm reset</h2><p>Type <code>{confirmationText}</code> exactly, then acknowledge permanent local data loss.</p><label className="ui-field"><span className="ui-field__label">Confirmation text</span><input className="ui-input" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} aria-describedby="reset-help" /></label><p id="reset-help" className="field-description">Required before every reset and dataset load.</p><label className="ui-checkbox"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /> <span>I understand this permanently deletes local data.</span></label><div className="button-row"><Button variant="danger" disabled={status === 'working' || !acknowledged || confirmation !== confirmationText} onClick={() => void resetAndLoad()}>{status === 'working' ? 'Resetting and loading…' : dataset === 'empty-workspace' ? 'Reset to empty workspace' : 'Reset and load dataset'}</Button></div></Card>
    </div>
    {status === 'error' ? <StatusBanner badge="Setup failed" title="No successful setup readback exists" tone="warning">{message}</StatusBanner> : null}
    {readback ? <Card padding="md"><h2>Readback verified</h2><p role="status" aria-live="polite">Dataset <strong>{readback.dataset}</strong> is persisted. Active Event: <code>{readback.activeEventId ?? 'none'}</code>.</p><dl className="summary-list">{Object.entries(readback.counts).map(([key, value]) => <div className="summary-list__item" key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl><h3>Generated production navigation</h3><div className="button-row"><Link className="ui-button ui-button--secondary" to="/dashboard">Open Dashboard</Link>{readback.eventIds[0] ? <Link className="ui-button ui-button--secondary" to={`/events?eventId=${encodeURIComponent(readback.eventIds[0])}`}>Open Event</Link> : null}<Link className="ui-button ui-button--secondary" to="/participants">Open Participants</Link><Link className="ui-button ui-button--secondary" to="/draw/setup">Open Draw Setup</Link><Link className="ui-button ui-button--secondary" to="/draw/live">Open Draw Queue</Link>{readback.sessionIds[0] ? <Link className="ui-button ui-button--secondary" to={`/draw/pending/${encodeURIComponent(readback.sessionIds[0])}`}>Open Pending Results</Link> : null}<Link className="ui-button ui-button--secondary" to="/history">Open History</Link><Link className="ui-button ui-button--secondary" to="/settings">Open Settings</Link>{readback.eventIds[0] && readback.displayConfigurationIds[0] ? <a className="ui-button ui-button--secondary" href={`/display?eventId=${encodeURIComponent(readback.eventIds[0])}&displayConfigurationId=${encodeURIComponent(readback.displayConfigurationIds[0])}`} target="_blank" rel="noreferrer">Open Audience Display</a> : null}</div></Card> : null}
  </main>
}
