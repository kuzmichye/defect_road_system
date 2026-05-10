import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Upload, Map, Database, LogOut, X, TrendingUp } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Дашборд' },
  { to: '/upload', icon: Upload, label: 'Загрузка' },
  { to: '/map', icon: Map, label: 'Карта' },
  { to: '/inventory', icon: Database, label: 'Инвентаризация' },
  { to: '/analytics', icon: TrendingUp, label: 'Аналитика' },
]

interface SidebarProps {
  mobileOpen: boolean
  onClose: () => void
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const { logout, username } = useAuthStore()

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed lg:relative inset-y-0 left-0 z-50
        w-60 bg-slate-900 min-h-screen flex flex-col flex-shrink-0
        transform transition-transform duration-200 ease-in-out
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-5 border-b border-slate-700 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl leading-none">🛣️</span>
            <div>
              <h1 className="text-white font-bold text-sm">Дефекты дорог</h1>
              <p className="text-slate-400 text-xs mt-0.5">Система мониторинга</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-slate-400 hover:text-white mt-0.5"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-700 space-y-2">
          <p className="text-slate-400 text-xs truncate">{username}</p>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-xs transition-colors"
          >
            <LogOut size={14} />
            Выйти
          </button>
          <p className="text-slate-600 text-xs">НИУ МГСУ</p>
        </div>
      </aside>
    </>
  )
}
