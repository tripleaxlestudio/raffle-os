import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProductionSetupContinuation } from './ProductionSetupContinuation.tsx'

const workspace = vi.hoisted(() => ({ value: { status: 'empty' as 'empty' | 'ready', event: undefined as { name: string } | undefined } }))

vi.mock('../../app/workspace/ProductionWorkspaceContext.tsx', () => ({
  useProductionWorkspace: () => workspace.value,
}))

function renderContinuation() {
  const router = createMemoryRouter([{ path: '*', element: <ProductionSetupContinuation /> }], { initialEntries: ['/events'] })
  return { router, ...render(<RouterProvider router={router} />) }
}

afterEach(() => {
  cleanup()
  workspace.value = { status: 'empty', event: undefined }
})

describe('ProductionSetupContinuation', () => {
  it('keeps Next disabled without an authoritative Current Event', () => {
    renderContinuation()

    expect(screen.getByRole('button', { name: /Next: Prize Categories/i })).toBeDisabled()
    expect(screen.getAllByText('Select an Event as Current to continue.')).toHaveLength(2)
  })

  it('enables Next and shows the Current Event identity as workspace state becomes ready', async () => {
    const view = renderContinuation()
    workspace.value = { status: 'ready', event: { name: 'Gala Dinner 2026' } }
    const user = userEvent.setup()
    // The provider signal causes the real application to refresh; this rerender models that state transition.
    view.unmount()
    const readyView = renderContinuation()
    expect(screen.getByText('Gala Dinner 2026')).toBeVisible()
    const next = screen.getByRole('button', { name: /Next: Prize Categories/i })
    expect(next).toBeEnabled()
    await user.click(next)
    expect(readyView.router.state.location.pathname).toBe('/prize-categories')
  })

  it('keeps the Dashboard back action as the secondary production route', async () => {
    const { router } = renderContinuation()
    const user = userEvent.setup()
    await user.click(screen.getByRole('link', { name: 'Back to Dashboard' }))
    expect(router.state.location.pathname).toBe('/dashboard')
  })
})
