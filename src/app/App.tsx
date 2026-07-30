import { RouterProvider } from 'react-router'
import { AppErrorBoundary } from './errors/AppErrorBoundary.tsx'
import { appRouter } from './router.tsx'

function App() {
  return (
    <AppErrorBoundary>
      <RouterProvider router={appRouter} />
    </AppErrorBoundary>
  )
}

export default App
