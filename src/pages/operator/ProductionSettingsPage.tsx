import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useProductionWorkspace } from '../../app/workspace/ProductionWorkspaceContext.tsx'
import { createDisplayConfigurationService } from '../../application/display/display-configuration-service.ts'
import { createOperatorPublisher } from '../../application/display-transport/operator-publisher.ts'
import { createBroadcastChannelTransport } from '../../application/display-transport/transport.ts'
import { setDisplayConnectionStatus, type DisplayConnectionStatus } from '../../application/display-transport/connection-status.ts'
import type { DisplayConfiguration } from '../../domain/display/display-configuration.types.ts'
import { parseDrawSessionId } from '../../domain/shared/identifiers.ts'
import { createDrawSetupProductionServices } from '../../infrastructure/composition/draw-command-production.ts'
import { PageHeader } from '../../shared/components/PageHeader.tsx'
import { StatusBanner } from '../../shared/components/StatusBanner.tsx'
import { Button } from '../../shared/ui/Button.tsx'

const resolutions = [{ label: '1920 × 1080 (Full HD)', width: 1920, height: 1080 }, { label: '3840 × 2160 (4K UHD)', width: 3840, height: 2160 }, { label: '1280 × 720 (HD)', width: 1280, height: 720 }] as const
const statusLabel: Record<DisplayConnectionStatus, string> = { 'setup-required': 'Setup required', waiting: 'Waiting', connected: 'Connected', reconnecting: 'Reconnecting', unavailable: 'Unavailable', 'publication-failed': 'Publication failed' }
function safeError(error: unknown): string { return error instanceof Error ? error.message : 'Display configuration could not be saved safely.' }

