import type { IconName } from '../../../shared/ui/index.ts'

export type SettingsTabId =
  | 'general'
  | 'storage'
  | 'operations'
  | 'connections'
  | 'diagnostics'
  | 'about'

export interface SettingsTabItem {
  readonly id: SettingsTabId
  readonly label: string
  readonly icon: IconName
}

export const SETTINGS_TABS: readonly SettingsTabItem[] = [
  { id: 'general', label: 'Umum', icon: 'SlidersHorizontal' },
  { id: 'storage', label: 'Data & Penyimpanan', icon: 'FolderOpen' },
  { id: 'operations', label: 'Operasional', icon: 'Play' },
  { id: 'connections', label: 'Koneksi & Integrasi', icon: 'Radio' },
  { id: 'diagnostics', label: 'Sistem & Diagnostik', icon: 'ListChecks' },
  { id: 'about', label: 'Tentang', icon: 'Sparkles' },
] as const
