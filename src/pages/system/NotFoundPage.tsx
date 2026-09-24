import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <main className="error-page" data-interface="operator">
      <div className="error-page__content">
        <h1>Halaman tidak ditemukan</h1>
        <p>Halaman yang diminta tidak tersedia.</p>
        <div className="error-page__actions">
          <Link className="not-found__link" to="/dashboard">
            Kembali ke Dasbor
          </Link>
        </div>
      </div>
    </main>
  )
}
