import {
  createBrowserRouter,
  Navigate,
  type RouteObject,
} from 'react-router'
import { OperatorLayout } from './layouts/OperatorLayout.tsx'
import { AudienceDisplayPage } from '../pages/display/AudienceDisplayPage.tsx'
import { DashboardPage } from '../pages/operator/DashboardPage.tsx'
import { DrawSetupPage } from '../pages/operator/DrawSetupPage.tsx'
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
      element: <DrawSetupPage />,
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
    element: <AudienceDisplayPage />,
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
] satisfies RouteObject[]

export const appRouter = createBrowserRouter(appRoutes)
