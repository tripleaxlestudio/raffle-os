import type { ReactNode } from 'react'
import type { PublicAudienceContext } from './audience-view.types.ts'
import { EventBrand } from './EventBrand.tsx'

export function AudienceDrawHeader({ context, winnerCount, children, className = '' }: { readonly context: PublicAudienceContext; readonly winnerCount?: number; readonly children?: ReactNode; readonly className?: string }) {
  return <header className={['audience-draw-header', className].filter(Boolean).join(' ')}>
    <EventBrand compact eventName={context.eventName} eventSubtitle={context.eventSubtitle} logo={context.logo} />
    <div className="audience-draw-header__identity">
      <p className="audience-eyebrow">UNDIAN AKTIF</p>
      <h1 className="audience-draw-header__prize">{context.prizeLabel}</h1>
      <p className="audience-draw-header__meta"><span>{context.prizeCategory}</span>{winnerCount === undefined ? null : <><span aria-hidden="true">·</span><strong>{winnerCount} Pemenang</strong></>}</p>
      {children}
    </div>
  </header>
}
