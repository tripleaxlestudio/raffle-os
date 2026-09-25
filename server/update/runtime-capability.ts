import type { UpdateCapability } from './update-api.ts'

export const UPDATE_CAPABILITY_ENVIRONMENT_VARIABLE = 'KOCOKAN_UPDATE_CAPABILITY'
export const UPDATE_TOKEN_ENVIRONMENT_VARIABLE = 'KOCOKAN_UPDATE_TOKEN'

export interface RuntimeUpdateBootstrap {
  readonly capability: Exclude<UpdateCapability, 'development'>
  readonly mutationToken?: string
}

function validToken(value: string | undefined): value is string {
  // 32 random bytes encoded as unpadded base64url are exactly 43 characters.
  return value !== undefined && /^[A-Za-z0-9_-]{43}$/.test(value)
}

export function consumeRuntimeUpdateBootstrap(environment: Record<string, string | undefined>): RuntimeUpdateBootstrap {
  const capability = environment[UPDATE_CAPABILITY_ENVIRONMENT_VARIABLE]
  const token = environment[UPDATE_TOKEN_ENVIRONMENT_VARIABLE]
  delete environment[UPDATE_CAPABILITY_ENVIRONMENT_VARIABLE]
  delete environment[UPDATE_TOKEN_ENVIRONMENT_VARIABLE]
  if (capability !== 'installed' || !validToken(token)) return { capability: 'portable' }
  return { capability: 'installed', mutationToken: token }
}
