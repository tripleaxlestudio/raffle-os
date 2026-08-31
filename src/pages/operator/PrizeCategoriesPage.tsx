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
    catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'Kategori hadiah tidak dapat dibaca.') }
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
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'Kategori hadiah tidak dapat disimpan.') }
    finally { setSubmitting(false) }
  }

  if (workspace.status === 'loading') return <section aria-busy="true" aria-labelledby="categories-title"><PageHeader eyebrow="Pengaturan produksi" headingId="categories-title" title="Kategori Hadiah" description="Membaca Acara yang dipilih…" /><p role="status">Memuat konteks Acara…</p></section>
  if (selectedEvent === null) return <section aria-labelledby="categories-title"><PageHeader eyebrow="Pengaturan produksi" headingId="categories-title" title="Kategori Hadiah" description="Kategori hadiah terikat pada Acara yang dipilih secara eksplisit." /><StatusBanner badge="Acara diperlukan" title="Pilih Acara terlebih dahulu" tone="warning">Pilih Acara tersimpan sebelum membuat atau melihat kategori hadiah.</StatusBanner><ButtonLink icon={<Icon name="Trophy" />} to="/events">Buka pengelolaan Acara</ButtonLink></section>

  const isReadOnly = selectedEvent.status === 'archived'
  const isFormValid = form.name.trim().length > 0 && form.prizeName.trim().length > 0 && /^(0|[1-9]\d*)$/.test(form.displayOrder)
  return <section className="prize-categories-page" aria-labelledby="categories-title"><div className="page-header"><div className="page-header__copy"><p className="page-header__eyebrow">Pengaturan produksi</p><h1 id="categories-title">Kategori Hadiah</h1><p className="page-header__description">Kelola kategori hadiah untuk {selectedEvent.name}.</p><p className="prize-categories-page__info">Perubahan hadiah berlaku untuk undian berikutnya. Record undian yang sudah ada tidak berubah.</p></div></div>
    {saved ? <StatusBanner badge="Tersimpan" title="Kategori hadiah tersimpan" tone="success">Kategori berhasil dibaca kembali dari IndexedDB dan tersedia di Pengaturan Undian.</StatusBanner> : null}
    {error ? <StatusBanner badge="Kesalahan penyimpanan atau validasi" title="Tindakan kategori hadiah tidak dapat diselesaikan" tone="warning">{error}</StatusBanner> : null}
    <div className="prize-categories-page__layout">
      <Card padding="md" className="prize-categories-page__form-card"><div className="prize-categories-page__card-heading"><div><p className="prize-categories-page__eyebrow">{editing === null ? 'Kategori hadiah baru' : 'Edit record'}</p><h2>{editing === null ? 'Buat Kategori Hadiah' : 'Edit Kategori Hadiah'}</h2></div></div>
        <form className="prize-categories-page__form" onSubmit={(event) => { event.preventDefault(); void submit() }}>
          <Input label="Nama kategori" required maxLength={120} disabled={isReadOnly} value={form.name} placeholder="contoh: Door Prize" onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <div className="prize-categories-page__two-column"><Input label="Nama hadiah" required maxLength={160} disabled={isReadOnly} value={form.prizeName} placeholder="contoh: Sepeda" onChange={(event) => setForm({ ...form, prizeName: event.target.value })} /><Input label="Nama sponsor" maxLength={120} disabled={isReadOnly} value={form.sponsorName} placeholder="Opsional" onChange={(event) => setForm({ ...form, sponsorName: event.target.value })} /></div>
          <label className="ui-field"><span className="ui-field__label">Deskripsi</span><textarea className="ui-input" maxLength={500} disabled={isReadOnly} value={form.description} placeholder="Keterangan opsional tentang hadiah ini" onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
          <Input label="Urutan tampilan" description="Nomor lebih kecil ditampilkan lebih dahulu." containerClassName="prize-categories-page__order-field" type="number" min={0} step={1} required disabled={isReadOnly} value={form.displayOrder} onChange={(event) => setForm({ ...form, displayOrder: event.target.value })} />
          <div className="prize-categories-page__form-actions"><Button icon={<Icon name={editing === null ? 'Plus' : 'Save'} />} type="submit" disabled={!isFormValid || isReadOnly} isLoading={submitting}>{editing === null ? 'Buat Kategori Hadiah' : 'Simpan perubahan'}</Button>{editing !== null ? <Button icon={<Icon name="X" />} type="button" variant="secondary" onClick={reset}>Batal</Button> : null}</div>
        </form>
      </Card>
      <Card padding="md" className="prize-categories-page__list-card"><div className="prize-categories-page__card-heading"><div><p className="prize-categories-page__eyebrow">{items.length === 0 ? 'Pengaturan hadiah' : 'Hadiah yang sudah diatur'}</p><h2>Kategori Hadiah</h2></div><span className="prize-categories-page__record-count">{items.length} kategori</span></div>
        {loading ? <p role="status">Memuat kategori hadiah…</p> : items.length === 0 ? <div className="prize-categories-page__empty" role="status"><strong>Belum ada kategori hadiah</strong><p>Buat kategori pertama sebelum mengatur undian.</p></div> : <ul className="prize-categories-page__list">{items.map((category) => <li className="prize-categories-page__category-card" key={category.id}><div className="prize-categories-page__category-main"><div className="prize-categories-page__category-heading"><div><h3>{category.name}</h3><p>{category.prizeName}</p></div><span className="prize-categories-page__order">Urutan {category.displayOrder}</span></div>{category.sponsorName ? <p className="prize-categories-page__sponsor">Disponsori oleh {category.sponsorName}</p> : null}{category.description ? <p className="prize-categories-page__description">{category.description}</p> : null}</div><div className="prize-categories-page__category-actions"><Button icon={<Icon name="Pencil" />} size="sm" variant="quiet" disabled={isReadOnly} onClick={() => beginEdit(category)}>Edit</Button></div></li>)}</ul>}
      </Card>
    </div>
  </section>
}
