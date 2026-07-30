import type {
  ReactNode,
  TableHTMLAttributes,
} from 'react'
import { joinClassNames } from './class-names.ts'

interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  caption: string
  emptyState?: ReactNode
  isEmpty?: boolean
}

export function Table({
  caption,
  children,
  className,
  emptyState,
  isEmpty = false,
  ...props
}: TableProps) {
  return (
    <div className="ui-table-frame">
      <div className="ui-table-scroll">
        <table
          className={joinClassNames('ui-table', className)}
          {...props}
        >
          <caption>{caption}</caption>
          {children}
        </table>
      </div>
      {isEmpty ? (
        <div className="ui-table-empty">
          {emptyState ?? 'No rows are available.'}
        </div>
      ) : null}
    </div>
  )
}
