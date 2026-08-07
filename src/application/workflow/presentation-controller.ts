import type { IsoTimestamp } from '../../domain/shared/timestamps.ts'
import type { PresentationStage } from '../../domain/workflow/presentation-workflow.types.ts'
import { PresentationError } from './presentation-errors.ts'
import { PRESENTATION_POLICY, type PresentationPolicy } from './presentation-policy.ts'
import type { PresentationResultProjection } from './presentation-projection.ts'
import { DEFAULT_DRAW_PRESENTATION_CONFIGURATION, type DrawPresentationConfiguration } from '../../domain/draws/draw-presentation.types.ts'

export type PresentationControllerStage = 'result-locked' | PresentationStage | 'failed'
export interface PresentationClock {
  now(): IsoTimestamp
  setTimeout(callback: () => void, delayMs: number): unknown
  clearTimeout(handle: unknown): void
  prefersReducedMotion(): boolean
}
export interface PresentationControllerState { readonly stage: PresentationControllerStage; readonly countdownLabel: 3 | 2 | 1 | null; readonly error: PresentationError | null; readonly stageStartedAt?: IsoTimestamp; readonly blackoutRequested?: boolean; readonly presentationConfiguration: DrawPresentationConfiguration }
export interface PresentationControllerOptions {
  readonly result: PresentationResultProjection
  readonly presentationConfiguration?: DrawPresentationConfiguration
  readonly mode: 'live' | 'practice'
  readonly persistStage: (stage: PresentationStage, stageStartedAt: IsoTimestamp) => Promise<void>
  readonly persistBlackout?: (requested: boolean) => Promise<void>
  readonly clock: PresentationClock
  readonly policy?: PresentationPolicy
  readonly onState: (state: PresentationControllerState) => void
}

export class PresentationController {
  readonly result: PresentationResultProjection
  readonly presentationConfiguration: DrawPresentationConfiguration
  private readonly options: PresentationControllerOptions
  private readonly policy: PresentationPolicy
  private readonly usesLegacyPolicy: boolean
  private timeout: unknown = null
  private disposed = false
  private transitioning = false
  private bootstrapStarted = false
  private lifecycleVersion = 0
  private state: PresentationControllerState

