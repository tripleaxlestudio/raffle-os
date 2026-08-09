import { useCallback, useEffect, useState } from 'react'
import { Icon } from '../../shared/ui/Icon.tsx'

export interface SettingsSaveToastProps {
  readonly kind: 'success' | 'error'
  readonly message: string
  readonly onDismiss: () => void
}

export function SettingsSaveToast({ kind, message, onDismiss }: SettingsSaveToastProps) {
  const [exiting, setExiting] = useState(false)

  const dismiss = useCallback(() => {
    const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) { onDismiss(); return }
    setExiting(true)
    window.setTimeout(onDismiss, 180)
  }, [onDismiss])

  useEffect(() => {
    if (kind === 'error') return
    const timer = window.setTimeout(dismiss, 3000)
    return () => window.clearTimeout(timer)
  }, [dismiss, kind, message])

  return <div aria-live={kind === 'success' ? 'polite' : undefined} className={`settings-toast settings-toast--${kind}${exiting ? ' settings-toast--exiting' : ''}`} role={kind === 'success' ? 'status' : 'alert'}>
    <span aria-hidden="true" className="settings-toast__icon">{kind === 'success' ? <Icon name="CircleCheck" /> : '!'}</span>
    <div className="settings-toast__copy"><strong>{kind === 'success' ? 'Settings saved' : 'Unable to save settings'}</strong><span>{message}</span></div>
    <button aria-label="Close notification" className="settings-toast__close" onClick={dismiss} type="button"><Icon name="X" /></button>
  </div>
}
