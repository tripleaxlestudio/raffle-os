interface EventBrandProps {
  compact?: boolean
  eventName: string
  eventSubtitle: string
}

export function EventBrand({
  compact = false,
  eventName,
  eventSubtitle,
}: EventBrandProps) {
  return (
    <div
      aria-label="Event"
      className={`event-brand${compact ? ' event-brand--compact' : ''}`}
    >
      <p className="event-brand__name">{eventName}</p>
      <p className="event-brand__subtitle">{eventSubtitle}</p>
    </div>
  )
}
