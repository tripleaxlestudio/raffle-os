import { describe, expect, it } from 'vitest'
import audienceFixtureSource from './data/audience.fixture.ts?raw'
import audienceTypesSource from './audience-types.ts?raw'
import scenarioQuerySource from './scenario-query.ts?raw'
import audiencePageSource from '../pages/display/AudienceDisplayPage.tsx?raw'
import audienceShellSource from '../app/layouts/AudienceDisplayShell.tsx?raw'
import audienceStylesSource from '../styles/audience.css?raw'
import audienceStageSource from '../ui/audience/AudienceStage.tsx?raw'
import blackoutStageSource from '../ui/audience/BlackoutStage.tsx?raw'
import countdownStageSource from '../ui/audience/CountdownStage.tsx?raw'
import disconnectedStageSource from '../ui/audience/DisconnectedStage.tsx?raw'
import displayStateLabelSource from '../ui/audience/DisplayStateLabel.tsx?raw'
import eventBrandSource from '../ui/audience/EventBrand.tsx?raw'
import rollingStageSource from '../ui/audience/RollingStage.tsx?raw'
import standbyStageSource from '../ui/audience/StandbyStage.tsx?raw'
import ticketTileSource from '../ui/audience/TicketTile.tsx?raw'
import winnerGridSource from '../ui/audience/WinnerGrid.tsx?raw'
import winnerStageSource from '../ui/audience/WinnerStage.tsx?raw'
import { audienceFixtures } from './data/audience.fixture.ts'

const audienceImplementationSource = [
  audienceFixtureSource,
  audienceTypesSource,
  scenarioQuerySource,
  audiencePageSource,
  audienceShellSource,
  audienceStylesSource,
  audienceStageSource,
  blackoutStageSource,
  countdownStageSource,
  disconnectedStageSource,
  displayStateLabelSource,
  eventBrandSource,
  rollingStageSource,
  standbyStageSource,
  ticketTileSource,
  winnerGridSource,
  winnerStageSource,
].join('\n')

describe('Audience prototype scope', () => {
  it('contains no communication, storage, file, timer, randomness, fullscreen, or audio implementation', () => {
    const forbiddenPatterns = [
      new RegExp(`${'BroadcastChannel'}\\b`),
      new RegExp(`${'localStorage'}\\b`),
      new RegExp(`${'sessionStorage'}\\b`),
      new RegExp(`${'indexedDB'}\\b`),
      new RegExp(`${'FileReader'}\\b`),
      new RegExp(`Math\\.${'random'}\\s*\\(`),
      new RegExp(`crypto\\.${'getRandomValues'}\\s*\\(`),
      new RegExp(`${'Date.now'}\\s*\\(`),
      new RegExp(`${'setTimeout'}\\s*\\(`),
      new RegExp(`${'setInterval'}\\s*\\(`),
      new RegExp(`${'requestAnimationFrame'}\\s*\\(`),
      new RegExp(`\\.${'requestFullscreen'}\\s*\\(`),
      new RegExp(`\\.${'exitFullscreen'}\\s*\\(`),
      new RegExp(`new\\s+${'Audio'}\\s*\\(`),
      new RegExp(`\\.${'play'}\\s*\\(`),
      new RegExp(`\\.${'pause'}\\s*\\(`),
      new RegExp(`@keyframes\\b`),
    ]

    for (const pattern of forbiddenPatterns) {
      expect(audienceImplementationSource).not.toMatch(pattern)
    }
  })

  it('limits Audience fixture keys to public presentation data', () => {
    const fixtureJson = JSON.stringify(audienceFixtures)
    const forbiddenFixtureKeys = [
      'participantName',
      'email',
      'phone',
      'group',
      'checkIn',
      'eligibility',
      'sessionId',
      'operator',
      'redrawReason',
      'internalNotes',
      'replacementReason',
      'databaseId',
    ]

    for (const key of forbiddenFixtureKeys) {
      expect(fixtureJson).not.toMatch(
        new RegExp(`"${key}"\\s*:`, 'i'),
      )
    }
  })

  it('keeps all Audience ticket identifiers as exact strings', () => {
    for (const count of [1, 6, 10, 20] as const) {
      for (const ticketNumber of audienceFixtures.reveal[count]
        .ticketNumbers) {
        expect(typeof ticketNumber).toBe('string')
        expect(ticketNumber).toMatch(/^\d{6}$/)
      }
    }
  })
})
