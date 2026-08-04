import { installAcceptanceBrowserApi } from '../infrastructure/persistence/seed/phase5-acceptance-browser.ts'

export function installPhase5BrowserAcceptanceApi(): void {
  installAcceptanceBrowserApi({ enabled: true })
}
