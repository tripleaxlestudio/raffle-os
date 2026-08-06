import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import { RouteErrorPage } from './errors/RouteErrorPage.tsx'
import { AudienceDisplayShell } from './layouts/AudienceDisplayShell.tsx'
import { OperatorLayout } from './layouts/OperatorLayout.tsx'
import { ProductionOperatorLayout } from './layouts/ProductionOperatorLayout.tsx'
import { AudienceDisplayPage } from '../pages/display/AudienceDisplayPage.tsx'
import { AudiencePrototypePage } from '../pages/display/AudiencePrototypePage.tsx'
import { DashboardPage } from '../pages/operator/DashboardPage.tsx'
import { DrawRunPage } from '../pages/operator/DrawRunPage.tsx'
import { DrawSetupPage } from '../pages/operator/DrawSetupPage.tsx'
import { DrawSetupPrototypePage } from '../pages/operator/DrawSetupPrototypePage.tsx'
import { PrototypeHistoryPage } from '../pages/operator/HistoryPage.tsx'
import { ProductionHistoryPage } from '../pages/operator/ProductionHistoryPage.tsx'
import { LiveDrawPage } from '../pages/operator/LiveDrawPage.tsx'
import { ParticipantsPage } from '../pages/operator/ParticipantsPage.tsx'
import { PrototypeParticipantsPage } from '../pages/operator/PrototypeParticipantsPage.tsx'
import { PendingResultsPage } from '../pages/operator/PendingResultsPage.tsx'
import { ProductionDashboardPage } from '../pages/operator/ProductionDashboardPage.tsx'
import { ProductionSettingsPage } from '../pages/operator/ProductionSettingsPage.tsx'
import { ProductionPendingResultsPage } from '../pages/operator/ProductionPendingResultsPage.tsx'
import { ProductionWorkspaceBlockedPage } from '../pages/operator/ProductionWorkspaceBlockedPage.tsx'
import { EventsPage } from '../pages/operator/EventsPage.tsx'
import { PrizeCategoriesPage } from '../pages/operator/PrizeCategoriesPage.tsx'
import { SettingsPage as PrototypeSettingsPage } from '../pages/operator/SettingsPage.tsx'
import { NotFoundPage } from '../pages/system/NotFoundPage.tsx'

const operatorRoutes = {
  id: 'operator',
  path: '/',
  element: <ProductionOperatorLayout />,
  errorElement: <RouteErrorPage />,
  children: [
    { index: true, element: <Navigate to="/dashboard" replace /> },
    { path: 'dashboard', element: <ProductionDashboardPage /> },
    { path: 'events', element: <EventsPage /> },
    { path: 'prize-categories', element: <PrizeCategoriesPage /> },
    { path: 'participants', element: <ParticipantsPage /> },
    { path: 'draw/setup', element: <DrawSetupPage /> },
    { path: 'draw/live', element: <ProductionWorkspaceBlockedPage title="Live Draw" description="The production DrawSession queue is not available yet." detail="Live Draw presentation begins from an authoritative DrawSession handoff. The queue and resume workflow will be added in Slice 11." /> },
    { path: 'draw/results', element: <ProductionWorkspaceBlockedPage title="Pending Results" description="The production pending-result queue is not available yet." detail="Only generated production pending routes may open official decisions. No fixture results are shown here." /> },
    { path: 'history', element: <ProductionHistoryPage /> },
    { path: 'settings', element: <ProductionSettingsPage /> },
  ],
} satisfies RouteObject

const productionDrawRunRoutes = {
  id: 'production-draw-run',
  path: '/',
  element: <ProductionOperatorLayout />,
  errorElement: <RouteErrorPage />,
  children: [
    { path: 'draw/run/:drawSessionId', element: <DrawRunPage /> },
    { path: 'draw/pending/:drawSessionId', element: <ProductionPendingResultsPage /> },
  ],
} satisfies RouteObject

const prototypeRoutes = {
  id: 'development-prototypes',
  path: '/dev/prototypes',
  element: <OperatorLayout />,
  errorElement: <RouteErrorPage />,
  children: [
    { path: 'dashboard', element: <DashboardPage /> },
    { path: 'participants', element: <PrototypeParticipantsPage /> },
    { path: 'draw/setup', element: <DrawSetupPrototypePage /> },
    { path: 'draw/live', element: <LiveDrawPage /> },
    { path: 'draw/results', element: <PendingResultsPage /> },
    { path: 'history', element: <PrototypeHistoryPage /> },
    { path: 'settings', element: <PrototypeSettingsPage /> },
  ],
} satisfies RouteObject

export const appRoutes = [
  operatorRoutes,
  productionDrawRunRoutes,
  prototypeRoutes,
  {
    path: '/display',
    element: <AudienceDisplayShell />,
    errorElement: <RouteErrorPage />,
    children: [{ index: true, element: <AudienceDisplayPage /> }],
  },
  {
    path: '/dev/prototypes/display',
    element: <AudienceDisplayShell />,
    errorElement: <RouteErrorPage />,
    children: [{ index: true, element: <AudiencePrototypePage /> }],
  },
  { path: '*', element: <NotFoundPage />, errorElement: <RouteErrorPage /> },
] satisfies RouteObject[]

export const appRouter = createBrowserRouter(appRoutes)
