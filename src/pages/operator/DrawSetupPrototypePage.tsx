import { useSearchParams } from 'react-router'
import { drawSetupFixtures } from '../../prototype/data/index.ts'
import { resolvePrototypeDrawSetupQuery } from '../../prototype/scenario-query.ts'
import { PageHeader } from '../../shared/components/PageHeader.tsx'
import { StatusBanner } from '../../shared/components/StatusBanner.tsx'
import { Badge, Button, ButtonLink, Card } from '../../shared/ui/index.ts'

export function DrawSetupPrototypePage() {
  const [searchParams] = useSearchParams()
  const query = resolvePrototypeDrawSetupQuery(searchParams)
  const fixture = drawSetupFixtures[query.scenario]
  const insufficient = query.scenario === 'insufficient'
  return <section aria-labelledby="draw-setup-prototype-title" className="draw-setup" data-prototype-static="true" data-draw-mode={query.mode}>
    <div className="prototype-notice" role="note"><span aria-hidden="true">PROTO</span> Fictional setup data only. Nothing on this page is saved, filtered, validated, or made official.</div>
    <PageHeader actions={<div className="draw-mode-context"><Badge variant={query.mode}>{query.mode === 'live' ? 'LIVE FLOW' : 'PRACTICE'}</Badge><span>Static prototype scenario</span></div>} description={`${fixture.configuration.eventName} · ${fixture.configuration.category}`} eyebrow="Draw configuration prototype" headingId="draw-setup-prototype-title" title="Draw Setup" />
    <StatusBanner badge={insufficient ? 'Proceeding blocked' : 'Prototype ready'} title={insufficient ? 'Requested winners exceed the eligible participant pool.' : 'Static configuration is ready for operator review'} tone={insufficient ? 'warning' : 'success'}>{insufficient ? 'This explicit prototype scenario requests 20 winners from 12 static eligible participants.' : 'These values are deterministic prototype fixtures and are not authoritative.'}</StatusBanner>
    <Card className="draw-panel" padding="md"><h2>Prototype capacity</h2><dl aria-label="Eligible pool summary" className="eligible-pool-metrics"><div><dt>Total participants</dt><dd>{fixture.eligibility.totalParticipants}</dd></div><div><dt>Eligible pool</dt><dd>{fixture.eligibility.eligibleParticipants}</dd></div><div><dt>Requested winners</dt><dd>{fixture.eligibility.requestedWinners}</dd></div></dl></Card>
    <div className="draw-action-bar"><div><strong>Static prototype only</strong><span>No command or persistence is available.</span></div><div className="draw-action-bar__actions"><ButtonLink to="/dashboard" variant="secondary">Return to Dashboard</ButtonLink>{insufficient ? <Button disabled size="lg">Resolve pool shortage</Button> : <ButtonLink to={`/draw/live?state=ready&mode=${query.mode}`} size="lg">Review draw</ButtonLink>}</div></div>
  </section>
}
