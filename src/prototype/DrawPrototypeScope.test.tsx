import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { appRoutes } from '../app/router.tsx'
import drawSetupFixtureSource from './data/draw-setup.fixture.ts?raw'
import liveDrawFixtureSource from './data/live-draw.fixture.ts?raw'
import scenarioQuerySource from './scenario-query.ts?raw'
import drawSetupPageSource from '../pages/operator/DrawSetupPage.tsx?raw'
import liveDrawPageSource from '../pages/operator/LiveDrawPage.tsx?raw'

const implementationSources = [
  drawSetupFixtureSource,
  liveDrawFixtureSource,
  scenarioQuerySource,
  drawSetupPageSource,
  liveDrawPageSource,
]

describe('Draw prototype scope and separation', () => {
  it('contains no random, timer, persistence, or communication APIs', () => {
    const source = implementationSources.join('\n')
    const forbiddenPatterns = [
      new RegExp(`Math\\.${'random'}\\s*\\(`),
      new RegExp(`crypto\\.${'getRandomValues'}\\s*\\(`),
      new RegExp(`${'setTimeout'}\\s*\\(`),
      new RegExp(`${'setInterval'}\\s*\\(`),
      new RegExp(`${'requestAnimationFrame'}\\s*\\(`),
      new RegExp(`${'Date.now'}\\s*\\(`),
      new RegExp(`${'localStorage'}\\b`),
      new RegExp(`${'indexedDB'}\\b`),
      new RegExp(`${'BroadcastChannel'}\\b`),
    ]

    for (const pattern of forbiddenPatterns) {
      expect(source).not.toMatch(pattern)
    }
  })

  it('keeps the Audience Display free of Operator draw controls', () => {
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/dev/prototypes/display'],
    })
    render(<RouterProvider router={router} />)

    expect(
      screen.getByRole('heading', { name: 'Draw will begin shortly' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('navigation', {
        name: 'Prototype navigation scenarios',
      }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Hold to start draw' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('000123')).not.toBeInTheDocument()
  })
})
