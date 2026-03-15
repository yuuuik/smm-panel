import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { LayoutDashboard, Users, Globe, FileText, CheckSquare, Terminal, LogOut, UserCircle, ShieldCheck, HelpCircle, MessageCircle, Crown } from 'lucide-react'
import { me } from './api'

const baseNav = [
  { to: '/', label: 'Главная', icon: LayoutDashboard },
  { to: '/accounts', label: 'Аккаунты', icon: Users },
  { to: '/proxies', label: 'Прокси', icon: Globe },
  { to: '/templates', label: 'Шаблоны', icon: FileText },
  { to: '/actions', label: 'Задачи', icon: CheckSquare },
  { to: '/logs', label: 'Логи', icon: Terminal },
  { to: '/profile', label: 'Профиль', icon: UserCircle },
  { to: '/faq', label: 'FAQ', icon: HelpCircle },
  { to: '/support', label: 'Поддержка', icon: MessageCircle },
  { to: '/subscription', label: 'Подписка', icon: Crown },
]

export default function Layout() {
  const navigate = useNavigate()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    me().then((u) => setIsAdmin(!!u.is_admin)).catch(() => {})
  }, [])

  const nav = isAdmin
    ? [...baseNav, { to: '/admin', label: 'Администрация', icon: ShieldCheck }]
    : baseNav

  const logout = () => {
    localStorage.removeItem('token')
    navigate('/login')
  }
  return (
    <div className="flex min-h-screen bg-panel-bg">
      <aside className="w-56 bg-panel-card border-r border-[#1c2333] flex flex-col fixed top-0 left-0 h-screen z-40">
        {/* Logo */}
        <div className="p-4 border-b border-[#1c2333] flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0">
            <img src="/logo.png" alt="BEMQEL" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="font-black text-sm text-white leading-tight tracking-widest uppercase" style={{ letterSpacing: '0.12em' }}>BEMQEL</h1>
            <p className="text-[9px] text-[#4b6080] tracking-widest uppercase mt-0.5">FB Automation</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 pt-3">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-semibold mb-1 transition-all ${
                  isActive
                    ? 'bg-[rgba(0,212,255,0.12)] text-cyan-400 shadow-[0_0_12px_rgba(0,212,255,0.2)] border-l-2 border-cyan-400'
                    : 'text-[#8ba3c0] hover:bg-[rgba(255,255,255,0.04)] hover:text-white border-l-2 border-transparent'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={16} className={isActive ? 'text-cyan-400' : ''} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-2 border-t border-[#1c2333]">
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 text-[13px] font-semibold text-[#8ba3c0] hover:text-panel-pink hover:bg-[rgba(236,72,153,0.08)] rounded-lg transition-all"
          >
            <LogOut size={14} />
            Выход
          </button>
        </div>
      </aside>

      <main
        className="flex-1 overflow-auto p-6 ml-56"
        style={{
          backgroundImage:
            'linear-gradient(rgba(6,182,212,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.04) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      >
        <Outlet />
      </main>
    </div>
  )
}
