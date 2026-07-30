import { describe, expect, it } from 'vitest'
import {
  resolvePrototypeDrawSetupQuery,
  resolvePrototypeHistoryView,
  resolvePrototypeLiveDrawQuery,
  resolvePrototypePendingResultsQuery,
  resolvePrototypeSettingsSection,
} from './scenario-query.ts'

describe('draw prototype query parsing', () => {
  it('defaults Draw Setup safely', () => {
    expect(resolvePrototypeDrawSetupQuery(new URLSearchParams())).toEqual({
      mode: 'practice',
      scenario: 'ready',
    })
  })

  it('accepts supported Draw Setup values', () => {
    expect(
      resolvePrototypeDrawSetupQuery(
        new URLSearchParams('mode=live&scenario=insufficient'),
      ),
    ).toEqual({
      mode: 'live',
      scenario: 'insufficient',
    })
  })

  it('falls back for invalid Draw Setup values', () => {
    expect(
      resolvePrototypeDrawSetupQuery(
        new URLSearchParams('mode=official&scenario=unknown'),
      ),
    ).toEqual({
      mode: 'practice',
      scenario: 'ready',
    })
  })

  it('defaults Live Draw safely', () => {
    expect(resolvePrototypeLiveDrawQuery(new URLSearchParams())).toEqual({
      mode: 'practice',
      stage: 'countdown',
      state: 'ready',
    })
  })

  it('accepts the running rolling state', () => {
    expect(
      resolvePrototypeLiveDrawQuery(
        new URLSearchParams(
          'state=running&mode=live&stage=rolling',
        ),
      ),
    ).toEqual({
      mode: 'live',
      stage: 'rolling',
      state: 'running',
    })
  })

  it('falls back for invalid Live Draw values', () => {
    expect(
      resolvePrototypeLiveDrawQuery(
        new URLSearchParams(
          'state=drawing&mode=official&stage=reveal',
        ),
      ),
    ).toEqual({
      mode: 'practice',
      stage: 'countdown',
      state: 'ready',
    })
  })

  it('falls back to countdown for an invalid running stage', () => {
    expect(
      resolvePrototypeLiveDrawQuery(
        new URLSearchParams(
          'state=running&mode=practice&stage=winner',
        ),
      ),
    ).toEqual({
      mode: 'practice',
      stage: 'countdown',
      state: 'running',
    })
  })
})

describe('Slice 4 prototype query parsing', () => {
  it('defaults Pending Results safely', () => {
    expect(
      resolvePrototypePendingResultsQuery(new URLSearchParams()),
    ).toEqual({
      panel: 'summary',
      scenario: 'pending',
      selection: 'single',
    })
  })

  it('accepts supported Pending Results and redraw values', () => {
    expect(
      resolvePrototypePendingResultsQuery(
        new URLSearchParams(
          'scenario=partial&panel=redraw&selection=multiple',
        ),
      ),
    ).toEqual({
      panel: 'redraw',
      scenario: 'partial',
      selection: 'multiple',
    })
  })

  it('falls back for invalid result scenarios and redraw selections', () => {
    expect(
      resolvePrototypePendingResultsQuery(
        new URLSearchParams(
          'scenario=official&panel=mutation&selection=all',
        ),
      ),
    ).toEqual({
      panel: 'summary',
      scenario: 'pending',
      selection: 'single',
    })
  })

  it('falls back invalid History views to sessions', () => {
    expect(
      resolvePrototypeHistoryView(new URLSearchParams('view=deleted')),
    ).toBe('sessions')
    expect(
      resolvePrototypeHistoryView(
        new URLSearchParams('view=session-detail'),
      ),
    ).toBe('session-detail')
  })

  it('falls back invalid Settings sections to branding', () => {
    expect(
      resolvePrototypeSettingsSection(
        new URLSearchParams('section=storage'),
      ),
    ).toBe('branding')
    expect(
      resolvePrototypeSettingsSection(
        new URLSearchParams('section=display'),
      ),
    ).toBe('display')
  })
})
