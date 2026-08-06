export function BlackoutStage({ appearance = 'pure-black' }: { readonly appearance?: 'pure-black' | 'event-surface' }) {
  return (
    <div
      className="audience-blackout-stage"
      data-audience-state="blackout"
      data-blackout-appearance={appearance}
    />
  )
}
