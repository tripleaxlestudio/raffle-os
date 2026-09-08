import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ConfirmationDialog } from '../../shared/ui/ConfirmationDialog.tsx'
import {
  generateInitialDummyLogs,
  generateNextSimulatedEntry,
} from './log/dummy-logs.ts'
import { LogToolbar } from './log/LogToolbar.tsx'
import { LogViewer } from './log/LogViewer.tsx'
import type {
  LogCategory,
  LogEntry,
  LogFilterState,
  LogLevel,
} from './log/log-types.ts'

export function LogPage() {
  const [sessionStartTime] = useState<Date>(() => new Date(Date.now() - 24 * 1000))
  const [logs, setLogs] = useState<LogEntry[]>(() => generateInitialDummyLogs(sessionStartTime))
  const [isPaused, setIsPaused] = useState<boolean>(false)
  const [pausedBuffer, setPausedBuffer] = useState<LogEntry[]>([])
  const [autoScroll, setAutoScroll] = useState<boolean>(true)
  const [clearDialogOpen, setClearDialogOpen] = useState<boolean>(false)

  // Default filters: Error ON, Peringatan ON, Info ON, Debug OFF
  const [filters, setFilters] = useState<LogFilterState>({
    levels: {
      error: true,
      warning: true,
      info: true,
      debug: false,
    },
    category: 'ALL',
    search: '',
  })

  // Simulated real-time log ingestion
  const isPausedRef = useRef(isPaused)
  useEffect(() => {
    isPausedRef.current = isPaused
  }, [isPaused])

  useEffect(() => {
    const timer = setInterval(() => {
      const nextEntry = generateNextSimulatedEntry(new Date())
      if (isPausedRef.current) {
        setPausedBuffer((prev) => [...prev, nextEntry])
      } else {
        setLogs((prev) => [...prev, nextEntry])
      }
    }, 3200)

    return () => clearInterval(timer)
  }, [])

  // Toggle pause / resume
  const handleTogglePause = useCallback(() => {
    setIsPaused((prev) => {
      const next = !prev
      if (!next && pausedBuffer.length > 0) {
        // Resuming: flush buffer into visible logs
        setLogs((curr) => [...curr, ...pausedBuffer])
        setPausedBuffer([])
      }
      return next
    })
  }, [pausedBuffer])

  // Filter actions
  const handleToggleLevel = useCallback((level: LogLevel) => {
    setFilters((prev) => ({
      ...prev,
      levels: {
        ...prev.levels,
        [level]: !prev.levels[level],
      },
    }))
  }, [])

  const handleCategoryChange = useCallback((category: LogCategory | 'ALL') => {
    setFilters((prev) => ({ ...prev, category }))
  }, [])

  const handleSearchChange = useCallback((search: string) => {
    setFilters((prev) => ({ ...prev, search }))
  }, [])

  const handleResetFilters = useCallback(() => {
    setFilters({
      levels: {
        error: true,
        warning: true,
        info: true,
        debug: true,
      },
      category: 'ALL',
      search: '',
    })
  }, [])

  // Level counts across all session logs
  const levelCounts = useMemo<Record<LogLevel, number>>(() => {
    const counts: Record<LogLevel, number> = {
      error: 0,
      warning: 0,
      info: 0,
      debug: 0,
    }
    for (const entry of logs) {
      counts[entry.level] = (counts[entry.level] ?? 0) + 1
    }
    return counts
  }, [logs])

  // Filtered log entries
  const filteredLogs = useMemo(() => {
    const query = filters.search.trim().toLowerCase()
    return logs.filter((entry) => {
      // Level check
      if (!filters.levels[entry.level]) return false

      // Category check
      if (filters.category !== 'ALL' && entry.category !== filters.category) {
        return false
      }

      // Search query
      if (query) {
        const matchesMsg = entry.message.toLowerCase().includes(query)
        const matchesSource = entry.source.toLowerCase().includes(query)
        const matchesLevel = entry.level.toLowerCase().includes(query)
        const matchesMetadata = entry.metadata
          ? Object.entries(entry.metadata).some(
              ([k, v]) =>
                k.toLowerCase().includes(query) ||
                String(v).toLowerCase().includes(query),
            )
          : false
        if (!matchesMsg && !matchesSource && !matchesLevel && !matchesMetadata) {
          return false
        }
      }

      return true
    })
  }, [logs, filters])

  // Export logs to .txt
  const handleExport = useCallback(() => {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const fileTimestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
    const filename = `kocokan-log-${fileTimestamp}.txt`

    const lines = logs.map((entry) => {
      const levelPad = (entry.level === 'warning' ? 'WARN' : entry.level.toUpperCase()).padEnd(5, ' ')
      const sourcePad = entry.source.padEnd(20, ' ')
      let line = `${entry.fullTimestamp} ${levelPad} ${sourcePad} ${entry.message}`
      if (entry.metadata && Object.keys(entry.metadata).length > 0) {
        line += `\n    metadata: ${JSON.stringify(entry.metadata)}`
      }
      return line
    })

    const header = [
      '================================================================================',
      `KOCOKAN System Diagnostic Log`,
      `Exported: ${now.toISOString()}`,
      `Total Entries: ${logs.length}`,
      '================================================================================',
      '',
    ].join('\n')

    const fileContent = header + lines.join('\n')
    const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }, [logs])

  // Clear confirmation
  const handleConfirmClear = useCallback(() => {
    setLogs([])
    setPausedBuffer([])
    setClearDialogOpen(false)
  }, [])

  const formattedStartTime = useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(sessionStartTime.getHours())}:${pad(sessionStartTime.getMinutes())}:${pad(sessionStartTime.getSeconds())}`
  }, [sessionStartTime])

  return (
    <section aria-labelledby="log-title" className="kc-log-page">
      {/* 1. Page Header */}
      <header className="kc-log-header">
        <div className="kc-log-header__title-group">
          <h1 id="log-title" className="kc-log-header__title">
            Log Sistem
          </h1>
          <p className="kc-log-header__subtitle">
            Aktivitas dan diagnostik aplikasi KOCOKAN.
          </p>
        </div>
      </header>

      {/* 2. Toolbar */}
      <LogToolbar
        filters={filters}
        onToggleLevel={handleToggleLevel}
        onCategoryChange={handleCategoryChange}
        onSearchChange={handleSearchChange}
        levelCounts={levelCounts}
        autoScroll={autoScroll}
        onToggleAutoScroll={() => setAutoScroll((prev) => !prev)}
        isPaused={isPaused}
        onTogglePause={handleTogglePause}
        onExport={handleExport}
        onOpenClearDialog={() => setClearDialogOpen(true)}
      />

      {/* 3. Session Meta Bar */}
      <div className="kc-log-meta-bar">
        <div className="kc-log-meta-bar__left">
          <span>
            <strong>{filteredLogs.length}</strong> entri ditampilkan
            {filteredLogs.length !== logs.length ? ` (dari ${logs.length} total)` : ''}
          </span>
          <span>·</span>
          <span>Sesi dimulai {formattedStartTime}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isPaused ? (
            <span className="kc-log-meta-bar__badge kc-log-meta-bar__badge--paused">
              <span className="kc-log-meta-bar__dot" aria-hidden="true" />
              Dijeda {pausedBuffer.length > 0 ? `(${pausedBuffer.length} baru)` : ''}
            </span>
          ) : (
            <span className="kc-log-meta-bar__badge kc-log-meta-bar__badge--live">
              <span className="kc-log-meta-bar__dot" aria-hidden="true" />
              Real-time
            </span>
          )}
          {!autoScroll && (
            <span style={{ color: 'var(--kc-text-muted)', fontSize: '11px' }}>
              (Auto-scroll nonaktif)
            </span>
          )}
        </div>
      </div>

      {/* 4. Log Viewer */}
      <LogViewer
        logs={filteredLogs}
        autoScroll={autoScroll && !isPaused}
        onResetFilters={handleResetFilters}
      />

      {/* Clear Confirmation Dialog */}
      <ConfirmationDialog
        open={clearDialogOpen}
        title="Bersihkan log sesi ini?"
        consequence="Log yang sedang ditampilkan akan dihapus dari viewer."
        confirmLabel="Bersihkan Log"
        cancelLabel="Batal"
        tone="danger"
        onConfirm={handleConfirmClear}
        onCancel={() => setClearDialogOpen(false)}
      />
    </section>
  )
}
