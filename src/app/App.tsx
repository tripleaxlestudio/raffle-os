import { RouterProvider } from 'react-router'
import { appRouter } from './router.tsx'

function App() {
  return <RouterProvider router={appRouter} />
}

export default App
