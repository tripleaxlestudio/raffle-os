import { useEffect, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import type { StartupRecoveryResult } from '../../application/workflow/startup-recovery-arbiter.ts'
import { ButtonLink, Card } from '../../shared/ui/index.ts'

function isRecoveryTarget(pathname: string, targetPath: string): boolean {
  return pathname === targetPath
}

export function StartupRecoveryGate({ recovery }: { readonly recovery?: StartupRecoveryResult }): ReactNode {
  const location = useLocation()
  const navigate = useNavigate()
  const targetPath = recovery?.kind === 'recover-session' || recovery?.kind === 'conflicting-sessions'
    ? recovery.recommendedRoute
    : null
  useEffect(() => {
    if (targetPath !== null && !isRecoveryTarget(location.pathname, targetPath)) void navigate(targetPath, { replace: true })
  }, [location.pathname, navigate, targetPath])

  if (targetPath === null || isRecoveryTarget(location.pathname, targetPath)) return null
  return <Card aria-live="polite" className="production-workspace-state production-workspace-state--loading" padding="md">
    <div className="production-workspace-state__copy"><h2>Recovering saved Live work</h2><p>Resolving the authoritative DrawSession before normal setup can continue.</p></div>
    <ButtonLink to={targetPath}>Open recovery</ButtonLink>
  </Card>
}
