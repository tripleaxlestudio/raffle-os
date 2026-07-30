import { Outlet } from 'react-router'

export function AudienceDisplayShell() {
  return (
    <section
      aria-label="Audience Display shell"
      className="audience-display-shell"
      data-audience-shell
      data-interface="audience"
    >
      <main
        aria-label="Audience presentation"
        className="audience-display-main"
      >
        <Outlet />
      </main>
    </section>
  )
}
