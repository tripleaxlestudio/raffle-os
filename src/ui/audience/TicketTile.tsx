interface TicketTileProps {
  confirmed: boolean
  ticketNumber?: string
  visible?: boolean
}

export function TicketTile({
  confirmed,
  ticketNumber,
  visible = true,
}: TicketTileProps) {
  return (
    <li
      className="ticket-tile"
      data-confirmed={confirmed ? 'true' : 'false'}
      data-ticket-tile
      data-visible={visible ? 'true' : 'false'}
    >
      {visible ? <><span className="ticket-tile__label">Ticket</span><strong className="ticket-tile__number">{ticketNumber}</strong></> : <span className="ticket-tile__waiting" aria-label="Winner pending">Awaiting winner</span>}
    </li>
  )
}
