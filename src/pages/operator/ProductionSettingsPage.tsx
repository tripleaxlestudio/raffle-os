import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useProductionWorkspace } from '../../app/workspace/ProductionWorkspaceContext.tsx'
import { createDisplayConfigurationService } from '../../application/display/display-configuration-service.ts'
import type { DisplayConfiguration } from '../../domain/display/display-configuration.types.ts'
import { createDrawSetupProductionServices } from '../../infrastructure/composition/draw-command-production.ts'
import { PageHeader } from '../../shared/components/PageHeader.tsx'
import { StatusBanner } from '../../shared/components/StatusBanner.tsx'
import { Button } from '../../shared/ui/Button.tsx'

const resolutions = [{ label: '1920 × 1080 (Full HD)', width: 1920, height: 1080 }, { label: '3840 × 2160 (4K UHD)', width: 3840, height: 2160 }, { label: '1280 × 720 (HD)', width: 1280, height: 720 }] as const

function safeError(error: unknown): string { return error instanceof Error ? error.message : 'Display configuration could not be saved safely.' }

export function ProductionSettingsPage() {
  const workspace = useProductionWorkspace()
  const services = useMemo(() => createDrawSetupProductionServices(), [])
  const displayService = useMemo(() => createDisplayConfigurationService({ events: services.events, configurations: services.displayConfigurations! }), [services])
  const [configuration, setConfiguration] = useState<DisplayConfiguration | null>(null)
  const [resolution, setResolution] = useState('1920x1080')
  const [margin, setMargin] = useState('48')
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'saving' | 'saved' | 'error'>('loading')
  const [message, setMessage] = useState<string | null>(null)
  const load = useCallback(async () => {
    if (workspace.status !== 'ready') return
    setState('loading'); setMessage(null)
    try {
      await services.open()
      const current = await displayService.readForEvent(workspace.event)
      setConfiguration(current)
      if (current !== null) { setResolution(`${current.targetResolution.width}x${current.targetResolution.height}`); setMargin(String(current.safeAreaMargin)); setState('ready') }
      else setState('missing')
    } catch (error: unknown) { setState('error'); setMessage(safeError(error)) }
  }, [displayService, services, workspace])
  useEffect(() => { void Promise.resolve().then(load) }, [load])

  if (workspace.status === 'loading') return <section aria-busy="true"><PageHeader eyebrow="Production workspace" headingId="settings-title" title="Settings" description="Reading the active Event display configuration…" /></section>
  if (workspace.status !== 'ready') return <section aria-labelledby="settings-title"><PageHeader eyebrow="Production workspace" headingId="settings-title" title="Settings" description="Display configuration is not configured for an active Event." /><StatusBanner badge="Event required" title="Display configuration not configured" tone="warning">No editable controls are shown because there is no authoritative Event context.</StatusBanner><Link className="ui-button ui-button--secondary" to="/events">Open Event management</Link></section>
  const activeEvent = workspace.event

  const selected = resolutions.find((item) => `${item.width}x${item.height}` === resolution) ?? resolutions[0]
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (state === 'saving') return
    setState('saving'); setMessage(null)
    try { const saved = await displayService.saveForEvent(activeEvent, { targetResolution: { width: selected.width, height: selected.height }, safeAreaMargin: Number(margin), blackoutAppearance: 'pure-black' }, configuration); setConfiguration(saved); setState('saved') }
    catch (error: unknown) { setState('error'); setMessage(safeError(error)) }
  }
  const launch = configuration === null ? null : `/display?eventId=${encodeURIComponent(activeEvent.id)}&displayConfigurationId=${encodeURIComponent(configuration.id)}`
  return <section aria-labelledby="settings-title" className="draw-setup">
    <PageHeader eyebrow="Production workspace" headingId="settings-title" title="Audience Display Settings" description={`${activeEvent.name} · authoritative Event configuration`} />
    {state === 'missing' ? <StatusBanner badge="Configuration required" title="Create the Audience Display configuration" tone="warning">Save the supported display values below before launching an Audience window.</StatusBanner> : null}
    {state === 'saved' ? <StatusBanner badge="Saved" title="Display configuration saved" tone="info">The configuration was read back from local persistence and is ready for Audience launch.</StatusBanner> : null}
    {state === 'error' ? <StatusBanner badge="Storage error" title="Display configuration unavailable" tone="warning">{message}</StatusBanner> : null}
    <form onSubmit={(event) => void save(event)} aria-label="Audience Display configuration">
      <fieldset disabled={state === 'saving'}><legend>Presentation</legend><label htmlFor="resolution">Target resolution</label><select id="resolution" value={resolution} onChange={(event) => setResolution(event.target.value)}>{resolutions.map((item) => <option key={item.label} value={`${item.width}x${item.height}`}>{item.label}</option>)}</select><label htmlFor="safe-area">Safe-area margin (px)</label><input id="safe-area" inputMode="numeric" min="0" max="500" required type="number" value={margin} onChange={(event) => setMargin(event.target.value)} /><label htmlFor="blackout">Blackout appearance</label><select id="blackout" value="pure-black" disabled><option value="pure-black">Pure black</option></select></fieldset>
      <div className="button-row"><Button disabled={state === 'saving'} type="submit">{state === 'saving' ? 'Saving…' : 'Save display settings'}</Button>{launch === null ? null : <a className="ui-button ui-button--secondary" href={launch} target="_blank" rel="noreferrer">Open Audience Display</a>}</div>
    </form>
    <p role="status" aria-live="polite">{state === 'saving' ? 'Saving authoritative display settings.' : state === 'error' ? message : ''}</p>
    <p><Link to="/dashboard">Return to Dashboard</Link></p>
  </section>
}
