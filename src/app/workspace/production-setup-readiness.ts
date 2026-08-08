import type { DrawConfiguration } from '../../domain/draws/draw-configuration.types.ts'
import type { DrawSession } from '../../domain/draws/draw-session.types.ts'
import type { DisplayConfiguration } from '../../domain/display/display-configuration.types.ts'
import type { Participant } from '../../domain/participants/participant.types.ts'
import type { PrizeCategory } from '../../domain/prizes/prize.types.ts'

export const PRODUCTION_SETUP_STAGE_COUNT = 5
export const PRODUCTION_SETUP_STAGE_ROUTES = ['/events', '/prize-categories', '/participants', '/settings', '/draw/setup'] as const
export interface ProductionSetupReadiness { readonly event: boolean; readonly prize: boolean; readonly participants: boolean; readonly displaySettings: boolean; readonly drawSetup: boolean }
export interface ProductionSetupReadinessInput { readonly hasCurrentEvent: boolean; readonly categories: readonly PrizeCategory[]; readonly participants: readonly Participant[]; readonly displayConfiguration: DisplayConfiguration | null; readonly configurations: readonly DrawConfiguration[]; readonly sessions: readonly DrawSession[] }

export function deriveProductionSetupReadiness(input: ProductionSetupReadinessInput): ProductionSetupReadiness {
  const event = input.hasCurrentEvent
  const prize = event && input.categories.some((category) => category.name.trim() !== '' && category.prizeName.trim() !== '')
  const participants = prize && input.participants.length > 0
  const displaySettings = participants && input.displayConfiguration !== null
  const drawSetup = displaySettings && input.configurations.some((configuration) => input.sessions.some((session) => session.configurationId === configuration.id && session.status === 'ready'))
  return { event, prize, participants, displaySettings, drawSetup }
}
export function productionSetupStageComplete(readiness: ProductionSetupReadiness, index: number): boolean { return [readiness.event, readiness.prize, readiness.participants, readiness.displaySettings, readiness.drawSetup][index] ?? false }
export function productionSetupJourneyComplete(readiness: ProductionSetupReadiness): boolean {
  return Array.from({ length: PRODUCTION_SETUP_STAGE_COUNT }, (_, index) => productionSetupStageComplete(readiness, index)).every(Boolean)
}
export function getInitialProductionSetupAdmission(readiness: ProductionSetupReadiness): number {
  let admittedThrough = 0
  while (admittedThrough < PRODUCTION_SETUP_STAGE_COUNT - 1 && productionSetupStageComplete(readiness, admittedThrough)) admittedThrough += 1
  return admittedThrough
}
export function productionSetupStageUnlocked(readiness: ProductionSetupReadiness, index: number): boolean {
  if (index === 0) return true
  if (index < 0) return true
  return productionSetupStageComplete(readiness, index - 1) && productionSetupStageUnlocked(readiness, index - 1)
}

export function productionSetupStageIndexForRoute(pathname: string): number | undefined {
  const index = PRODUCTION_SETUP_STAGE_ROUTES.indexOf(pathname as typeof PRODUCTION_SETUP_STAGE_ROUTES[number])
  return index === -1 ? undefined : index
}
export function getProductionSetupProgress(readiness: ProductionSetupReadiness): { readonly completedIndex: number; readonly nextIndex: number } {
  let completedIndex = -1
  for (let index = 0; index < PRODUCTION_SETUP_STAGE_COUNT; index += 1) { if (!productionSetupStageComplete(readiness, index)) break; completedIndex = index }
  return { completedIndex, nextIndex: Math.max(1, Math.min(completedIndex + 1, PRODUCTION_SETUP_STAGE_COUNT - 1)) }
}
