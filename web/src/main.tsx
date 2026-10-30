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
import { Content } from './routes/Content'
import { NewClient } from './routes/NewClient'
import { PostPage } from './routes/PostPage'
import { NewResearch } from './routes/NewResearch'
import { Research } from './routes/Research'
import { ResearchPdf } from './routes/ResearchPdf'
import { ResearchRun } from './routes/ResearchRun'
import { SignIn } from './routes/SignIn'
import { Topics } from './routes/Topics'

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } })

const router = createBrowserRouter([
  { path: '/sign-in', element: <SignIn /> },
  { path: '/research/:id/pdf', element: <ResearchPdf /> },
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
      { path: 'topics', element: <Topics /> },
      { path: 'content', element: <Content /> },
      { path: 'content/:id', element: <PostPage /> },
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
