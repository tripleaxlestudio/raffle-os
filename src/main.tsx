import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App.tsx'
import './styles/app.css'

if (import.meta.env.DEV) {
  void import('./acceptance/phase5-browser-bootstrap.ts').then(
    ({ installPhase5BrowserAcceptanceApi }) => {
      installPhase5BrowserAcceptanceApi()
    },
  )
}

const rootElement = document.getElementById('root')

if (rootElement === null) {
  throw new Error('Raffle OS root element was not found.')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
