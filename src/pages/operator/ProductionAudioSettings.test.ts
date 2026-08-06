import productionSettingsSource from './ProductionSettingsPage.tsx?raw'
import { describe, expect, it } from 'vitest'
import { formatAudioAssetSize, isValidRevealCue } from './audio-settings-ui.ts'

describe('production Audio settings UI contract', () => {
  it('keeps the authoritative audio contract in a compact two-column layout', () => {
    const source = productionSettingsSource
    expect(source).toContain('Audio cues')
    expect(source).toContain('settings-audio-columns')
    expect(source).toContain('Audio enabled')
    expect(source).toContain('type="radio"')
    expect(source).toContain('name="audio-enabled"')
    expect(source).toContain('settings-audio-enabled__options')
    expect(source).not.toContain('<select value={settings.audioEnabled')
    expect(source).toContain('Master volume')
    expect(source).toContain('Reveal cue audio')
    expect(source).toContain('Choose audio')
    expect(source).toContain('Play / Test Audio')
    expect(source).toContain('isValidRevealCue(settings.revealCue)')
    expect(source).not.toContain('Countdown cue')
    expect(source).not.toContain('Rolling cue')
    expect(source).not.toContain('Mute all')
  })

  it('keeps empty, selected, replace, and remove states inside the audio card', () => {
    const source = productionSettingsSource
    expect(source).toContain('No local audio asset selected.')
    expect(source).toContain("asset ? 'Replace' : 'Choose audio'")
    expect(source).toContain('>Remove</Button>')
    expect(source).toContain('setAudioMessage(\'Reveal cue removed.\')')
    expect(source).toContain('<span>♫</span>')
    expect(source).toContain('AudioAssetField')
  })

  it('explains unavailable playback and preserves the shared save toast path', () => {
    expect(productionSettingsSource).toContain('Enable audio to test the selected reveal cue.')
    expect(productionSettingsSource).toContain('Choose a valid local audio file to enable testing.')
    expect(productionSettingsSource).toContain('SettingsSaveToast')
    expect(productionSettingsSource).toContain("`${details[0]} settings saved`")
  })
})

describe('audio settings UI helpers', () => {
  it('accepts audio assets within the existing persistence limits only', () => {
    const valid = { name: 'reveal.mp3', type: 'audio/mpeg', size: 1024, blob: new Blob(['cue'], { type: 'audio/mpeg' }) }
    expect(isValidRevealCue(valid)).toBe(true)
    expect(isValidRevealCue({ ...valid, type: 'image/png' })).toBe(false)
    expect(isValidRevealCue({ ...valid, size: 10 * 1024 * 1024 + 1 })).toBe(false)
  })

  it('formats the selected filename size for compact card metadata', () => {
    expect(formatAudioAssetSize(12 * 1024)).toBe('12 KB')
    expect(formatAudioAssetSize(1.5 * 1024 * 1024)).toBe('1.5 MB')
  })
})
