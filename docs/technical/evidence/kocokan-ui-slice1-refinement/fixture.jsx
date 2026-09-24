// Component render samples only. No storage, import, draw, publisher or save commands.
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { UiThemeContext } from '/src/shared/ui/ui-theme.ts'
import { DrawControlDeck } from '/src/pages/operator/DrawSessionQueuePage.tsx'
import { MetricCard } from '/src/shared/components/MetricCard.tsx'
import { ProgressStepper } from '/src/shared/components/ProgressStepper.tsx'
import { Button, Card } from '/src/shared/ui/index.ts'
import '/src/styles/app.css'

const sample = mode => ({ action: { kind: 'run', to: '/render-only-no-command' }, checkpoint: null,
  category: { id: 'render-category', name: 'Door Prize', prizeName: 'Blender' },
  event: { id: 'render-event', name: 'Render-only sample' }, relation: 'valid',
  session: { id: `render-${mode}`, mode, status: 'ready', updatedAt: '2026-08-31T00:00:00Z' }, winnerCount: 1 })
const deck = { key: 'render-deck', categoryName: 'Door Prize', defaultMode: 'practice',
  eventName: 'Render-only sample', prizeName: 'Blender', sessions: { practice: sample('practice'), live: sample('live') }, winnerCount: 1 }

export function RefinementFixture() {
  const [mode, setMode] = useState('practice')
  return <MemoryRouter><UiThemeContext value="kocokan"><main data-ui-theme="kocokan" data-interface="operator" style={{ height: '100dvh', overflow: 'auto', background: 'var(--kc-page)', color: 'var(--kc-text)', padding: 28, display: 'grid', gap: 20, alignContent: 'start' }}>
    <h1>Refinement: populated component samples</h1><p>No persisted Event/session. Links remain inside MemoryRouter; no draw command is available.</p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}><MetricCard label="Participants" value="300" detail="231 checked in" to="/participants" /><MetricCard label="Prizes" value="4" detail="Render-only" to="/prize-categories" /><MetricCard label="Pending" value="0" detail="Render-only" tone="warning" to="/draw/pending" /></div>
    <ProgressStepper currentStep="mapping" steps={[{ id: 'upload', label: 'Upload' }, { id: 'mapping', label: 'Mapping' }, { id: 'validation', label: 'Validation' }, { id: 'confirmation', label: 'Confirmation' }]} />
    <Card><div className="prize-categories-page__category-card"><div className="prize-categories-page__category-heading"><div><h3>Door Prize</h3><p>Blender · render-only category row</p></div></div><Button variant="quiet">Edit sample (no action)</Button></div></Card>
    <DrawControlDeck connection={{ acknowledged: true, acknowledgedAt: undefined, detail: 'Render-only connection state', label: 'Terhubung', tone: 'success' }} deck={deck} displayUrl={null} selectedMode={mode} setSelectedMode={setMode} />
  </main></UiThemeContext></MemoryRouter>
}
createRoot(document.getElementById('fixture')).render(<RefinementFixture />)
