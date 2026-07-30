import type { AppMode } from '../../domain/types/index.ts'
import { Badge } from '../../shared/ui/index.ts'

interface ModeBadgeProps {
  mode: AppMode
}

const modeLabels: Record<AppMode, string> = {
  practice: 'Practice Mode',
  live: 'Live Mode',
}

export function ModeBadge({ mode }: ModeBadgeProps) {
  return (
    <Badge
      className="mode-badge"
      data-mode={mode}
      indicator
      variant={mode}
    >
      {modeLabels[mode]}
    </Badge>
  )
}
