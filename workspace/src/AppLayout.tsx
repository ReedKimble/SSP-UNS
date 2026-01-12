import { Outlet } from 'react-router-dom'
import SidebarNav from './components/layout/SidebarNav'
import TopBar from './components/layout/TopBar'

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex">
      <SidebarNav />
      <div className="flex-1 flex flex-col border-l border-slate-800 bg-slate-900/40">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
