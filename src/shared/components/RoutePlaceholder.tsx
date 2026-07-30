interface RoutePlaceholderProps {
  title: string
  purpose: string
}

export function RoutePlaceholder({
  title,
  purpose,
}: RoutePlaceholderProps) {
  return (
    <section className="route-placeholder">
      <h1>{title}</h1>
      <p>{purpose}</p>
      <p>This feature is not yet implemented.</p>
    </section>
  )
}
