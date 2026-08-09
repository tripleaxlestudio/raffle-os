import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button.tsx'
import { Icon } from './Icon.tsx'

const focusableSelector = [
  'a[href]',
  'button:not(:disabled)',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

interface SidePanelProps {
  children: ReactNode
  description: string
  footer?: ReactNode
  onClose: () => void
  open: boolean
  title: string
}

export function SidePanel({
  children,
  description,
  footer,
  onClose,
  open,
  title,
}: SidePanelProps) {
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    const operatorShell = document.querySelector<HTMLElement>(
      '[data-operator-shell]',
    )
    const operatorShellWasInert =
      operatorShell?.hasAttribute('inert') ?? false
    const rootHadSidePanelState =
      document.documentElement.hasAttribute('data-side-panel-open')

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null

    operatorShell?.setAttribute('inert', '')
    document.documentElement.setAttribute('data-side-panel-open', '')

    const firstFocusable =
      panelRef.current?.querySelector<HTMLElement>(focusableSelector)
    ;(firstFocusable ?? panelRef.current)?.focus()

    return () => {
      if (!operatorShellWasInert) {
        operatorShell?.removeAttribute('inert')
      }
      if (!rootHadSidePanelState) {
        document.documentElement.removeAttribute('data-side-panel-open')
      }
      previousFocusRef.current?.focus()
      previousFocusRef.current = null
    }
  }, [open])

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }

    if (event.key !== 'Tab') {
      return
    }

    const focusableElements = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>(
        focusableSelector,
      ) ?? [],
    )
    const first = focusableElements[0]
    const last = focusableElements.at(-1)

    if (
      event.shiftKey &&
      (document.activeElement === first ||
        document.activeElement === panelRef.current)
    ) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first?.focus()
    }
  }

  if (!open) {
    return null
  }

  return createPortal(
    <div
      className="ui-side-panel-layer"
      data-interface="operator"
      data-layer="drawer-root"
    >
      <button
        aria-label="Close redraw panel"
        className="ui-side-panel-backdrop"
        data-layer="drawer-backdrop"
        onClick={onClose}
        type="button"
      />
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="ui-side-panel"
        data-layer="drawer-surface"
        onKeyDown={handleKeyDown}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="ui-side-panel__header">
          <div>
            <p>Redraw review</p>
            <h2 id={titleId}>{title}</h2>
          </div>
          <Button
            aria-label="Close redraw panel"
            icon={<Icon name="X" />}
            onClick={onClose}
            size="sm"
            variant="quiet"
          >
            Close
          </Button>
        </header>
        <p className="ui-side-panel__description" id={descriptionId}>
          {description}
        </p>
        <div className="ui-side-panel__body">{children}</div>
        {footer === undefined ? null : (
          <footer className="ui-side-panel__footer">{footer}</footer>
        )}
      </div>
    </div>,
    document.body,
  )
}
