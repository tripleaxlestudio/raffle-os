import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, ButtonLink, Card, Icon, Input } from '../../shared/ui/index.ts'
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
    catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'Prize categories could not be read.') }
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
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'Prize category could not be saved.') }
    finally { setSubmitting(false) }
  }

  if (workspace.status === 'loading') return <section aria-busy="true" aria-labelledby="categories-title"><PageHeader eyebrow="Production setup" headingId="categories-title" title="Prize Categories" description="Reading the selected Event…" /><p role="status">Loading Event context…</p></section>
  if (selectedEvent === null) return <section aria-labelledby="categories-title"><PageHeader eyebrow="Production setup" headingId="categories-title" title="Prize Categories" description="Prize categories belong to the explicitly selected Event." /><StatusBanner badge="Event required" title="Select an Event first" tone="warning">Choose a persisted Event before creating or viewing prize categories.</StatusBanner><ButtonLink icon={<Icon name="Trophy" />} to="/events">Open Event management</ButtonLink></section>

  const isReadOnly = selectedEvent.status === 'archived'
  const isFormValid = form.name.trim().length > 0 && form.prizeName.trim().length > 0 && /^(0|[1-9]\d*)$/.test(form.displayOrder)
  return <section className="prize-categories-page" aria-labelledby="categories-title"><div className="page-header"><div className="page-header__copy"><p className="page-header__eyebrow">Production setup</p><h1 id="categories-title">Prize Categories</h1><p className="page-header__description">Manage prize categories for {selectedEvent.name}.</p><p className="prize-categories-page__info">Prize changes apply to future draws. Existing draw records remain unchanged.</p></div></div>
    {saved ? <StatusBanner badge="Saved" title="Prize category saved" tone="success">The category was read back from IndexedDB and is available in Draw Setup.</StatusBanner> : null}
    {error ? <StatusBanner badge="Storage or validation error" title="Prize category action could not be completed" tone="warning">{error}</StatusBanner> : null}
    <div className="prize-categories-page__layout">
      <Card padding="md" className="prize-categories-page__form-card"><div className="prize-categories-page__card-heading"><div><p className="prize-categories-page__eyebrow">{editing === null ? 'New prize category' : 'Edit record'}</p><h2>{editing === null ? 'Create Prize Category' : 'Edit Prize Category'}</h2></div></div>
        <form className="prize-categories-page__form" onSubmit={(event) => { event.preventDefault(); void submit() }}>
          <Input label="Category name" required maxLength={120} disabled={isReadOnly} value={form.name} placeholder="e.g. Door Prize" onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <div className="prize-categories-page__two-column"><Input label="Prize name" required maxLength={160} disabled={isReadOnly} value={form.prizeName} placeholder="e.g. Sepeda" onChange={(event) => setForm({ ...form, prizeName: event.target.value })} /><Input label="Sponsor name" maxLength={120} disabled={isReadOnly} value={form.sponsorName} placeholder="Optional" onChange={(event) => setForm({ ...form, sponsorName: event.target.value })} /></div>
          <label className="ui-field"><span className="ui-field__label">Description</span><textarea className="ui-input" maxLength={500} disabled={isReadOnly} value={form.description} placeholder="Optional details about this prize" onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
          <Input label="Display order" description="Lower numbers appear first." containerClassName="prize-categories-page__order-field" type="number" min={0} step={1} required disabled={isReadOnly} value={form.displayOrder} onChange={(event) => setForm({ ...form, displayOrder: event.target.value })} />
          <div className="prize-categories-page__form-actions"><Button icon={<Icon name={editing === null ? 'Plus' : 'Save'} />} type="submit" disabled={!isFormValid || isReadOnly} isLoading={submitting}>{editing === null ? 'Create Prize Category' : 'Save changes'}</Button>{editing !== null ? <Button icon={<Icon name="X" />} type="button" variant="secondary" onClick={reset}>Cancel</Button> : null}</div>
        </form>
      </Card>
      <Card padding="md" className="prize-categories-page__list-card"><div className="prize-categories-page__card-heading"><div><p className="prize-categories-page__eyebrow">{items.length === 0 ? 'Prize setup' : 'Configured prizes'}</p><h2>Prize Categories</h2></div><span className="prize-categories-page__record-count">{items.length} {items.length === 1 ? 'category' : 'categories'}</span></div>
        {loading ? <p role="status">Loading prize categories…</p> : items.length === 0 ? <div className="prize-categories-page__empty" role="status"><strong>No prize categories yet</strong><p>Create the first category before configuring a draw.</p></div> : <ul className="prize-categories-page__list">{items.map((category) => <li className="prize-categories-page__category-card" key={category.id}><div className="prize-categories-page__category-main"><div className="prize-categories-page__category-heading"><div><h3>{category.name}</h3><p>{category.prizeName}</p></div><span className="prize-categories-page__order">Order {category.displayOrder}</span></div>{category.sponsorName ? <p className="prize-categories-page__sponsor">Sponsored by {category.sponsorName}</p> : null}{category.description ? <p className="prize-categories-page__description">{category.description}</p> : null}</div><div className="prize-categories-page__category-actions"><Button icon={<Icon name="Pencil" />} size="sm" variant="quiet" disabled={isReadOnly} onClick={() => beginEdit(category)}>Edit</Button></div></li>)}</ul>}
      </Card>
    </div>
  </section>
}
