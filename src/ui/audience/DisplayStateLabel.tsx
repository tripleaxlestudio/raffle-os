interface DisplayStateLabelProps {
  children: string
  tone?: 'neutral' | 'verification' | 'confirmed'
}

export function DisplayStateLabel({
  children,
  tone = 'neutral',
}: DisplayStateLabelProps) {
  return (
    <p
      className="display-state-label"
      data-status-tone={tone}
      role="status"
    >
      <span aria-hidden="true" className="display-state-label__marker" />
      <span>{children}</span>
    </p>
  )
}
