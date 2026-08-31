/* eslint-disable react-hooks/immutability, react-hooks/static-components, react-hooks/exhaustive-deps */
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { DisplayConfiguration } from '../../../domain/display/display-configuration.types.ts'
import type { DrawSessionId, WinnerRecordId } from '../../../domain/shared/identifiers.ts'
import type { IsoTimestamp } from '../../../domain/shared/timestamps.ts'
import type { PresentationStage } from '../../../domain/workflow/presentation-workflow.types.ts'
import { DEFAULT_DRAW_PRESENTATION_CONFIGURATION, type DrawPresentationConfiguration } from '../../../domain/draws/draw-presentation.types.ts'
import type { PresentationCheckpointRecord } from '../../../domain/workflow/presentation-checkpoint.types.ts'
import { checkpointFromState } from '../../../domain/workflow/presentation-checkpoint.types.ts'
import { savePracticeBlackout, savePracticePresentationStage, type PracticeResultProjection } from '../../../application/draw/practice-result-storage.ts'
import { PresentationController, type PresentationClock, type PresentationControllerState } from '../../../application/workflow/presentation-controller.ts'
import { PRESENTATION_POLICY, type PresentationPolicy } from '../../../application/workflow/presentation-policy.ts'
import { PresentationError } from '../../../application/workflow/presentation-errors.ts'
import type { PresentationLineageEntry, PresentationResultProjection } from '../../../application/workflow/presentation-projection.ts'
import { createOperatorPublisher, createPublisherRuntimeIdentity, type OperatorPublisher } from '../../../application/display-transport/operator-publisher.ts'
import { createBroadcastChannelTransport } from '../../../application/display-transport/transport.ts'
import type { ProtocolScope } from '../../../application/display-transport/protocol.ts'
import { deriveProductionDisplayScope } from '../../../application/display/display-configuration-service.ts'
import { Badge, Button, ButtonLink, Card, Icon, Modal } from '../../../shared/ui/index.ts'
import { AudienceDisplayButton } from '../../../shared/components/AudienceDisplayButton.tsx'
import { PresentationRecoveryDialog } from './PresentationRecoveryDialog.tsx'
import { DRAW_ROLL_SPEED_PRESETS } from './draw-presentation-presets.ts'
import { AudiencePresentation } from '../../audience/AudiencePresentation.tsx'
import type { PublicDisplaySnapshot } from '../../../application/display-transport/public-projection.ts'
import { parseTicketNumber } from '../../../domain/participants/participant.invariants.ts'

export interface ProductionDrawRecap {
  readonly winnerCount: number
  readonly eligibleCount: number
  readonly winningRule: string
  readonly countdownSeconds: number
  readonly rollingSeconds: number
  readonly presentationConfiguration?: DrawPresentationConfiguration
}
function presentationSummary(configuration: DrawPresentationConfiguration): string {
  if (configuration.presentationMode === 'instant-reveal') return 'Ungkap Langsung'
  const speed = DRAW_ROLL_SPEED_PRESETS.find((preset) => preset.value === configuration.rollSpeedPerSecond)?.label ?? `${configuration.rollSpeedPerSecond}/dtk`
  const stop = configuration.rollStopMode === 'manual' ? 'Berhenti Manual' : `Berwaktu · ${configuration.rollDurationSeconds} dtk`
  const reveal = configuration.revealMode === 'sequential' ? 'Berurutan' : 'Bersamaan'
  return `Pengacakan Nomor Acak · ${stop} · ${speed} · ${reveal}`
}

export function ProductionDrawRunHeader({ mode, stage, eventName, prizeCategory, prizeName, recap, audienceStatus, backTo }: { readonly mode: 'practice' | 'live'; readonly stage: string; readonly eventName: string; readonly prizeCategory: string; readonly prizeName: string; readonly recap?: ProductionDrawRecap; readonly audienceStatus?: { readonly label: string; readonly detail: string; readonly displayUrl: string | null }; readonly backTo?: string }) {
  return <header className="production-draw-run-header"><div className="production-draw-run-header__identity"><div className="production-draw-run-header__title"><Badge variant={mode === 'practice' ? 'warning' : 'danger'}>{mode === 'practice' ? 'LATIHAN' : 'LIVE'}</Badge><div><p className="operator-eyebrow">{mode === 'practice' ? 'Hanya simulasi' : 'Hasil resmi terkunci'}</p><h1 id="presentation-heading">{stage}</h1><p>{eventName} · {prizeCategory} · {prizeName}</p>{recap?.presentationConfiguration === undefined ? null : <p data-testid="presentation-summary" className="production-presentation-summary">{presentationSummary(recap.presentationConfiguration)}</p>}</div></div><dl className="production-draw-run-header__metrics"><div><dt>Pemenang</dt><dd>{recap?.winnerCount ?? '—'}</dd></div><div><dt>Memenuhi syarat</dt><dd>{recap?.eligibleCount ?? '—'}</dd></div><div><dt>Waktu presentasi</dt><dd>{recap === undefined ? <span>—</span> : <><span className="production-draw-run-header__timing-item"><span>Hitung mundur</span><strong>{recap.countdownSeconds}s</strong></span><span className="production-draw-run-header__timing-separator" aria-hidden="true">·</span><span className="production-draw-run-header__timing-item"><span>Pengacakan</span><strong>{recap.rollingSeconds}s</strong></span></>}</dd></div></dl></div><div className="production-draw-run-header__audience"><div className="production-draw-run-header__audience-status"><strong className="production-draw-run-header__audience-heading">Tampilan Audiens</strong><div className="production-draw-run-header__audience-state"><Badge variant={audienceStatus?.label === 'Terhubung' ? 'success' : audienceStatus?.label === 'Menunggu' ? 'warning' : 'danger'}>{audienceStatus?.label ?? 'Tidak tersedia'}</Badge></div><small>{audienceStatus?.detail ?? 'Belum ada status penerbit produksi.'}</small></div><div className="production-draw-run-header__actions">{backTo === undefined ? null : <ButtonLink icon={<Icon name="ArrowLeft" />} to={backTo} variant="secondary" className="production-draw-run-header__back">Kembali ke Undian</ButtonLink>}{audienceStatus?.displayUrl === null || audienceStatus === undefined ? null : <AudienceDisplayButton displayUrl={audienceStatus.displayUrl} variant="secondary" className="production-draw-run-header__audience-action" />}</div></div></header>
}

