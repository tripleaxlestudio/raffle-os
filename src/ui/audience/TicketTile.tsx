interface TicketTileProps {
  confirmed: boolean
  ticketNumber: string
}

export function TicketTile({
  confirmed,
  ticketNumber,
}: TicketTileProps) {
  return (
    <li
      className="ticket-tile"
      data-confirmed={confirmed ? 'true' : 'false'}
      data-ticket-tile
    >
      <span className="ticket-tile__label">Ticket</span>
      <strong className="ticket-tile__number">{ticketNumber}</strong>
    </li>
  )
}
