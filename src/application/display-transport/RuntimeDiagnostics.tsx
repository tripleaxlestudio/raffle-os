import { useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { clearRuntimeTrace, getRuntimeTrace, serializeRuntimeTrace, subscribeRuntimeTrace, type RuntimeTraceEntry, type RuntimeTraceSide } from './runtime-trace.ts'

function TraceControls({ side }: { readonly side: RuntimeTraceSide }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(serializeRuntimeTrace()); setCopied(true); window.setTimeout(() => setCopied(false), 1200) } catch { setCopied(false) }
  }
  return <div className="runtime-diagnostics__actions"><button type="button" onClick={() => void copy}>Copy trace as JSON</button><button type="button" onClick={clearRuntimeTrace}>Clear trace</button>{copied ? <span role="status">Trace copied</span> : null}<span>{side} trace is memory-only and capped at 200 entries.</span></div>
}

function TraceTable({ entries }: { readonly entries: readonly RuntimeTraceEntry[] }) {
  return <div className="runtime-diagnostics__trace"><table><thead><tr><th>Time</th><th>Route</th><th>Direction</th><th>Message</th><th>State</th><th>Validation / order</th><th>Controller</th><th>Rendered</th><th>Ack / cleanup</th></tr></thead><tbody>{entries.slice(-30).map((entry, index) => <tr key={`${entry.timestamp}-${index}`}><td>{entry.timestamp}</td><td>{entry.currentRoute}</td><td>{entry.direction}</td><td>{entry.messageType}</td><td>{entry.publicState}</td><td>{entry.validationResult} / {entry.orderingResult}{entry.rejectionReason !== 'none' ? ` · ${entry.rejectionReason}` : ''}</td><td>{entry.controllerStateBefore} → {entry.controllerStateAfter}</td><td>{entry.renderedState}</td><td>{entry.acknowledgementStatus}{entry.cleanupDisposeReason !== 'none' ? ` · ${entry.cleanupDisposeReason}` : ''}</td></tr>)}</tbody></table></div>
}

export function RuntimeDiagnosticsPanel({ side, title, summary, renderedState }: { readonly side: RuntimeTraceSide; readonly title: string; readonly summary: ReactNode; readonly renderedState?: string }) {
  const [open, setOpen] = useState(false)
  const allEntries = useSyncExternalStore(subscribeRuntimeTrace, getRuntimeTrace, getRuntimeTrace)
  const entries = useMemo(() => allEntries.filter((entry) => entry.side === side), [allEntries, side])
  if (!import.meta.env.DEV) return null
  return <details className="runtime-diagnostics" data-testid={`${side.toLowerCase()}-runtime-diagnostics`} onToggle={(event) => setOpen(event.currentTarget.open)}><summary>{title}</summary>{open ? <div className="runtime-diagnostics__body">{summary}{renderedState !== undefined ? <p><strong>Rendered state</strong> {renderedState}</p> : null}<TraceControls side={side} /><TraceTable entries={entries} /></div> : null}</details>
}