interface ProductionDrawPresentationProps {
  readonly result: PresentationResultProjection
  readonly activeResult?: PresentationResultProjection
  readonly mode: 'live' | 'practice'
  readonly eventName: string
  readonly eventId?: string
  readonly displayConfigurationId?: string
  readonly prizeCategory: string
  readonly prizeName: string
  readonly checkpoints?: { findByDrawSessionId(id: DrawSessionId): Promise<PresentationCheckpointRecord | null>; upsert(checkpoint: PresentationCheckpointRecord): Promise<void> }
  readonly practiceResult?: PracticeResultProjection
  readonly onFailure: (error: PresentationError) => void
  readonly initialPresentation?: { readonly stage: PresentationStage; readonly stageStartedAt: IsoTimestamp; readonly blackoutRequested: boolean }
  readonly onHandoff?: () => void
  readonly sharedPublisher?: OperatorPublisher | null
  readonly onResetPractice?: () => void
  readonly resetPending?: boolean
  readonly presentationPolicy?: PresentationPolicy
  readonly presentationConfiguration?: DrawPresentationConfiguration
  readonly audienceStatus?: { readonly label: string; readonly detail: string; readonly displayUrl: string | null }
  readonly recap?: ProductionDrawRecap
  readonly backTo?: string
  readonly onRecoveryBack?: () => void
  readonly onReviewPendingResults?: () => void
  readonly reviewPendingResultsAvailable?: boolean
  readonly onQuickRedraw?: (winnerIds: readonly WinnerRecordId[]) => Promise<void>
  readonly redrawLineage?: readonly PresentationLineageEntry[]
  readonly displayConfiguration?: Pick<DisplayConfiguration, 'safeAreaMargin' | 'blackoutAppearance' | 'targetResolution'>
}

function browserClock(): PresentationClock {
  return { now: () => new Date().toISOString() as IsoTimestamp, setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs), clearTimeout: (handle) => window.clearTimeout(handle as number), prefersReducedMotion: () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false }
}

function presentationResultForStage(stage: PresentationControllerState['stage'], result: PresentationResultProjection, activeResult?: PresentationResultProjection): PresentationResultProjection {
  return stage === 'countdown' || stage === 'rolling' || stage === 'reveal' || stage === 'pending-handoff' ? activeResult ?? result : result
}

// eslint-disable-next-line react-refresh/only-export-components
export function presentationWinnerCountForStage(stage: PresentationControllerState['stage'], result: PresentationResultProjection, activeResult?: PresentationResultProjection): number {
  return presentationResultForStage(stage, result, activeResult).winners.length
}

