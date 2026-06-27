import { ConfigProvider } from 'antd'
import AppRouter from '@/routes'
import theme from '@/theme'

export default function App() {
  return (
    <ConfigProvider theme={theme}>
      <AppRouter />
    </ConfigProvider>
  )
}
