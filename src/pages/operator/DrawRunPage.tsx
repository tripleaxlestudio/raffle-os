import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import type { DrawReadinessResult } from '../../application/draw/draw-readiness.types.ts'
import { queryDrawReadiness } from '../../application/draw/draw-readiness-query.ts'
import { createDrawSetupProductionServices } from '../../infrastructure/composition/draw-command-production.ts'
import { PageHeader } from '../../shared/components/PageHeader.tsx'
import { StatusBanner } from '../../shared/components/StatusBanner.tsx'
import { Button, Card } from '../../shared/ui/index.ts'

export function DrawRunPage() {
  const services = useMemo(() => createDrawSetupProductionServices(), [])
  const navigate = useNavigate()
  const { drawSessionId } = useParams<{ drawSessionId: string }>()
  const [result, setResult] = useState<DrawReadinessResult | null>(null)
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    setLoading(true)
    try { await services.open(); setResult(drawSessionId === undefined || services.checkStorage === undefined || services.checkCrypto === undefined ? { state: 'failed', retryable: false, reason: 'This DrawSession URL is invalid.' } : await queryDrawReadiness(drawSessionId, { ...services, checkStorage: services.checkStorage, checkCrypto: services.checkCrypto })) }
    catch { setResult({ state: 'failed', retryable: true, reason: 'The persisted session could not be loaded.' }) }
    finally { setLoading(false) }
  }, [drawSessionId, services])
  useEffect(() => { void Promise.resolve().then(load) }, [load])
  if (loading) return <section aria-busy="true"><PageHeader eyebrow="Production start gate" headingId="draw-run-title" title="Draw Start Gate" description="Validating the persisted DrawSession…" /></section>
  if (result?.state !== 'ready' || result.data === undefined) return <section aria-labelledby="draw-run-title"><PageHeader eyebrow="Production start gate" headingId="draw-run-title" title="Draw Start Gate" description="The session is not ready for the next workflow." /><StatusBanner badge="Blocked" title="Cannot open this DrawSession" tone="warning">{result?.reason ?? 'The requested DrawSession is unavailable.'}</StatusBanner><Button onClick={() => navigate('/draw/setup')}>Back to Draw Setup</Button></section>
  return <section aria-labelledby="draw-run-title" className="draw-setup"><PageHeader eyebrow="Production start gate" headingId="draw-run-title" title="Draw Start Gate" description={`${result.data.event.name} · ${result.data.category.name}`} /><StatusBanner badge="Validated" title="Session is ready for the Slice 4 start gate" tone="success">No command was invoked, no winner was selected, and no official record or presentation checkpoint was created.</StatusBanner><Card padding="md"><dl className="summary-list"><div className="summary-list__item"><dt>Mode</dt><dd>{result.data.mode === 'live' ? 'Live — official workflow' : 'Practice — rehearsal only'}</dd></div><div className="summary-list__item"><dt>Requested winners</dt><dd>{result.data.requestedWinnerCount}</dd></div><div className="summary-list__item"><dt>Eligible participants</dt><dd>{result.data.authoritativeEligibleCount}</dd></div><div className="summary-list__item"><dt>DrawSession</dt><dd><code>{result.data.session.id}</code></dd></div></dl></Card><Link to="/draw/setup">Return to Draw Setup</Link></section>
}
