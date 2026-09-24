import { ButtonLink, Card } from '../ui/index.ts'

export function ProductionSetupRequired({
  description = 'Pilih atau buat Acara sebelum menggunakan ruang kerja ini.',
  title = 'Acara perlu diatur',
}: {
  readonly description?: string
  readonly title?: string
}) {
  return <Card className="production-workspace-state production-workspace-state--setup" padding="md">
    <span aria-hidden="true" className="production-workspace-state__icon">!</span>
    <div className="production-workspace-state__copy"><h2>{title}</h2><p>{description}</p></div>
    <ButtonLink to="/events">Buka Pengelolaan Acara</ButtonLink>
  </Card>
}

export function ProductionLoadingState({ description }: { readonly description: string }) {
  return <Card aria-live="polite" className="production-workspace-state production-workspace-state--loading" padding="md">
    <span aria-hidden="true" className="production-workspace-state__icon production-workspace-state__icon--loading" />
    <div className="production-workspace-state__copy"><h2>Memuat</h2><p>{description}</p></div>
  </Card>
}
