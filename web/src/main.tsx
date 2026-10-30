import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'
import { Layout } from './components/Layout'
import './index.css'
import { AuthProvider } from './lib/auth'
import { ClaudeApi } from './routes/ClaudeApi'
import { ClientPage } from './routes/ClientPage'
import { Clients } from './routes/Clients'
import { NewClient } from './routes/NewClient'
import { NewResearch } from './routes/NewResearch'
import { Research } from './routes/Research'
import { ResearchRun } from './routes/ResearchRun'
import { SignIn } from './routes/SignIn'
import { Soon } from './routes/Soon'

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } })

const router = createBrowserRouter([
  { path: '/sign-in', element: <SignIn /> },
  {
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/clients" replace /> },
      { path: 'clients', element: <Clients /> },
      { path: 'clients/new', element: <NewClient /> },
      { path: 'clients/:id', element: <ClientPage /> },
      { path: 'clients/:id/edit', element: <NewClient /> },
      { path: 'research', element: <Research /> },
      { path: 'research/new', element: <NewResearch /> },
      { path: 'research/:id', element: <ResearchRun /> },
      { path: 'topics', element: <Soon title="Topics">The next 5 blog topics for each client.</Soon> },
      { path: 'content', element: <Soon title="Content">Posts written by Claude, waiting for your review.</Soon> },
      { path: 'settings', element: <ClaudeApi /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AuthProvider>
  </StrictMode>,
)
