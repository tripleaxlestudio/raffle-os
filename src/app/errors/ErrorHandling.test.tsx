import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AppErrorBoundary } from './AppErrorBoundary.tsx'
import { RouteErrorPage } from './RouteErrorPage.tsx'

function UnexpectedRenderFailure(): never {
  const error = new Error('RENDER_DETAIL_SENTINEL')
  error.stack = 'RENDER_STACK_SENTINEL'
  throw error
}

function renderRouteError(error: unknown) {
  const router = createMemoryRouter(
    [
      {
        path: '/failure',
        loader: () => {
          throw error
        },
        element: <p>Unreachable route content</p>,
        errorElement: <RouteErrorPage />,
      },
      {
        path: '/dashboard',
        element: <h1>Dashboard recovery target</h1>,
      },
    ],
    {
      initialEntries: ['/failure'],
    },
  )

  render(<RouterProvider router={router} />)
}

describe('AppErrorBoundary', () => {
  it('catches unexpected render errors without exposing internal details', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    render(
      <AppErrorBoundary>
        <UnexpectedRenderFailure />
      </AppErrorBoundary>,
    )

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Terjadi kesalahan',
      }),
    ).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent('RENDER_DETAIL_SENTINEL')
    expect(document.body).not.toHaveTextContent('RENDER_STACK_SENTINEL')

    consoleError.mockRestore()
  })

  it('provides a reload action', async () => {
    const user = userEvent.setup()
    const onReload = vi.fn()
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    render(
      <AppErrorBoundary onReload={onReload}>
        <UnexpectedRenderFailure />
      </AppErrorBoundary>,
    )

    await user.click(
      screen.getByRole('button', { name: 'Reload application' }),
    )

    expect(onReload).toHaveBeenCalledOnce()
    consoleError.mockRestore()
  })
})

describe('RouteErrorPage', () => {
  it('recognizes route-response errors without rendering response details', async () => {
    renderRouteError(
      new Response('ROUTE_RESPONSE_DETAIL_SENTINEL', {
        status: 404,
        statusText: 'ROUTE_RESPONSE_STATUS_SENTINEL',
      }),
    )

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Halaman tidak ditemukan',
      }),
    ).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent(
      'ROUTE_RESPONSE_DETAIL_SENTINEL',
    )
    expect(document.body).not.toHaveTextContent(
      'ROUTE_RESPONSE_STATUS_SENTINEL',
    )
  })

  it('renders a generic fallback for unknown errors without a raw stack', async () => {
    const error = new Error('ROUTE_DETAIL_SENTINEL')
    error.stack = 'ROUTE_STACK_SENTINEL'

    renderRouteError(error)

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Terjadi kesalahan',
      }),
    ).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent('ROUTE_DETAIL_SENTINEL')
    expect(document.body).not.toHaveTextContent('ROUTE_STACK_SENTINEL')
    expect(
      screen.getByRole('link', { name: 'Return to Dashboard' }),
    ).toHaveAttribute('href', '/dashboard')
  })
})
