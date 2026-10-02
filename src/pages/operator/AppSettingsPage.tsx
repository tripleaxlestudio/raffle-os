import { useSearchParams } from 'react-router'
import { Icon } from '../../shared/ui/index.ts'
import type { RaffleOSDatabase } from '../../infrastructure/persistence/db.ts'
import { SETTINGS_TABS, type SettingsTabId } from './settings/settings-types.ts'
import { GeneralTab } from './settings/GeneralTab.tsx'
import { DataStorageTab } from './settings/DataStorageTab.tsx'
import { OperationsTab } from './settings/OperationsTab.tsx'
import { ConnectionsTab } from './settings/ConnectionsTab.tsx'
import { DiagnosticsTab } from './settings/DiagnosticsTab.tsx'
import { AboutTab } from './settings/AboutTab.tsx'

interface AppSettingsPageProps {
  readonly database?: RaffleOSDatabase
}

export function AppSettingsPage({ database }: AppSettingsPageProps = {}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab: SettingsTabId = SETTINGS_TABS.find((tab) => tab.id === searchParams.get('tab'))?.id ?? 'general'
  function setActiveTab(tab: SettingsTabId) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set('tab', tab)
      return next
    })
  }

  return (
    <section aria-labelledby="app-settings-title" className="kc-settings-page">
      {/* 1. Header */}
      <header className="kc-settings-header">
        <h1 id="app-settings-title" className="kc-settings-header__title">
          Settings
        </h1>
        <p className="kc-settings-header__description">
          Pengaturan aplikasi, penyimpanan, koneksi, dan sistem Kocokan.
        </p>
      </header>

      {/* 2. Horizontal Tab Navigation */}
      <nav aria-label="Tab Pengaturan" className="kc-settings-nav" role="tablist">
        {SETTINGS_TABS.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              aria-controls={`panel-${tab.id}`}
              aria-selected={isActive}
              className={`kc-settings-tab ${isActive ? 'kc-settings-tab--active' : ''}`}
              id={`tab-${tab.id}`}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              type="button"
            >
              <span className="kc-settings-tab__icon" aria-hidden="true">
                <Icon name={tab.icon} size={16} />
              </span>
              <span>{tab.label}</span>
            </button>
          )
        })}
      </nav>

      {/* 3. Tab Panels */}
      {activeTab === 'general' && <GeneralTab />}
      {activeTab === 'storage' && <DataStorageTab database={database} />}
      {activeTab === 'operations' && <OperationsTab />}
      {activeTab === 'connections' && <ConnectionsTab />}
      {activeTab === 'diagnostics' && <DiagnosticsTab />}
      {activeTab === 'about' && <AboutTab />}
    </section>
  )
}
