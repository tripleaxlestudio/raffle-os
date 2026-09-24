import { useUiClass } from './ui-theme.ts'
import { Button } from './Button.tsx'

export interface SegmentedControlOption {
  readonly label: string
  readonly value: string
}

interface SegmentedControlProps {
  label: string
  onChange: (value: string) => void
  options: readonly SegmentedControlOption[]
  value: string
}

export function SegmentedControl({
  label,
  onChange,
  options,
  value,
}: SegmentedControlProps) {
  const ui = useUiClass()
  return (
    <div aria-label={label} className={ui("ui-segmented")} role="group">
      {options.map((option) => (
        <Button
          aria-pressed={option.value === value}
          key={option.value}
          onClick={() => onChange(option.value)}
          size="sm"
          variant="quiet"
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}
