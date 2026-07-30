import { isRouteErrorResponse, Link, useRouteError } from 'react-router'

interface RouteErrorContent {
  heading: string
  message: string
}

function getRouteErrorContent(error: unknown): RouteErrorContent {
  if (isRouteErrorResponse(error) && error.status === 404) {
    return {
      heading: 'Page not found',
      message: 'The requested page could not be found.',
    }
  }

  if (isRouteErrorResponse(error)) {
    return {
      heading: 'Unable to load this page',
      message: 'The requested page could not be opened.',
    }
  }

  return {
    heading: 'Something went wrong',
    message: 'An unexpected error prevented this page from loading.',
  }
}

export function RouteErrorPage() {
  const error = useRouteError()
  const content = getRouteErrorContent(error)

  return (
    <main className="error-page">
      <div className="error-page__content">
        <h1>{content.heading}</h1>
        <p>{content.message}</p>
        <div className="error-page__actions">
          <Link className="recovery-link" to="/dashboard">
            Return to Dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
