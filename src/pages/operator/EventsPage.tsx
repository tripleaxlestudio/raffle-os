import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, ButtonLink, Card, Input } from '../../shared/ui/index.ts'
import { PageHeader } from '../../shared/components/PageHeader.tsx'
import { StatusBanner } from '../../shared/components/StatusBanner.tsx'
import { createEventSetupProductionServices } from '../../infrastructure/composition/event-setup-production.ts'
import { signalProductionWorkspaceChanged, useProductionWorkspace } from '../../app/workspace/ProductionWorkspaceContext.tsx'
import type { Event } from '../../domain/events/event.types.ts'
import type { EventId } from '../../domain/shared/identifiers.ts'

type EventSummary = { readonly event: Event; readonly participantCount: number; readonly categoryCount: number; readonly liveSessionCount: number }
const empty = { name: '', description: '', scheduledAt: '' }

export function EventsPage() {
  const services = useMemo(() => createEventSetupProductionServices(), [])
  const workspace = useProductionWorkspace()
  const [items, setItems] = useState<EventSummary[]>([])
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      await services.open()
      const events = await services.events.findAll()
      setItems(await Promise.all(events.map(async (event) => {
        const [participantCount, categories, sessions] = await Promise.all([services.participants.countByEventId(event.id), services.categories.findByEventId(event.id), services.sessions.findByEventId(event.id)])
        return { event, participantCount, categoryCount: categories.length, liveSessionCount: sessions.filter((session) => session.mode === 'live').length }
      })))
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'Events could not be read from local storage.') } finally { setLoading(false) }
  }, [services])
  useEffect(() => { void Promise.resolve().then(load) }, [load])

  function beginEdit(event: Event) { setEditing(event); setForm({ name: event.name, description: event.description ?? '', scheduledAt: event.scheduledAt ?? '' }); setSaved(false); setError(null) }
  function resetForm() { setEditing(null); setForm(empty); setSaved(false) }
  async function submit() {
    if (submitting) return
    setSubmitting(true); setError(null); setSaved(false)
    try {
      if (editing === null) await services.service.createEvent(form)
      else await services.service.updateEvent(editing, form)
      resetForm(); setSaved(true); signalProductionWorkspaceChanged(); await load()
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'The Event could not be saved.') } finally { setSubmitting(false) }
  }
  async function select(eventId: EventId) {
    if (submitting) return
    setSubmitting(true); setError(null)
    try { await services.service.selectEvent(eventId); signalProductionWorkspaceChanged(); await load() }
    catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'The Event could not be selected.') }
    finally { setSubmitting(false) }
  }

  return <section aria-labelledby="events-title">
    <PageHeader eyebrow="Production setup" headingId="events-title" title="Events" description="Create and select the local Event that owns participants, categories, and draw history." />
    {saved ? <StatusBanner badge="Saved" title="Event saved" tone="success">The record was read back from IndexedDB.</StatusBanner> : null}
    {error ? <StatusBanner badge="Storage or validation error" title="Event action could not be completed" tone="warning">{error}</StatusBanner> : null}
    <div className="setup-grid">
      <Card padding="md"><h2>{editing === null ? 'Create Event' : 'Edit draft Event'}</h2><form onSubmit={(event) => { event.preventDefault(); void submit() }}>
        <Input label="Event name" value={form.name} required maxLength={120} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <label className="ui-field"><span className="ui-field__label">Description</span><textarea className="ui-input" maxLength={500} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
        <Input label="Scheduled at (UTC ISO timestamp)" placeholder="2026-08-06T09:00:00.000Z" value={form.scheduledAt} onChange={(event) => setForm({ ...form, scheduledAt: event.target.value })} />
        <div className="page-header__actions"><Button type="submit" isLoading={submitting}>{editing === null ? 'Create Event' : 'Save draft changes'}</Button>{editing !== null ? <Button type="button" variant="secondary" onClick={resetForm}>Cancel</Button> : null}</div>
      </form></Card>
      <Card padding="md"><h2>Persisted Events</h2>{loading ? <p role="status">Loading Events…</p> : items.length === 0 ? <p role="status">No Events exist yet. Create the first Event to begin setup.</p> : <ul className="setup-record-list">{items.map(({ event, participantCount, categoryCount, liveSessionCount }) => <li key={event.id} className={workspace.status === 'ready' && workspace.event.id === event.id ? 'setup-record setup-record--selected' : 'setup-record'}><div><strong>{event.name}</strong><span>{event.status} · {participantCount} participants · {categoryCount} PrizeCategories · {liveSessionCount} Live sessions</span><small>Created {event.createdAt} · Updated {event.updatedAt}</small></div><div className="page-header__actions">{workspace.status === 'ready' && workspace.event.id === event.id ? <span aria-label="Selected Event">Selected / current</span> : <Button size="sm" variant="secondary" disabled={submitting} onClick={() => void select(event.id)}>Open Event</Button>}{event.status === 'draft' ? <Button size="sm" variant="quiet" onClick={() => beginEdit(event)}>Edit draft</Button> : <span aria-label="Event is immutable">Read-only</span>}</div></li>)}</ul>}</Card>
    </div>
    <p><ButtonLink variant="secondary" to="/prize-categories">Manage PrizeCategories</ButtonLink></p>
  </section>
}
