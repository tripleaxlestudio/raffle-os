import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, ButtonLink, Card, Input } from '../../shared/ui/index.ts'
import { PageHeader } from '../../shared/components/PageHeader.tsx'
import { StatusBanner } from '../../shared/components/StatusBanner.tsx'
import { createEventSetupProductionServices } from '../../infrastructure/composition/event-setup-production.ts'
import { signalProductionWorkspaceChanged, useProductionWorkspace } from '../../app/workspace/ProductionWorkspaceContext.tsx'
import type { PrizeCategory } from '../../domain/prizes/prize.types.ts'

const empty = { name: '', prizeName: '', description: '', sponsorName: '', displayOrder: '0' }

export function PrizeCategoriesPage() {
  const services = useMemo(() => createEventSetupProductionServices(), [])
  const workspace = useProductionWorkspace()
  const selectedEvent = workspace.status === 'ready' ? workspace.event : null
  const [items, setItems] = useState<PrizeCategory[]>([])
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState<PrizeCategory | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    if (selectedEvent === null) { setItems([]); setLoading(false); return }
    setLoading(true); setError(null)
    try { await services.open(); setItems(await services.categories.findByEventId(selectedEvent.id)) }
    catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'PrizeCategories could not be read.') }
    finally { setLoading(false) }
  }, [selectedEvent, services])
  useEffect(() => { void Promise.resolve().then(load) }, [load])

  function beginEdit(category: PrizeCategory) { setEditing(category); setForm({ name: category.name, prizeName: category.prizeName, description: category.description ?? '', sponsorName: category.sponsorName ?? '', displayOrder: String(category.displayOrder) }); setSaved(false) }
  function reset() { setEditing(null); setForm(empty) }
  async function submit() {
    if (submitting || selectedEvent === null) return
    setSubmitting(true); setError(null); setSaved(false)
    try {
      const draft = { name: form.name, prizeName: form.prizeName, description: form.description, sponsorName: form.sponsorName, displayOrder: Number(form.displayOrder) }
      if (editing === null) await services.service.createCategory({ eventId: selectedEvent.id, ...draft })
      else await services.service.updateCategory(editing, draft)
      reset(); setSaved(true); signalProductionWorkspaceChanged(); await load()
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'PrizeCategory could not be saved.') }
    finally { setSubmitting(false) }
  }

  if (workspace.status === 'loading') return <section aria-busy="true" aria-labelledby="categories-title"><PageHeader eyebrow="Production setup" headingId="categories-title" title="PrizeCategories" description="Reading the selected Event…" /><p role="status">Loading Event context…</p></section>
  if (selectedEvent === null) return <section aria-labelledby="categories-title"><PageHeader eyebrow="Production setup" headingId="categories-title" title="PrizeCategories" description="PrizeCategories belong to the explicitly selected Event." /><StatusBanner badge="Event required" title="Select an Event first" tone="warning">Choose a persisted Event before creating or viewing PrizeCategories.</StatusBanner><ButtonLink to="/events">Open Event management</ButtonLink></section>
  return <section aria-labelledby="categories-title"><PageHeader eyebrow="Production setup" headingId="categories-title" title="PrizeCategories" description={`Manage categories owned by ${selectedEvent.name}.`} />{saved ? <StatusBanner badge="Saved" title="PrizeCategory saved" tone="success">The category was read back from IndexedDB and is available in Draw Setup.</StatusBanner> : null}{error ? <StatusBanner badge="Storage or validation error" title="PrizeCategory action could not be completed" tone="warning">{error}</StatusBanner> : null}<div className="setup-grid"><Card padding="md"><h2>{editing === null ? 'Create PrizeCategory' : 'Edit draft PrizeCategory'}</h2><form onSubmit={(e) => { e.preventDefault(); void submit() }}><Input label="Category name" required maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><Input label="Prize name" required maxLength={160} value={form.prizeName} onChange={(e) => setForm({ ...form, prizeName: e.target.value })} /><label className="ui-field"><span className="ui-field__label">Description</span><textarea className="ui-input" maxLength={500} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label><Input label="Sponsor name" maxLength={120} value={form.sponsorName} onChange={(e) => setForm({ ...form, sponsorName: e.target.value })} /><Input label="Display order" type="number" min={0} step={1} required value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: e.target.value })} /><div className="page-header__actions"><Button type="submit" isLoading={submitting}>{editing === null ? 'Create PrizeCategory' : 'Save changes'}</Button>{editing !== null ? <Button type="button" variant="secondary" onClick={reset}>Cancel</Button> : null}</div></form></Card><Card padding="md"><h2>Categories for {selectedEvent.name}</h2>{loading ? <p role="status">Loading PrizeCategories…</p> : items.length === 0 ? <p role="status">No PrizeCategories exist for this Event. Create one before configuring a draw.</p> : <ul className="setup-record-list">{items.map((category) => <li className="setup-record" key={category.id}><div><strong>{category.name}</strong><span>{category.prizeName} · order {category.displayOrder}</span><small>Owned by {selectedEvent.name} · created {category.createdAt}</small></div>{selectedEvent.status === 'draft' ? <Button size="sm" variant="quiet" onClick={() => beginEdit(category)}>Edit</Button> : <span aria-label="PrizeCategory is immutable">Read-only</span>}</li>)}</ul>}</Card></div><p><ButtonLink variant="secondary" to="/draw/setup">Back to Draw Setup</ButtonLink></p></section>
}
