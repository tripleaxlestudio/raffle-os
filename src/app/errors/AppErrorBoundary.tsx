import { Component, type ReactNode } from 'react'

interface AppErrorBoundaryProps {
  children: ReactNode
  onReload?: () => void
}

interface AppErrorBoundaryState {
  hasError: boolean
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
  }

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    void error
    return { hasError: true }
  }

  private readonly handleReload = () => {
    if (this.props.onReload !== undefined) {
      this.props.onReload()
      return
    }

    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="error-page" data-interface="operator">
          <div className="error-page__content">
            <h1>Something went wrong</h1>
            <p>
              Raffle OS could not display this page. Reload the application to
              try again.
            </p>
            <div className="error-page__actions">
              <button
                className="error-recovery__button"
                onClick={this.handleReload}
                type="button"
              >
                Reload application
              </button>
            </div>
          </div>
        </main>
      )
    }

    return this.props.children
  }
}
