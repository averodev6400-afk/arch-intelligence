import { Layout } from 'antd'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'

const { Content } = Layout

const navItems = [
  { key: '/nodes', label: 'Nodes' },
  { key: '/archs', label: 'Archs' },
]

export default function MainLayout() {
  const navigate = useNavigate()
  const location = useLocation()

  const activeKey = location.pathname.startsWith('/archs') ? '/archs' : location.pathname

  return (
    <Layout className="min-h-screen">
      {/* Professional top toolbar */}
      <header className="flex items-center justify-between px-6 h-14 bg-white border-b border-slate-200 sticky top-0 z-50">
        {/* Logo – left */}
        <div
          className="flex items-center gap-2.5 cursor-pointer select-none"
          onClick={() => navigate('/')}
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-500 flex items-center justify-center shadow-sm">
            <span className="text-white text-sm font-bold leading-none">A</span>
          </div>
          <span className="text-base font-semibold text-slate-900 tracking-tight">
            Arch Intelligence
          </span>
        </div>

        {/* Nav – right */}
        <nav className="flex items-center gap-1">
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => navigate(item.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                activeKey === item.key
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <Content className="h-[calc(100vh-3.5rem)]">
        <Outlet />
      </Content>
    </Layout>
  )
}
