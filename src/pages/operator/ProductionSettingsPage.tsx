import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useProductionAudiencePublisher, useProductionWorkspace } from '../../app/workspace/ProductionWorkspaceContext.tsx'
import { appendRuntimeTrace } from '../../application/display-transport/runtime-trace.ts'
import { createEventSettingsService } from '../../application/settings/event-settings-service.ts'
import { createDisplayConfigurationService } from '../../application/display/display-configuration-service.ts'
import { setDisplayConnectionStatus, type DisplayConnectionStatus } from '../../application/display-transport/connection-status.ts'
import type { EventSettings, LocalAsset } from '../../domain/settings/event-settings.types.ts'
import { parseDrawSessionId } from '../../domain/shared/identifiers.ts'
import { createDrawSetupProductionServices } from '../../infrastructure/composition/draw-command-production.ts'
import { PageHeader } from '../../shared/components/PageHeader.tsx'
import { StatusBanner } from '../../shared/components/StatusBanner.tsx'
import { Button } from '../../shared/ui/Button.tsx'

const resolutions = [{ label: '1920 × 1080 (Full HD)', width: 1920, height: 1080 }, { label: '3840 × 2160 (4K UHD)', width: 3840, height: 2160 }, { label: '1280 × 720 (HD)', width: 1280, height: 720 }] as const
const labels: Record<DisplayConnectionStatus, string> = { 'setup-required': 'Setup required', waiting: 'Waiting', connected: 'Connected', reconnecting: 'Reconnecting', unavailable: 'Unavailable', 'publication-failed': 'Publication failed' }
const assetFromFile = (file: File): LocalAsset => ({ name: file.name, type: file.type, size: file.size, blob: file })
function errorText(error: unknown): string { return error instanceof Error ? error.message : 'Settings could not be saved safely.' }

