import type { ThemeConfig } from 'antd'

const theme: ThemeConfig = {
  token: {
    // Primary palette – a calm indigo that works well for dev tools
    colorPrimary: '#4f46e5',
    colorInfo: '#4f46e5',
    colorSuccess: '#10b981',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',

    // Typography
    fontFamily:
      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontSize: 14,
    fontSizeHeading1: 30,
    fontSizeHeading2: 24,
    fontSizeHeading3: 20,
    fontSizeHeading4: 16,

    // Border & radius
    borderRadius: 8,
    borderRadiusLG: 12,
    borderRadiusSM: 6,

    // Spacing & layout
    controlHeight: 36,
    controlHeightLG: 40,
    controlHeightSM: 28,

    // Colors – light, airy backgrounds
    colorBgContainer: '#ffffff',
    colorBgLayout: '#f8fafc',
    colorBorderSecondary: '#e2e8f0',
    colorTextBase: '#1e293b',
    colorTextSecondary: '#64748b',
  },
  components: {
    Menu: {
      horizontalItemSelectedColor: '#4f46e5',
      horizontalItemHoverColor: '#4f46e5',
      itemBg: 'transparent',
      activeBarBorderWidth: 2,
      itemHeight: 48,
    },
    Button: {
      primaryShadow: '0 1px 2px 0 rgba(79, 70, 229, 0.2)',
      defaultBorderColor: '#e2e8f0',
    },
    Card: {
      paddingLG: 20,
    },
    Table: {
      headerBg: '#f8fafc',
      headerColor: '#475569',
      rowHoverBg: '#f1f5f9',
    },
    Input: {
      activeBorderColor: '#4f46e5',
      hoverBorderColor: '#818cf8',
    },
  },
}

export default theme
