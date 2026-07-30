import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <main className="error-page">
      <div className="error-page__content">
        <h1>Not Found</h1>
        <p>The requested page does not exist.</p>
        <div className="error-page__actions">
          <Link className="not-found__link" to="/dashboard">
            Return to Dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
