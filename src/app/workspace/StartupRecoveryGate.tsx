import { useEffect, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import type { StartupRecoveryResult } from '../../application/workflow/startup-recovery-arbiter.ts'
import { ButtonLink, Card } from '../../shared/ui/index.ts'
import { StatusBanner } from '../../shared/components/StatusBanner.tsx'
import { OperatorPersistenceStatus } from '../../shared/components/OperatorPersistenceStatus.tsx'

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

  if (recovery === undefined || recovery.kind === 'normal' || recovery.kind === 'no-active-event') return null
  if (recovery.kind === 'storage-failure') return <OperatorPersistenceStatus kind="blocked" detail={`${recovery.error} No official data was changed. Retry from the affected workspace after local storage is available.`} />
  const onRecoveryRoute = targetPath !== null && isRecoveryTarget(location.pathname, targetPath)
  const isConflict = recovery.kind === 'conflicting-sessions'
  const decision = recovery.kind === 'recover-session' ? recovery.decision : undefined
  const acknowledgement = decision?.kind === 'safe-acknowledgement-required'
  const title = isConflict ? 'Choose a saved Live session to recover' : acknowledgement ? 'Safe acknowledgement required' : 'Saved Live work recovered'
  const detail = isConflict
    ? `${recovery.sessions.length} unresolved Live sessions were found. Review the saved sessions before continuing.`
    : acknowledgement
      ? 'The selection outcome cannot be inferred safely from presentation state. Review authoritative records before taking action.'
      : decision?.kind === 'resume-setup'
        ? 'The presentation was interrupted before an official selection. Draw Setup is safe to resume.'
        : 'The authoritative session was preserved. No new selection will be made during recovery.'
  const actionLabel = isConflict || acknowledgement ? 'Review saved result' : decision?.kind === 'resume-setup' ? 'Return to Draw Setup' : 'Continue verification'
  if (onRecoveryRoute) return <StatusBanner badge="Recovery" title={title} tone="warning">{detail} <ButtonLink className="recovery-link" to={targetPath}>{actionLabel}</ButtonLink></StatusBanner>
  return <Card aria-live="polite" className="production-workspace-state production-workspace-state--loading" padding="md">
    <div className="production-workspace-state__copy"><h2>Recovering saved Live work</h2><p>{detail}</p></div>
    {targetPath === null ? null : <ButtonLink to={targetPath}>{actionLabel}</ButtonLink>}
  </Card>
}
