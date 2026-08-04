import type { AcceptanceBrowserApi } from '../infrastructure/persistence/seed/phase5-acceptance-browser.ts'

declare global {
  var __raffleAcceptance: AcceptanceBrowserApi | undefined
}

export {}
