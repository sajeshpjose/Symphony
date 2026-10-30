import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../lib/auth'
import { Sidebar } from './Sidebar'

export function Layout() {
  const { session, loading } = useAuth()
  if (loading) return null
  if (!session) return <Navigate to="/sign-in" replace />
  return (
    <div className="flex min-h-full gap-2 p-2">
      <Sidebar />
      <main className="min-w-0 flex-1 px-6 py-6">
        <div className="mx-auto max-w-[1136px]">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
