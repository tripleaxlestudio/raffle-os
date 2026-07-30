import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { appRoutes } from '../app/router.tsx'
import historyFixtureSource from './data/history.fixture.ts?raw'
import pendingFixtureSource from './data/pending-results.fixture.ts?raw'
import redrawFixtureSource from './data/redraw.fixture.ts?raw'
import settingsFixtureSource from './data/settings.fixture.ts?raw'
import historyPageSource from '../pages/operator/HistoryPage.tsx?raw'
import pendingPageSource from '../pages/operator/PendingResultsPage.tsx?raw'
import settingsPageSource from '../pages/operator/SettingsPage.tsx?raw'

const implementationSource = [
  historyFixtureSource,
  pendingFixtureSource,
  redrawFixtureSource,
  settingsFixtureSource,
  historyPageSource,
  pendingPageSource,
  settingsPageSource,
].join('\n')

describe('Slice 4 scope and privacy', () => {
  it('contains no random, storage, file, audio, communication, or export implementation', () => {
    const forbiddenPatterns = [
      new RegExp(`Math\\.${'random'}\\s*\\(`),
      new RegExp(`crypto\\.${'getRandomValues'}\\s*\\(`),
      new RegExp(`${'Date.now'}\\s*\\(`),
      new RegExp(`${'localStorage'}\\b`),
      new RegExp(`${'sessionStorage'}\\b`),
      new RegExp(`${'indexedDB'}\\b`),
      new RegExp(`${'FileReader'}\\b`),
      new RegExp(`${'BroadcastChannel'}\\b`),
      new RegExp(`\\.createObjectURL\\s*\\(`),
      new RegExp(`\\.play\\s*\\(`),
      new RegExp(`\\.pause\\s*\\(`),
      new RegExp(`download\\s*=`),
    ]

    for (const pattern of forbiddenPatterns) {
      expect(implementationSource).not.toMatch(pattern)
    }
  })

  it('keeps fixtures frozen and deterministic', async () => {
    const { historyFixture, pendingResultsFixtures, redrawFixture, settingsFixture } =
      await import('./data/index.ts')

    expect(Object.isFrozen(pendingResultsFixtures)).toBe(true)
    expect(Object.isFrozen(redrawFixture)).toBe(true)
    expect(Object.isFrozen(historyFixture)).toBe(true)
    expect(Object.isFrozen(settingsFixture)).toBe(true)
    expect(redrawFixture.relationship.originalTicket).toBe('004216')
    expect(redrawFixture.relationship.replacementTicket).toBe('035118')
  })

  it('keeps Operator details and PrototypeNavigator out of /display', () => {
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/display?state=standby'],
    })
    render(<RouterProvider router={router} />)

    for (const operatorDetail of [
      'Alya Pranoto',
      'Bima Raharja',
      'Jakarta Chapter',
      'Participant absent',
      '000784',
      '004216',
    ]) {
      expect(screen.queryByText(operatorDetail)).not.toBeInTheDocument()
    }
    expect(
      screen.queryByRole('navigation', {
        name: 'Prototype navigation scenarios',
      }),
    ).not.toBeInTheDocument()
  })
})
