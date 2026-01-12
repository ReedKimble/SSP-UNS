import { NavLink } from 'react-router-dom'
import { ROUTES } from '@/routes/routeMeta'

const baseClasses =
  'flex items-start gap-3 rounded-xl px-4 py-3 text-left transition-colors duration-150'

export default function SidebarNav() {
  return (
    <aside className="hidden w-72 flex-shrink-0 border-r border-slate-800 bg-slate-900/30 lg:flex lg:flex-col">
      <div className="px-6 pb-4 pt-6">
        <p className="text-sm uppercase tracking-[0.2em] text-slate-400">UNS · SSP Studio</p>
        <h1 className="text-2xl font-semibold text-white">Runtime Console</h1>
        <p className="text-sm text-slate-400">Design · analyze · perform</p>
      </div>
      <nav className="flex-1 space-y-1 px-3 pb-6">
        {ROUTES.map((route) => (
          <NavLink
            key={route.id}
            to={route.path}
            className={({ isActive }) =>
              `${baseClasses} ${
                isActive ? 'bg-brand-500/20 border border-brand-500 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`
            }
          >
            <div>
              <p className="font-semibold text-base">{route.label}</p>
              <p className="text-xs text-slate-400">{route.description}</p>
            </div>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
