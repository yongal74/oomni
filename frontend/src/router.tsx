import React, { useEffect, useState } from 'react'
import { createBrowserRouter, Navigate, useNavigate } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { authApi } from './lib/api'

const OnboardingPage = React.lazy(() => import('./pages/OnboardingPage'))
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'))
const ApprovalPage = React.lazy(() => import('./pages/ApprovalPage'))
const CostPage = React.lazy(() => import('./pages/CostPage'))
const IntegrationsPage = React.lazy(() => import('./pages/IntegrationsPage'))
const N8nPage = React.lazy(() => import('./pages/N8nPage'))
const BotDetailPage = React.lazy(() => import('./pages/BotDetailPage'))
const IssuesPage = React.lazy(() => import('./pages/IssuesPage'))
const SchedulePage = React.lazy(() => import('./pages/SchedulePage'))
const ReportPage = React.lazy(() => import('./pages/ReportPage'))
const PinPage = React.lazy(() => import('./pages/PinPage'))

const Loader = () => (
  <div className="flex-1 flex items-center justify-center h-64">
    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
)

// 앱 시작 시 PIN 상태 확인 후 리다이렉트
function AuthGuard() {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    authApi.status()
      .then(({ pin_set }) => {
        const sessionToken = localStorage.getItem('session_token')
        if (!pin_set) {
          // PIN 미설정 → 온보딩
          navigate('/onboarding', { replace: true })
        } else if (sessionToken) {
          // 로그인됨 → 대시보드
          navigate('/dashboard', { replace: true })
        } else {
          // PIN 있지만 미로그인 → PIN 입력
          navigate('/pin', { replace: true })
        }
      })
      .catch(() => {
        // 백엔드 응답 없음 → 대시보드로 (개발 환경 fallback)
        navigate('/dashboard', { replace: true })
      })
      .finally(() => setChecking(false))
  }, [navigate])

  if (checking) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return null
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AuthGuard />,
  },
  {
    path: '/onboarding',
    element: <React.Suspense fallback={<Loader />}><OnboardingPage /></React.Suspense>,
  },
  {
    path: '/pin',
    element: <React.Suspense fallback={<Loader />}><PinPage /></React.Suspense>,
  },
  {
    path: '/dashboard',
    element: <AppLayout />,
    children: [
      { index: true, element: <React.Suspense fallback={<Loader />}><DashboardPage /></React.Suspense> },
      { path: 'approvals', element: <React.Suspense fallback={<Loader />}><ApprovalPage /></React.Suspense> },
      { path: 'cost', element: <React.Suspense fallback={<Loader />}><CostPage /></React.Suspense> },
      { path: 'integrations', element: <React.Suspense fallback={<Loader />}><IntegrationsPage /></React.Suspense> },
      { path: 'n8n', element: <React.Suspense fallback={<Loader />}><N8nPage /></React.Suspense> },
      { path: 'bots/:id', element: <React.Suspense fallback={<Loader />}><BotDetailPage /></React.Suspense> },
      { path: 'issues', element: <React.Suspense fallback={<Loader />}><IssuesPage /></React.Suspense> },
      { path: 'schedules', element: <React.Suspense fallback={<Loader />}><SchedulePage /></React.Suspense> },
      { path: 'reports', element: <React.Suspense fallback={<Loader />}><ReportPage /></React.Suspense> },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
])
