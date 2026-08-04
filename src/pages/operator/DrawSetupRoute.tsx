import { useSearchParams } from 'react-router'
import { DrawSetupPage } from './DrawSetupPage.tsx'
import { DrawSetupPrototypePage } from './DrawSetupPrototypePage.tsx'

export function DrawSetupRoute() {
  const [searchParams] = useSearchParams()
  return searchParams.has('scenario') ? <DrawSetupPrototypePage /> : <DrawSetupPage />
}
