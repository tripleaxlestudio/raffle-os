type AudienceWinnerCount = 1 | 6 | 10 | 20
import { TicketTile } from './TicketTile.tsx'

interface WinnerGridProps {
  confirmed: boolean
  count: AudienceWinnerCount
  ticketNumbers: readonly string[]
}

const layoutMetadata = {
  1: { columns: 1, layout: 'hero', rows: 1 },
  6: { columns: 3, layout: '3x2', rows: 2 },
  10: { columns: 5, layout: '5x2', rows: 2 },
  20: { columns: 5, layout: '5x4', rows: 4 },
} as const satisfies Record<
  AudienceWinnerCount,
  { columns: number; layout: string; rows: number }
>

export function WinnerGrid({
  confirmed,
  count,
  ticketNumbers,
}: WinnerGridProps) {
  const metadata = layoutMetadata[count]

  return (
    <ol
      aria-label={`${count} ticket ${confirmed ? 'confirmed results' : 'results'}`}
      className={`winner-grid winner-grid--${count}`}
      data-columns={metadata.columns}
      data-grid-layout={metadata.layout}
      data-rows={metadata.rows}
      data-winner-count={count}
    >
      {ticketNumbers.map((ticketNumber) => (
        <TicketTile
          confirmed={confirmed}
          key={ticketNumber}
          ticketNumber={ticketNumber}
        />
      ))}
    </ol>
  )
}
