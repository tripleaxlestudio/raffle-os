import { useEffect, useMemo, useState } from 'react'
import { buildOfficialHistorySession, type OfficialHistorySession } from '../../application/history/history-read-model.ts'
import { createDrawSetupProductionServices } from '../../infrastructure/composition/draw-command-production.ts'
import { PageHeader } from '../../shared/components/PageHeader.tsx'
import { StatusBanner } from '../../shared/components/StatusBanner.tsx'
import { Badge, Card, Table } from '../../shared/ui/index.ts'

export function ProductionHistoryPage() {
  const services = useMemo(() => createDrawSetupProductionServices(), [])
  const [state, setState] = useState<{ status: 'loading' } | { status: 'ready'; sessions: readonly OfficialHistorySession[] } | { status: 'error'; message: string }>({ status: 'loading' })
  useEffect(() => {
    void Promise.resolve().then(async () => {
      try {
        await services.open()
        const sessions: OfficialHistorySession[] = []
        for (const event of await services.events.findAll()) {
          for (const session of (await services.sessions.findByEventId(event.id)).filter((item) => item.mode === 'live')) {
            const [winners, category, redraws] = await Promise.all([
              services.winners.findByDrawSessionId(session.id),
              session.configurationSnapshot === null ? Promise.resolve(null) : services.categories.findById(session.configurationSnapshot.prizeCategoryId),
              services.redraws?.findByDrawSessionId(session.id) ?? Promise.resolve([]),
            ])
            sessions.push(buildOfficialHistorySession(session, event, category, winners, redraws))
          }
        }
        sessions.sort((left, right) => right.session.createdAt.localeCompare(left.session.createdAt))
        setState({ status: 'ready', sessions })
      } catch { setState({ status: 'error', message: 'Official history could not be read safely. Retry the local read.' }) }
    })
  }, [services])
  if (state.status === 'loading') return <section aria-busy="true" aria-live="polite"><PageHeader eyebrow="Official records" headingId="history-title" title="History" description="Reading persisted Live history…" /></section>
  if (state.status === 'error') return <section aria-live="polite"><PageHeader eyebrow="Official records" headingId="history-title" title="History unavailable" description={state.message} /><StatusBanner badge="Read-only recovery" title="Official history was not changed" tone="warning">Retry the local read. No export or mutation was attempted.</StatusBanner></section>
  return <section aria-labelledby="history-title" className="history-page"><PageHeader description="Persisted Live sessions and append-only winner evidence." eyebrow="Official records" headingId="history-title" title="History" /><Card className="history-panel" padding="none"><Table caption="Official Live draw history"><thead><tr><th>Session</th><th>Event</th><th>Ticket</th><th>Status</th><th>Confirmed at</th><th>Cancelled at</th><th>Reason / lineage</th><th>Actor</th></tr></thead><tbody>{state.sessions.flatMap((item) => item.records.map((record) => <tr key={record.winner.id}><td>{item.session.id}<br /><Badge variant={item.session.status === 'completed' ? 'confirmed' : item.session.status === 'cancelled' ? 'danger' : 'pending'}>{item.session.status}</Badge></td><td>{record.event.name}</td><td><code className="result-ticket">{record.winner.ticketNumber}</code></td><td>{statusLabel(record.winner.status)}</td><td>{record.winner.confirmedAt ?? '—'}</td><td>{record.winner.cancelledAt ?? '—'}</td><td>{record.redraw === null ? 'Original record' : <>{record.redraw.reason}{record.redraw.reasonNote ? ` · ${record.redraw.reasonNote}` : ''} · original → <code>{record.replacement?.ticketNumber ?? 'missing'}</code> ({record.replacement?.status ?? 'missing'})</>}</td><td>{record.actor}</td></tr>))}</tbody></Table></Card></section>
}

function statusLabel(status: 'pending' | 'confirmed' | 'cancelled'): string {
  return status === 'pending' ? 'Pending' : status === 'confirmed' ? 'Confirmed' : 'Cancelled'
}
