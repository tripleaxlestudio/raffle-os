import { useCallback, useEffect, useState, type RefObject } from 'react'
import { Button, Icon } from '../ui/index.ts'
import { joinClassNames } from '../ui/class-names.ts'

export interface BackToTopButtonProps {
  /**
   * Reference to the scroll container element.
   * If not provided, defaults to finding element with id "operator-main" or matching targetSelector.
   */
  readonly targetRef?: RefObject<HTMLElement | null>
  /**
   * Optional CSS selector to locate the scroll container.
   * Defaults to '#operator-main'.
   */
  readonly targetSelector?: string
  /**
   * Vertical scroll threshold in pixels before the button appears.
   * Defaults to 400.
   */
  readonly threshold?: number
  /**
   * Optional additional CSS classes for the button.
   */
  readonly className?: string
  /**
   * Optional callback when clicked.
   */
  readonly onClick?: () => void
}

export const DEFAULT_BACK_TO_TOP_THRESHOLD = 400

export function BackToTopButton({
  className,
  onClick,
  targetRef,
  targetSelector = '#operator-main',
  threshold = DEFAULT_BACK_TO_TOP_THRESHOLD,
}: BackToTopButtonProps) {
  const [isVisible, setIsVisible] = useState(false)

  const resolveContainer = useCallback((): HTMLElement | null => {
    if (targetRef?.current) return targetRef.current
    if (targetSelector) {
      const el = document.querySelector<HTMLElement>(targetSelector)
      if (el) return el
    }
    return document.getElementById('operator-main')
  }, [targetRef, targetSelector])

  useEffect(() => {
    let container = resolveContainer()

    const checkVisibility = () => {
      if (!container) {
        container = resolveContainer()
        if (container) {
          container.addEventListener('scroll', checkVisibility, { passive: true })
        } else {
          return
        }
      }
      const isPastThreshold = container.scrollTop > threshold
      const hasScrollableContent = container.scrollHeight > container.clientHeight + threshold
      setIsVisible(isPastThreshold && hasScrollableContent)
    }

    checkVisibility()

    if (container) {
      container.addEventListener('scroll', checkVisibility, { passive: true })
    }
    window.addEventListener('resize', checkVisibility, { passive: true })

    return () => {
      if (container) {
        container.removeEventListener('scroll', checkVisibility)
      }
      window.removeEventListener('resize', checkVisibility)
    }
  }, [resolveContainer, threshold])

  const handleScrollToTop = useCallback(() => {
    const container = resolveContainer()
    if (!container) return

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

    if (typeof container.scrollTo === 'function') {
      container.scrollTo({
        top: 0,
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      })
    } else {
      container.scrollTop = 0
    }

    onClick?.()

    if (container.hasAttribute('tabindex')) {
      container.focus({ preventScroll: true })
    }
  }, [onClick, resolveContainer])

  return (
    <div
      aria-hidden={!isVisible}
      className={joinClassNames(
        'operator-back-to-top-wrapper',
        isVisible && 'operator-back-to-top-wrapper--visible',
      )}
    >
      <Button
        aria-label="Kembali ke atas"
        className={joinClassNames('operator-back-to-top', className)}
        disabled={!isVisible}
        icon={<Icon name="ArrowUp" size={20} />}
        onClick={handleScrollToTop}
        size="md"
        square
        tabIndex={isVisible ? 0 : -1}
        title="Kembali ke atas"
        type="button"
        variant="secondary"
      />
    </div>
  )
}
