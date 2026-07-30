import type { PrototypeSettingsFixture } from '../operator-types.ts'

export const settingsFixture: PrototypeSettingsFixture = Object.freeze({
  branding: Object.freeze({
    accentColor: '#F2A93B',
    eventName: 'Nusantara Tech Gala 2026',
    eventSubtitle: 'Celebrating ideas that move Indonesia forward',
    primaryColor: '#7567FF',
  }),
  presentation: Object.freeze({
    celebrationEffect: 'Confetti burst',
    countdownDuration: '3 seconds',
    revealStyle: 'Ticket spotlight',
    rollingDuration: '8 seconds',
    winnerLayout: 'Adaptive operator preview',
  }),
  audio: Object.freeze({
    countdownCue: 'Pulse countdown',
    masterVolume: '72%',
    rollingCue: 'Ticket roll',
    winnerRevealCue: 'Grand reveal',
  }),
  display: Object.freeze({
    blackoutAppearance: 'Pure black',
    safeArea: '5% title-safe margin',
    targetResolution: '1920 × 1080 (16:9)',
  }),
})
