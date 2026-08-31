import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  createMemoryRouter,
  RouterProvider,
} from 'react-router'
import { describe, expect, it } from 'vitest'
import { appRoutes } from './router.tsx'

function expectLocation(
  router: ReturnType<typeof createMemoryRouter>,
  expected: string,
) {
  expect(
    `${router.state.location.pathname}${router.state.location.search}`,
  ).toBe(expected)
}

function expectNoProductionSuccessClaim() {
  expect(document.body).not.toHaveTextContent(
    /participants were imported|successfully imported|winner was selected|winners were confirmed|redraw completed|history was saved|settings were saved|download completed/i,
  )
}

describe('Phase 2 deterministic happy path', () => {
  it('connects every static screen through browser-history-compatible URLs', async () => {
    const user = userEvent.setup()
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/dev/prototypes/dashboard'],
    })
    render(<RouterProvider router={router} />)

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Nusantara Tech Gala 2026',
      }),
    ).toBeVisible()
    expectNoProductionSuccessClaim()

    await user.click(screen.getByRole('link', { name: 'Peserta' }))
    await router.navigate('/dev/prototypes/participants?workflow=prototype')
    expectLocation(router, '/dev/prototypes/participants?workflow=prototype')
    expect(await screen.findByRole('heading', { name: 'Choose participant file' })).toBeVisible()
    expectNoProductionSuccessClaim()

    await user.click(
      screen.getByRole('link', {
        name: 'Continue to column mapping',
      }),
    )
    expectLocation(router, '/dev/prototypes/participants?step=mapping')
    expect(screen.getByRole('heading', { name: 'Map spreadsheet columns' }))
      .toBeVisible()
    expectNoProductionSuccessClaim()

    await user.click(
      screen.getByRole('link', { name: 'Validate participant data' }),
    )
    expectLocation(router, '/dev/prototypes/participants?step=validation')
    expect(screen.getByRole('heading', { name: 'Review validation results' }))
      .toBeVisible()
    expectNoProductionSuccessClaim()

    await user.click(
      screen.getByRole('link', { name: 'Review import summary' }),
    )
    expectLocation(router, '/dev/prototypes/participants?step=summary')
    expect(screen.getByRole('heading', { name: 'Review import summary' }))
      .toBeVisible()
    expectNoProductionSuccessClaim()

    await user.click(
      screen.getByRole('link', { name: 'Continue to Draw Setup' }),
    )
    expectLocation(router, '/dev/prototypes/draw/setup?mode=practice&scenario=ready')
    expect(screen.getByRole('heading', { level: 1, name: 'Pengaturan Undian' }))
      .toBeVisible()
    expectNoProductionSuccessClaim()

    await router.navigate('/dev/prototypes/draw/live?state=ready&mode=practice')
    expectLocation(router, '/dev/prototypes/draw/live?state=ready&mode=practice')
    expect(await screen.findByRole('heading', { name: 'Operator start gate' }))
      .toBeVisible()
    expectNoProductionSuccessClaim()

    await user.click(
      screen.getByRole('button', { name: 'Hold to start draw' }),
    )
    await user.click(
      screen.getByRole('button', {
        name: 'Show countdown prototype',
      }),
    )
    await waitFor(() => {
      expectLocation(
        router,
        '/dev/prototypes/draw/live?state=running&mode=practice&stage=countdown',
      )
    })
    expect(screen.getByLabelText('Static countdown value 3')).toBeVisible()
    expectNoProductionSuccessClaim()

    await user.click(
      screen.getByRole('link', { name: 'Show rolling state' }),
    )
    expectLocation(
      router,
      '/dev/prototypes/draw/live?state=running&mode=practice&stage=rolling',
    )
    expect(screen.getByLabelText('Static ticket stream')).toBeVisible()
    expectNoProductionSuccessClaim()

    await user.click(
      screen.getByRole('link', { name: 'Tinjau Hasil Tertunda' }),
    )
    expectLocation(router, '/dev/prototypes/draw/results')
    expect(screen.getByRole('heading', { level: 1, name: 'Hasil Tertunda' }))
      .toBeVisible()
    expectNoProductionSuccessClaim()

    await user.click(
      screen.getByRole('button', { name: 'Confirm selected (2)' }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Show partial scenario' }),
    )
    await waitFor(() => {
      expectLocation(router, '/dev/prototypes/draw/results?scenario=partial')
    })
    expect(
      screen.getByRole('table', {
        name: 'Prototype winner records for partial scenario',
      }),
    ).toBeVisible()
    expectNoProductionSuccessClaim()

    await user.click(screen.getByRole('link', { name: 'Open redraw' }))
    expectLocation(
      router,
      '/dev/prototypes/draw/results?scenario=partial&panel=redraw&selection=multiple',
    )
    expect(
      screen.getByRole('dialog', {
        name: 'Redraw 2 selected winners',
      }),
    ).toBeVisible()
    expectNoProductionSuccessClaim()

    await user.click(
      screen.getByRole('link', { name: 'Preview replacement' }),
    )
    expectLocation(
      router,
      '/dev/prototypes/draw/results?scenario=partial&panel=replacement',
    )
    expect(
      screen.getByRole('dialog', {
        name: 'Replacement relationship preview',
      }),
    ).toBeVisible()
    expectNoProductionSuccessClaim()

    await user.click(
      screen.getByRole('link', { name: 'Review in History' }),
    )
    expectLocation(router, '/dev/prototypes/history?view=session-detail')
    expect(
      screen.getByRole('heading', {
        name: 'Cancellation & replacement',
      }),
    ).toBeVisible()
    expectNoProductionSuccessClaim()

    await user.click(
      screen.getByRole('link', {
        name: 'Review presentation settings',
      }),
    )
    expectLocation(router, '/dev/prototypes/settings?section=branding')
    expect(screen.getByRole('heading', { level: 2, name: 'Branding' }))
      .toBeVisible()
    expectNoProductionSuccessClaim()

    await user.click(
      screen.getByRole('link', { name: 'Preview display' }),
    )
    expectLocation(router, '/dev/prototypes/display?state=standby')
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Draw will begin shortly',
      }),
    ).toBeVisible()
    expectNoProductionSuccessClaim()
  }, 15_000)
})
