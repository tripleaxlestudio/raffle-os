import {
  DRAW_REVEAL_MODES,
  type DrawPresentationConfiguration,
  type DrawPresentationMode,
  type DrawRevealMode,
} from '../../../domain/draws/draw-presentation.types.ts'
import { ROLLING_DURATIONS_SECONDS } from '../../../domain/settings/presentation-settings.types.ts'
import { DRAW_ROLL_SPEED_PRESETS } from './draw-presentation-presets.ts'

interface PresentationChoiceProps {
  readonly checked: boolean
  readonly disabled: boolean
  readonly label: string
  readonly description: string
  readonly onSelect: () => void
}

function PresentationChoice({ checked, disabled, label, description, onSelect }: PresentationChoiceProps) {
  return <button type="button" role="radio" aria-checked={checked} className={`presentation-choice${checked ? ' presentation-choice--selected' : ''}`} onClick={onSelect} disabled={disabled}>
    <span className="presentation-choice__indicator" aria-hidden="true" />
    <span className="presentation-choice__copy"><strong>{label}</strong><small>{description}</small></span>
  </button>
}

interface SegmentedChoiceProps {
  readonly label: string
  readonly selected: boolean
  readonly disabled: boolean
  readonly onSelect: () => void
}

function SegmentedChoice({ label, selected, disabled, onSelect }: SegmentedChoiceProps) {
  return <button type="button" role="radio" aria-checked={selected} className={`presentation-segment${selected ? ' presentation-segment--selected' : ''}`} onClick={onSelect} disabled={disabled}>{label}</button>
}

export function DrawPresentationSettings({ configuration, winnerCount, disabled, onChange }: { readonly configuration: DrawPresentationConfiguration; readonly winnerCount: number; readonly disabled: boolean; readonly onChange: (value: DrawPresentationConfiguration) => void }) {
  const update = <K extends keyof DrawPresentationConfiguration>(key: K, value: DrawPresentationConfiguration[K]) => onChange({ ...configuration, [key]: value })

  return <section className="draw-setup-section draw-presentation-settings" aria-labelledby="presentation-settings-title">
    <div className="draw-setup-section__heading"><div><p className="operator-eyebrow">Presentation</p><h2 id="presentation-settings-title">Reveal style</h2></div><span className="draw-setup-section__hint">Saved to DrawConfiguration</span></div>
    <p className="draw-presentation-settings__description">Choose how the authoritative winners are presented after the countdown.</p>
    <div className="presentation-mode-choices" role="radiogroup" aria-labelledby="presentation-mode-label">
      <span id="presentation-mode-label" className="sr-only">Presentation mode</span>
      <PresentationChoice checked={configuration.presentationMode === 'instant-reveal'} disabled={disabled} label="Instant Reveal" description="Countdown finishes and winners are revealed immediately." onSelect={() => update('presentationMode', 'instant-reveal' satisfies DrawPresentationMode)} />
      <PresentationChoice checked={configuration.presentationMode === 'random-number-roll'} disabled={disabled} label="Random Number Roll" description="Display cycles through random ticket values before the authoritative winner reveal." onSelect={() => update('presentationMode', 'random-number-roll' satisfies DrawPresentationMode)} />
    </div>
    {configuration.presentationMode === 'random-number-roll' ? <div className="presentation-roll-controls">
      <fieldset className="presentation-control-group"><legend>Roll duration</legend><div className="presentation-segmented" role="radiogroup" aria-label="Roll duration">{ROLLING_DURATIONS_SECONDS.map((duration) => <SegmentedChoice key={duration} label={`${duration} sec`} selected={configuration.rollDurationSeconds === duration} disabled={disabled} onSelect={() => update('rollDurationSeconds', duration)} />)}</div></fieldset>
      <fieldset className="presentation-control-group"><legend>Roll speed</legend><div className="presentation-segmented" role="radiogroup" aria-label="Roll speed">{DRAW_ROLL_SPEED_PRESETS.map((preset) => <SegmentedChoice key={preset.label} label={`${preset.label} · ${preset.description}`} selected={configuration.rollSpeedPerSecond === preset.value} disabled={disabled} onSelect={() => update('rollSpeedPerSecond', preset.value)} />)}</div></fieldset>
      <fieldset className="presentation-control-group"><legend>Reveal mode</legend><div className="presentation-segmented presentation-segmented--wide" role="radiogroup" aria-label="Reveal mode"><SegmentedChoice label="Reveal Together" selected={configuration.revealMode === DRAW_REVEAL_MODES[0]} disabled={disabled} onSelect={() => update('revealMode', 'all-together' satisfies DrawRevealMode)} /><SegmentedChoice label="Reveal Sequentially" selected={configuration.revealMode === DRAW_REVEAL_MODES[1]} disabled={disabled} onSelect={() => update('revealMode', 'sequential' satisfies DrawRevealMode)} /></div><small className="presentation-control-group__hint">For one winner, both reveal modes look the same. With multiple winners, choose whether tickets appear together or one at a time.</small></fieldset>
      <p className="presentation-roll-controls__note">Random values are visual only; the authoritative winners remain selected independently by the draw engine.</p>
    </div> : null}
    {configuration.presentationMode === 'random-number-roll' && winnerCount === 1 ? <p className="sr-only">Reveal mode has no visible difference for a single winner.</p> : null}
  </section>
}
