import { Button } from './Button.tsx'
import { Select } from './Select.tsx'

const PAGINATION_PAGE_SIZES = [10, 50, 100] as const

interface PaginationProps {
  readonly page: number
  readonly pageSize: number
  readonly totalItems: number
  readonly onPageChange: (page: number) => void
  readonly onPageSizeChange: (pageSize: number) => void
  readonly label?: string
}

export function Pagination({ label = 'Pagination', onPageChange, onPageSizeChange, page, pageSize, totalItems }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const firstItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1
  const lastItem = Math.min(page * pageSize, totalItems)

  return <nav className="ui-pagination" aria-label={label}>
    <span className="ui-pagination__range">{firstItem}–{lastItem} of {totalItems}</span>
    <div className="ui-pagination__controls">
      <Select containerClassName="ui-pagination__page-size" id={`${label.toLowerCase().replaceAll(' ', '-')}-page-size`} label="Rows per page" value={pageSize} onChange={(event) => onPageSizeChange(Number(event.currentTarget.value))}>
        {PAGINATION_PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
      </Select>
      <Button size="sm" variant="quiet" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Previous</Button>
      <span className="ui-pagination__page-status" aria-live="polite">Page {page} of {totalPages}</span>
      <Button size="sm" variant="quiet" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Next</Button>
    </div>
  </nav>
}
