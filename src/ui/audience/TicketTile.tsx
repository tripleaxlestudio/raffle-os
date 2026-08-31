interface TicketTileProps {
  status: 'pending' | 'confirmed'
  ticketNumber?: string
  locked?: boolean
  revealEntrance?: boolean
}

export function TicketTile({
  status,
  ticketNumber,
  locked = true,
  revealEntrance = false,
}: TicketTileProps) {
  return (
    <div
      role="listitem"
      className="ticket-tile"
      data-confirmed={status === 'confirmed' ? 'true' : 'false'}
      data-verification-status={status}
      data-ticket-tile
      data-visible="true"
      data-locked={locked ? 'true' : 'false'}
      data-reveal-entrance={revealEntrance ? 'true' : 'false'}
    >
      <span className="ticket-tile__label">{locked ? status === 'confirmed' ? 'Dikonfirmasi' : 'Menunggu' : 'Berputar'}</span><strong className="ticket-tile__number">{ticketNumber}</strong>
    </div>
  )
}
