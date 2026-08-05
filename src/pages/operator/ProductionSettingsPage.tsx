import { Link } from 'react-router'
import { PageHeader } from '../../shared/components/PageHeader.tsx'
import { StatusBanner } from '../../shared/components/StatusBanner.tsx'

export function ProductionSettingsPage() {
  return <section aria-labelledby="settings-title"><PageHeader eyebrow="Production workspace" headingId="settings-title" title="Settings" description="Production display configuration is not connected yet." /><StatusBanner badge="Not configured" title="No inert settings controls are available" tone="warning">DisplayConfiguration persistence and presentation settings are planned for a later Phase 8 slice. This page will not pretend to save branding, audio, or display values.</StatusBanner><p><Link className="ui-button ui-button--secondary" to="/dashboard">Return to Dashboard</Link></p></section>
}
