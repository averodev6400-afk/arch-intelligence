import { Layout } from 'antd'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'

const { Header, Content } = Layout

const navItems = [
  {
    key: '/nodes',
    label: 'Nodes',
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3" strokeWidth="2" />
        <circle cx="4" cy="6" r="2" strokeWidth="2" />
        <circle cx="20" cy="6" r="2" strokeWidth="2" />
        <circle cx="4" cy="18" r="2" strokeWidth="2" />
        <circle cx="20" cy="18" r="2" strokeWidth="2" />
        <line x1="6" y1="6.5" x2="9.5" y2="11" strokeWidth="2" strokeLinecap="round" />
        <line x1="18" y1="6.5" x2="14.5" y2="11" strokeWidth="2" strokeLinecap="round" />
        <line x1="6" y1="17.5" x2="9.5" y2="13" strokeWidth="2" strokeLinecap="round" />
        <line x1="18" y1="17.5" x2="14.5" y2="13" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: '/archs',
    label: 'Architectures',
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="5" rx="1" strokeWidth="2" />
        <rect x="14" y="3" width="7" height="5" rx="1" strokeWidth="2" />
        <rect x="8" y="16" width="8" height="5" rx="1" strokeWidth="2" />
        <line x1="12" y1="8" x2="12" y2="11" strokeWidth="2" strokeLinecap="round" />
        <line x1="6.5" y1="8" x2="12" y2="11" strokeWidth="2" strokeLinecap="round" />
        <line x1="17.5" y1="8" x2="12" y2="11" strokeWidth="2" strokeLinecap="round" />
        <line x1="12" y1="11" x2="12" y2="16" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
]

export default function MainLayout() {
  const navigate = useNavigate()
  const location = useLocation()

  const activeKey = location.pathname.startsWith('/archs') ? '/archs' : location.pathname

  return (
    <Layout className="min-h-screen">
      <Header
        className="bg-white! border-b! border-slate-200! px-4!"
        style={{ height: 52, lineHeight: '52px', position: 'sticky', top: 0, zIndex: 100 }}
      >
        <div className="flex items-center h-full gap-6">
          {/* Logo */}
          <div
            className="flex items-center gap-2.5 cursor-pointer select-none shrink-0"
            onClick={() => navigate('/')}
          >
            <div className="w-7 h-7 rounded-lg bg-linear-to-br from-indigo-600 to-indigo-500 flex items-center justify-center shadow-sm">
              <span className="text-white text-sm font-bold leading-none">A</span>
            </div>
            <span className="text-sm font-semibold text-slate-900 tracking-tight">
              Arch Intelligence
            </span>
          </div>

          {/* Divider */}
          <div className="h-5 w-px bg-slate-200 shrink-0" />

          {/* Nav items */}
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => navigate(item.key)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all cursor-pointer ${
                  activeKey === item.key
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className={activeKey === item.key ? 'text-indigo-600' : 'text-slate-400'}>
                  {item.icon}
                </span>
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </Header>

      <Layout>
        <Content className="overflow-auto" style={{ height: 'calc(100vh - 52px)' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
