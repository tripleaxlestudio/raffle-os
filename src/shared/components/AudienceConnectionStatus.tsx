import { useUiClass } from '../ui/ui-theme.ts'
import type { DisplayConnectionStatus } from '../../application/display-transport/connection-status.ts'
import { Icon, type IconName } from '../ui/Icon.tsx'

const presentation: Record<DisplayConnectionStatus, { label: string; icon: IconName }> = {
  'setup-required': { label: 'Perlu pengaturan', icon: 'MonitorCog' },
  waiting: { label: 'Menunggu', icon: 'Clock' },
  connected: { label: 'Terhubung', icon: 'MonitorCheck' },
  reconnecting: { label: 'Menghubungkan ulang', icon: 'RefreshCw' },
  unavailable: { label: 'Tidak tersedia', icon: 'CircleX' },
  'publication-failed': { label: 'Publikasi gagal', icon: 'TriangleAlert' },
}

export function AudienceConnectionStatus({ state, prefix = false }: {
  readonly state: DisplayConnectionStatus
  readonly prefix?: boolean
}) {
  const ui = useUiClass()
  const { label, icon } = presentation[state]
  return <span className={ui("audience-connection-status")} data-connection-state={state}>
    <Icon name={icon} size={20} />
    <span>{prefix ? 'Audiens: ' : ''}{label}</span>
  </span>
}
