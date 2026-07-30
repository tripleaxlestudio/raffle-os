export interface SummaryListItem {
  label: string
  value: string
}

interface SummaryListProps {
  items: readonly SummaryListItem[]
}

export function SummaryList({ items }: SummaryListProps) {
  return (
    <dl className="summary-list">
      {items.map((item) => (
        <div className="summary-list__item" key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