  constructor(options: PresentationControllerOptions) { this.options = options; this.result = options.result; this.presentationConfiguration = options.presentationConfiguration ?? DEFAULT_DRAW_PRESENTATION_CONFIGURATION; this.policy = options.policy ?? PRESENTATION_POLICY; this.usesLegacyPolicy = options.presentationConfiguration === undefined; this.state = { stage: 'result-locked', countdownLabel: null, error: null, presentationConfiguration: this.presentationConfiguration } }
  getState(): PresentationControllerState { return this.state }
  async resume(stage: PresentationStage, stageStartedAt: IsoTimestamp, blackoutRequested = false): Promise<void> {
    this.reactivateAfterStrictModeReplay()
    if (this.disposed || this.state.stage !== 'result-locked' || this.bootstrapStarted) return
    this.bootstrapStarted = true
    if (stage === 'reveal' || stage === 'pending-handoff') {
      this.state = { ...this.state, stage, countdownLabel: null, error: null, stageStartedAt, blackoutRequested }
      this.options.onState(this.state)
      return
    }
    const elapsed = Math.max(0, Date.parse(this.options.clock.now()) - Date.parse(stageStartedAt))
    const duration = stage === 'countdown' ? this.policy.countdownDurationMs : this.rollingDurationMs()
    if (!Number.isFinite(elapsed) || elapsed >= duration) {
      await this.transition(this.nextAfter(stage))
      if (this.getState().stage === 'rolling' && !this.isManualRolling()) this.schedule(this.rollingDurationMs())
      return
    }
    const label = stage === 'countdown' ? (Math.max(1, 3 - Math.floor(elapsed / this.policy.countdownLabelDurationMs)) as 3 | 2 | 1) : null
    this.state = { ...this.state, stage, countdownLabel: label, error: null, stageStartedAt, blackoutRequested }
    this.options.onState(this.state)
    if (stage === 'countdown' || !this.isManualRolling()) this.schedule(Math.max(0, duration - elapsed), () => { void this.transition(stage === 'countdown' ? this.nextAfter('countdown') : 'reveal') })
  }
  async handoff(): Promise<void> {
    if (this.disposed || this.state.stage === 'result-locked' || this.state.stage === 'failed' || this.state.stage === 'pending-handoff') return
    this.clearTimer()
    await this.transition('pending-handoff')
  }
  async setBlackout(requested: boolean): Promise<void> {
    if (this.disposed || this.options.persistBlackout === undefined) return
    try {
      await this.options.persistBlackout(requested)
      this.state = { ...this.state, blackoutRequested: requested }
      this.options.onState(this.state)
    } catch (cause: unknown) { this.fail(new PresentationError('blackout-update-failure', 'Blackout intent could not be saved. The presentation stage and result were preserved.', true, true, cause)) }
  }
  async start(): Promise<void> {
    this.reactivateAfterStrictModeReplay()
    if (this.disposed || this.state.stage !== 'result-locked' || this.bootstrapStarted) return
    this.bootstrapStarted = true
    if (this.options.clock.prefersReducedMotion()) { await this.transition('reveal'); return }
    await this.transition('countdown')
    if (this.getState().stage === 'countdown') this.schedule(this.policy.countdownLabelDurationMs)
  }
  async skip(): Promise<void> {
    if (this.disposed || (this.state.stage !== 'countdown' && this.state.stage !== 'rolling')) return
    this.clearTimer()
    await this.transition('reveal')
  }
  async stopRollingAndReveal(): Promise<void> {
    if (this.disposed || this.state.stage !== 'rolling' || !this.isManualRolling()) return
    this.clearTimer()
    await this.transition('reveal')
  }
  async retry(): Promise<void> {
    if (this.disposed || this.state.stage !== 'failed') return
    if (this.state.error?.code === 'pending-handoff-write-failure') { await this.transition('pending-handoff'); return }
    this.clearTimer()
    this.state = { ...this.state, stage: 'result-locked', countdownLabel: null, error: null }
    this.bootstrapStarted = false
    this.options.onState(this.state)
    await this.start()
  }
  dispose(): void {
    this.disposed = true
    this.lifecycleVersion += 1
    this.clearTimer()
  }
  private schedule(delayMs: number, callback?: () => void): void {
    try { this.timeout = this.options.clock.setTimeout(() => { if (callback !== undefined) callback(); else void this.tick() }, delayMs) } catch (cause: unknown) { this.fail(new PresentationError('timer-controller-failure', 'Presentation was interrupted safely.', true, true, cause)) }
  }
  private async tick(): Promise<void> {
    if (this.disposed || this.state.stage === 'failed' || this.transitioning) return
    if (this.state.stage === 'countdown') {
      const nextLabel = this.state.countdownLabel === null ? 3 : this.state.countdownLabel > 1 ? (this.state.countdownLabel - 1) as 3 | 2 | 1 : null
      this.state = { ...this.state, countdownLabel: nextLabel }
      this.options.onState(this.state)
      if (nextLabel !== null) { this.schedule(this.policy.countdownLabelDurationMs); return }
      await this.transition(this.nextAfter('countdown'));
      if (this.state.stage === 'rolling' && !this.isManualRolling()) this.schedule(this.rollingDurationMs())
      return
    }
    if (this.state.stage === 'rolling') await this.transition('reveal')
  }
  private async transition(next: PresentationStage): Promise<void> {
    if (this.disposed || this.transitioning || this.state.stage === next || this.state.stage === 'failed') return
    if (this.state.stage === 'reveal' || (next === 'countdown' && this.state.stage !== 'result-locked')) { this.fail(new PresentationError('invalid-stage-transition', 'The presentation stage transition is invalid.', false)); return }
    this.transitioning = true
    const lifecycleVersion = this.lifecycleVersion
    try {
      const startedAt = this.options.clock.now()
      await this.options.persistStage(next, startedAt)
      if (this.disposed || lifecycleVersion !== this.lifecycleVersion) return
      this.state = { ...this.state, stage: next, countdownLabel: next === 'countdown' ? 3 : null, error: null, stageStartedAt: startedAt, blackoutRequested: this.state.blackoutRequested }
      this.options.onState(this.state)
    } catch (cause: unknown) {
      const error = cause instanceof PresentationError ? cause : new PresentationError(next === 'pending-handoff' ? 'pending-handoff-write-failure' : 'unexpected-presentation-failure', next === 'pending-handoff' ? 'Pending handoff could not be saved. Retry the handoff; the official result is preserved.' : 'Presentation could not continue safely.', true, true, cause)
      this.fail(error)
    } finally {
      if (lifecycleVersion === this.lifecycleVersion) this.transitioning = false
    }
  }
  private reactivateAfterStrictModeReplay(): void {
    if (!this.disposed) return
    this.disposed = false
    this.bootstrapStarted = false
    this.transitioning = false
    this.state = { ...this.state, stage: 'result-locked', countdownLabel: null, error: null }
  }
  private fail(error: PresentationError): void { this.clearTimer(); this.state = { ...this.state, stage: 'failed', countdownLabel: null, error }; this.options.onState(this.state) }
  private clearTimer(): void { if (this.timeout !== null) { this.options.clock.clearTimeout(this.timeout); this.timeout = null } }
  private rollingDurationMs(): number { return this.usesLegacyPolicy ? this.policy.rollingDurationMs : this.presentationConfiguration.rollDurationSeconds * 1000 }
  private isManualRolling(): boolean { return !this.usesLegacyPolicy && this.presentationConfiguration.presentationMode === 'random-number-roll' && this.presentationConfiguration.rollStopMode === 'manual' }
  private nextAfter(stage: 'countdown' | 'rolling'): PresentationStage { return stage === 'countdown' && (this.usesLegacyPolicy || this.presentationConfiguration.presentationMode === 'random-number-roll') ? 'rolling' : 'reveal' }
}
