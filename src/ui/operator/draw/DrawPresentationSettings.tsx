import { useUiClass } from '../../../shared/ui/ui-theme.ts'
import {
  resolveDrawPresentationConfiguration,
  type DrawPresentationConfiguration,
  type DrawPresentationMode,
} from '../../../domain/draws/draw-presentation.types.ts'

interface PresentationChoiceProps {
  readonly checked: boolean
  readonly disabled: boolean
  readonly label: string
  readonly description: string
  readonly onSelect: () => void
}

function PresentationChoice({ checked, disabled, label, description, onSelect }: PresentationChoiceProps) {
  const uiClass = useUiClass()
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      className={uiClass(`presentation-choice${checked ? ' presentation-choice--selected' : ''}`)}
      onClick={onSelect}
      disabled={disabled}
    >
      <span className={uiClass('presentation-choice__indicator')} aria-hidden="true" />
      <span className={uiClass('presentation-choice__copy')}>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
    </button>
  )
}

export function DrawPresentationSettings({
  configuration,
  disabled,
  onChange,
}: {
  readonly configuration: DrawPresentationConfiguration
  readonly winnerCount?: number
  readonly disabled: boolean
  readonly onChange: (value: DrawPresentationConfiguration) => void
}) {
  const uiClass = useUiClass()
  const selectMode = (mode: DrawPresentationMode) => {
    onChange(resolveDrawPresentationConfiguration({ presentationMode: mode }))
  }

  return (
    <section className={uiClass('draw-setup-section draw-presentation-settings')} aria-labelledby="presentation-settings-title">
      <div className={uiClass('draw-setup-section__heading')}>
        <div>
          <p className={uiClass('operator-eyebrow')}>Presentasi</p>
          <h2 id="presentation-settings-title">Gaya pengungkapan</h2>
        </div>
        <span className={uiClass('draw-setup-section__hint')}>Disimpan ke DrawConfiguration</span>
      </div>
      <p className={uiClass('draw-presentation-settings__description')}>
        Pilih cara pemenang resmi ditampilkan setelah hitung mundur.
      </p>
      <div className={uiClass('presentation-mode-choices')} role="radiogroup" aria-labelledby="presentation-mode-label">
        <span id="presentation-mode-label" className="sr-only">Mode presentasi</span>
        <PresentationChoice
          checked={configuration.presentationMode === 'instant-reveal'}
          disabled={disabled}
          label="Tampil Langsung"
          description="Setelah hitung mundur, pemenang langsung ditampilkan."
          onSelect={() => selectMode('instant-reveal')}
        />
        <PresentationChoice
          checked={configuration.presentationMode === 'random-number-roll'}
          disabled={disabled}
          label="Putar & Stop Manual"
          description="Setelah hitung mundur, nomor akan terus berputar hingga operator menekan Stop."
          onSelect={() => selectMode('random-number-roll')}
        />
      </div>
    </section>
  )
}
