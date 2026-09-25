import type { DrawSession } from '../../domain/draws/draw-session.types.ts'
import type { PresentationStage } from '../../domain/workflow/presentation-workflow.types.ts'

export type UpdateSafetyReason =
  | 'workspace-unreadable'
  | 'draw-active'
  | 'recovery-unresolved'
  | 'conflicting-sessions'
  | 'receipt-ambiguous'
  | 'redraw-recovery-active'
  | 'presentation-active'
  | 'audience-connected'
  | 'audience-ambiguous'

export type UpdateSafetyResult =
  | { readonly safe: true }
  | { readonly safe: false; readonly reason: UpdateSafetyReason }

export interface UpdateSafetySnapshot {
  readonly workspaceReadable: boolean
  readonly liveSessionStatuses: readonly DrawSession['status'][]
  readonly recovery: 'normal' | 'unresolved' | 'conflicting-sessions'
  readonly receiptAmbiguous: boolean
  readonly activeRedrawRecovery: boolean
  readonly presentationStages: readonly PresentationStage[]
  readonly audience: 'connected' | 'disconnected' | 'ambiguous'
}

export type UpdateSafetyAuthority = () => Promise<UpdateSafetyResult>

const ACTIVE_PRESENTATION = new Set<PresentationStage>(['countdown', 'rolling', 'reveal', 'pending-handoff'])

export function evaluateUpdateSafety(snapshot: UpdateSafetySnapshot): UpdateSafetyResult {
  if (!snapshot.workspaceReadable) return { safe: false, reason: 'workspace-unreadable' }
  if (snapshot.recovery === 'conflicting-sessions') return { safe: false, reason: 'conflicting-sessions' }
  if (snapshot.receiptAmbiguous) return { safe: false, reason: 'receipt-ambiguous' }
  if (snapshot.activeRedrawRecovery) return { safe: false, reason: 'redraw-recovery-active' }
  if (snapshot.recovery === 'unresolved') return { safe: false, reason: 'recovery-unresolved' }
  if (snapshot.liveSessionStatuses.some((status) => status === 'drawing' || status === 'pending-confirmation')) {
    return { safe: false, reason: 'draw-active' }
  }
  if (snapshot.presentationStages.some((stage) => ACTIVE_PRESENTATION.has(stage))) {
    return { safe: false, reason: 'presentation-active' }
  }
  if (snapshot.audience === 'ambiguous') return { safe: false, reason: 'audience-ambiguous' }
  if (snapshot.audience === 'connected') return { safe: false, reason: 'audience-connected' }
  return { safe: true }
}

let registeredAuthority: UpdateSafetyAuthority | null = null

export function registerUpdateSafetyAuthority(authority: UpdateSafetyAuthority): () => void {
  registeredAuthority = authority
  return () => {
    if (registeredAuthority === authority) registeredAuthority = null
  }
}

export async function readAuthoritativeUpdateSafety(): Promise<UpdateSafetyResult> {
  if (registeredAuthority === null) return { safe: false, reason: 'workspace-unreadable' }
  try {
    return await registeredAuthority()
  } catch {
    return { safe: false, reason: 'workspace-unreadable' }
  }
}

export function updateSafetyCopy(result: UpdateSafetyResult): string | null {
  if (result.safe) return null
  if (result.reason === 'audience-connected' || result.reason === 'audience-ambiguous') return 'Tutup Audience Display sebelum memasang pembaruan.'
  if (result.reason === 'draw-active' || result.reason === 'presentation-active') return 'Selesaikan proses undian sebelum memasang pembaruan.'
  if (result.reason === 'recovery-unresolved' || result.reason === 'redraw-recovery-active' || result.reason === 'receipt-ambiguous' || result.reason === 'conflicting-sessions') return 'Selesaikan proses pemulihan sebelum memasang pembaruan.'
  return 'Pembaruan tidak dapat dipasang saat sesi undian sedang aktif.'
}
