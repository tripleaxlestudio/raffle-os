import { useEffect, useMemo, type CSSProperties } from 'react'
import type { LocalAsset } from '../../domain/settings/event-settings.types.ts'
import { EventBrand } from './EventBrand.tsx'

interface AudiencePreviewSurfaceProps {
  readonly displayName: string
  readonly subtitle?: string
  readonly logo?: LocalAsset
  readonly background?: LocalAsset
  readonly primaryColor: string
  readonly accentColor: string
  readonly safeAreaMargin: number
  readonly className?: string
}

export function AudiencePreviewSurface({
  accentColor,
  background,
  className,
  displayName,
  logo,
  primaryColor,
  safeAreaMargin,
  subtitle = '',
}: AudiencePreviewSurfaceProps) {
  const logoUrl = useMemo(() => logo === undefined ? undefined : URL.createObjectURL(logo.blob), [logo])
  const backgroundUrl = useMemo(() => background === undefined ? undefined : URL.createObjectURL(background.blob), [background])

  useEffect(() => () => {
    if (logoUrl !== undefined) URL.revokeObjectURL(logoUrl)
  }, [logoUrl])
  useEffect(() => () => {
    if (backgroundUrl !== undefined) URL.revokeObjectURL(backgroundUrl)
  }, [backgroundUrl])

  const style = {
    '--audience-safe-inline': `${safeAreaMargin}px`,
    '--audience-safe-block': `${safeAreaMargin}px`,
    '--accent': primaryColor,
    '--accent-hover': accentColor,
    '--audience-background-image': backgroundUrl === undefined ? undefined : `url(${backgroundUrl})`,
  } as CSSProperties

  return <div className={['audience-stage', 'audience-preview-surface', 'settings-display-preview', className].filter(Boolean).join(' ')} style={style}>
    <EventBrand eventName={displayName} eventSubtitle={subtitle} logo={logoUrl} />
    <div className="audience-preview-surface__message">
      <p className="audience-eyebrow">Display ready</p>
      <h1>Draw will begin shortly</h1>
      <p className="audience-prize"><span>Current draw</span><strong>Winner announcement</strong></p>
    </div>
    <div aria-hidden="true" className="audience-safe-area-markers" />
    <span className="audience-preview-surface__label">STATIC DISPLAY PREVIEW</span>
  </div>
}
