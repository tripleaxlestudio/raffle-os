import { createContext } from 'react'
import type { StartupRecoveryResult } from '../../application/workflow/startup-recovery-arbiter.ts'

const READ_ONLY_HELP_PATHS = new Set([
  '/help/whats-new',
  '/help/guide',
  '/help/support',
  '/help/licenses',
])

export function isReadOnlyHelpPath(pathname: string): boolean {
  return READ_ONLY_HELP_PATHS.has(pathname)
}

export function recoveryNavigationTarget(recovery: StartupRecoveryResult | undefined): string | null {
  return recovery?.kind === 'recover-session' || recovery?.kind === 'conflicting-sessions'
    ? recovery.recommendedRoute
    : null
}

// Default keeps standalone Help renderers independent of the production workspace.
export const RecoveryHelpContext = createContext(false)