export function ProductionSettingsPage() {
  const workspace = useProductionWorkspace()
  const audience = useProductionAudiencePublisher()
  const services = useMemo(() => createDrawSetupProductionServices(), [])
  const settingsService = useMemo(() => createEventSettingsService(services.eventSettings), [services])
  const displayService = useMemo(() => createDisplayConfigurationService({ events: services.events, configurations: services.displayConfigurations! }), [services])
  const [settings, setSettings] = useState<EventSettings | null>(null)
  const [section, setSection] = useState<'branding' | 'presentation' | 'audio' | 'display'>('branding')
  const [resolution, setResolution] = useState('1920x1080')
  const [settingsState, setSettingsState] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading')
  const [message, setMessage] = useState<string | null>(null)
  const [connection, setConnection] = useState<DisplayConnectionStatus>('waiting')
  const initiallyTestActive = audience.getDiagnostics()?.retainedPublicState === 'display-test'
  const [testing, setTesting] = useState(initiallyTestActive)
  const [testVisibility, setTestVisibility] = useState<'inactive' | 'publishing' | 'visible' | 'stopping' | 'standby' | 'failed'>(initiallyTestActive ? 'visible' : 'inactive')
  const [popupBlocked, setPopupBlocked] = useState(false)
  const [audioMessage, setAudioMessage] = useState('')
  const testVisibilityRef = useRef(testVisibility)
  const settingsRef = useRef(settings)
  useEffect(() => { testVisibilityRef.current = testVisibility }, [testVisibility])
  useEffect(() => { settingsRef.current = settings }, [settings])
  const load = useCallback(async () => {
    if (workspace.status !== 'ready') return
    setSettingsState('loading')
    try { await services.open(); const loaded = await settingsService.readForEvent(workspace.event); setSettings(loaded); setResolution(`${workspace.displayConfiguration?.targetResolution.width ?? 1920}x${workspace.displayConfiguration?.targetResolution.height ?? 1080}`); setSettingsState('ready') } catch (error: unknown) { setSettingsState('error'); setMessage(errorText(error)) }
  }, [services, settingsService, workspace])
  useEffect(() => { void Promise.resolve().then(load) }, [load])
  useEffect(() => audience.subscribe((status) => {
    const retainedState = audience.getDiagnostics()?.retainedPublicState
    if (retainedState === 'display-test') { setTesting(true); setTestVisibility('visible') }
    if (retainedState === 'standby' && testVisibilityRef.current !== 'publishing') { setTesting(false); setTestVisibility('standby') }
    if (status.kind === 'display-ready' || status.kind === 'snapshot-applied') {
      setConnection('connected')
      if (status.kind === 'snapshot-applied' && status.publicState === 'display-test') { setTesting(true); setTestVisibility('visible') }
      if (status.kind === 'snapshot-applied' && status.publicState === 'standby' && testVisibilityRef.current === 'stopping') { setTesting(false); setTestVisibility('standby') }
    }
    if (status.kind === 'transport-error') { setConnection('publication-failed'); setTestVisibility('failed'); setMessage('The display snapshot could not be published safely.') }
  }), [audience])
  if (workspace.status !== 'ready') return <section aria-labelledby="settings-title"><PageHeader eyebrow="Production workspace" headingId="settings-title" title="Settings" description="An active Event is required." /><StatusBanner badge="Event required" title="Display configuration not configured" tone="warning">No editable controls are shown without authoritative Event context. Select an active Event to configure production settings.</StatusBanner><Link className="ui-button ui-button--secondary" to="/events">Open Event management</Link></section>
  if (settings === null) return <section aria-busy="true"><PageHeader eyebrow="Production workspace" headingId="settings-title" title="Settings" description="Reading authoritative Event settings…" />{settingsState === 'error' ? <StatusBanner badge="Storage error" title="Settings unavailable" tone="warning">{message}</StatusBanner> : null}</section>
  const event = workspace.event
  const activeDisplay = workspace.displayConfiguration
  const currentSettings = settings
  const displayUrl = activeDisplay === null ? null : `/display?eventId=${encodeURIComponent(event.id)}&displayConfigurationId=${encodeURIComponent(activeDisplay.id)}`
  const key = activeDisplay === null ? `${event.id}:unconfigured` : `${event.id}:${activeDisplay.id}`
  const selected = resolutions.find((item) => `${item.width}x${item.height}` === resolution) ?? resolutions[0]
  async function save(eventSubmit: FormEvent<HTMLFormElement>) {
    eventSubmit.preventDefault(); setSettingsState('saving'); setMessage(null)
    try { const saved = await settingsService.saveForEvent(event, { ...currentSettings, safeAreaMargin: currentSettings.safeAreaMargin }); if (activeDisplay !== null) await displayService.saveForEvent(event, { targetResolution: { width: selected.width, height: selected.height }, safeAreaMargin: saved.safeAreaMargin, blackoutAppearance: saved.blackoutAppearance === 'event-surface' ? 'pure-black' : saved.blackoutAppearance }, activeDisplay); setSettings(saved); setSettingsState('ready'); setDisplayConnectionStatus(key, 'waiting') } catch (error: unknown) { setSettingsState('error'); setMessage(errorText(error)) }
  }
  function fileChange(field: 'logo' | 'background' | 'revealCue', file: File | undefined) { if (file !== undefined) setSettings((current) => current === null ? current : { ...current, [field]: assetFromFile(file) }) }
  function openAudience() { if (displayUrl === null) return; setPopupBlocked(window.open(displayUrl, '_blank', 'noopener,noreferrer') === null) }
  function stopTest() {
    const publisherDiagnostics = audience.getDiagnostics()
    appendRuntimeTrace({ side: 'Operator', publisherControllerInstanceId: publisherDiagnostics?.publisherInstanceId ?? 'unavailable', scope: publisherDiagnostics === undefined ? undefined : { eventId: event.id, displayId: activeDisplay?.id ?? 'unknown' } }, { messageType: 'test-stopped', direction: 'local' })
    setTestVisibility('stopping'); setTesting(false)
    const parsed = parseDrawSessionId(event.id)
    if (!parsed.ok) { setTestVisibility('failed'); return }
    const result = audience.publish({ drawSessionId: parsed.value, stage: 'standby', blackoutRequested: false, displayTest: false, eventName: currentSettings.displayName, eventSubtitle: currentSettings.subtitle, primaryColor: currentSettings.primaryColor, accentColor: currentSettings.accentColor, logo: currentSettings.logo === undefined ? undefined : { type: currentSettings.logo.type, blob: currentSettings.logo.blob }, background: currentSettings.background === undefined ? undefined : { type: currentSettings.background.type, blob: currentSettings.background.blob }, blackoutAppearance: currentSettings.blackoutAppearance, safeAreaMargin: currentSettings.safeAreaMargin })
    if (!result.ok) setTestVisibility('failed')
  }
  function testConnection() {
    if (activeDisplay === null) return
    const parsed = parseDrawSessionId(event.id); if (!parsed.ok) { setMessage('The active Event cannot safely scope a display test.'); return }
    if (audience.publisher === null) { setMessage('The production Audience publisher is not ready.'); return }
    appendRuntimeTrace({ side: 'Operator', publisherControllerInstanceId: audience.getDiagnostics()?.publisherInstanceId ?? 'unavailable', scope: { eventId: event.id, displayId: activeDisplay.id } }, { messageType: 'test-started', direction: 'local' })
    setTesting(true); setTestVisibility('publishing'); setConnection('waiting'); setDisplayConnectionStatus(key, 'waiting')
    const result = audience.publish({ drawSessionId: parsed.value, stage: 'standby', blackoutRequested: false, displayTest: true, eventName: currentSettings.displayName, eventSubtitle: currentSettings.subtitle, primaryColor: currentSettings.primaryColor, accentColor: currentSettings.accentColor, logo: currentSettings.logo === undefined ? undefined : { type: currentSettings.logo.type, blob: currentSettings.logo.blob }, background: currentSettings.background === undefined ? undefined : { type: currentSettings.background.type, blob: currentSettings.background.blob }, blackoutAppearance: currentSettings.blackoutAppearance, safeAreaMargin: currentSettings.safeAreaMargin })
    if (!result.ok) { setTestVisibility('failed'); setConnection('publication-failed') }
  }
  async function testAudio() { if (!currentSettings.revealCue) { setAudioMessage('Choose a local reveal cue first.'); return } try { const audio = new Audio(URL.createObjectURL(currentSettings.revealCue.blob)); audio.volume = currentSettings.masterVolume / 100; await audio.play(); setAudioMessage('Cue played after your action.'); audio.onended = () => URL.revokeObjectURL(audio.src) } catch { setAudioMessage('Browser audio permission is required; press Test Audio again after allowing playback.') } }
  return <section aria-labelledby="settings-title" className="production-settings"><PageHeader eyebrow="Production workspace" headingId="settings-title" title="Settings" description={`${event.name} · authoritative Event presentation`} />{message ? <StatusBanner badge="Settings" title="Action needs attention" tone="warning">{message}</StatusBanner> : null}<div className="settings-workspace"><nav aria-label="Settings sections" className="settings-section-nav"><p>Settings</p>{(['branding', 'presentation', 'audio', 'display'] as const).map((item) => <button type="button" key={item} className={section === item ? 'is-active' : ''} aria-current={section === item ? 'page' : undefined} onClick={() => setSection(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}</nav><div className="settings-content"><article className="settings-card"><div className="settings-card__heading"><div><p className="settings-card__eyebrow">{section}</p><h2>{section === 'branding' ? 'Event identity' : section === 'presentation' ? 'Presentation behavior' : section === 'audio' ? 'Audio cues' : 'Audience Display'}</h2></div><span className="settings-authority">Persisted</span></div><form onSubmit={save} aria-label={`${section} settings`}>
    {section === 'branding' ? <div className="settings-form-grid settings-form-grid--branding"><label>Public display name<input value={settings.displayName} onChange={(e) => setSettings({ ...settings, displayName: e.target.value })} /></label><label>Public subtitle<input value={settings.subtitle} onChange={(e) => setSettings({ ...settings, subtitle: e.target.value })} /></label><ColorField label="Primary color" value={settings.primaryColor} onChange={(value) => setSettings({ ...settings, primaryColor: value })} /><ColorField label="Accent color" value={settings.accentColor} onChange={(value) => setSettings({ ...settings, accentColor: value })} /><AssetField label="Event logo" asset={settings.logo} accept="image/*" onFile={(file) => fileChange('logo', file)} onRemove={() => setSettings({ ...settings, logo: undefined })} /><AssetField label="16:9 background image" asset={settings.background} accept="image/*" onFile={(file) => fileChange('background', file)} onRemove={() => setSettings({ ...settings, background: undefined })} /></div> : null}
    {section === 'presentation' ? <div className="settings-presentation-grid"><div className="settings-form-grid"><label>Safe-area margin (px)<input type="number" min="0" max="500" value={settings.safeAreaMargin} onChange={(e) => setSettings({ ...settings, safeAreaMargin: Number(e.target.value) })} /><span>Applied to the public Audience content boundary.</span></label><label>Blackout appearance<select value={settings.blackoutAppearance} onChange={(e) => setSettings({ ...settings, blackoutAppearance: e.target.value as EventSettings['blackoutAppearance'] })}><option value="pure-black">Pure black</option><option value="event-surface">Event surface</option></select></label></div><div className="settings-safe-area-preview" aria-label={`Safe-area preview with ${settings.safeAreaMargin}px margin`}><span>Public content boundary</span></div></div> : null}
    {section === 'audio' ? <div className="settings-form-grid"><label>Audio enabled<select value={settings.audioEnabled ? 'enabled' : 'disabled'} onChange={(e) => setSettings({ ...settings, audioEnabled: e.target.value === 'enabled' })}><option value="enabled">Enabled</option><option value="disabled">Disabled</option></select></label><label>Master volume (%)<div className="settings-volume-control"><input type="range" min="0" max="100" value={settings.masterVolume} onChange={(e) => setSettings({ ...settings, masterVolume: Number(e.target.value) })} /><output>{settings.masterVolume}%</output></div></label><AssetField label="Reveal cue audio" asset={settings.revealCue} accept="audio/*" onFile={(file) => fileChange('revealCue', file)} onRemove={() => setSettings({ ...settings, revealCue: undefined })} /><button type="button" className="ui-button ui-button--secondary" onClick={() => void testAudio()}>Play / Test Audio</button><span role="status">{audioMessage}</span></div> : null}
    {section === 'display' ? <div className="settings-display-grid"><div className="settings-form-grid"><label>Target resolution<select value={resolution} onChange={(e) => setResolution(e.target.value)}>{resolutions.map((item) => <option key={item.label} value={`${item.width}x${item.height}`}>{item.label}</option>)}</select></label><p className="settings-helper">The public display uses the saved Branding and Presentation values during the next test.</p></div><div className="settings-display-preview" style={{ '--preview-primary': currentSettings.primaryColor, '--preview-accent': currentSettings.accentColor } as CSSProperties}><strong>{currentSettings.displayName}</strong><span>{currentSettings.subtitle}</span><small>{selected.label} · safe area {currentSettings.safeAreaMargin}px</small></div></div> : null}
    <div className="settings-action-row"><Button disabled={settingsState === 'saving'} type="submit">{settingsState === 'saving' ? 'Saving…' : `Save ${section} settings`}</Button>{section === 'display' && displayUrl !== null ? <button type="button" className="ui-button ui-button--secondary" onClick={openAudience}>Open Audience Display</button> : null}{section === 'display' && displayUrl !== null ? <button type="button" className="ui-button ui-button--primary" disabled={testing} onClick={testConnection}>{testing ? 'Publishing test…' : 'Test Display Connection'}</button> : null}{testing ? <button type="button" className="ui-button ui-button--secondary" onClick={stopTest}>Stop Test</button> : null}</div></form>{section === 'display' ? <div className="settings-display-actions"><div><strong>Connection</strong><span className={`settings-connection settings-connection--${connection}`}>{labels[connection]}</span><span className={`settings-connection settings-connection--${testVisibility}`}>{testVisibility === 'visible' ? 'Test visible on Audience' : testVisibility === 'publishing' ? 'Publishing test' : testVisibility === 'failed' ? 'Publication rejected/failed' : 'Test inactive'}</span><p>Transport connection and public snapshot application are tracked separately.</p></div><details><summary>Publication diagnostics</summary><p>Resolved scope: {event.id} / {activeDisplay?.id ?? 'not configured'}</p><p>Mode: {testVisibility === 'visible' ? 'Test snapshot applied' : testVisibility === 'publishing' ? 'Awaiting Audience application' : 'Standby'}</p></details></div> : null}{popupBlocked ? <div className="settings-popup-fallback" role="alert">The browser blocked the new window. <button type="button" className="ui-button ui-button--secondary" onClick={openAudience}>Open Audience Display</button></div> : null}</article></div></div><p><Link to="/dashboard">Return to Dashboard</Link></p></section>
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="settings-color-field">{label}<span><input type="color" value={value} onChange={(e) => onChange(e.target.value)} /><input aria-label={`${label} hex`} value={value} onChange={(e) => onChange(e.target.value)} /></span></label> }
function AssetField({ label, asset, accept, onFile, onRemove }: { label: string; asset?: LocalAsset; accept: string; onFile: (file: File | undefined) => void; onRemove: () => void }) { return <div className="settings-asset-field"><label>{label}<input type="file" accept={accept} onChange={(e) => onFile(e.target.files?.[0])} /></label>{asset ? <div className="settings-asset-preview"><span>{asset.name} · {(asset.size / 1024).toFixed(0)} KB</span><button type="button" onClick={onRemove}>Remove</button></div> : <small>No local asset selected. Choose a local file to preview it here.</small>}</div> }
