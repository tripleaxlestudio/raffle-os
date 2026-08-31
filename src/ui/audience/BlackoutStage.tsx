export function BlackoutStage({ appearance = 'pure-black' }: { readonly appearance?: 'pure-black' | 'event-surface' }) {
  return (
    <div
      aria-label="Layar hitam Tampilan Audiens aktif"
      className="audience-blackout-stage"
      data-audience-state="blackout"
      data-blackout-appearance={appearance}
      role="status"
    />
  )
}
