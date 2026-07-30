import type { AppMode } from '../../domain/types/index.ts'

interface ModeBadgeProps {
  mode: AppMode
}

const modeLabels: Record<AppMode, string> = {
  practice: 'Practice Mode',
  live: 'Live Mode',
}

export function ModeBadge({ mode }: ModeBadgeProps) {
  return (
    <span className="mode-badge" data-mode={mode}>
      {modeLabels[mode]}
    </span>
  )
}
