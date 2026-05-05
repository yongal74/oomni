import React, { useEffect, useState } from 'react'
import { createHashRouter, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AppLayout } from './components/layout/AppLayout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { authApi, agentsApi, type Agent } from './lib/api'

const OnboardingPage = React.lazy(() => import('./pages/OnboardingPage'))
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'))
const ApprovalPage = React.lazy(() => import('./pages/ApprovalPage'))
const CostPage = React.lazy(() => import('./pages/CostPage'))
const UnifiedBotPage = React.lazy(() => import('./pages/UnifiedBotPage'))
const PtyBotPage = React.lazy(() => import('./pages/PtyBotPage'))
const PinPage = React.lazy(() => import('./pages/PinPage'))
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'))
const MissionBoard = React.lazy(() => import('./pages/MissionBoard').then(m => ({ default: m.MissionBoard })))
const GrowthStudio = React.lazy(() => import('./pages/GrowthStudio'))
const StudioBotPage = React.lazy(() => import('./pages/StudioBotPage'))
const OpsCenter = React.lazy(() => import('./pages/OpsCenter'))
const CDPView        = React.lazy(() => import('./pages/CDPView'))
const SnsSettingsPage = React.lazy(() => import('./pages/SnsSettingsPage'))

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

// 페이지마다 Suspense + ErrorBoundary 격리 — 한 페이지 에러가 전체 앱 크래시를 막음
function PageWrap({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <React.Suspense fallback={<Loader />}>
        {children}
      </React.Suspense>
    </ErrorBoundary>
  )
}

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
      { index: true, element: <PageWrap><DashboardPage /></PageWrap> },
      { path: 'board',          element: <PageWrap><MissionBoard /></PageWrap> },
      { path: 'growth',         element: <PageWrap><GrowthStudio /></PageWrap> },
      { path: 'design-studio',  element: <PageWrap><StudioBotPage /></PageWrap> },
      { path: 'ops',            element: <PageWrap><OpsCenter /></PageWrap> },
      { path: 'cdp',            element: <PageWrap><CDPView /></PageWrap> },
      { path: 'approvals',      element: <PageWrap><ApprovalPage /></PageWrap> },
      { path: 'cost',           element: <PageWrap><CostPage /></PageWrap> },
      { path: 'bots/:id',       element: <ErrorBoundary><BotPageRouter /></ErrorBoundary> },
      { path: 'settings',       element: <PageWrap><SettingsPage /></PageWrap> },
      { path: 'sns-settings',   element: <PageWrap><React.Suspense fallback={<Loader />}><SnsSettingsPage /></React.Suspense></PageWrap> },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
])
