import { Link } from 'react-router'
import { PageHeader } from '../../shared/components/PageHeader.tsx'
import { StatusBanner } from '../../shared/components/StatusBanner.tsx'

export function ProductionWorkspaceBlockedPage({ title, description, detail }: { readonly title: string; readonly description: string; readonly detail: string }) {
  return <section className="draw-setup" aria-labelledby="production-blocked-title">
    <PageHeader eyebrow="Production workspace" headingId="production-blocked-title" title={title} description={description} />
    <StatusBanner badge="Not available yet" title="This production workflow is not connected" tone="warning">{detail}</StatusBanner>
    <p><Link className="ui-button ui-button--secondary" to="/draw/setup">Open authoritative Draw Setup</Link></p>
  </section>
}
