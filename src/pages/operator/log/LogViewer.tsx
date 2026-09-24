import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../../shared/ui/Icon.tsx'
import { LogRow } from './LogRow.tsx'
import type { LogEntry } from './log-types.ts'

interface LogViewerProps {
  logs: LogEntry[]
  autoScroll: boolean
  onResetFilters?: () => void
}

export function LogViewer({ logs, autoScroll, onResetFilters }: LogViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [unreadNewLogs, setUnreadNewLogs] = useState<number>(0)
  const userScrolledAwayRef = useRef<boolean>(false)
  const prevLogsLengthRef = useRef<number>(logs.length)

  const handleToggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
    userScrolledAwayRef.current = false
    setUnreadNewLogs(0)
  }

  // Handle scroll events to detect if user manually scrolled up
  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight
    const isNearBottom = distanceFromBottom < 36

    if (isNearBottom) {
      userScrolledAwayRef.current = false
      if (unreadNewLogs > 0) {
        setUnreadNewLogs(0)
      }
    } else {
      userScrolledAwayRef.current = true
    }
  }

  // Handle incoming logs: auto-scroll or show unread counter
  useEffect(() => {
    const diff = logs.length - prevLogsLengthRef.current
    prevLogsLengthRef.current = logs.length

    if (diff > 0) {
      if (autoScroll && !userScrolledAwayRef.current) {
        // Immediate scroll to bottom
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
      } else if (userScrolledAwayRef.current) {
        // User scrolled away, show indicator
        setUnreadNewLogs((prev) => prev + diff)
      }
    }
  }, [logs.length, autoScroll])

  return (
    <div className="kc-log-viewer-container">
      {/* Table Header */}
      <div className="kc-log-table-header" aria-hidden="true">
        <span className="kc-log-col-time">Waktu</span>
        <span className="kc-log-col-level">Level</span>
        <span className="kc-log-col-source">Sumber</span>
        <span className="kc-log-col-msg">Pesan</span>
      </div>

      {/* Scrollable Rows Container */}
      <div
        className="kc-log-scroll-area"
        ref={scrollRef}
        onScroll={handleScroll}
        tabIndex={0}
        role="region"
        aria-label="Daftar log sistem"
      >
        {logs.length === 0 ? (
          <div className="kc-log-empty">
            <Icon name="Search" size={24} />
            <p>Tidak ada log yang cocok dengan filter saat ini.</p>
            {onResetFilters && (
              <button
                type="button"
                className="kc-log-copy-btn"
                onClick={onResetFilters}
              >
                Reset Filter
              </button>
            )}
          </div>
        ) : (
          logs.map((entry) => (
            <LogRow
              key={entry.id}
              entry={entry}
              isExpanded={expandedId === entry.id}
              onToggleExpand={handleToggleExpand}
            />
          ))
        )}
      </div>

      {/* Floating Unread Indicator */}
      {unreadNewLogs > 0 && (
        <button
          type="button"
          className="kc-log-unread-pill"
          onClick={scrollToBottom}
          aria-label={`Ada ${unreadNewLogs} log baru, klik untuk scroll ke bawah`}
        >
          <Icon name="ArrowDown" size={14} />
          <span>{unreadNewLogs} log baru</span>
        </button>
      )}
    </div>
  )
}
