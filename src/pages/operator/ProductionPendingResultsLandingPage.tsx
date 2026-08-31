import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge, Button, ButtonLink, Card, Icon } from '../../shared/ui/index.ts'
import { PageHeader } from '../../shared/components/PageHeader.tsx'
import { StatusBanner } from '../../shared/components/StatusBanner.tsx'
import { createDrawSetupProductionServices } from '../../infrastructure/composition/draw-command-production.ts'
import { queryDrawSessionQueue, type DrawSessionQueueResult } from '../../application/draw/draw-session-queue.ts'
import { useProductionWorkspace } from '../../app/workspace/ProductionWorkspaceContext.tsx'
import { ProductionLoadingState, ProductionSetupRequired } from '../../shared/components/ProductionWorkspaceState.tsx'

type LandingState = { readonly status: 'loading' } | { readonly status: 'error'; readonly message: string } | { readonly status: 'ready'; readonly queue: DrawSessionQueueResult }

export function ProductionPendingResultsLandingPage() {
  const workspace = useProductionWorkspace()
  const services = useMemo(() => createDrawSetupProductionServices(), [])
  const [state, setState] = useState<LandingState>({ status: 'loading' })
  const load = useCallback(async () => {
    if (workspace.status !== 'ready') return
    setState({ status: 'loading' })
    try {
      await services.open()
      const queue = await queryDrawSessionQueue(workspace.event.id, services)
      setState(queue === null ? { status: 'error', message: 'Acara aktif tidak dapat dibaca kembali dari penyimpanan lokal.' } : { status: 'ready', queue })
    } catch (cause: unknown) {
      setState({ status: 'error', message: cause instanceof Error ? cause.message : 'Sesi undian yang menunggu konfirmasi tidak dapat dibaca dengan aman.' })
    }
  }, [services, workspace])
  useEffect(() => { void Promise.resolve().then(load) }, [load])

  if (workspace.status === 'loading' || state.status === 'loading') return <section aria-busy="true"><PageHeader eyebrow="Operasi produksi" headingId="pending-landing-title" title="Hasil" description="Membaca sesi resmi yang menunggu konfirmasi…" /><ProductionLoadingState description="Membaca sesi resmi yang menunggu konfirmasi…" /></section>
  if (workspace.status !== 'ready') return <section aria-labelledby="pending-landing-title"><PageHeader eyebrow="Operasi produksi" headingId="pending-landing-title" title="Hasil" description="Acara aktif diperlukan." /><ProductionSetupRequired title="Acara diperlukan untuk meninjau hasil" description="Pilih atau buat Acara sebelum meninjau hasil yang menunggu konfirmasi." /></section>
  if (state.status === 'error') return <section aria-labelledby="pending-landing-title"><PageHeader eyebrow="Operasi produksi" headingId="pending-landing-title" title="Hasil" description="Daftar hasil produksi tidak tersedia." /><StatusBanner badge="Gagal membaca" title="Sesi menunggu konfirmasi tidak dapat dibaca" tone="warning">{state.message}</StatusBanner><Button icon={<Icon name="RefreshCw" />} onClick={() => void load()}>Coba baca lagi</Button></section>

  const pending = state.queue.items.filter((item) => item.session.mode === 'live' && item.session.status === 'pending-confirmation')
  return <section aria-labelledby="pending-landing-title" className="pending-results pending-results--production">
    <PageHeader eyebrow="Operasi produksi" headingId="pending-landing-title" title="Hasil" description={`${state.queue.event.name} · sesi Live belum selesai`} />
    {pending.length === 0 ? <Card padding="lg" className="pending-results__empty-state"><Badge aria-label="Tidak perlu tindakan" className="pending-results__empty-state-icon" variant="success">✓</Badge><div className="pending-results__empty-state-copy"><h2>Tidak ada hasil menunggu konfirmasi</h2><p>Tidak ada hasil Undian yang menunggu peninjauan.</p></div><div className="pending-results__empty-state-actions"><ButtonLink icon={<Icon name="Radio" />} to="/draw/live">Buka Undian</ButtonLink><ButtonLink icon={<Icon name="History" />} variant="secondary" to="/history">Lihat Riwayat</ButtonLink></div></Card> : pending.length === 1 ? <Card padding="md" className="pending-results__landing-card"><div className="pending-results__landing-heading"><p className="operator-eyebrow">MENUNGGU PENINJAUAN</p><Badge variant="pending">MENUNGGU</Badge></div><h2>{pending[0].category?.prizeName ?? 'Hadiah tidak tersedia'}</h2><p className="pending-results__landing-meta">{pending[0].category?.name ?? 'Kategori hadiah tidak tersedia'} · <strong>{pending[0].winnerCount} pemenang</strong></p><p className="pending-results__landing-supporting"><strong>{pending[0].winnerCount}</strong> pemenang menunggu keputusan.</p><ButtonLink icon={<Icon name="ClipboardCheck" />} size="lg" to={`/draw/pending/${pending[0].session.id}`}>Tinjau Pemenang</ButtonLink></Card> : <div className="draw-session-queue" aria-label="Sesi undian menunggu konfirmasi">{pending.map((item) => <Card key={item.session.id} padding="md" className="draw-session-queue__item"><p className="operator-eyebrow">{item.category?.name ?? 'Kategori hadiah tidak tersedia'}</p><h2>{item.category?.prizeName ?? 'Hadiah tidak tersedia'}</h2><p>Diperbarui {item.session.updatedAt}</p><ButtonLink icon={<Icon name="ClipboardCheck" />} to={`/draw/pending/${item.session.id}`}>Tinjau hasil ini</ButtonLink></Card>)}</div>}
  </section>
}
