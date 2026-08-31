import { Button, Icon } from '../ui/index.ts'

export type OperatorPersistenceStatusKind = 'saved' | 'saving' | 'failed' | 'recovery-required' | 'blocked'

interface OperatorPersistenceStatusProps {
  readonly kind: OperatorPersistenceStatusKind
  readonly detail: string
  readonly onAction?: () => void
  readonly actionLabel?: string
  readonly actionDisabled?: boolean
}

const labels: Record<OperatorPersistenceStatusKind, string> = {
  saved: 'Tersimpan secara lokal', saving: 'Menyimpan secara lokal…', failed: 'Gagal menyimpan',
  'recovery-required': 'Perlu pemulihan', blocked: 'Mode Live diblokir',
}
const icons: Record<OperatorPersistenceStatusKind, 'CircleCheck' | 'Clock' | 'CircleX' | 'ShieldAlert'> = {
  saved: 'CircleCheck', saving: 'Clock', failed: 'CircleX',
  'recovery-required': 'ShieldAlert', blocked: 'ShieldAlert',
}

export function OperatorPersistenceStatus({ kind, detail, onAction, actionLabel, actionDisabled = false }: OperatorPersistenceStatusProps) {
  const actionable = onAction !== undefined && actionLabel !== undefined
  return <section aria-live={kind === 'saving' ? 'polite' : 'assertive'} className={`operator-persistence-status operator-persistence-status--${kind}`} data-testid="operator-persistence-status" role={kind === 'saved' || kind === 'saving' ? 'status' : 'alert'}>
    <span aria-hidden="true" className="operator-persistence-status__icon"><Icon name={icons[kind]} size={16} /></span>
    <div className="operator-persistence-status__copy"><strong>{labels[kind]}</strong><span>{detail}</span></div>
    {actionable ? <Button icon={<Icon name="RefreshCw" />} size="sm" variant="secondary" disabled={actionDisabled} onClick={onAction}>{actionLabel}</Button> : null}
  </section>
}
