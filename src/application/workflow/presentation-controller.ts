import type { IsoTimestamp } from '../../domain/shared/timestamps.ts'
import type { PresentationStage } from '../../domain/workflow/presentation-workflow.types.ts'
import { PresentationError } from './presentation-errors.ts'
import { PRESENTATION_POLICY, type PresentationPolicy } from './presentation-policy.ts'
import type { PresentationResultProjection } from './presentation-projection.ts'

export type PresentationControllerStage = 'result-locked' | PresentationStage | 'failed'
export interface PresentationClock {
  now(): IsoTimestamp
  setTimeout(callback: () => void, delayMs: number): unknown
  clearTimeout(handle: unknown): void
  prefersReducedMotion(): boolean
}
export interface PresentationControllerState { readonly stage: PresentationControllerStage; readonly countdownLabel: 3 | 2 | 1 | null; readonly error: PresentationError | null }
export interface PresentationControllerOptions {
  readonly result: PresentationResultProjection
  readonly mode: 'live' | 'practice'
  readonly persistStage: (stage: PresentationStage, stageStartedAt: IsoTimestamp) => Promise<void>
  readonly persistBlackout?: (requested: boolean) => Promise<void>
  readonly clock: PresentationClock
  readonly policy?: PresentationPolicy
  readonly onState: (state: PresentationControllerState) => void
}

export class PresentationController {
  readonly result: PresentationResultProjection
  private readonly options: PresentationControllerOptions
  private readonly policy: PresentationPolicy
  private timeout: unknown = null
  private disposed = false
  private transitioning = false
  private state: PresentationControllerState = { stage: 'result-locked', countdownLabel: null, error: null }

  constructor(options: PresentationControllerOptions) { this.options = options; this.result = options.result; this.policy = options.policy ?? PRESENTATION_POLICY }
  getState(): PresentationControllerState { return this.state }
  async resume(stage: PresentationStage, stageStartedAt: IsoTimestamp): Promise<void> {
    if (this.disposed || this.state.stage !== 'result-locked') return
    if (stage === 'reveal' || stage === 'pending-handoff') {
      this.state = { stage, countdownLabel: null, error: null }
      this.options.onState(this.state)
      return
    }
    const elapsed = Math.max(0, Date.parse(this.options.clock.now()) - Date.parse(stageStartedAt))
    const duration = stage === 'countdown' ? this.policy.countdownDurationMs : this.policy.rollingDurationMs
    if (!Number.isFinite(elapsed) || elapsed >= duration) {
      await this.transition(stage === 'countdown' ? 'rolling' : 'reveal')
      if (this.getState().stage === 'rolling') this.schedule(this.policy.rollingDurationMs)
      return
    }
    const label = stage === 'countdown' ? (Math.max(1, 3 - Math.floor(elapsed / this.policy.countdownLabelDurationMs)) as 3 | 2 | 1) : null
    this.state = { stage, countdownLabel: label, error: null }
    this.options.onState(this.state)
    this.schedule(Math.max(0, duration - elapsed))
  }
  async handoff(): Promise<void> {
    if (this.disposed || this.state.stage === 'result-locked' || this.state.stage === 'failed' || this.state.stage === 'pending-handoff') return
    this.clearTimer()
    await this.transition('pending-handoff')
  }
  async setBlackout(requested: boolean): Promise<void> {
    if (this.disposed || this.options.persistBlackout === undefined) return
    try { await this.options.persistBlackout(requested) } catch (cause: unknown) { this.fail(new PresentationError('blackout-update-failure', 'Blackout intent could not be saved. The presentation stage and result were preserved.', true, true, cause)) }
  }
  async start(): Promise<void> {
    if (this.disposed && this.state.stage === 'result-locked') this.disposed = false
    if (this.disposed || this.state.stage !== 'result-locked') return
    if (this.options.clock.prefersReducedMotion()) { await this.transition('reveal'); return }
    await this.transition('countdown')
    if (this.getState().stage === 'countdown') this.schedule(this.policy.countdownLabelDurationMs)
  }
  async skip(): Promise<void> {
    if (this.disposed || (this.state.stage !== 'countdown' && this.state.stage !== 'rolling')) return
    this.clearTimer()
    await this.transition('reveal')
  }
  async retry(): Promise<void> {
    if (this.disposed || this.state.stage !== 'failed') return
    if (this.state.error?.code === 'pending-handoff-write-failure') { await this.transition('pending-handoff'); return }
    this.clearTimer()
    this.state = { stage: 'result-locked', countdownLabel: null, error: null }
    this.options.onState(this.state)
    await this.start()
  }
  dispose(): void { this.disposed = true; this.clearTimer() }
  private schedule(delayMs: number): void {
    try { this.timeout = this.options.clock.setTimeout(() => { void this.tick() }, delayMs) } catch (cause: unknown) { this.fail(new PresentationError('timer-controller-failure', 'Presentation was interrupted safely.', true, true, cause)) }
  }
  private async tick(): Promise<void> {
    if (this.disposed || this.state.stage === 'failed' || this.transitioning) return
    if (this.state.stage === 'countdown') {
      const nextLabel = this.state.countdownLabel === null ? 3 : this.state.countdownLabel > 1 ? (this.state.countdownLabel - 1) as 3 | 2 | 1 : null
      this.state = { ...this.state, countdownLabel: nextLabel }
      this.options.onState(this.state)
      if (nextLabel !== null) { this.schedule(this.policy.countdownLabelDurationMs); return }
      await this.transition('rolling');
      if (this.state.stage === 'rolling') this.schedule(this.policy.rollingDurationMs)
      return
    }
    if (this.state.stage === 'rolling') await this.transition('reveal')
  }
  private async transition(next: PresentationStage): Promise<void> {
    if (this.disposed || this.transitioning || this.state.stage === next || this.state.stage === 'failed') return
    if (this.state.stage === 'reveal' || (next === 'countdown' && this.state.stage !== 'result-locked')) { this.fail(new PresentationError('invalid-stage-transition', 'The presentation stage transition is invalid.', false)); return }
    this.transitioning = true
    try {
      const startedAt = this.options.clock.now()
      await this.options.persistStage(next, startedAt)
      if (this.disposed) return
      this.state = { stage: next, countdownLabel: next === 'countdown' ? 3 : null, error: null }
      this.options.onState(this.state)
    } catch (cause: unknown) {
      const error = cause instanceof PresentationError ? cause : new PresentationError(next === 'pending-handoff' ? 'pending-handoff-write-failure' : 'unexpected-presentation-failure', next === 'pending-handoff' ? 'Pending handoff could not be saved. Retry the handoff; the official result is preserved.' : 'Presentation could not continue safely.', true, true, cause)
      this.fail(error)
    } finally { this.transitioning = false }
  }
  private fail(error: PresentationError): void { this.clearTimer(); this.state = { stage: 'failed', countdownLabel: null, error }; this.options.onState(this.state) }
  private clearTimer(): void { if (this.timeout !== null) { this.options.clock.clearTimeout(this.timeout); this.timeout = null } }
}
