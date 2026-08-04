import {
  createBrowserRouter,
  Navigate,
  type RouteObject,
} from 'react-router'
import { RouteErrorPage } from './errors/RouteErrorPage.tsx'
import { AudienceDisplayShell } from './layouts/AudienceDisplayShell.tsx'
import { OperatorLayout } from './layouts/OperatorLayout.tsx'
import { AudienceDisplayPage } from '../pages/display/AudienceDisplayPage.tsx'
import { DashboardPage } from '../pages/operator/DashboardPage.tsx'
import { DrawSetupRoute } from '../pages/operator/DrawSetupRoute.tsx'
import { HistoryPage } from '../pages/operator/HistoryPage.tsx'
import { LiveDrawPage } from '../pages/operator/LiveDrawPage.tsx'
import { ParticipantsPage } from '../pages/operator/ParticipantsPage.tsx'
import { PendingResultsPage } from '../pages/operator/PendingResultsPage.tsx'
import { SettingsPage } from '../pages/operator/SettingsPage.tsx'
import { NotFoundPage } from '../pages/system/NotFoundPage.tsx'

const operatorRoutes = {
  id: 'operator',
  path: '/',
  element: <OperatorLayout />,
  errorElement: <RouteErrorPage />,
  children: [
    {
      index: true,
      element: <Navigate to="/dashboard" replace />,
    },
    {
      path: 'dashboard',
      element: <DashboardPage />,
    },
    {
      path: 'participants',
      element: <ParticipantsPage />,
    },
    {
      path: 'draw/setup',
      element: <DrawSetupRoute />,
    },
    {
      path: 'draw/live',
      element: <LiveDrawPage />,
    },
    {
      path: 'draw/results',
      element: <PendingResultsPage />,
    },
    {
      path: 'history',
      element: <HistoryPage />,
    },
    {
      path: 'settings',
      element: <SettingsPage />,
    },
  ],
} satisfies RouteObject

export const appRoutes = [
  operatorRoutes,
  {
    path: '/display',
    element: <AudienceDisplayShell />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        index: true,
        element: <AudienceDisplayPage />,
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
    errorElement: <RouteErrorPage />,
  },
] satisfies RouteObject[]

export const appRouter = createBrowserRouter(appRoutes)
