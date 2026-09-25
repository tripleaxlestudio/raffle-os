// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { consumeRuntimeUpdateBootstrap, UPDATE_CAPABILITY_ENVIRONMENT_VARIABLE, UPDATE_TOKEN_ENVIRONMENT_VARIABLE } from './runtime-capability.ts'

const token = 'a'.repeat(43)

describe('consumeRuntimeUpdateBootstrap', () => {
  it('accepts one valid installed launcher bootstrap and consumes it', () => {
    const environment = { [UPDATE_CAPABILITY_ENVIRONMENT_VARIABLE]: 'installed', [UPDATE_TOKEN_ENVIRONMENT_VARIABLE]: token }
    expect(consumeRuntimeUpdateBootstrap(environment)).toEqual({ capability: 'installed', mutationToken: token })
    expect(environment).toEqual({})
    expect(consumeRuntimeUpdateBootstrap(environment)).toEqual({ capability: 'portable' })
  })

  it('keeps explicit portable metadata disabled and discards its token', () => {
    const environment = { [UPDATE_CAPABILITY_ENVIRONMENT_VARIABLE]: 'portable', [UPDATE_TOKEN_ENVIRONMENT_VARIABLE]: token }
    expect(consumeRuntimeUpdateBootstrap(environment)).toEqual({ capability: 'portable' })
  })

  it.each([
    ['absent metadata', {}],
    ['invalid capability', { [UPDATE_CAPABILITY_ENVIRONMENT_VARIABLE]: 'development', [UPDATE_TOKEN_ENVIRONMENT_VARIABLE]: token }],
    ['missing token', { [UPDATE_CAPABILITY_ENVIRONMENT_VARIABLE]: 'installed' }],
    ['short token', { [UPDATE_CAPABILITY_ENVIRONMENT_VARIABLE]: 'installed', [UPDATE_TOKEN_ENVIRONMENT_VARIABLE]: 'short' }],
    ['non-base64url token', { [UPDATE_CAPABILITY_ENVIRONMENT_VARIABLE]: 'installed', [UPDATE_TOKEN_ENVIRONMENT_VARIABLE]: `${'a'.repeat(42)}+` }],
  ])('fails closed for %s', (_label, environment) => {
    expect(consumeRuntimeUpdateBootstrap(environment)).toEqual({ capability: 'portable' })
  })
})
