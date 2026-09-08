import { Button } from '../../../shared/ui/Button.tsx'
import { Icon } from '../../../shared/ui/Icon.tsx'
import {
  LOG_CATEGORIES,
  type LogCategory,
  type LogFilterState,
  type LogLevel,
} from './log-types.ts'

interface LogToolbarProps {
  filters: LogFilterState
  onToggleLevel: (level: LogLevel) => void
  onCategoryChange: (category: LogCategory | 'ALL') => void
  onSearchChange: (search: string) => void
  levelCounts: Record<LogLevel, number>
  autoScroll: boolean
  onToggleAutoScroll: () => void
  isPaused: boolean
  onTogglePause: () => void
  onExport: () => void
  onOpenClearDialog: () => void
}

export function LogToolbar({
  filters,
  onToggleLevel,
  onCategoryChange,
  onSearchChange,
  levelCounts,
  autoScroll,
  onToggleAutoScroll,
  isPaused,
  onTogglePause,
  onExport,
  onOpenClearDialog,
}: LogToolbarProps) {
  const levelLabels: { key: LogLevel; label: string }[] = [
    { key: 'error', label: 'Error' },
    { key: 'warning', label: 'Peringatan' },
    { key: 'info', label: 'Info' },
    { key: 'debug', label: 'Debug' },
  ]

  return (
    <div className="kc-log-toolbar" role="toolbar" aria-label="Alat log sistem">
      <div className="kc-log-toolbar__left">
        {/* Level Filters */}
        <div className="kc-log-level-group" role="group" aria-label="Filter level log">
          {levelLabels.map(({ key, label }) => {
            const active = filters.levels[key]
            const count = levelCounts[key]
            return (
              <button
                key={key}
                type="button"
                className="kc-log-level-btn"
                data-active={active}
                data-level={key}
                onClick={() => onToggleLevel(key)}
                aria-pressed={active}
              >
                <span>{label}</span>
                <span className="kc-log-level-badge">({count})</span>
              </button>
            )
          })}
        </div>

        {/* Search Input */}
        <div className="kc-log-search-wrap">
          <span className="kc-log-search-icon" aria-hidden="true">
            <Icon name="Search" size={14} />
          </span>
          <input
            type="text"
            className="kc-log-search-input"
            placeholder="Cari log..."
            value={filters.search}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Cari log sistem"
          />
          {filters.search && (
            <button
              type="button"
              className="kc-log-search-clear"
              onClick={() => onSearchChange('')}
              aria-label="Hapus pencarian"
            >
              <Icon name="X" size={13} />
            </button>
          )}
        </div>

        {/* Source Dropdown */}
        <div className="kc-log-select-wrap">
          <select
            className="kc-log-select"
            value={filters.category}
            onChange={(e) => onCategoryChange(e.target.value as LogCategory | 'ALL')}
            aria-label="Filter sumber log"
          >
            <option value="ALL">Semua Sumber</option>
            {LOG_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <span className="kc-log-select-chevron" aria-hidden="true">
            <Icon name="ChevronDown" size={13} />
          </span>
        </div>
      </div>

      <div className="kc-log-toolbar__right">
        {/* Auto-scroll button */}
        <Button
          size="sm"
          variant={autoScroll ? 'secondary' : 'quiet'}
          onClick={onToggleAutoScroll}
          icon={<Icon name="ArrowDown" size={14} />}
          title={autoScroll ? 'Matikan auto-scroll' : 'Aktifkan auto-scroll'}
        >
          {autoScroll ? 'Auto-scroll: Aktif' : 'Auto-scroll: Mati'}
        </Button>

        {/* Pause / Resume button */}
        <Button
          size="sm"
          variant={isPaused ? 'primary' : 'secondary'}
          onClick={onTogglePause}
          icon={<Icon name={isPaused ? 'Play' : 'Pause'} size={14} />}
          title={isPaused ? 'Lanjutkan pembaruan log real-time' : 'Jeda pembaruan log'}
        >
          {isPaused ? 'Lanjutkan' : 'Jeda'}
        </Button>

        {/* Export button */}
        <Button
          size="sm"
          variant="secondary"
          onClick={onExport}
          icon={<Icon name="Download" size={14} />}
          title="Ekspor seluruh log sesi ini ke file teks (.txt)"
        >
          Ekspor Log
        </Button>

        {/* Clear button */}
        <Button
          size="sm"
          variant="quiet"
          onClick={onOpenClearDialog}
          icon={<Icon name="Trash2" size={14} />}
          title="Bersihkan log sesi saat ini"
        >
          Bersihkan
        </Button>
      </div>
    </div>
  )
}
