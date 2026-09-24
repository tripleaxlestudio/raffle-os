import { useEffect, useMemo } from 'react'

interface EventBrandProps { compact?: boolean; eventName: string; eventSubtitle: string; logo?: Blob | string }

export function EventBrand({ compact = false, eventName, eventSubtitle, logo }: EventBrandProps) {
  const logoUrl = useMemo(() => logo === undefined ? undefined : typeof logo === 'string' ? logo : URL.createObjectURL(logo), [logo])
  useEffect(() => () => { if (logoUrl !== undefined && typeof logo !== 'string') URL.revokeObjectURL(logoUrl) }, [logo, logoUrl])
  return <div aria-label="Acara" className={`event-brand${compact ? ' event-brand--compact' : ''}`}>
    {logoUrl ? <img className="event-brand__logo" src={logoUrl} alt="" /> : null}
    <p className="event-brand__name">{eventName}</p>
    <p className="event-brand__subtitle">{eventSubtitle}</p>
  </div>
}
