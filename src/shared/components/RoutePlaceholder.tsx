interface RoutePlaceholderProps {
  title: string
  purpose: string
}

export function RoutePlaceholder({
  title,
  purpose,
}: RoutePlaceholderProps) {
  return (
    <main>
      <h1>{title}</h1>
      <p>{purpose}</p>
      <p>This feature is not yet implemented.</p>
    </main>
  )
}
