import { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { parseTicketNumber } from '../../../../src/domain/participants/participant.invariants.ts'
import { parseWinnerRecordId } from '../../../../src/domain/shared/identifiers.ts'
import type { Result } from '../../../../src/domain/shared/result.ts'
import type { WinnerRecord } from '../../../../src/domain/winners/winner.types.ts'
import { PendingResultsSummary, PendingWinnerGrid, ReasonSelect } from '../../../../src/pages/operator/ProductionPendingResultsPage.tsx'
import { Badge, Button, Card, Icon, Modal } from '../../../../src/shared/ui/index.ts'
import { UiThemeContext } from '../../../../src/shared/ui/ui-theme.ts'
import '../../../../src/styles/app.css'

function valid<T>(result: Result<T>): T {
  if (!result.ok) throw new Error('Invalid Slice 4 visual fixture')
  return result.value
}

function fixtureWinner(sequenceNumber: number, status: WinnerRecord['status'] = 'pending') {
  const suffix = sequenceNumber.toString().padStart(12, '0')
  return {
    id: valid(parseWinnerRecordId(`00000000-0000-4000-8000-${suffix}`)),
    sequenceNumber,
    ticketNumber: valid(parseTicketNumber(sequenceNumber.toString().padStart(6, '0'))),
    status,
  }
}

export function Fixture() {
  const params = new URLSearchParams(window.location.search)
  const count = Math.min(100, Math.max(1, Number(params.get('count') ?? 20)))
  const completed = params.get('state') === 'completed'
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [reason, setReason] = useState<'absent' | 'other'>('absent')
  const winners = useMemo(() => Array.from({ length: count }, (_, index) => fixtureWinner(index + 1, completed ? 'confirmed' : 'pending')), [completed, count])
  const selectedCount = selected.size
  const toggle = (winnerId: string) => setSelected((current) => {
    const next = new Set(current)
    if (next.has(winnerId)) next.delete(winnerId)
    else next.add(winnerId)
    return next
  })

  return <main data-ui-theme="kocokan" style={{ height: '100vh', overflow: 'auto', padding: '28px', background: 'var(--kc-page)' }}>
    <section aria-labelledby="fixture-title" className={`pending-results pending-results--production${completed ? ' pending-results--completed' : ''}`}>
      <header className="kc-page-header"><div className="kc-page-header__copy"><p className="kc-page-header__eyebrow">LIVE · PRODUKSI RESMI</p><h1 id="fixture-title">{completed ? 'Hasil Akhir' : 'Tinjau Pemenang'}</h1><p className="kc-page-header__description">K-Ion Nano Premium 5 · Door Prize</p></div><Badge variant={completed ? 'confirmed' : 'pending'}>{completed ? 'SELESAI' : 'MENUNGGU'}</Badge></header>
      {completed ? <div className="pending-results__completion-state" role="status"><div className="pending-results__completion-copy"><span>UNDIAN SELESAI</span><strong>Peninjauan pemenang selesai</strong><p>Semua {count} pemenang telah dikonfirmasi dan siap untuk undian berikutnya.</p></div><div className="pending-results__completion-actions"><Button icon={<Icon name="Play" />} size="lg">Mulai Undian Berikutnya</Button><Button icon={<Icon name="History" />} variant="secondary">Lihat Riwayat</Button></div></div> : null}
      <PendingResultsSummary total={count} pending={completed ? 0 : count} confirmed={completed ? count : 0} cancelled={0} replacements={0} />
      <div className="pending-results__workspace">
        {!completed ? <Card padding="none" tone="raised" className="pending-results__queue"><div className="pending-results__section-heading"><div><p className="operator-eyebrow">Keputusan pemenang</p><h2>Pilih pemenang</h2><p>Pilih pemenang, lalu konfirmasi, batalkan, atau undi ulang sesuai kebutuhan.</p></div><Button icon={selectedCount === count ? <Icon name="ListX" /> : <Icon name="ListChecks" />} onClick={() => setSelected(selectedCount === count ? new Set() : new Set(winners.map((winner) => winner.id)))} variant="secondary">{selectedCount === count ? 'Batalkan Pilihan Semua' : 'Pilih Semua yang Tertunda'}</Button></div><div className="pending-results__selection-status" aria-live="polite"><strong>{count} pending</strong><span>{selectedCount > 0 ? `${selectedCount} dipilih` : 'Belum ada pemenang dipilih'}</span></div><PendingWinnerGrid winners={winners} selected={selected} busy={false} onToggle={toggle} /><div className="pending-results__action-bar"><div><strong>Tindakan keputusan</strong><span>{selectedCount > 0 ? `Terapkan ke ${selectedCount} pemenang yang dipilih.` : 'Pilih satu atau beberapa pemenang tertunda untuk melanjutkan.'}</span></div><div className="pending-results__actions"><Button className="pending-results__action pending-results__action--confirm" icon={<Icon name="CircleCheck" />} disabled={selectedCount === 0}>Konfirmasi{selectedCount > 0 ? ` ${selectedCount}` : ''}</Button><Button className="pending-results__action pending-results__action--cancel" icon={<Icon name="CircleX" />} disabled={selectedCount === 0} variant="danger">Batalkan{selectedCount > 0 ? ` ${selectedCount}` : ''}</Button><Button className="pending-results__action pending-results__action--redraw" icon={<Icon name="RotateCcw" />} disabled={selectedCount === 0} onClick={() => setDialogOpen(true)} variant="secondary">Undi Ulang{selectedCount > 0 ? ` ${selectedCount}` : ''}</Button></div></div></Card> : null}
        <Card padding="md" tone="raised" className="pending-results__details"><div className="pending-results__section-heading"><div><p className="operator-eyebrow">Konteks Operator</p><h2>Detail Hasil</h2></div><Badge variant="live">Live</Badge></div><dl className="pending-results__details-list"><div><dt>Acara</dt><dd>UJI SLICE 4 — Pending Results</dd></div><div><dt>Kategori hadiah</dt><dd>Door Prize</dd></div><div><dt>Hadiah</dt><dd>K-Ion Nano Premium 5</dd></div><div><dt>Jumlah pemenang</dt><dd>{count}</dd></div><div><dt>Pool yang memenuhi syarat</dt><dd>10000</dd></div><div><dt>Waktu undian</dt><dd>1 Sep 2026 · 06.00</dd></div></dl><div className="pending-results__capacity"><span>Kapasitas undian ulang</span><strong>{Math.max(0, 10000 - count)} pengganti yang memenuhi syarat tersedia</strong><small>Identitas pengganti tidak dipilih sampai undian ulang diminta.</small></div></Card>
      </div>
      {completed ? <Card padding="sm" tone="raised" className="pending-results__completed-actions"><div className="pending-results__correction-actions"><div><p className="operator-eyebrow">Koreksi / Pemulihan</p><h2>Perlu mengoreksi hasil ini?</h2></div><Button icon={<Icon name="RotateCcw" />} variant="danger">Undi ulang pemenang terkonfirmasi</Button></div></Card> : null}
      <details className="pending-results__audit"><summary>Record pemenang otoritatif <span>{count} record</span></summary><div><ol>{winners.slice(0, Math.min(count, 10)).map((winner) => <li key={winner.id}><code>{winner.ticketNumber}</code> <Badge variant={completed ? 'confirmed' : 'pending'}>{completed ? 'Dikonfirmasi' : 'Tertunda'}</Badge></li>)}</ol><p><small>Fixture membatasi preview record; data resmi aplikasi tidak diubah.</small></p></div></details>
    </section>
    <Modal headerIcon={<Icon name="RotateCcw" />} headerIconTone="danger" open={dialogOpen} title="Undi ulang pemenang tertunda" onClose={() => setDialogOpen(false)} footer={<><Button onClick={() => setDialogOpen(false)} variant="secondary">Kembali</Button><Button icon={<Icon name="RotateCcw" />} variant="danger">Undi ulang secara resmi</Button></>}><div className="pending-results__decision-content"><p>Fixture visual: tidak ada command atau record resmi yang dijalankan.</p><ReasonSelect id="fixture-reason" reason={reason} busy={false} onChange={(value) => setReason(value === 'other' ? 'other' : 'absent')} /></div></Modal>
  </main>
}

createRoot(document.getElementById('root') as HTMLElement).render(<MemoryRouter><UiThemeContext.Provider value="kocokan"><Fixture /></UiThemeContext.Provider></MemoryRouter>)
