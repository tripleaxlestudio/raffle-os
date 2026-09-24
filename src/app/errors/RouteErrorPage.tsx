import { isRouteErrorResponse, Link, useRouteError } from 'react-router'

interface RouteErrorContent {
  heading: string
  message: string
}

function getRouteErrorContent(error: unknown): RouteErrorContent {
  if (isRouteErrorResponse(error) && error.status === 404) {
    return {
      heading: 'Halaman tidak ditemukan',
      message: 'Halaman yang diminta tidak dapat ditemukan.',
    }
  }

  if (isRouteErrorResponse(error)) {
    return {
      heading: 'Halaman tidak dapat dimuat',
      message: 'Halaman yang diminta tidak dapat dibuka.',
    }
  }

  return {
    heading: 'Terjadi kesalahan',
    message: 'Kesalahan tak terduga menyebabkan halaman ini tidak dapat dimuat.',
  }
}

export function RouteErrorPage() {
  const error = useRouteError()
  const content = getRouteErrorContent(error)

  return (
    <main className="error-page" data-interface="operator">
      <div className="error-page__content">
        <h1>{content.heading}</h1>
        <p>{content.message}</p>
        <div className="error-page__actions">
          <Link className="recovery-link" to="/dashboard">
            Kembali ke Dasbor
          </Link>
        </div>
      </div>
    </main>
  )
}
