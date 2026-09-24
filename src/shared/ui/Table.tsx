import { useUiClass } from './ui-theme.ts'
import type {
  ThHTMLAttributes,
  ReactNode,
  TableHTMLAttributes,
} from 'react'
import { joinClassNames } from './class-names.ts'

interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  caption: string
  emptyState?: ReactNode
  isEmpty?: boolean
}

interface TableHeaderProps
  extends ThHTMLAttributes<HTMLTableCellElement> {
  sortable?: boolean
}

export function TableHeader({
  children,
  className,
  sortable = false,
  ...props
}: TableHeaderProps) {
  const ui = useUiClass()
  return (
    <th
      aria-sort={sortable ? 'none' : undefined}
      className={joinClassNames(
        sortable && ui('ui-table__header--sortable'),
        className,
      )}
      {...props}
    >
      <span>{children}</span>
      {sortable ? (
        <span aria-hidden="true" className={ui("ui-table__sort-marker")}>
          {'\u2195'}
        </span>
      ) : null}
    </th>
  )
}

export function Table({
  caption,
  children,
  className,
  emptyState,
  isEmpty = false,
  ...props
}: TableProps) {
  const ui = useUiClass()
  return (
    <div className={ui("ui-table-frame")}>
      <div className={ui("ui-table-scroll")}>
        <table
          className={joinClassNames(ui('ui-table'), className)}
          {...props}
        >
          <caption>{caption}</caption>
          {children}
        </table>
      </div>
      {isEmpty ? (
        <div className={ui("ui-table-empty")}>
          {emptyState ?? 'No rows are available.'}
        </div>
      ) : null}
    </div>
  )
}
