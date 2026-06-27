import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import MainLayout from '@/components/layout/MainLayout'
import NodesPage from '@/pages/NodesPage'
import ArchsListPage from '@/pages/ArchsListPage'
import ArchEditorPage from '@/pages/ArchEditorPage'

const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <Navigate to="/nodes" replace /> },
      { path: 'nodes', element: <NodesPage /> },
      { path: 'archs', element: <ArchsListPage /> },
      { path: 'archs/:id', element: <ArchEditorPage /> },
    ],
  },
])

export default function AppRouter() {
  return <RouterProvider router={router} />
}
