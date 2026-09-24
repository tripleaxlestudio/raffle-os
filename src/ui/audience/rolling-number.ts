export const SYNTHETIC_ROLL_WIDTH = 6

export function rollingFrameIndex(rollingStartedAt: string | undefined, nowMs: number, speed: number): number {
  if (rollingStartedAt === undefined) return 0
  return Math.max(0, Math.floor((nowMs - Date.parse(rollingStartedAt)) / 1000 * speed))
}

export function syntheticRollingNumber(seed: string, slotIndex: number, frameIndex: number): string {
  let hash = 2166136261
  for (const character of `${seed}:${slotIndex}:${frameIndex}`) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return ((hash >>> 0) % 1000000).toString().padStart(SYNTHETIC_ROLL_WIDTH, '0')
}
