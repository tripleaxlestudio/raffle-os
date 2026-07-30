import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button.tsx'

const focusableSelector = [
  'a[href]',
  'button:not(:disabled)',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

interface ModalProps {
  children: ReactNode
  description?: string
  footer?: ReactNode
  initialFocusRef?: RefObject<HTMLElement | null>
  onClose: () => void
  open: boolean
  title: string
}

export function Modal({
  children,
  description,
  footer,
  initialFocusRef,
  onClose,
  open,
  title,
}: ModalProps) {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null

    const dialog = dialogRef.current
    const initialFocus =
      initialFocusRef?.current ??
      dialog?.querySelector<HTMLElement>(focusableSelector) ??
      dialog
    initialFocus?.focus()

    return () => {
      previousFocusRef.current?.focus()
      previousFocusRef.current = null
    }
  }, [initialFocusRef, open])

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
      dialogRef.current?.querySelectorAll<HTMLElement>(
        focusableSelector,
      ) ?? [],
    )

    if (focusableElements.length === 0) {
      event.preventDefault()
      dialogRef.current?.focus()
      return
    }

    const firstElement = focusableElements[0]
    const lastElement = focusableElements.at(-1)

    if (
      event.shiftKey &&
      (document.activeElement === firstElement ||
        document.activeElement === dialogRef.current)
    ) {
      event.preventDefault()
      lastElement?.focus()
    } else if (
      !event.shiftKey &&
      document.activeElement === lastElement
    ) {
      event.preventDefault()
      firstElement?.focus()
    }
  }

  if (!open) {
    return null
  }

  return createPortal(
    <div className="ui-modal-layer">
      <div aria-hidden="true" className="ui-modal-backdrop" />
      <div
        aria-describedby={description === undefined ? undefined : descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="ui-modal"
        onKeyDown={handleKeyDown}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="ui-modal__header">
          <div>
            <p className="ui-modal__eyebrow">Operator confirmation</p>
            <h2 id={titleId}>{title}</h2>
          </div>
          <Button
            aria-label="Close dialog"
            onClick={onClose}
            size="sm"
            variant="quiet"
          >
            Close
          </Button>
        </header>
        {description === undefined ? null : (
          <p className="ui-modal__description" id={descriptionId}>
            {description}
          </p>
        )}
        <div className="ui-modal__body">{children}</div>
        {footer === undefined ? null : (
          <footer className="ui-modal__footer">{footer}</footer>
        )}
      </div>
    </div>,
    document.body,
  )
}
