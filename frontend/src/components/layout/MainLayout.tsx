import { useState } from 'react'
import { Layout } from 'antd'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'

const { Sider, Content } = Layout

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
  const [collapsed, setCollapsed] = useState(false)

  const activeKey = location.pathname.startsWith('/archs') ? '/archs' : location.pathname

  return (
    <Layout className="min-h-screen">
      <Sider
        width={220}
        collapsedWidth={64}
        collapsed={collapsed}
        className="bg-white! border-r! border-slate-200!"
        style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'hidden' }}
      >
        {/* Logo + collapse toggle */}
        <div className="flex items-center h-14 border-b border-slate-200 px-4 gap-2.5">
          <div
            className="flex items-center gap-2.5 cursor-pointer select-none flex-1 min-w-0"
            onClick={() => navigate('/')}
          >
            <div className="w-8 h-8 rounded-lg bg-linear-to-br from-indigo-600 to-indigo-500 flex items-center justify-center shadow-sm shrink-0">
              <span className="text-white text-sm font-bold leading-none">A</span>
            </div>
            {!collapsed && (
              <span className="text-base font-semibold text-slate-900 tracking-tight truncate">
                Arch Intelligence
              </span>
            )}
          </div>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-all cursor-pointer"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {collapsed ? (
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              ) : (
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
              )}
            </svg>
          </button>
        </div>

        {/* Nav items */}
        <nav className="px-2 pt-4 flex flex-col gap-1">
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => navigate(item.key)}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                collapsed ? 'justify-center' : 'text-left'
              } ${
                activeKey === item.key
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span className={activeKey === item.key ? 'text-indigo-600' : 'text-slate-400'}>
                {item.icon}
              </span>
              {!collapsed && item.label}
            </button>
          ))}
        </nav>
      </Sider>

      <Layout>
        <Content className="h-screen overflow-auto">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
