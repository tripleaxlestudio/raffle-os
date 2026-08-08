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

function renderSidebar() {
  return render(<MemoryRouter initialEntries={['/dashboard']}><OperatorSidebar production /><LocationProbe /></MemoryRouter>)
}

beforeEach(() => { workspace.status = 'empty' })

describe('production sidebar Event gating', () => {
  it('keeps Dashboard enabled and disables Event-scoped navigation without exposing links', async () => {
    const user = userEvent.setup()
    renderSidebar()

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard')
    for (const label of ['Participants', 'Draw Setup', 'Live Draw', 'Pending Results', 'History', 'Settings']) {
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

    expect(screen.getAllByRole('generic').filter((element) => element.getAttribute('aria-disabled') === 'true')).toHaveLength(6)
  })

  it('restores all navigation when the workspace becomes ready without remounting', () => {
    const view = renderSidebar()
    workspace.status = 'ready'
    view.rerender(<MemoryRouter initialEntries={['/dashboard']}><OperatorSidebar production /><LocationProbe /></MemoryRouter>)

    for (const label of ['Dashboard', 'Participants', 'Draw Setup', 'Live Draw', 'Pending Results', 'History', 'Settings']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    }
    expect(screen.queryAllByText('Select an Event first')).toHaveLength(0)
  })

  it('preserves the stable normal navigation shell while workspace data is loading', () => {
    workspace.status = 'loading'
    renderSidebar()

    expect(screen.getAllByRole('link')).toHaveLength(7)
    expect(screen.queryAllByText('Select an Event first')).toHaveLength(0)
  })
})
