import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OperatorSidebar } from './OperatorSidebar.tsx'

const workspace = vi.hoisted(() => ({ status: 'empty' as 'empty' | 'invalid-reference' | 'loading' | 'ready' }))

vi.mock('../workspace/ProductionWorkspaceContext.tsx', () => ({
  useProductionWorkspace: () => workspace,
}))

function LocationProbe() {
  return <output data-testid="location"><LocationText /></output>
}

function LocationText() {
  return <>{useLocation().pathname}</>
}

function renderSidebar(path = '/dashboard') {
  return render(<MemoryRouter initialEntries={[path]}><OperatorSidebar production /><LocationProbe /></MemoryRouter>)
}

beforeEach(() => { workspace.status = 'empty' })

describe('production sidebar Event gating', () => {
  it('keeps Dashboard enabled and disables Event-scoped navigation without exposing links', async () => {
    const user = userEvent.setup()
    renderSidebar()

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard')
    for (const label of ['Prize', 'Participants', 'Display Settings', 'Draw Setup', 'Live Draw', 'Pending Results', 'History']) {
      const item = screen.getByText(label).closest('[aria-disabled]') as HTMLElement
      expect(item).toHaveAttribute('aria-disabled', 'true')
      expect(item).not.toHaveAttribute('tabindex')
      expect(item.closest('a')).toBeNull()
      await user.click(item)
    }
    expect(screen.getByTestId('location')).toHaveTextContent('/dashboard')
  })

  it('treats a stale Event reference as unavailable', () => {
    workspace.status = 'invalid-reference'
    renderSidebar()

    expect(screen.getAllByRole('generic').filter((element) => element.getAttribute('aria-disabled') === 'true')).toHaveLength(7)
  })

  it('restores all navigation when the workspace becomes ready without remounting', () => {
    const view = renderSidebar()
    workspace.status = 'ready'
    view.rerender(<MemoryRouter initialEntries={['/dashboard']}><OperatorSidebar production /><LocationProbe /></MemoryRouter>)

    for (const label of ['Dashboard', 'Prize', 'Participants', 'Display Settings', 'Draw Setup', 'Live Draw', 'Pending Results', 'History']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    }
    expect(screen.queryAllByText('Select an Event first')).toHaveLength(0)
  })

  it('preserves the stable normal navigation shell while workspace data is loading', () => {
    workspace.status = 'loading'
    renderSidebar()

    expect(screen.getAllByRole('link')).toHaveLength(8)
    expect(screen.queryAllByText('Select an Event first')).toHaveLength(0)
  })

  it('marks Prize active on the existing Prize Categories route', () => {
    workspace.status = 'ready'
    renderSidebar('/prize-categories')

    expect(screen.getByRole('link', { name: 'Prize' })).toHaveClass('operator-nav__link--active')
    expect(screen.getByRole('link', { name: 'Prize' })).toHaveAttribute('href', '/prize-categories')
  })

  it('keeps the next stage disabled when the current stage is complete but not admitted', () => {
    Object.assign(workspace, { status: 'ready', setupReadiness: { event: true, prize: true, participants: false, displaySettings: false, drawSetup: false }, setupJourneyReachedStep: 2 })
    renderSidebar('/prize-categories')

    expect(screen.getByRole('link', { name: 'Prize' })).toHaveClass('operator-nav__link--active')
    expect(screen.getByText('Participants').closest('[aria-disabled]')).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText('Display Settings').closest('[aria-disabled]')).toHaveAttribute('aria-disabled', 'true')
  })

  it('admits the next stage without revoking it when navigating back', () => {
    Object.assign(workspace, { status: 'ready', setupReadiness: { event: true, prize: true, participants: false, displaySettings: false, drawSetup: false }, setupJourneyReachedStep: 3 })
    renderSidebar('/prize-categories')

    expect(screen.getByRole('link', { name: 'Participants' })).toBeInTheDocument()
    expect(screen.getByText('Display Settings').closest('[aria-disabled]')).toHaveAttribute('aria-disabled', 'true')
  })

  it('restores normal production navigation after authoritative setup completion', () => {
    Object.assign(workspace, { status: 'ready', setupReadiness: { event: true, prize: true, participants: true, displaySettings: true, drawSetup: true }, setupJourneyReachedStep: 5 })
    renderSidebar('/draw/setup')

    for (const label of ['Prize', 'Participants', 'Display Settings', 'Draw Setup', 'Live Draw', 'Pending Results', 'History']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    }
    expect(screen.queryAllByLabelText('Complete the previous setup step first')).toHaveLength(0)
  })
})
