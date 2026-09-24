import { useUiClass } from './ui-theme.ts'
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

export function Pagination({ label = 'Paginasi', onPageChange, onPageSizeChange, page, pageSize, totalItems }: PaginationProps) {
  const ui = useUiClass()
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const firstItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1
  const lastItem = Math.min(page * pageSize, totalItems)

  return <nav className={ui("ui-pagination")} aria-label={label}>
    <span className={ui("ui-pagination__range")}>{firstItem}–{lastItem} dari {totalItems}</span>
    <div className={ui("ui-pagination__controls")}>
      <Select containerClassName={ui("ui-pagination__page-size")} id={`${label.toLowerCase().replaceAll(' ', '-')}-page-size`} label="Baris per halaman" value={pageSize} onChange={(event) => onPageSizeChange(Number(event.currentTarget.value))}>
        {PAGINATION_PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
      </Select>
      <Button size="sm" variant="quiet" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Sebelumnya</Button>
      <span className={ui("ui-pagination__page-status")} aria-live="polite">Halaman {page} dari {totalPages}</span>
      <Button size="sm" variant="quiet" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Berikutnya</Button>
    </div>
  </nav>
}
