import type {
  ApplicationPreferenceKey,
  ApplicationPreferenceRegistry,
} from '../../../domain/preferences/application-preference.types.ts'
import type { IsoTimestamp } from '../../../domain/shared/timestamps.ts'

export interface PreferenceRepository {
  get<K extends ApplicationPreferenceKey>(
    key: K,
  ): Promise<ApplicationPreferenceRegistry[K] | null>
  set<K extends ApplicationPreferenceKey>(
    key: K,
    value: ApplicationPreferenceRegistry[K],
    at: IsoTimestamp,
  ): Promise<void>
}
