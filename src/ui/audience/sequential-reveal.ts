export const SEQUENTIAL_REVEAL_INTERVAL_MS = 800

export function visibleWinnerCount(startedAt: string | undefined, winnerCount: number, now = Date.now()): number {
  if (winnerCount <= 1) return winnerCount
  const elapsed = startedAt === undefined ? 0 : Math.max(0, now - Date.parse(startedAt))
  return Math.min(winnerCount, Math.max(1, Math.floor(elapsed / SEQUENTIAL_REVEAL_INTERVAL_MS) + 1))
}
