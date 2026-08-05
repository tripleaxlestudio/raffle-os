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
      const error = cause instanceof PresentationError ? cause : new PresentationError('unexpected-presentation-failure', 'Presentation could not continue safely.', true, true, cause)
      this.fail(error)
    } finally { this.transitioning = false }
  }
  private fail(error: PresentationError): void { this.clearTimer(); this.state = { stage: 'failed', countdownLabel: null, error }; this.options.onState(this.state) }
  private clearTimer(): void { if (this.timeout !== null) { this.options.clock.clearTimeout(this.timeout); this.timeout = null } }
}
