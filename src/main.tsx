import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App.tsx'
import './styles/operator-shell.css'
import './styles/audience-display.css'

const rootElement = document.getElementById('root')

if (rootElement === null) {
  throw new Error('Raffle OS root element was not found.')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
