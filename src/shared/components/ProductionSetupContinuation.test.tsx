import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProductionSetupContinuation } from './ProductionSetupContinuation.tsx'
import { PRODUCTION_SETUP_JOURNEY } from './production-setup-journey.ts'

const workspace = vi.hoisted(() => ({ value: { status: 'empty' as 'empty' | 'ready', event: undefined as { name: string } | undefined, setupJourneyReachedStep: undefined as number | undefined, advanceSetupJourney: vi.fn() } }))

vi.mock('../../app/workspace/ProductionWorkspaceContext.tsx', () => ({ useProductionWorkspace: () => workspace.value }))

function renderContinuation(initialEntry = '/events') {
  const router = createMemoryRouter([{ path: '*', element: <ProductionSetupContinuation /> }], { initialEntries: [initialEntry] })
  return { router, ...render(<RouterProvider router={router} />) }
}

afterEach(() => { cleanup(); workspace.value = { status: 'empty', event: undefined, setupJourneyReachedStep: undefined, advanceSetupJourney: vi.fn() } })

describe('ProductionSetupContinuation', () => {
  it('reports the five-stage production setup journey in order', () => {
    renderContinuation()
    expect(screen.getByRole('region', { name: 'Event setup' })).toHaveClass('production-setup-continuation')
    expect(screen.getByRole('region', { name: 'Event setup' })).toHaveAttribute('data-setup-journey-surface', 'sticky')
    expect(screen.getByText(/SETUP JOURNEY · STEP 1 OF 5 · EVENT IN PROGRESS/)).toBeVisible()
    expect(screen.getByRole('list', { name: 'Production setup steps' })).toHaveTextContent('EventPrizeParticipantsDisplay SettingsDraw Setup')
    expect(PRODUCTION_SETUP_JOURNEY.map((step) => step.label)).toEqual(['Event', 'Prize', 'Peserta', 'Pengaturan Tampilan', 'Pengaturan Undian'])
  })

  it.each([
    ['/events', '1'], ['/prize-categories', '2'], ['/participants', '3'], ['/settings', '4'], ['/draw/setup', '5'],
  ])('uses the route as the current setup stage for %s', (route, step) => {
    renderContinuation(route)
    expect(screen.getByText(new RegExp(`SETUP JOURNEY · STEP ${step} OF 5`))).toBeVisible()
  })

  it('keeps Next disabled without an authoritative Current Event', () => {
    renderContinuation()
    expect(screen.getByRole('button', { name: /Next: Prize/i })).toBeDisabled()
    expect(screen.getByText('Select an Event as Current to continue.')).toBeVisible()
  })

  it('keeps Participants locked while Prize has no persisted category', () => {
    workspace.value = { status: 'ready', event: { name: 'Gala Dinner 2026' }, setupJourneyReachedStep: 2, advanceSetupJourney: vi.fn() } as never
    renderContinuation('/prize-categories')
    expect(screen.getByText(/PRIZE IN PROGRESS/)).toBeVisible()
    expect(screen.getByText(/Create at least one prize category to continue\./)).toBeVisible()
    expect(screen.getByRole('button', { name: /Next: Participants/i })).toBeDisabled()
  })

  it('uses persisted readiness to enable the next stage without a visit flag', async () => {
    workspace.value = { status: 'ready', event: { name: 'Gala Dinner 2026' }, setupJourneyReachedStep: 2, advanceSetupJourney: vi.fn(), setupReadiness: { event: true, prize: true, participants: false, displaySettings: false, drawSetup: false } } as never
    const { router } = renderContinuation('/prize-categories')
    expect(screen.getByText(/PRIZE COMPLETE/)).toBeVisible()
    expect(screen.getByRole('button', { name: /Next: Participants/i })).toBeEnabled()
    await userEvent.setup().click(screen.getByRole('button', { name: /Next: Participants/i }))
    expect(workspace.value.advanceSetupJourney).toHaveBeenCalledWith(3)
    expect(router.state.location.pathname).toBe('/participants')
  })

  it('does not admit Participants merely because Prize is complete', () => {
    workspace.value = { status: 'ready', event: { name: 'Gala Dinner 2026' }, setupJourneyReachedStep: 2, advanceSetupJourney: vi.fn(), setupReadiness: { event: true, prize: true, participants: false, displaySettings: false, drawSetup: false } } as never
    renderContinuation('/prize-categories')
    expect(screen.getByRole('button', { name: /Next: Participants/i })).toBeEnabled()
    expect(workspace.value.setupJourneyReachedStep).toBe(2)
  })

  it('uses Previous for every stage after Event', async () => {
    const { router } = renderContinuation('/settings')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Previous' }))
    expect(router.state.location.pathname).toBe('/participants')
  })

  it('enables Next and shows the Current Event identity as workspace state becomes ready', async () => {
    workspace.value = { status: 'ready', event: { name: 'Gala Dinner 2026' }, setupJourneyReachedStep: 1, advanceSetupJourney: vi.fn() } as never
    const { router } = renderContinuation()
    expect(screen.getByText(/Gala Dinner 2026/)).toBeVisible()
    const next = screen.getByRole('button', { name: /Next: Prize/i })
    expect(next).toBeEnabled()
    await userEvent.setup().click(next)
    expect(router.state.location.pathname).toBe('/prize-categories')
  })

  it('keeps the Dashboard back action on the first stage', async () => {
    const { router } = renderContinuation()
    await userEvent.setup().click(screen.getByRole('link', { name: 'Kembali ke Dasbor' }))
    expect(router.state.location.pathname).toBe('/dashboard')
  })

  it('keeps Step 5 visible while authoritative Draw Setup is incomplete', () => {
    workspace.value = { status: 'ready', event: { name: 'Gala Dinner 2026' }, setupJourneyReachedStep: 5, advanceSetupJourney: vi.fn(), setupReadiness: { event: true, prize: true, participants: true, displaySettings: true, drawSetup: false } } as never
    renderContinuation('/draw/setup')

    expect(screen.getByText(/SETUP JOURNEY/)).toHaveTextContent('STEP 5 OF 5')
  })

  it('hides the complete journey on every setup route without leaving footer space', () => {
    const completeReadiness = { event: true, prize: true, participants: true, displaySettings: true, drawSetup: true }
    for (const route of ['/events', '/draw/setup', '/prize-categories', '/participants', '/settings']) {
      cleanup()
      workspace.value = { status: 'ready', event: { name: 'Gala Dinner 2026' }, setupJourneyReachedStep: 5, advanceSetupJourney: vi.fn(), setupReadiness: completeReadiness } as never
      renderContinuation(route)
      expect(screen.queryByRole('region', { name: /setup/i })).not.toBeInTheDocument()
      expect(screen.queryByText(/SETUP JOURNEY/)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Next: Complete/i })).not.toBeInTheDocument()
      expect(document.querySelector('[data-setup-journey-surface="sticky"]')).toBeNull()
    }
  })

  it('shows the recovery journey again when authoritative setup becomes incomplete', () => {
    workspace.value = { status: 'ready', event: { name: 'Gala Dinner 2026' }, setupJourneyReachedStep: 5, advanceSetupJourney: vi.fn(), setupReadiness: { event: true, prize: true, participants: true, displaySettings: false, drawSetup: false } } as never
    renderContinuation('/settings')

    expect(screen.getByText(/SETUP JOURNEY/)).toHaveTextContent('STEP 4 OF 5')
  })

  it('does not carry completion suppression between Events', () => {
    workspace.value = { status: 'ready', event: { name: 'Incomplete Event' }, setupJourneyReachedStep: 5, advanceSetupJourney: vi.fn(), setupReadiness: { event: true, prize: true, participants: true, displaySettings: true, drawSetup: false } } as never
    renderContinuation('/draw/setup')

    expect(screen.getByRole('region', { name: 'Draw Setup setup' })).toHaveTextContent('Incomplete Event')
  })
})
