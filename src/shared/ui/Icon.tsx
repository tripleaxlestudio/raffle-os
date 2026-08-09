import type { ReactNode, SVGAttributes } from 'react'
import { joinClassNames } from './class-names.ts'

export type IconName =
  | 'ArrowLeft'
  | 'ArrowRight'
  | 'Calendar'
  | 'CircleCheck'
  | 'CircleAlert'
  | 'CircleX'
  | 'Clock'
  | 'ChevronDown'
  | 'ChevronUp'
  | 'ClipboardCheck'
  | 'ExternalLink'
  | 'FileX'
  | 'FolderOpen'
  | 'History'
  | 'LayoutDashboard'
  | 'ListChecks'
  | 'ListX'
  | 'Lock'
  | 'Monitor'
  | 'MonitorCheck'
  | 'MonitorCog'
  | 'Palette'
  | 'Pencil'
  | 'Play'
  | 'Plus'
  | 'RefreshCw'
  | 'Radio'
  | 'RotateCcw'
  | 'Save'
  | 'SlidersHorizontal'
  | 'StopCircle'
  | 'ShieldAlert'
  | 'TriangleAlert'
  | 'Trash2'
  | 'Trophy'
  | 'Upload'
  | 'Users'
  | 'Volume2'
  | 'X'

interface IconProps extends Omit<SVGAttributes<SVGSVGElement>, 'children'> {
  name: IconName
  size?: number
}

export function Icon({ className, name, size = 20, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={joinClassNames('ui-icon', className)}
      fill="none"
      focusable="false"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width={size}
      {...props}
    >
      {iconPaths[name]}
    </svg>
  )
}

const iconPaths: Record<IconName, ReactNode> = {
  ArrowLeft: (
    <>
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </>
  ),
  ArrowRight: (
    <>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </>
  ),
  Calendar: (
    <>
      <rect height="16" rx="2" width="18" x="3" y="4" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  CircleCheck: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 2.5 2.5L16 9" />
    </>
  ),
  CircleAlert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16h.01" />
    </>
  ),
  CircleX: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </>
  ),
  Clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  ChevronDown: <path d="m6 9 6 6 6-6" />,
  ChevronUp: <path d="m6 15 6-6 6 6" />,
  ClipboardCheck: (
    <>
      <path d="M9 5h6" />
      <path d="M9 3h6v4H9z" />
      <rect height="16" rx="2" width="14" x="5" y="5" />
      <path d="m9 14 2 2 4-4" />
    </>
  ),
  ExternalLink: (
    <>
      <path d="M14 5h5v5" />
      <path d="m19 5-8 8" />
      <path d="M19 13v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4" />
    </>
  ),
  FileX: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M9 13l6 6M15 13l-6 6" />
    </>
  ),
  FolderOpen: (
    <>
      <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M3 10h18" />
    </>
  ),
  History: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  LayoutDashboard: (
    <>
      <rect height="7" rx="1" width="7" x="3" y="3" />
      <rect height="7" rx="1" width="7" x="14" y="3" />
      <rect height="7" rx="1" width="7" x="3" y="14" />
      <rect height="7" rx="1" width="7" x="14" y="14" />
    </>
  ),
  ListChecks: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="m3 6 1.5 1.5L6.5 5M3 12l1.5 1.5 2-2.5M3 18l1.5 1.5 2-2.5" />
    </>
  ),
  ListX: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="m3 5 3 3M6 5 3 8M3 17l3 3M6 17l-3 3" />
    </>
  ),
  Lock: (
    <>
      <rect height="10" rx="2" width="14" x="5" y="10" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2" />
    </>
  ),
  Monitor: (
    <>
      <rect height="14" rx="2" width="18" x="3" y="3" />
      <path d="M8 21h8M12 17v4" />
    </>
  ),
  MonitorCheck: (
    <>
      <rect height="14" rx="2" width="18" x="3" y="3" />
      <path d="M8 21h8M12 17v4m-4-7 2 2 4-4" />
    </>
  ),
  MonitorCog: (
    <>
      <rect height="12" rx="2" width="18" x="3" y="3" />
      <path d="M8 21h8M12 15v6" />
      <circle cx="16.5" cy="11" r="2.5" />
      <path d="m16.5 7.5.4.8m-.4 6.2.4.8m3.1-3.9-.8.4m-5.4-.4-.8.4m.8-4.3.8.4m4.6 3.5.8.4" />
    </>
  ),
  Palette: (
    <>
      <path d="M12 3a9 9 0 0 0 0 18h1.5a1.5 1.5 0 0 0 0-3H12a2 2 0 0 1 0-4h2.5a6.5 6.5 0 0 0 0-13Z" />
      <circle cx="7.5" cy="10" r=".75" />
      <circle cx="8.5" cy="6.5" r=".75" />
      <circle cx="13" cy="6" r=".75" />
    </>
  ),
  Pencil: (
    <>
      <path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10z" />
      <path d="m14.5 7.5 2 2" />
    </>
  ),
  Play: (
    <path d="m8 5 11 7-11 7V5Z" />
  ),
  Plus: <path d="M12 5v14M5 12h14" />,
  RefreshCw: (
    <>
      <path d="M20 11a8 8 0 0 0-14.9-3L3 11" />
      <path d="M3 4v7h7" />
      <path d="M4 13a8 8 0 0 0 14.9 3L21 13" />
      <path d="M21 20v-7h-7" />
    </>
  ),
  Radio: (
    <>
      <circle cx="12" cy="12" r="2" />
      <path d="M16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4" />
      <path d="M19 5a10 10 0 0 1 0 14M5 19a10 10 0 0 1 0-14" />
    </>
  ),
  RotateCcw: (
    <>
      <path d="M3 12a9 9 0 0 1 15-6.7" />
      <path d="M18 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7" />
      <path d="M6 21v-5h5" />
    </>
  ),
  Save: (
    <>
      <path d="M5 3h11l3 3v15H5z" />
      <path d="M8 3v6h8V3M8 21v-6h8v6" />
    </>
  ),
  ShieldAlert: (
    <>
      <path d="M12 3 20 6v5c0 5-3.4 8.3-8 10-4.6-1.7-8-5-8-10V6z" />
      <path d="M12 8v5M12 16h.01" />
    </>
  ),
  SlidersHorizontal: (
    <>
      <path d="M4 6h16M4 12h16M4 18h16" />
      <circle cx="8" cy="6" r="2" />
      <circle cx="16" cy="12" r="2" />
      <circle cx="10" cy="18" r="2" />
    </>
  ),
  StopCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <rect height="6" rx="1" width="6" x="9" y="9" />
    </>
  ),
  TriangleAlert: (
    <>
      <path d="m12 3 10 18H2z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  Trash2: (
    <>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" />
    </>
  ),
  Trophy: (
    <>
      <path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" />
      <path d="M8 6H5a3 3 0 0 0 3 3M16 6h3a3 3 0 0 1-3 3M12 12v5M8 21h8M9 17h6" />
    </>
  ),
  Upload: (
    <>
      <path d="M12 3v12" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
    </>
  ),
  Users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  Volume2: (
    <>
      <path d="M4 9v6h4l5 4V5L8 9zM17 9a4 4 0 0 1 0 6M19.5 6.5a8 8 0 0 1 0 11" />
    </>
  ),
  X: <path d="m6 6 12 12M18 6 6 18" />,
}
