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
  readonly description?: string
  readonly selected: boolean
  readonly disabled: boolean
  readonly onSelect: () => void
}

function SegmentedChoice({ label, description, selected, disabled, onSelect }: SegmentedChoiceProps) {
  return <button type="button" role="radio" aria-checked={selected} aria-pressed={selected} data-selected={selected ? 'true' : 'false'} className={`presentation-segment${selected ? ' presentation-segment--selected' : ''}`} onClick={onSelect} disabled={disabled}><span className="presentation-segment__label">{label}</span>{description ? <span className="presentation-segment__description">{description}</span> : null}</button>
}

export function DrawPresentationSettings({ configuration, winnerCount, disabled, onChange }: { readonly configuration: DrawPresentationConfiguration; readonly winnerCount: number; readonly disabled: boolean; readonly onChange: (value: DrawPresentationConfiguration) => void }) {
  const update = <K extends keyof DrawPresentationConfiguration>(key: K, value: DrawPresentationConfiguration[K]) => onChange({ ...configuration, [key]: value })

  return <section className="draw-setup-section draw-presentation-settings" aria-labelledby="presentation-settings-title">
    <div className="draw-setup-section__heading"><div><p className="operator-eyebrow">Presentasi</p><h2 id="presentation-settings-title">Gaya pengungkapan</h2></div><span className="draw-setup-section__hint">Disimpan ke DrawConfiguration</span></div>
    <p className="draw-presentation-settings__description">Pilih cara pemenang resmi ditampilkan setelah hitung mundur.</p>
    <div className="presentation-mode-choices" role="radiogroup" aria-labelledby="presentation-mode-label">
      <span id="presentation-mode-label" className="sr-only">Mode presentasi</span>
      <PresentationChoice checked={configuration.presentationMode === 'instant-reveal'} disabled={disabled} label="Ungkap Langsung" description="Hitung mundur selesai dan pemenang langsung ditampilkan." onSelect={() => update('presentationMode', 'instant-reveal' satisfies DrawPresentationMode)} />
      <PresentationChoice checked={configuration.presentationMode === 'random-number-roll'} disabled={disabled} label="Putar Nomor Acak" description="Tampilan menggilir nilai tiket acak sebelum pemenang resmi ditampilkan." onSelect={() => update('presentationMode', 'random-number-roll' satisfies DrawPresentationMode)} />
    </div>
    {configuration.presentationMode === 'random-number-roll' ? <div className="presentation-roll-controls">
      <div className="presentation-roll-controls__row">
        <fieldset className="presentation-control-group"><legend>Kontrol putaran</legend><div className="presentation-segmented presentation-segmented--control" role="radiogroup" aria-label="Kontrol putaran"><SegmentedChoice label="Berwaktu" selected={configuration.rollStopMode === 'timed'} disabled={disabled} onSelect={() => update('rollStopMode', 'timed')} /><SegmentedChoice label="Berhenti Manual" selected={configuration.rollStopMode === 'manual'} disabled={disabled} onSelect={() => update('rollStopMode', 'manual')} /></div></fieldset>
        {configuration.rollStopMode === 'timed' ? <fieldset className="presentation-control-group"><legend>Durasi putaran</legend><div className="presentation-segmented" role="radiogroup" aria-label="Durasi putaran">{ROLLING_DURATIONS_SECONDS.map((duration) => <SegmentedChoice key={duration} label={`${duration} dtk`} selected={configuration.rollDurationSeconds === duration} disabled={disabled} onSelect={() => update('rollDurationSeconds', duration)} />)}</div></fieldset> : <div className="presentation-control-group presentation-manual-state"><span className="presentation-control-group__label">Kontrol manual</span><strong>Berhenti &amp; Ungkap dari Undian</strong><small className="presentation-control-group__hint">Putaran berlanjut sampai dihentikan Operator.</small></div>}
        <fieldset className="presentation-control-group"><legend>Kecepatan putaran</legend><div className="presentation-segmented presentation-segmented--speed" role="radiogroup" aria-label="Kecepatan putaran">{DRAW_ROLL_SPEED_PRESETS.map((preset) => <SegmentedChoice key={preset.label} label={preset.label} description={preset.description} selected={configuration.rollSpeedPerSecond === preset.value} disabled={disabled} onSelect={() => update('rollSpeedPerSecond', preset.value)} />)}</div></fieldset>
      </div>
      <fieldset className="presentation-control-group presentation-roll-controls__reveal"><legend>Mode pengungkapan</legend><div className="presentation-segmented presentation-segmented--wide" role="radiogroup" aria-label="Mode pengungkapan"><SegmentedChoice label="Ungkap Bersamaan" selected={configuration.revealMode === DRAW_REVEAL_MODES[0]} disabled={disabled} onSelect={() => update('revealMode', 'all-together' satisfies DrawRevealMode)} /><SegmentedChoice label="Ungkap Berurutan" selected={configuration.revealMode === DRAW_REVEAL_MODES[1]} disabled={disabled} onSelect={() => update('revealMode', 'sequential' satisfies DrawRevealMode)} /></div><small className="presentation-control-group__hint">Untuk satu pemenang, kedua mode terlihat sama. Untuk beberapa pemenang, pilih apakah tiket muncul bersama atau satu per satu.</small></fieldset>
      <p className="presentation-roll-controls__note">Nilai acak hanya visual; pemenang resmi tetap dipilih secara terpisah oleh mesin undian.</p>
    </div> : null}
    {configuration.presentationMode === 'random-number-roll' && winnerCount === 1 ? <p className="sr-only">Mode pengungkapan tidak memiliki perbedaan visual untuk satu pemenang.</p> : null}
  </section>
}
