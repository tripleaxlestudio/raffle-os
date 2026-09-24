import type { ComponentProps } from 'react'
import { openManagedAudienceDisplay } from '../../infrastructure/browser/managed-audience-display.ts'
import { Button, Icon } from '../ui/index.ts'

interface AudienceDisplayButtonProps
  extends Omit<ComponentProps<typeof Button>, 'children' | 'icon' | 'onClick'> {
  readonly displayUrl: string
  readonly onPopupBlocked?: (blocked: boolean) => void
}

export function AudienceDisplayButton({
  displayUrl,
  onPopupBlocked,
  ...buttonProps
}: AudienceDisplayButtonProps) {
  return (
    <Button
      icon={<Icon name="ExternalLink" />}
      iconAfter
      onClick={() => {
        onPopupBlocked?.(openManagedAudienceDisplay(displayUrl) === 'blocked')
      }}
      {...buttonProps}
    >
      Buka Tampilan Audiens
    </Button>
  )
}
