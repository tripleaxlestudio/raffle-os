import { useEffect, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import type { StartupRecoveryResult } from '../../application/workflow/startup-recovery-arbiter.ts'
import { ButtonLink, Card, Icon } from '../../shared/ui/index.ts'
import { StatusBanner } from '../../shared/components/StatusBanner.tsx'
import { OperatorPersistenceStatus } from '../../shared/components/OperatorPersistenceStatus.tsx'
import { useIntentionalRedrawTransition } from './ProductionWorkspaceContext.tsx'

function isRecoveryTarget(pathname: string, targetPath: string): boolean {
  return pathname === targetPath
}

export function StartupRecoveryGate({ recovery }: { readonly recovery?: StartupRecoveryResult }): ReactNode {
  const location = useLocation()
  const navigate = useNavigate()
  const redrawTransition = useIntentionalRedrawTransition()
  const targetPath = recovery?.kind === 'recover-session' || recovery?.kind === 'conflicting-sessions'
    ? recovery.recommendedRoute
    : null
  useEffect(() => {
    const handoff = redrawTransition.handoff
    if (handoff !== null && location.pathname !== `/draw/run/${handoff.drawSessionId}`) redrawTransition.clear()
  }, [location.pathname, redrawTransition])
  useEffect(() => {
    if (targetPath !== null && !isRecoveryTarget(location.pathname, targetPath)) void navigate(targetPath, { replace: true })
  }, [location.pathname, navigate, targetPath])

  if (recovery === undefined || recovery.kind === 'normal' || recovery.kind === 'no-active-event') return null
  if (recovery.kind === 'storage-failure') return <OperatorPersistenceStatus kind="blocked" detail={`${recovery.error} Tidak ada data resmi yang diubah. Coba lagi dari ruang kerja terkait setelah penyimpanan lokal tersedia.`} />
  const onRecoveryRoute = targetPath !== null && isRecoveryTarget(location.pathname, targetPath)
  const recoveredRedrawRequest = recovery.kind === 'recover-session' ? recovery.redrawRequest : undefined
  const onRecoveredRedrawRoute = recovery.kind === 'recover-session' && recoveredRedrawRequest !== undefined && location.pathname === `/draw/run/${recovery.session.id}`
  const isIntentionalRedrawRoute = onRecoveredRedrawRoute && redrawTransition.handoff?.request.id === recoveredRedrawRequest.id
  const isConflict = recovery.kind === 'conflicting-sessions'
  const decision = recovery.kind === 'recover-session' ? recovery.decision : undefined
  const acknowledgement = decision?.kind === 'safe-acknowledgement-required'
  const title = isConflict ? 'Pilih sesi Live tersimpan untuk dipulihkan' : acknowledgement ? 'Perlu konfirmasi aman' : 'Pekerjaan Live tersimpan berhasil dipulihkan'
  const detail = isConflict
    ? `Ditemukan ${recovery.sessions.length} sesi Live yang belum selesai. Tinjau sesi tersimpan sebelum melanjutkan.`
    : acknowledgement
      ? 'Hasil pemilihan tidak dapat disimpulkan secara aman dari status presentasi. Tinjau record resmi sebelum mengambil tindakan.'
      : decision?.kind === 'resume-setup'
        ? 'Presentasi terhenti sebelum pemilihan resmi. Pengaturan Undian aman untuk dilanjutkan.'
        : 'Sesi resmi tetap dipertahankan. Tidak ada pemilihan baru selama pemulihan.'
  const actionLabel = isConflict || acknowledgement ? 'Tinjau hasil tersimpan' : decision?.kind === 'resume-setup' ? 'Kembali ke Pengaturan Undian' : 'Lanjutkan verifikasi'
  if (isIntentionalRedrawRoute) return null
  if (onRecoveredRedrawRoute) return <StatusBanner badge="Dipulihkan" className="kc-draw-recovery-notice" icon={<Icon name="CircleCheck" size={20} />} title="Sesi undi ulang berhasil dipulihkan" tone="success">Semua hasil dan keputusan sebelumnya tetap tersimpan.</StatusBanner>
  if (onRecoveryRoute) return <StatusBanner badge="Pemulihan" title={title} tone="warning">{detail}</StatusBanner>
  return <Card aria-live="polite" className="production-workspace-state production-workspace-state--loading" padding="md">
    <div className="production-workspace-state__copy"><h2>Memulihkan pekerjaan Live tersimpan</h2><p>{detail}</p></div>
    {targetPath === null ? null : <ButtonLink to={targetPath}>{actionLabel}</ButtonLink>}
  </Card>
}
