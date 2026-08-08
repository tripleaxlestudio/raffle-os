import { TicketTile } from './TicketTile.tsx'
import { composeWinnerRows, winnerLayoutTier, winnerRowComposition, winnerRowMax } from './winner-layout.ts'
import type { CSSProperties } from 'react'

interface WinnerGridProps {
  confirmed?: boolean
  winnerStatuses?: readonly ('pending' | 'confirmed')[]
  count: number
  ticketNumbers: readonly string[]
  lockedCount?: number
  rolling?: boolean
  className?: string
  ariaLabel?: string
  prototypeStatic?: boolean
  revealEntrance?: boolean
}

function layoutMetadata(count: number) {
  const tier = winnerLayoutTier(count)
  const composition = winnerRowComposition(count)
  const columns = count <= 3 ? count : composition[0] ?? 1
  return { columns, layout: tier === 'a' ? 'hero' : `${columns}x${composition.length}`, rows: composition.length, tier, composition }
}

export function WinnerGrid({
  confirmed,
  winnerStatuses,
  count,
  ticketNumbers,
  lockedCount = ticketNumbers.length,
  rolling = false,
  className,
  ariaLabel,
  prototypeStatic = false,
  revealEntrance = false,
}: WinnerGridProps) {
  const metadata = layoutMetadata(count)

  return (
    <div
      role="list"
      aria-label={ariaLabel ?? `${count} ticket ${confirmed ? 'confirmed results' : 'results'}`}
      className={`winner-grid winner-grid--${count}${className === undefined ? '' : ` ${className}`}`}
      data-columns={metadata.columns}
      data-grid-layout={metadata.layout}
      data-rows={metadata.rows}
      data-winner-count={count}
      data-slot-count={count}
      data-layout-tier={metadata.tier}
      data-layout-group={metadata.tier === 'b' && count > 1 ? 'centered' : 'distributed'}
      data-row-composition={metadata.composition.join(',')}
      data-testid="winner-grid"
      data-prototype-static={prototypeStatic ? 'true' : undefined}
      style={{ '--winner-row-max': winnerRowMax(count), marginInline: 'auto', justifySelf: 'center', alignItems: 'center', ...(metadata.tier === 'b' ? { width: 'fit-content', maxWidth: '100%', gridTemplateColumns: `repeat(${metadata.columns}, minmax(min(18rem, 28vw), 26rem))` } : {}) } as CSSProperties}
    >
      {composeWinnerRows(Array.from({ length: count }, (_, index) => index)).map((row, rowIndex) => (
        <div className="winner-grid__row" data-row-index={rowIndex} data-row-length={row.length} key={rowIndex}>
          {row.map((index) => {
            const locked = !rolling || index < lockedCount
            const ticketNumber = ticketNumbers[index]
            const status = locked && (winnerStatuses?.[index] ?? (confirmed ? 'confirmed' : 'pending')) === 'confirmed' ? 'confirmed' : 'pending'
            return <TicketTile status={status} key={index} ticketNumber={ticketNumber ?? '000000'} locked={locked} revealEntrance={revealEntrance} />
          })}
        </div>
      ))}
    </div>
  )
}
