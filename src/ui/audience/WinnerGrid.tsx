import { TicketTile } from './TicketTile.tsx'

interface WinnerGridProps {
  confirmed: boolean
  count: number
  ticketNumbers: readonly string[]
  visibleCount?: number
}

function layoutMetadata(count: number) {
  if (count === 1) return { columns: 1, layout: 'hero', rows: 1 }
  const columns = count <= 6 ? 3 : 5
  const rows = Math.ceil(count / columns)
  return { columns, layout: `${columns}x${rows}`, rows }
}

export function WinnerGrid({
  confirmed,
  count,
  ticketNumbers,
  visibleCount = ticketNumbers.length,
}: WinnerGridProps) {
  const metadata = layoutMetadata(count)

  return (
    <ol
      aria-label={`${count} ticket ${confirmed ? 'confirmed results' : 'results'}`}
      className={`winner-grid winner-grid--${count}`}
      data-columns={metadata.columns}
      data-grid-layout={metadata.layout}
      data-rows={metadata.rows}
      data-winner-count={count}
      style={{ gridTemplateColumns: `repeat(${metadata.columns}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${metadata.rows}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: count }, (_, index) => {
        const ticketNumber = ticketNumbers[index]
        return <TicketTile confirmed={confirmed} key={ticketNumber ?? `pending-${index}`} ticketNumber={ticketNumber} visible={index < visibleCount && ticketNumber !== undefined} />
      })}
    </ol>
  )
}
