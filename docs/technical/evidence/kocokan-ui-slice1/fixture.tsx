// Review-only Vite entry, not a production route or persisted DrawRun fixture.
// No database, publisher, selection command, storage, or official History writes.
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { UiThemeContext } from '/src/shared/ui/ui-theme.ts'
import { Badge, Button, Card, Checkbox, ConfirmationDialog, Input, Pagination, SegmentedControl, Select, SidePanel, Table, TableHeader, Toast, Toggle } from '/src/shared/ui/index.ts'
import { AudienceConnectionStatus } from '/src/shared/components/AudienceConnectionStatus.tsx'
import { AudiencePresentation } from '/src/ui/audience/AudiencePresentation.tsx'
import '/src/styles/app.css'

export function Fixture() {
  const [panel, setPanel] = useState(false), [modal, setModal] = useState(false), [toast, setToast] = useState(true)
  const [mode, setMode] = useState('practice'), [page, setPage] = useState(1), [size, setSize] = useState(10)
  const [stage, setStage] = useState('standby')
  const snapshot = { drawSessionId: 'visual-fixture-only', stage: stage === 'blackout' ? 'standby' : stage, blackoutRequested: stage === 'blackout', eventName: 'VISUAL FIXTURE', eventSubtitle: 'Not a real draw', primaryColor: '#7567ff', accentColor: '#f2a93b', safeAreaMargin: 32, displayTest: false, presentationMode: 'instant-reveal', revealMode: 'all-together', ...(stage === 'reveal' ? { prizeName: 'Fixture prize', ticketNumbers: ['000001', '000002', '000003'], winnerStatuses: ['pending', 'pending', 'pending'] } : {}) }
  return <MemoryRouter><UiThemeContext value="kocokan"><main data-interface="operator" data-ui-theme="kocokan" data-operator-shell style={{ height: '100dvh', overflow: 'auto', padding: 28, background: 'var(--kc-page)', color: 'var(--kc-text)', display: 'grid', gap: 20, alignContent: 'start' }}>
    <h1 style={{ margin: 0 }}>Slice 1 • component review only</h1><p style={{ margin: 0 }}>No persistence, publisher or draw commands. Audience examples below are render fixtures, not a live session.</p>
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}><Button onClick={() => setModal(true)}>Primary / open modal</Button><Button variant="secondary" onClick={() => setPanel(true)}>Secondary / open panel</Button><Button variant="success">Success</Button><Button variant="danger">Danger (no action)</Button><Button variant="quiet">Quiet</Button><Button square aria-label="Square button">+</Button><Button disabled>Disabled</Button><Button isLoading>Loading</Button></div>
    <Card><div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 20 }}><Input label="Ticket" placeholder="000001" description="Literal ticket string" /><Select label="Prize"><option>Fixture prize</option><option>Second prize</option></Select><div><Toggle label="Audio" /><Checkbox label="Check-in required" /></div></div><SegmentedControl label="Mode" value={mode} onChange={setMode} options={[{ value: 'practice', label: 'Practice' }, { value: 'live', label: 'Live' }]} /></Card>
    <Card padding="sm"><Table caption="Fixture tickets"><thead><tr><TableHeader sortable>Ticket</TableHeader><TableHeader>Status</TableHeader></tr></thead><tbody><tr><td>000001</td><td><Badge variant="pending">Pending</Badge></td></tr><tr><td>000002</td><td><Badge variant="success">Confirmed</Badge></td></tr></tbody></Table><Pagination page={page} pageSize={size} totalItems={65} onPageChange={setPage} onPageSizeChange={setSize} /></Card>
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>{['setup-required', 'waiting', 'connected', 'reconnecting', 'unavailable', 'publication-failed'].map(state => <AudienceConnectionStatus state={state} key={state} />)}</div>
    {toast ? <Toast title="Fixture saved" description="Review-only toast; nothing was stored." variant="success" onDismiss={() => setToast(false)} /> : null}
    <SegmentedControl label="Audience fixture stage" value={stage} onChange={setStage} options={['standby', 'reveal', 'blackout'].map(value => ({ value, label: value }))} />
    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>{['legacy', 'kocokan'].map(theme => <UiThemeContext key={theme} value={theme}><div data-interface="operator" data-ui-theme={theme === 'kocokan' ? theme : undefined} style={{ width: 432 }}><p>{theme} Card / same Audience renderer</p><Card><div className={`production-preview fixture-preview-${theme}`} style={{ width: 384, height: 216 }}><div className="production-preview__viewport"><AudiencePresentation snapshot={snapshot} preview /></div></div></Card></div></UiThemeContext>)}</div>
    <ConfirmationDialog open={modal} title="Fixture confirmation" consequence="This is a UI review only." confirmLabel="Finish review" onCancel={() => setModal(false)} onConfirm={() => setModal(false)} />
    <SidePanel open={panel} title="Fixture SidePanel" description="Dormant production primitive shown only in this review entry." onClose={() => setPanel(false)} footer={<Button onClick={() => setPanel(false)}>Close panel</Button>}><Input label="Panel input" /><p>Keyboard focus stays in this panel.</p></SidePanel>
  </main></UiThemeContext></MemoryRouter>
}
createRoot(document.getElementById('fixture')).render(<Fixture />)
