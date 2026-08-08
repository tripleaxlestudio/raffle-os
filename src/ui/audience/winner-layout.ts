export type WinnerLayoutTier = 'a' | 'b' | 'c' | 'd' | 'e' | 'f'

/**
 * Returns the maximum number of tickets that belong in one centered row.
 * The 1-3 tier intentionally keeps its existing single-row behavior.
 */
export function winnerRowMax(count: number): number {
  if (count <= 3) return Math.max(1, count)
  if (count <= 8) return 4
  if (count <= 20) return 5
  return 10
}

/**
 * Builds balanced row lengths. Rows are minimal for the applicable tier,
 * longer rows come first, and adjacent row lengths differ by at most one.
 */
export function winnerRowComposition(count: number): readonly number[] {
  const normalizedCount = Math.max(1, Math.floor(count))
  const maxPerRow = winnerRowMax(normalizedCount)
  const rowCount = normalizedCount <= 3 ? 1 : normalizedCount <= 8 ? 2 : Math.ceil(normalizedCount / maxPerRow)
  const shortRowLength = Math.floor(normalizedCount / rowCount)
  const longerRowCount = normalizedCount % rowCount

  return Array.from({ length: rowCount }, (_, index) => shortRowLength + (index < longerRowCount ? 1 : 0))
}

export function composeWinnerRows<T>(items: readonly T[]): readonly (readonly T[])[] {
  const rows = winnerRowComposition(items.length)
  let offset = 0
  return rows.map((length) => {
    const row = items.slice(offset, offset + length)
    offset += length
    return row
  })
}

export function winnerLayoutTier(count: number): WinnerLayoutTier {
  if (count === 1) return 'a'
  if (count <= 3) return 'b'
  if (count <= 6) return 'c'
  if (count <= 10) return 'd'
  if (count <= 20) return 'e'
  return 'f'
}
