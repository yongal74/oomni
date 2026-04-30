import React, { useEffect, useState } from 'react'
import { createHashRouter, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AppLayout } from './components/layout/AppLayout'
import { authApi, agentsApi, type Agent } from './lib/api'

const OnboardingPage = React.lazy(() => import('./pages/OnboardingPage'))
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'))
const ApprovalPage = React.lazy(() => import('./pages/ApprovalPage'))
const CostPage = React.lazy(() => import('./pages/CostPage'))
const UnifiedBotPage = React.lazy(() => import('./pages/UnifiedBotPage'))
const PtyBotPage = React.lazy(() => import('./pages/PtyBotPage'))
const PinPage = React.lazy(() => import('./pages/PinPage'))
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'))

// PTY 봇 역할 목록
const PTY_ROLES = new Set(['build', 'design', 'ops'])

// 봇 역할에 따라 UnifiedBotPage 또는 PtyBotPage로 분기
// key={id}로 봇 이동 시 컴포넌트 remount — 상태 초기화
function BotPageRouter() {
  const { id } = useParams<{ id: string }>()

  const { data: agent, isLoading } = useQuery<Agent>({
    queryKey: ['agent', id],
    queryFn: () => agentsApi.list().then(list => list.find((a: Agent) => a.id === id)!),
    enabled: !!id,
  })

  if (isLoading) {
    return <Loader />
  }

  if (!agent) {
    return <div className="p-8 text-base text-muted">봇을 찾을 수 없습니다</div>
  }

  if (PTY_ROLES.has(agent.role)) {
    return (
      <React.Suspense fallback={<Loader />}>
        <PtyBotPage key={id} />
      </React.Suspense>
    )
  }

  return (
    <React.Suspense fallback={<Loader />}>
      <UnifiedBotPage key={id} />
    </React.Suspense>
  )
}

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
    const sessionToken = sessionStorage.getItem('session_token')

    // 토큰이 있으면 서버에서 유효성 확인 후 자동 로그인
    const checkFn = sessionToken
      ? fetch(`/api/auth/status?token=${encodeURIComponent(sessionToken)}`)
          .then(r => r.json() as Promise<{ pin_set: boolean; authenticated?: boolean }>)
      : authApi.status().then(r => ({ pin_set: r.pin_set, authenticated: false }))

    checkFn
      .then(({ pin_set, authenticated }) => {
        if (!pin_set) {
          // PIN 미설정 → 온보딩
          navigate('/onboarding', { replace: true })
        } else if (authenticated) {
          // 세션 유효 → 바로 대시보드 (자동 로그인)
          navigate('/dashboard', { replace: true })
        } else {
          // PIN 있지만 세션 만료/없음 → PIN 입력
          sessionStorage.removeItem('session_token')
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

export const router = createHashRouter([
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
      { path: 'bots/:id', element: <BotPageRouter /> },
      { path: 'settings', element: <React.Suspense fallback={<Loader />}><SettingsPage /></React.Suspense> },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
])
