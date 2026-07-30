import { Outlet } from 'react-router'
import { OperatorHeader } from '../shell/OperatorHeader.tsx'
import { OperatorSidebar } from '../shell/OperatorSidebar.tsx'

export function OperatorLayout() {
  return (
    <div
      className="operator-layout"
      data-interface="operator"
      data-operator-shell
    >
      <OperatorSidebar />
      <div className="operator-workspace">
        <OperatorHeader />
        <main className="operator-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