function WinnerRevealList({ result, mode }: { readonly result: PresentationResultProjection; readonly mode: 'live' | 'practice' }) {
  return <ol className={`production-winner-list production-winner-list--${result.winners.length}`} aria-label={`${result.winners.length} pemenang ${mode === 'live' ? 'resmi' : 'Latihan'}`}>{result.winners.map((winner) => <li key={winner.winnerId}><span>#{winner.sequence}</span><strong>{winner.ticketNumber}</strong></li>)}</ol>
}

function RedrawHistoryPanel({ lineage }: { readonly lineage?: readonly PresentationLineageEntry[] }) {
  const replaced = lineage?.filter((entry) => entry.status === 'replaced') ?? []
  if (replaced.length === 0) return null
  return <section aria-label="Riwayat undian ulang" className="production-redraw-history-panel"><p className="production-redraw-history-panel__title">Riwayat undian ulang · {replaced.length} pemenang yang diganti{replaced.length === 1 ? '' : 's'}</p><details className="production-redraw-history-panel__details"><summary>Lihat riwayat</summary><div className="production-winner-lineage__history-list"><ul aria-label="Tiket yang diganti sebelumnya">{replaced.map((entry) => <li key={entry.winnerId}><strong>{entry.ticketNumber}</strong><span>DIGANTI · TIDAK HADIR</span></li>)}</ul></div></details></section>
}

export function ProductionDrawPresentation({ result, activeResult, mode, eventName, eventId = 'production-event', displayConfigurationId = eventId, prizeCategory, prizeName, checkpoints, practiceResult, onFailure, initialPresentation, onHandoff, sharedPublisher, onResetPractice, resetPending = false, presentationPolicy = PRESENTATION_POLICY, presentationConfiguration, audienceStatus, recap, backTo, onRecoveryBack, onReviewPendingResults, reviewPendingResultsAvailable = false, onQuickRedraw, redrawLineage, displayConfiguration }: ProductionDrawPresentationProps) {
  const activePresentationConfiguration = presentationConfiguration ?? presentationPolicy.presentationConfiguration ?? DEFAULT_DRAW_PRESENTATION_CONFIGURATION
  const runtimePresentationConfiguration = presentationConfiguration ?? presentationPolicy.presentationConfiguration
  const runtimeRecap = recap === undefined ? undefined : { ...recap, presentationConfiguration: recap.presentationConfiguration ?? activePresentationConfiguration }
  const [controllerState, setControllerState] = useState<PresentationControllerState>({ stage: 'result-locked', countdownLabel: null, error: null, presentationConfiguration: activePresentationConfiguration })
  const [blackoutRequested, setBlackoutRequested] = useState(initialPresentation?.blackoutRequested ?? false)
  const [quickRedrawOpen, setQuickRedrawOpen] = useState(false)
  const [redrawSelectionOpen, setRedrawSelectionOpen] = useState(false)
  const [selectedRedrawWinnerIds, setSelectedRedrawWinnerIds] = useState<readonly WinnerRecordId[]>([])
  const [quickRedrawBusy, setQuickRedrawBusy] = useState(false)
  const [quickRedrawError, setQuickRedrawError] = useState<string | null>(null)
  const scope: ProtocolScope = useMemo(() => deriveProductionDisplayScope(eventId, displayConfigurationId), [displayConfigurationId, eventId])
  const localPublisher = useMemo(() => { const runtime = createPublisherRuntimeIdentity(); return createOperatorPublisher({ transport: createBroadcastChannelTransport('raffle-os-display', scope), transportFactory: () => createBroadcastChannelTransport('raffle-os-display', scope), scope, senderId: runtime.publisherInstanceId, expectedSession: result.drawSessionId, epoch: runtime.epoch, clock: { now: () => new Date().toISOString() as IsoTimestamp } }) }, [result.drawSessionId, scope])
  const publisher = sharedPublisher ?? localPublisher
  const [publicSnapshot, setPublicSnapshot] = useState<PublicDisplaySnapshot | undefined>(() => publisher.getSnapshot())
  const sourceForState = useCallback((next: PresentationControllerState) => {
    const stageResult = presentationResultForStage(next.stage, result, activeResult)
    const rollingWinnerCount = stageResult.winners.length
    return next.stage === 'failed' || next.stage === 'result-locked'
      ? { drawSessionId: result.drawSessionId, stage: 'ready' as const, blackoutRequested: next.blackoutRequested ?? false, mode, prizeCategory, prizeName, result }
      : { drawSessionId: result.drawSessionId, stage: next.stage, stageStartedAt: next.stageStartedAt, countdownValue: next.stage === 'countdown' ? next.countdownLabel ?? 3 : undefined, blackoutRequested: next.blackoutRequested ?? false, mode, prizeCategory, prizeName, result: stageResult, ...(next.stage === 'rolling' && runtimePresentationConfiguration?.presentationMode === 'random-number-roll' ? { presentationConfiguration: { ...runtimePresentationConfiguration, winnerCount: rollingWinnerCount }, presentationSeed: result.drawSessionId } : {}), ...(next.stage === 'reveal' || next.stage === 'pending-handoff' ? runtimePresentationConfiguration === undefined ? {} : { presentationConfiguration: { presentationMode: runtimePresentationConfiguration.presentationMode, winnerCount: stageResult.winners.length, rollSpeedPerSecond: runtimePresentationConfiguration.rollSpeedPerSecond, rollStopMode: runtimePresentationConfiguration.rollStopMode, rollDurationSeconds: runtimePresentationConfiguration.rollDurationSeconds, revealMode: runtimePresentationConfiguration.revealMode }, presentationSeed: result.drawSessionId } : {}) }
  }, [activeResult, mode, prizeCategory, prizeName, result, runtimePresentationConfiguration])
  const controller = useMemo(() => new PresentationController({
    result, mode, presentationConfiguration: runtimePresentationConfiguration, clock: browserClock(),
    persistStage: async (stage, stageStartedAt) => {
      if (mode === 'practice') {
        if (practiceResult === undefined) throw new PresentationError('practice-projection-invalid', 'Proyeksi hasil Latihan tidak tersedia.', false, true)
        try { savePracticePresentationStage(practiceResult, stage, stageStartedAt) } catch (cause: unknown) { throw new PresentationError('session-storage-write-failure', 'Status presentasi Latihan tidak dapat disimpan di tab ini.', true, true, cause) }
        return
      }
      if (checkpoints === undefined) throw new PresentationError('checkpoint-write-failure', 'Hasil resmi terkunci, tetapi presentasi tidak dapat dimulai.', true, true)
      try { const prior = await checkpoints.findByDrawSessionId(result.drawSessionId); await checkpoints.upsert(checkpointFromState({ drawSessionId: result.drawSessionId, stage, stageStartedAt, blackoutRequested: prior?.blackoutRequested ?? false }, browserClock().now())) } catch (cause: unknown) { throw new PresentationError(stage === 'pending-handoff' ? 'pending-handoff-write-failure' : 'checkpoint-write-failure', stage === 'pending-handoff' ? 'Serah terima tertunda tidak dapat disimpan. Coba lagi; hasil resmi tetap dipertahankan.' : 'Hasil resmi terkunci, tetapi presentasi tidak dapat dimulai.', true, true, cause) }
    },
    persistBlackout: async (requested) => {
      if (mode === 'practice') {
        if (practiceResult === undefined) throw new PresentationError('practice-projection-invalid', 'Proyeksi hasil Latihan tidak tersedia.', false, true)
        savePracticeBlackout(practiceResult, requested)
      } else {
        if (checkpoints === undefined) throw new PresentationError('blackout-update-failure', 'Permintaan layar hitam tidak dapat disimpan. Hasil dan tahap tetap dipertahankan.', true, true)
        const current = await checkpoints.findByDrawSessionId(result.drawSessionId)
        if (current === null) throw new PresentationError('blackout-update-failure', 'Permintaan layar hitam tidak dapat disimpan karena checkpoint tidak tersedia.', true, true)
        await checkpoints.upsert({ ...current, blackoutRequested: requested, persistedAt: browserClock().now() })
      }
      setBlackoutRequested(requested)
    },
    onState: (next) => { setControllerState(next); if (next.blackoutRequested !== undefined) setBlackoutRequested(next.blackoutRequested); if (next.stage !== 'failed' && next.stage !== 'result-locked') { const published = publisher.publish(sourceForState(next)); if (published.ok) setPublicSnapshot(published.snapshot) } }, policy: presentationPolicy,
  }), [checkpoints, mode, practiceResult, presentationPolicy, publisher, result, runtimePresentationConfiguration, sourceForState])

  useEffect(() => {
    if (sharedPublisher !== undefined) return
    const started = publisher.start({ drawSessionId: result.drawSessionId, stage: 'ready', blackoutRequested: initialPresentation?.blackoutRequested ?? false, mode, prizeCategory, prizeName, result })
    if (started.ok) queueMicrotask(() => { if (publisher.getSnapshot() === started.snapshot) setPublicSnapshot(started.snapshot) })
    return () => publisher.close()
  }, [initialPresentation?.blackoutRequested, mode, prizeCategory, prizeName, publisher, result, sharedPublisher])
  useEffect(() => { void (initialPresentation === undefined ? controller.start() : controller.resume(initialPresentation.stage, initialPresentation.stageStartedAt, initialPresentation.blackoutRequested)); return () => controller.dispose() }, [controller, initialPresentation])
  useEffect(() => { if (resetPending) controller.dispose() }, [controller, resetPending])
  useEffect(() => { if (mode === 'live' && controllerState.stage === 'pending-handoff') onHandoff?.() }, [controllerState.stage, mode, onHandoff])
  useEffect(() => { if (controllerState.error !== null) onFailure(controllerState.error) }, [controllerState.error, onFailure])

  const blackoutControl = blackoutRequested ? <div className="presentation-blackout-control"><p>Publikasi Audiens sedang dalam mode layar hitam.</p><Button icon={<Icon name="X" />} variant="secondary" onClick={() => { void controller.setBlackout(false) }}>Akhiri layar hitam</Button></div> : null
  const resetControl = mode === 'practice' && onResetPractice !== undefined && (controllerState.stage === 'reveal' || controllerState.stage === 'pending-handoff' || controllerState.stage === 'failed' || controllerState.stage === 'result-locked') ? <Button icon={<Icon name="RefreshCw" />} variant="primary" disabled={resetPending} onClick={onResetPractice}>{resetPending ? 'Mereset simulasi…' : 'Reset simulasi'}</Button> : null
  const redrawableWinners = result.winners.filter((winner) => redrawLineage?.find((entry) => entry.winnerId === winner.winnerId)?.status !== 'replaced')
  const quickRedrawAvailable = mode === 'live' && redrawableWinners.length > 0 && onQuickRedraw !== undefined
  const effectiveRedrawWinnerIds = selectedRedrawWinnerIds.length > 0 || redrawableWinners.length !== 1 ? selectedRedrawWinnerIds : [redrawableWinners[0].winnerId]
  const selectedRedrawWinners = redrawableWinners.filter((winner) => effectiveRedrawWinnerIds.includes(winner.winnerId))
  useEffect(() => {
    if (quickRedrawOpen && redrawableWinners.length > 1 && selectedRedrawWinnerIds.length === 0) {
      queueMicrotask(() => { setQuickRedrawOpen(false); setRedrawSelectionOpen(true) })
    }
  }, [quickRedrawOpen, redrawableWinners.length, selectedRedrawWinnerIds.length])
  async function confirmQuickRedraw() {
    if (onQuickRedraw === undefined) return
    setQuickRedrawBusy(true)
    setQuickRedrawError(null)
    try { await onQuickRedraw(selectedRedrawWinners.map((winner) => winner.winnerId)); setQuickRedrawOpen(false); setSelectedRedrawWinnerIds([]) } catch (cause: unknown) { setQuickRedrawError(cause instanceof Error ? cause.message : 'Undian ulang tidak dapat diselesaikan dengan aman.') }
    finally { setQuickRedrawBusy(false) }
  }
  const quickRedrawTickets = selectedRedrawWinners.map((winner) => winner.ticketNumber)
  const quickRedrawTicket = quickRedrawTickets[0] ?? ''
  const quickRedrawDialog = quickRedrawAvailable ? <Modal closeOnEscape={!quickRedrawBusy} eyebrow="KONFIRMASI UNDIAN ULANG" footer={<><Button icon={<Icon name="ArrowLeft" />} disabled={quickRedrawBusy} onClick={() => { setQuickRedrawError(null); setQuickRedrawOpen(false) }} variant="quiet">Kembali</Button><Button className="production-quick-redraw-dialog__review" disabled={quickRedrawBusy} icon={<Icon name="ClipboardCheck" />} onClick={() => { setQuickRedrawError(null); setQuickRedrawOpen(false); onReviewPendingResults?.() }} variant="secondary">Tinjau Saja</Button><Button className="production-quick-redraw-dialog__confirm" disabled={quickRedrawBusy} icon={<Icon name="RotateCcw" />} isLoading={quickRedrawBusy} onClick={() => { void confirmQuickRedraw() }} variant="danger">Konfirmasi Undian Ulang</Button></>} onClose={() => { if (!quickRedrawBusy) { setQuickRedrawError(null); setQuickRedrawOpen(false) } }} open={quickRedrawOpen} showCloseButton={false} title="Undi ulang pemenang">
    <div className="production-quick-redraw-dialog__content">
      <section aria-labelledby="quick-redraw-current-winner" className="production-quick-redraw-dialog__winner">
        <p id="quick-redraw-current-winner" className="production-quick-redraw-dialog__label">Pemenang saat ini</p>
        <strong className="production-quick-redraw-dialog__ticket">{quickRedrawTickets.length === 1 ? `Tiket ${quickRedrawTicket}` : `${quickRedrawTickets.length} winners selected`}</strong>
      </section>
      <aside className="production-quick-redraw-dialog__warning">
        <strong>Pemenang ini akan diganti</strong>
        <p>{quickRedrawTickets.length === 1 ? `Tiket ${quickRedrawTicket}` : `Tickets ${quickRedrawTickets.join(', ')}`} akan ditandai Tidak Hadir dan dikecualikan of undian pengganti ini.</p>
        <p>Hasil asli tetap berada dalam riwayat resmi untuk keperluan audit.</p>
      </aside>
      <section aria-labelledby="quick-redraw-summary" className="production-quick-redraw-dialog__summary">
        <p id="quick-redraw-summary" className="production-quick-redraw-dialog__label">Undian pengganti</p>
        <dl>
          <div><dt>Hadiah</dt><dd>{prizeName}</dd></div>
          <div><dt>Kategori</dt><dd>{prizeCategory}</dd></div>
          <div><dt>Pemenang baru</dt><dd>{quickRedrawTickets.length}</dd></div>
        </dl>
      </section>
      <p className="production-quick-redraw-dialog__supporting-copy">Peserta baru yang memenuhi syarat akan dipilih menggunakan aturan Undian yang ada.</p>
      {quickRedrawError === null ? null : <p role="alert">{quickRedrawError}</p>}
    </div>
  </Modal> : null
  const redrawSelectionDialog = quickRedrawAvailable && redrawableWinners.length > 1 ? <Modal closeOnEscape={!quickRedrawBusy} description="Pilih pemenang yang tidak tersedia dan harus diganti." eyebrow="PILIH PEMENANG" footer={<><Button icon={<Icon name="CircleX" />} disabled={quickRedrawBusy} onClick={() => { setRedrawSelectionOpen(false); setSelectedRedrawWinnerIds([]) }} variant="quiet">Batal</Button><Button icon={<Icon name="RotateCcw" />} disabled={quickRedrawBusy || selectedRedrawWinnerIds.length === 0} onClick={() => { setRedrawSelectionOpen(false); setQuickRedrawError(null); setQuickRedrawOpen(true) }} variant="danger">Lanjutkan Undian Ulang</Button></>} onClose={() => { if (!quickRedrawBusy) { setRedrawSelectionOpen(false); setSelectedRedrawWinnerIds([]) } }} open={redrawSelectionOpen} showCloseButton={false} title="Pilih pemenang untuk diundi ulang"><div className="production-redraw-selection-dialog"><div className="production-redraw-selection-dialog__toolbar"><p aria-live="polite"><strong>{selectedRedrawWinnerIds.length}</strong> dari {redrawableWinners.length} dipilih</p><div><Button disabled={quickRedrawBusy || selectedRedrawWinnerIds.length === redrawableWinners.length} onClick={() => setSelectedRedrawWinnerIds(redrawableWinners.map((winner) => winner.winnerId))} size="sm" variant="quiet">Pilih semua</Button><Button disabled={quickRedrawBusy || selectedRedrawWinnerIds.length === 0} onClick={() => setSelectedRedrawWinnerIds([])} size="sm" variant="quiet">Bersihkan</Button></div></div><fieldset className="production-redraw-selection-dialog__list"><legend className="sr-only">Pemenang tertunda saat ini</legend>{redrawableWinners.map((winner) => { const selected = selectedRedrawWinnerIds.includes(winner.winnerId); return <label key={winner.winnerId} className={`production-redraw-selection-dialog__option${selected ? ' production-redraw-selection-dialog__option--selected' : ''}`}><input aria-label={`Pilih pemenang #${winner.sequence}, tiket ${winner.ticketNumber}`} checked={selected} disabled={quickRedrawBusy} onChange={() => setSelectedRedrawWinnerIds((current) => current.includes(winner.winnerId) ? current.filter((id) => id !== winner.winnerId) : [...current, winner.winnerId])} type="checkbox" /><span className="production-redraw-selection-dialog__position">#{winner.sequence}</span><strong className="production-redraw-selection-dialog__ticket">{winner.ticketNumber}</strong><span className="production-redraw-selection-dialog__state">{selected ? 'Dipilih' : 'Tersedia'}</span></label> })}</fieldset></div></Modal> : null
  const previewStore = useMemo(() => {
    let value = { publicSnapshot, displayConfiguration }
    const listeners = new Set<() => void>()
    return {
      getSnapshot: () => value,
      subscribe: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener) },
      set: (next: typeof value) => { if (value.publicSnapshot === next.publicSnapshot && value.displayConfiguration === next.displayConfiguration) return; value = next; listeners.forEach((listener) => listener()) },
    }
  }, [])
  useEffect(() => { previewStore.set({ publicSnapshot, displayConfiguration }) }, [displayConfiguration, previewStore, publicSnapshot])
  const PresentationFrame = useMemo(() => function StablePresentationFrame({ afterChildren, children, result, blackoutControl, operatorControl, blackoutRequested, mode, eventName, prizeCategory, prizeName, heading, announcement, audienceStatus, recap, previewStage, backTo }: { afterChildren?: ReactNode; children: ReactNode; result: PresentationResultProjection; blackoutControl: ReactNode; operatorControl: ReactNode; blackoutRequested: boolean; mode: 'live' | 'practice'; eventName: string; prizeCategory: string; prizeName: string; heading: string; announcement: string; audienceStatus?: { readonly label: string; readonly detail: string; displayUrl: string | null }; recap?: ProductionDrawRecap; previewStage: 'countdown' | 'rolling' | 'reveal'; backTo?: string }) {
    const { publicSnapshot: snapshot, displayConfiguration: configuration } = useSyncExternalStore(previewStore.subscribe, previewStore.getSnapshot, previewStore.getSnapshot)
    return <section className={`production-presentation production-draw-run-shell${blackoutRequested ? ' production-presentation--blackout' : ''}`} aria-labelledby="presentation-heading"><ProductionDrawRunHeader backTo={backTo} mode={mode} stage={heading} eventName={eventName} prizeCategory={prizeCategory} prizeName={prizeName} recap={recap} audienceStatus={audienceStatus} /><div className="presentation-header-actions">{blackoutControl}{operatorControl}</div><p className="sr-only" role="status" aria-live="polite">{announcement}</p><div className="production-presentation-grid"><div className="production-presentation__left-column"><div className="production-presentation__content">{children}</div>{afterChildren}</div><PresentationSupport recap={recap} previewStage={previewStage} audienceStatus={audienceStatus} eventName={eventName} prizeCategory={prizeCategory} prizeName={prizeName} result={result} blackoutRequested={blackoutRequested} publicSnapshot={snapshot} displayConfiguration={configuration} /></div></section>
  }, [previewStore])
  const redrawHistoryPanel = <><RedrawHistoryPanel lineage={redrawLineage} />{redrawSelectionDialog}</>
  const stage = controllerState.stage
  const stageResult = presentationResultForStage(stage, result, activeResult)
  const manualRolling = controllerState.presentationConfiguration.presentationMode === 'random-number-roll' && controllerState.presentationConfiguration.rollStopMode === 'manual'
  if (stage === 'rolling' && manualRolling) return <PresentationFrame backTo={backTo} result={result} recap={runtimeRecap} previewStage="rolling" audienceStatus={audienceStatus} blackoutRequested={blackoutRequested} blackoutControl={blackoutControl} operatorControl={null} mode={mode} eventName={eventName} prizeCategory={prizeCategory} prizeName={prizeName} heading="Pengacakan - pemenang terkunci" announcement="Pengacakan aktif. Pemenang sudah terkunci. Menunggu Hentikan dan Tampilkan."><div className="production-rolling" aria-label="Pengacakan aktif; pemenang terkunci"><span>• • • • •</span><span>MENGACAK</span><span>- - - - -</span></div><p className="presentation-progress">Menunggu Hentikan &amp; Tampilkan</p><div className="production-manual-stop-wrap"><Button icon={<Icon name="StopCircle" />} variant="danger" size="lg" className="production-manual-stop" onClick={() => { void controller.stopRollingAndReveal() }}>HENTIKAN &amp; TAMPILKAN</Button></div></PresentationFrame>
  if (stage === 'failed') return <><PresentationFrame backTo={backTo} result={result} recap={runtimeRecap} previewStage="reveal" audienceStatus={audienceStatus} blackoutRequested={blackoutRequested} blackoutControl={null} operatorControl={null} mode={mode} eventName={eventName} prizeCategory={prizeCategory} prizeName={prizeName} heading="Pemulihan presentasi" announcement="Pemulihan presentasi diperlukan"><div className="production-recovery-background"><Card padding="lg"><p className="operator-eyebrow">Ruang kerja Pelaksanaan Undian</p><h2>Hasil pemenang terkunci</h2><WinnerRevealList mode={mode} result={result} /></Card></div></PresentationFrame><PresentationRecoveryDialog onBackToSetup={onRecoveryBack ?? (() => undefined)} onReviewPendingResults={onReviewPendingResults} reviewPendingResultsAvailable={reviewPendingResultsAvailable} /></>
  if (stage === 'result-locked') return <Card padding="lg"><p>Menyiapkan presentasi hasil terkunci…</p></Card>
  if (stage === 'countdown') return <PresentationFrame backTo={backTo} result={result} recap={recap} previewStage="countdown" audienceStatus={audienceStatus} blackoutRequested={blackoutRequested} blackoutControl={blackoutControl} operatorControl={resetControl} mode={mode} eventName={eventName} prizeCategory={prizeCategory} prizeName={prizeName} heading="Bersiap" announcement={`Hitung mundur ${controllerState.countdownLabel ?? 3}`}><div className="production-countdown" aria-label={`Hitung mundur ${controllerState.countdownLabel ?? 3}`}>{controllerState.countdownLabel}</div><p className="presentation-progress">{recap?.countdownSeconds ?? Math.round(presentationPolicy.countdownDurationMs / 1000)} dtk hitung mundur</p><Button onClick={() => { void controller.skip() }}>Lewati animasi</Button></PresentationFrame>
  if (stage === 'rolling') return <PresentationFrame backTo={backTo} result={stageResult} recap={runtimeRecap} previewStage="rolling" audienceStatus={audienceStatus} blackoutRequested={blackoutRequested} blackoutControl={blackoutControl} operatorControl={manualRolling ? null : resetControl} mode={mode} eventName={eventName} prizeCategory={prizeCategory} prizeName={prizeName} heading={manualRolling ? 'Pengacakan — pemenang terkunci' : 'Pengacakan'} announcement={manualRolling ? 'Pengacakan aktif. Pemenang sudah terkunci. Menunggu Hentikan dan Tampilkan.' : 'Presentasi pengacakan aktif'}><div className="production-rolling" aria-label={manualRolling ? 'Pengacakan aktif; pemenang terkunci' : 'Presentasi pengacakan aktif'}><span>• • • • •</span><span>MENGACAK</span><span>— — — — —</span></div><p className="presentation-progress">{manualRolling ? 'Menunggu Hentikan & Tampilkan' : `${recap?.rollingSeconds ?? Math.round(presentationPolicy.rollingDurationMs / 1000)} dtk presentasi pengacakan`}</p>{manualRolling ? <div className="production-manual-stop-wrap"><Button icon={<Icon name="StopCircle" />} variant="danger" size="lg" className="production-manual-stop" onClick={() => { void controller.stopRollingAndReveal() }}>HENTIKAN &amp; TAMPILKAN</Button></div> : <Button onClick={() => { void controller.skip() }}>Lewati animasi</Button>}</PresentationFrame>
  if (stage === 'pending-handoff') return <section className="production-presentation production-draw-run-shell" aria-labelledby="presentation-heading"><ProductionDrawRunHeader backTo={backTo} mode={mode} stage="Presentasi Latihan selesai" eventName={eventName} prizeCategory={prizeCategory} prizeName={prizeName} recap={recap} audienceStatus={audienceStatus} /><div className="production-presentation-grid"><Card className="practice-complete-panel" padding="lg"><p className="operator-eyebrow">Latihan selesai</p><Badge variant="success">Simulasi selesai</Badge><h2>Simulasi selesai</h2><p>Presentasi Latihan selesai. Reset simulasi untuk menjalankannya lagi, atau kembali ke antrean Sesi Undian.</p><ol>{result.winners.map((winner) => <li key={winner.winnerId}><span>#{winner.sequence}</span><code>{winner.ticketNumber}</code></li>)}</ol><div className="practice-complete-panel__actions">{resetControl}<Button icon={<Icon name="ArrowLeft" />} variant="quiet" onClick={() => { void controller.handoff() }}>Kembali ke Sesi Undian</Button></div></Card><PresentationSupport recap={recap} previewStage="pending-handoff" audienceStatus={audienceStatus} eventName={eventName} prizeCategory={prizeCategory} prizeName={prizeName} result={result} blackoutRequested={blackoutRequested} publicSnapshot={publicSnapshot} displayConfiguration={displayConfiguration} /></div></section>
  return <><PresentationFrame backTo={backTo} result={stageResult} recap={runtimeRecap} previewStage="reveal" audienceStatus={audienceStatus} blackoutRequested={blackoutRequested} blackoutControl={blackoutControl} operatorControl={blackoutRequested ? resetControl : null} mode={mode} eventName={eventName} prizeCategory={prizeCategory} prizeName={prizeName} heading="Pengungkapan pemenang" announcement="Pengungkapan pemenang" afterChildren={redrawHistoryPanel}><WinnerRevealList mode={mode} result={stageResult} /><p className="presentation-completion">{mode === 'live' ? 'Presentasi selesai' : 'Presentasi Latihan selesai. Reset simulasi untuk menjalankannya lagi, atau kembali ke antrean Sesi Undian.'}</p>{mode === 'live' ? <p className="presentation-completion presentation-completion--detail">Pemenang yang dipilih siap ditinjau.</p> : null}<div className="presentation-action-row production-reveal-actions">{mode === 'practice' ? resetControl : null}<Button icon={mode === 'live' ? <Icon name="ClipboardCheck" /> : <Icon name="ArrowLeft" />} onClick={() => { void controller.handoff() }}>{mode === 'live' ? 'Tinjau Hasil Tertunda' : 'Kembali ke Sesi Undian'}</Button>{quickRedrawAvailable ? <Button icon={<Icon name="RotateCcw" />} onClick={() => { setQuickRedrawError(null); setQuickRedrawOpen(true) }} variant="danger">Undi Ulang Pemenang</Button> : null}</div></PresentationFrame>{quickRedrawDialog}</>
}

export function PresentationSupport({ recap, previewStage, audienceStatus, eventName, prizeCategory, prizeName, result, blackoutRequested, publicSnapshot, displayConfiguration }: { readonly recap?: ProductionDrawRecap; readonly previewStage: 'ready' | 'countdown' | 'rolling' | 'reveal' | 'pending-handoff'; readonly audienceStatus?: { readonly label: string; readonly detail: string; readonly displayUrl: string | null }; readonly eventName: string; readonly prizeCategory: string; readonly prizeName: string; readonly result?: PresentationResultProjection; readonly blackoutRequested: boolean; readonly publicSnapshot?: PublicDisplaySnapshot; readonly displayConfiguration?: Pick<DisplayConfiguration, 'safeAreaMargin' | 'blackoutAppearance' | 'targetResolution'> }) {
  const previewLabel = previewStage === 'ready' ? 'Undian berikutnya' : previewStage === 'pending-handoff' ? 'Selesai' : previewStage
  void prizeCategory
  void prizeName
  const fallbackSnapshot: PublicDisplaySnapshot = { drawSessionId: result?.drawSessionId ?? '00000000-0000-4000-8000-000000000001' as never, stage: previewStage === 'ready' ? 'standby' : previewStage, ...(previewStage === 'ready' ? {} : { stageStartedAt: '2026-08-05T00:00:00.000Z' as never }), blackoutRequested, eventName, prizeCategory, prizeName, winnerCount: result?.winners.length ?? recap?.winnerCount ?? 1, ...(result === undefined ? {} : { result: { drawSessionId: result.drawSessionId, winners: result.winners } }) }
  const snapshot = publicSnapshot ?? { ...fallbackSnapshot, ...(result === undefined ? {} : { ticketNumbers: result.winners.flatMap((winner) => { const ticket = parseTicketNumber(winner.ticketNumber); return ticket.ok ? [ticket.value] : [] }), winnerStatuses: result.winners.map(() => 'pending' as const) }) }
  return <aside className="production-presentation-support"><Card padding="md"><div className="production-support-section"><div className="production-support-section__heading"><span>Pratinjau Audiens</span><Badge variant={blackoutRequested ? 'danger' : previewStage === 'ready' || previewStage === 'countdown' || previewStage === 'rolling' ? 'info' : 'success'}>{blackoutRequested ? 'Layar hitam' : previewLabel}</Badge></div><div className="production-preview" aria-label={`Pratinjau Audiens publik untuk ${eventName}`} data-testid="production-preview" data-public-stage={blackoutRequested ? 'blackout' : previewStage}><div className="production-preview__viewport"><AudiencePresentation snapshot={snapshot} displayConfiguration={displayConfiguration} preview /></div></div></div><div className="production-support-section"><div className="production-support-section__heading"><span>Status runtime</span></div><small className="production-support-section__detail">Konfirmasi Audiens: {audienceStatus?.detail ?? 'Belum ada status penerbit.'}</small><dl className="production-recap"><div><dt>Jumlah pemenang</dt><dd>{recap?.winnerCount ?? result?.winners.length ?? '—'}</dd></div><div><dt>Pool yang memenuhi syarat</dt><dd>{recap?.eligibleCount ?? '—'}</dd></div><div><dt>Aturan kemenangan</dt><dd>{recap?.winningRule ?? '—'}</dd></div><div><dt>Presentasi</dt><dd>{recap === undefined ? '—' : `${recap.countdownSeconds} dtk hitung mundur · ${recap.rollingSeconds} dtk pengacakan`}</dd></div></dl></div></Card></aside>
}
