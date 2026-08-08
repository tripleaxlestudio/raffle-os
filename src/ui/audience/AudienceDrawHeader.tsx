import type { ReactNode } from 'react'
import type { PublicAudienceContext } from './audience-view.types.ts'
import { EventBrand } from './EventBrand.tsx'

export function AudienceDrawHeader({ context, children, className = '' }: { readonly context: PublicAudienceContext; readonly children?: ReactNode; readonly className?: string }) {
  return <header className={['audience-draw-header', className].filter(Boolean).join(' ')}>
    <EventBrand compact eventName={context.eventName} eventSubtitle={context.eventSubtitle} />
    <div className="audience-draw-header__identity">
      <p className="audience-eyebrow">Current draw</p>
      <p className="audience-draw-header__category">{context.prizeCategory}</p>
      <p className="audience-draw-header__prize">{context.prizeLabel}</p>
      {children}
    </div>
  </header>
}
