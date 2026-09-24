import { useCallback, useEffect, useState } from 'react'
import { useReducedMotionPreference } from '../../shared/hooks/useReducedMotionPreference.ts'
import { Icon } from '../../shared/ui/Icon.tsx'
import { useUiClass } from '../../shared/ui/ui-theme.ts'

const AUTO_DISMISS_MS = 3000
const EXIT_DURATION_MS = 180

export interface DrawSetupSaveToastProps {
  readonly onDismiss: () => void
}

export function DrawSetupSaveToast({ onDismiss }: DrawSetupSaveToastProps) {
  const uiClass = useUiClass()
  const reducedMotion = useReducedMotionPreference()
  const [exiting, setExiting] = useState(false)

  const dismiss = useCallback(() => {
    if (reducedMotion) { onDismiss(); return }
    setExiting(true)
  }, [onDismiss, reducedMotion])

  useEffect(() => {
    const timer = window.setTimeout(dismiss, AUTO_DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [dismiss])

  useEffect(() => {
    if (!exiting) return
    const timer = window.setTimeout(onDismiss, EXIT_DURATION_MS)
    return () => window.clearTimeout(timer)
  }, [exiting, onDismiss])

  return <div aria-atomic="true" aria-live="polite" className={`${uiClass('draw-setup-save-toast')}${exiting ? ` ${uiClass('draw-setup-save-toast--exiting')}` : ''}`} role="status">
    <span aria-hidden="true" className={uiClass('draw-setup-save-toast__icon')}><Icon name="CircleCheck" size={18} /></span>
    <strong>Sesi undian berhasil disimpan</strong>
    <button aria-label="Tutup notifikasi penyimpanan" className={uiClass('draw-setup-save-toast__close')} onClick={dismiss} type="button"><Icon name="X" size={16} /></button>
  </div>
}
