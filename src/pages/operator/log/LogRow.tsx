import { useState } from 'react'
import { Icon } from '../../../shared/ui/Icon.tsx'
import type { LogEntry } from './log-types.ts'

interface LogRowProps {
  entry: LogEntry
  isExpanded: boolean
  onToggleExpand: (id: string) => void
}

export function LogRow({ entry, isExpanded, onToggleExpand }: LogRowProps) {
  const [copied, setCopied] = useState(false)
  const hasMetadata = entry.metadata && Object.keys(entry.metadata).length > 0

  const handleCopyDetail = (e: React.MouseEvent) => {
    e.stopPropagation()
    const textToCopy = `${entry.fullTimestamp} [${entry.level.toUpperCase()}] ${entry.source}\n${entry.message}\n` +
      (entry.metadata ? JSON.stringify(entry.metadata, null, 2) : '')

    navigator.clipboard?.writeText(textToCopy).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      // Fallback if clipboard API is restricted
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const levelLabel = entry.level === 'warning' ? 'WARN' : entry.level.toUpperCase()

  return (
    <div
      className="kc-log-row-item"
      data-expanded={isExpanded}
      data-level={entry.level}
    >
      <div
        className="kc-log-row"
        onClick={() => onToggleExpand(entry.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggleExpand(entry.id)
          }
        }}
        aria-expanded={isExpanded}
      >
        <span className="kc-log-col-time kc-log-time-val">{entry.timestamp}</span>
        <span className="kc-log-col-level">
          <span className={`kc-log-level-tag kc-log-level-tag--${entry.level}`}>
            {levelLabel}
          </span>
        </span>
        <span className="kc-log-col-source kc-log-source-val" title={entry.source}>
          {entry.source}
        </span>
        <span className="kc-log-col-msg kc-log-msg-val" title={entry.message}>
          {entry.message}
        </span>
        <span className="kc-log-col-expand-indicator" aria-hidden="true">
          <Icon name="ChevronDown" size={14} />
        </span>
      </div>

      {isExpanded && (
        <div className="kc-log-detail-pane">
          <div className="kc-log-detail-header">
            <div>
              <div className="kc-log-detail-fullmsg">{entry.message}</div>
              <div style={{ color: 'var(--kc-text-muted)', fontSize: '11px', fontFamily: 'var(--kc-font-mono)' }}>
                {entry.fullTimestamp} · Level: <strong>{entry.level.toUpperCase()}</strong> · Sumber: <strong>{entry.source}</strong> ({entry.category})
              </div>
            </div>
            <button
              type="button"
              className="kc-log-copy-btn"
              onClick={handleCopyDetail}
              title="Salin rincian log ke clipboard"
            >
              <Icon name={copied ? 'Check' : 'Copy'} size={13} />
              {copied ? 'Tersalin!' : 'Salin Detail'}
            </button>
          </div>

          {hasMetadata ? (
            <div className="kc-log-metadata-grid">
              {Object.entries(entry.metadata!).map(([key, value]) => (
                <div key={key} className="kc-log-metadata-card">
                  <span className="kc-log-metadata-key">{key}</span>
                  <span className="kc-log-metadata-value">{String(value)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: 'var(--kc-text-muted)', fontSize: '11.5px', fontStyle: 'italic', marginTop: '6px' }}>
              Tidak ada metadata tambahan untuk entri ini.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
