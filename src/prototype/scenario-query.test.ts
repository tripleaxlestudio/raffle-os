import { describe, expect, it } from 'vitest'
import {
  resolvePrototypeDrawSetupQuery,
  resolvePrototypeLiveDrawQuery,
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
