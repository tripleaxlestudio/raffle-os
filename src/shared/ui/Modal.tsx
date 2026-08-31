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
import { Icon } from './Icon.tsx'

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
  eyebrow?: string
  footer?: ReactNode
  initialFocusRef?: RefObject<HTMLElement | null>
  onClose: () => void
  open: boolean
  closeOnEscape?: boolean
  showCloseButton?: boolean
  title: string
  headerIcon?: ReactNode
  headerIconTone?: 'warning' | 'danger' | 'success' | 'info'
}

export function Modal({
  children,
  description,
  eyebrow = 'Operator confirmation',
  footer,
  initialFocusRef,
  onClose,
  open,
  closeOnEscape = true,
  showCloseButton = true,
  title,
  headerIcon,
  headerIconTone,
}: ModalProps) {
  const titleId = useId()
  const descriptionId = useId()
  const layerRef = useRef<HTMLDivElement>(null)
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

    const layer = layerRef.current
    const backgroundElements = Array.from(document.body.children)
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== layer)
      .map((element) => ({ element, wasInert: element.hasAttribute('inert') }))
    const rootHadModalState = document.documentElement.hasAttribute('data-modal-open')
    backgroundElements.forEach(({ element }) => element.setAttribute('inert', ''))
    document.documentElement.setAttribute('data-modal-open', '')

    const dialog = dialogRef.current
    const initialFocus =
      initialFocusRef?.current ??
      dialog?.querySelector<HTMLElement>(focusableSelector) ??
      dialog
    initialFocus?.focus()

    return () => {
      backgroundElements.forEach(({ element, wasInert }) => {
        if (!wasInert) element.removeAttribute('inert')
      })
      if (!rootHadModalState) document.documentElement.removeAttribute('data-modal-open')
      previousFocusRef.current?.focus()
      previousFocusRef.current = null
    }
  }, [initialFocusRef, open])

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && closeOnEscape) {
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

  const inferredHeader = inferHeaderSemantic(eyebrow, title)
  const resolvedHeaderIcon = headerIcon ?? inferredHeader?.icon
  const resolvedHeaderTone = headerIconTone ?? inferredHeader?.tone ?? 'warning'

  return createPortal(
    <div className="ui-modal-layer" data-interface="operator" ref={layerRef}>
      <div aria-hidden="true" className="ui-modal-backdrop" />
      <div
        aria-describedby={description === undefined ? undefined : descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="ui-modal ui-modal--production-surface"
        onKeyDown={handleKeyDown}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="ui-modal__header">
          <div className="ui-modal__title-group">
            {resolvedHeaderIcon === undefined ? null : <span aria-hidden="true" className={`ui-modal__semantic-icon ui-modal__semantic-icon--${resolvedHeaderTone}`}>{resolvedHeaderIcon}</span>}
            <div>
              <p className="ui-modal__eyebrow">{eyebrow}</p>
              <h2 id={titleId}>{title}</h2>
            </div>
          </div>
          {showCloseButton ? (
            <Button
              aria-label="Close dialog"
              icon={<Icon name="X" />}
              onClick={onClose}
              size="sm"
              variant="quiet"
            >
              Close
            </Button>
          ) : null}
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

function inferHeaderSemantic(eyebrow: string, title: string): { readonly icon: ReactNode; readonly tone: 'warning' | 'danger' | 'success' | 'info' } | null {
  const text = `${eyebrow} ${title}`.toLowerCase()
  if (text.includes('redraw') || text.includes('replacement')) return { icon: <Icon name="RotateCcw" />, tone: 'danger' }
  if (text.includes('delete')) return { icon: <Icon name="Trash2" />, tone: 'danger' }
  if (text.includes('cancel')) return { icon: <Icon name="CircleX" />, tone: 'danger' }
  if (text.includes('recovery') || text.includes('retry')) return { icon: <Icon name="RefreshCw" />, tone: 'info' }
  if (text.includes('pending') || text.includes('action required') || text.includes('warning')) return { icon: <Icon name="TriangleAlert" />, tone: 'warning' }
  if (text.includes('live') || text.includes('irreversible')) return { icon: <Icon name="ShieldAlert" />, tone: 'warning' }
  if (text.includes('reset')) return { icon: <Icon name="RefreshCw" />, tone: 'warning' }
  if (text.includes('confirm') || text.includes('winner')) return { icon: <Icon name="CircleCheck" />, tone: 'success' }
  if (text.includes('activate')) return { icon: <Icon name="CircleAlert" />, tone: 'info' }
  return null
}
