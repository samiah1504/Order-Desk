import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'

export function AppLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="pb-20">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  )
}