export function ProductionSettingsPage() {
  const workspace = useProductionWorkspace()
  const services = useMemo(() => createDrawSetupProductionServices(), [])
  const displayService = useMemo(() => createDisplayConfigurationService({ events: services.events, configurations: services.displayConfigurations! }), [services])
  const [configuration, setConfiguration] = useState<DisplayConfiguration | null>(null)
  const [resolution, setResolution] = useState('1920x1080')
  const [margin, setMargin] = useState('48')
  const [section, setSection] = useState<'presentation' | 'display'>('display')
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'saving' | 'saved' | 'error'>('loading')
  const [message, setMessage] = useState<string | null>(null)
  const [connection, setConnection] = useState<DisplayConnectionStatus>('waiting')
  const [testing, setTesting] = useState(false)
  const [popupBlocked, setPopupBlocked] = useState(false)
  const load = useCallback(async () => {
    if (workspace.status !== 'ready') return
    setState('loading'); setMessage(null)
    try {
      await services.open()
      const current = await displayService.readForEvent(workspace.event)
      setConfiguration(current)
      if (current !== null) { setResolution(`${current.targetResolution.width}x${current.targetResolution.height}`); setMargin(String(current.safeAreaMargin)); setState('ready') } else setState('missing')
    } catch (error: unknown) { setState('error'); setMessage(safeError(error)) }
  }, [displayService, services, workspace])
  useEffect(() => { void Promise.resolve().then(load) }, [load])

  if (workspace.status === 'loading') return <section aria-busy="true"><PageHeader eyebrow="Production workspace" headingId="settings-title" title="Settings" description="Reading the active Event display configuration…" /></section>
  if (workspace.status !== 'ready') return <section aria-labelledby="settings-title"><PageHeader eyebrow="Production workspace" headingId="settings-title" title="Settings" description="Configure a production Audience Display for an active Event." /><StatusBanner badge="Event required" title="Display configuration not configured" tone="warning">No editable controls are shown because there is no authoritative Event context.</StatusBanner><Link className="ui-button ui-button--secondary" to="/events">Open Event management</Link></section>

  const activeEvent = workspace.event
  const selected = resolutions.find((item) => `${item.width}x${item.height}` === resolution) ?? resolutions[0]
  const audienceUrl = configuration === null ? null : `/display?eventId=${encodeURIComponent(activeEvent.id)}&displayConfigurationId=${encodeURIComponent(configuration.id)}`
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (state === 'saving') return
    setState('saving'); setMessage(null)
    void displayService.saveForEvent(activeEvent, { targetResolution: { width: selected.width, height: selected.height }, safeAreaMargin: Number(margin), blackoutAppearance: 'pure-black' }, configuration).then((saved) => { setConfiguration(saved); setState('saved'); setDisplayConnectionStatus(`${activeEvent.id}:${saved.id}`, 'waiting') }).catch((error: unknown) => { setState('error'); setMessage(safeError(error)) })
  }
  function openAudience() {
    if (audienceUrl === null) return
    const popup = window.open(audienceUrl, '_blank', 'noopener,noreferrer')
    setPopupBlocked(popup === null)
  }
  function testConnection() {
    if (configuration === null || testing) return
    const parsed = parseDrawSessionId(activeEvent.id)
    if (!parsed.ok) { setMessage('The active Event identifier cannot safely scope a display test.'); return }
    setTesting(true); setMessage(null); setDisplayConnectionStatus(`${activeEvent.id}:${configuration.id}`, 'waiting')
    const scope = { eventId: activeEvent.id, displayId: configuration.id }
    const publisher = createOperatorPublisher({ transport: createBroadcastChannelTransport('raffle-os-display', scope), transportFactory: () => createBroadcastChannelTransport('raffle-os-display', scope), scope, senderId: `display-test:${activeEvent.id}`, expectedSession: parsed.value, clock: { now: () => new Date().toISOString() as never } })
    const unsubscribe = publisher.subscribe((status) => {
      if (status.kind === 'display-ready') { setConnection('connected'); setDisplayConnectionStatus(`${activeEvent.id}:${configuration.id}`, 'connected') }
      if (status.kind === 'transport-error') { setConnection('publication-failed'); setDisplayConnectionStatus(`${activeEvent.id}:${configuration.id}`, 'publication-failed'); setMessage(status.error.kind === 'transport-unavailable' ? status.error.reason : 'The display-test snapshot could not be published safely.') }
    })
    const result = publisher.start({ drawSessionId: parsed.value, stage: 'standby', blackoutRequested: false, displayTest: true, eventName: activeEvent.name })
    if (!result.ok) { setConnection('publication-failed'); setDisplayConnectionStatus(`${activeEvent.id}:${configuration.id}`, 'publication-failed'); setMessage('The display-test snapshot could not be published safely.') }
    window.setTimeout(() => { unsubscribe(); publisher.close(); setTesting(false) }, 1500)
  }
  return <section aria-labelledby="settings-title" className="production-settings">
    <PageHeader eyebrow="Production workspace" headingId="settings-title" title="Settings" description={`${activeEvent.name} · local authoritative configuration`} />
    {state === 'missing' ? <StatusBanner badge="Configuration required" title="Create the Audience Display configuration" tone="warning">Save the supported display values before launching or testing an Audience window.</StatusBanner> : null}
    {state === 'saved' ? <StatusBanner badge="Saved" title="Display configuration saved" tone="info">The values were read back from local persistence.</StatusBanner> : null}
    {state === 'error' ? <StatusBanner badge="Storage error" title="Display configuration unavailable" tone="warning">{message}</StatusBanner> : null}
    <div className="settings-workspace">
      <nav aria-label="Settings sections" className="settings-section-nav"><p>Settings</p><button type="button" className={section === 'presentation' ? 'is-active' : ''} aria-current={section === 'presentation' ? 'page' : undefined} onClick={() => setSection('presentation')}>Presentation</button><button type="button" className={section === 'display' ? 'is-active' : ''} aria-current={section === 'display' ? 'page' : undefined} onClick={() => setSection('display')}>Display</button><div className="settings-section-nav__note">Branding and Audio are not exposed until authoritative persistence exists.</div></nav>
      <div className="settings-content">
        {section === 'presentation' ? <article className="settings-card"><div className="settings-card__heading"><div><p className="settings-card__eyebrow">Presentation</p><h2>Presentation behavior</h2></div><span className="settings-authority">Persisted</span></div><p className="settings-helper">The current production contract stores presentation-safe margin and blackout appearance with the display configuration.</p><div className="settings-readonly"><strong>Safe-area margin</strong><span>{margin} px · edit in Display</span></div><div className="settings-readonly"><strong>Blackout appearance</strong><span>Pure black · supported value</span></div></article> : <article className="settings-card"><div className="settings-card__heading"><div><p className="settings-card__eyebrow">Display</p><h2>Audience Display</h2></div><span className="settings-authority">Authoritative</span></div><p className="settings-helper">These values are stored per Event and define the production display scope.</p><form onSubmit={save} aria-label="Audience Display configuration"><div className="settings-form-grid"><label>Target resolution<select value={resolution} onChange={(event) => setResolution(event.target.value)} disabled={state === 'saving'}>{resolutions.map((item) => <option key={item.label} value={`${item.width}x${item.height}`}>{item.label}</option>)}</select></label><label>Safe-area margin (px)<input inputMode="numeric" min="0" max="500" required type="number" value={margin} onChange={(event) => setMargin(event.target.value)} disabled={state === 'saving'} /><span>Non-negative, up to 500 px.</span></label><label>Blackout appearance<select value="pure-black" disabled><option value="pure-black">Pure black</option></select><span>Only persisted blackout value currently supported.</span></label></div><div className="settings-action-row"><Button disabled={state === 'saving'} type="submit">{state === 'saving' ? 'Saving…' : 'Save Display Settings'}</Button><span role="status" aria-live="polite">{state === 'saved' ? 'Saved' : state === 'missing' ? 'Unsaved configuration' : state === 'error' ? message : 'Saved configuration'}</span></div></form><div className="settings-display-actions"><div><strong>Connection</strong><span className={`settings-connection settings-connection--${connection}`}>{statusLabel[connection]}</span><p>Responded means an Audience window answered through the scoped production transport.</p></div><div className="settings-action-buttons">{audienceUrl === null ? null : <button type="button" className="ui-button ui-button--secondary" onClick={openAudience}>Open Audience Display</button>}<button type="button" className="ui-button ui-button--secondary" disabled={configuration === null || testing} onClick={testConnection}>{testing ? 'Testing…' : 'Test Display Connection'}</button></div></div>{popupBlocked && audienceUrl !== null ? <div className="settings-popup-fallback" role="alert">The browser blocked the new window. <a href={audienceUrl} target="_blank" rel="noreferrer">Open the production Audience Display</a>.</div> : null}</article>}
      </div>
    </div>
    <p className="sr-only" role="status" aria-live="polite">{message ?? ''}</p><p><Link to="/dashboard">Return to Dashboard</Link></p>
  </section>
}
