import React, { useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAppStore } from '../../store/app.store'
import { agentsApi } from '../../lib/api'
import { Activity, BarChart2, Bell, Calendar, Crown, DollarSign, GitBranch, LayoutDashboard, Plug, Plus, Search, Settings, Ticket, Wrench, Zap } from 'lucide-react'
import { cn } from '../../lib/utils'
import { oomniWs } from '../../lib/ws'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NavItem = { to: string; icon: React.ComponentType<any>; label: string; end?: boolean }
type NavSection = { section: string; items: NavItem[] }

const NAV_SECTIONS: NavSection[] = [
  {
    section: '메인',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: '대시보드', end: true },
    ],
  },
  {
    section: '분석',
    items: [
      { to: '/dashboard/cost', icon: DollarSign, label: '비용 추적' },
      { to: '/dashboard/reports', icon: BarChart2, label: '리포트' },
      { to: '/dashboard/monitoring', icon: Activity, label: '모니터링' },
    ],
  },
  {
    section: '관리',
    items: [
      { to: '/dashboard/approvals', icon: Bell, label: '승인 인박스' },
      { to: '/dashboard/issues', icon: Ticket, label: '티켓' },
      { to: '/dashboard/schedules', icon: Calendar, label: '자동화' },
    ],
  },
  {
    section: '도구',
    items: [
      { to: '/dashboard/n8n', icon: Zap, label: 'n8n 자동화' },
      { to: '/dashboard/devtools', icon: Wrench, label: '개발 환경' },
      { to: '/dashboard/research', icon: Search, label: 'Research Studio' },
      { to: '/dashboard/pipeline', icon: GitBranch, label: '파이프라인' },
      { to: '/dashboard/integrations', icon: Plug, label: 'Obsidian' },
    ],
  },
  {
    section: '설정',
    items: [
      { to: '/dashboard/settings', icon: Settings, label: '설정' },
    ],
  },
]

export function AppLayout() {
  const { currentMission, pendingApprovals, agents, setAgents } = useAppStore()
  const navigate = useNavigate()

  // 사이드바 봇 목록 동기화: DashboardPage와 무관하게 항상 최신 agents 유지
  const { data: agentsData } = useQuery({
    queryKey: ['agents', currentMission?.id],
    queryFn: () => agentsApi.list(currentMission?.id),
    enabled: !!currentMission?.id,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })
  useEffect(() => { if (agentsData) setAgents(agentsData) }, [agentsData, setAgents])

  useEffect(() => {
    oomniWs.connect()
    return () => oomniWs.disconnect()
  }, [])

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      {/* 사이드바 */}
      <aside className="w-52 bg-surface border-r border-border flex flex-col shrink-0">
        {/* 로고 */}
        <div className="px-4 py-4 border-b border-border">
          <div className="text-lg font-bold text-primary tracking-tight">OOMNI</div>
          {currentMission && (
            <div className="text-[11px] text-muted mt-0.5 truncate">{currentMission.name}</div>
          )}
        </div>

        {/* 봇 목록 */}
        <div className="flex-1 overflow-y-auto px-2 py-3">
          {/* CEO Bot — 최상단 고정 */}
          {agents.some(a => a.role === 'ceo') ? (<>
            {agents.filter(a => a.role === 'ceo').map(agent => (
              <NavLink
                key={agent.id}
                to={`/dashboard/bots/${agent.id}`}
                className={({ isActive }) => cn(
                  'flex items-center gap-2 px-2 py-2 rounded-lg text-[13px] mb-0.5 border transition-colors',
                  isActive
                    ? 'bg-primary/10 border-primary/40 text-primary'
                    : 'border-primary/20 text-primary/70 hover:bg-primary/5 hover:text-primary hover:border-primary/30'
                )}
              >
                <Crown size={13} className="shrink-0 text-amber-400" />
                <span className="truncate font-semibold">{agent.name}</span>
                <div className={cn('ml-auto w-1.5 h-1.5 rounded-full', agent.is_active ? 'bg-green-500' : 'bg-[#333]')} />
              </NavLink>
            ))}
            <NavLink
              to="/dashboard/ceo"
              className={({ isActive }) => cn(
                'flex items-center gap-2 px-2 py-1 rounded text-[11px] mb-1 ml-1 transition-colors',
                isActive ? 'text-primary' : 'text-muted hover:text-primary/70'
              )}
            >
              <Crown size={10} className="shrink-0" />
              <span>CEO 대시보드</span>
            </NavLink>
            <div className="border-t border-border/50 mt-0.5 mb-2" />
          </>) : (
            <button
              onClick={() => navigate('/dashboard?addBot=true&role=ceo')}
              className="flex items-center gap-2 px-2 py-2 rounded-lg text-[13px] mb-2 border border-dashed border-border/40 text-muted hover:border-primary/30 hover:text-primary/70 w-full transition-colors"
            >
              <Crown size={13} className="shrink-0 text-muted" />
              <span className="truncate">CEO 추가</span>
              <Plus size={11} className="ml-auto shrink-0" />
            </button>
          )}

          <div className="text-[10px] text-muted uppercase tracking-widest px-2 mb-2">봇</div>
          {agents.filter(a => a.role !== 'ceo').map(agent => (
            <NavLink
              key={agent.id}
              to={`/dashboard/bots/${agent.id}`}
              className={({ isActive }) => cn(
                'flex items-center gap-2 px-2 py-1.5 rounded text-[13px] mb-0.5',
                isActive ? 'bg-[#2A2A2C] text-text' : 'text-muted hover:text-text hover:bg-[#1E1E20]'
              )}
            >
              <span>{BOT_EMOJI[agent.role] ?? '🤖'}</span>
              <span className="truncate">{agent.name}</span>
              <div className={cn('ml-auto w-1.5 h-1.5 rounded-full', agent.is_active ? 'bg-green-500' : 'bg-[#333]')} />
            </NavLink>
          ))}
          <button
            onClick={() => navigate('/dashboard?addBot=true')}
            className="flex items-center gap-2 px-2 py-1.5 rounded text-[12px] text-muted hover:text-text w-full mt-1"
          >
            <Plus size={12} />
            봇 추가
          </button>
        </div>

        {/* 네비게이션 */}
        <div className="border-t border-border px-2 py-3">
          {NAV_SECTIONS.map(({ section, items }, sectionIdx) => (
            <div key={section}>
              {sectionIdx > 0 && <div className="border-t border-border mx-1 my-1" />}
              <p className="text-[10px] text-muted uppercase tracking-widest px-2 pt-2 pb-1">{section}</p>
              {items.map(({ to, icon: Icon, label, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) => cn(
                    'flex items-center gap-2 px-2 py-1.5 rounded text-[13px] mb-0.5 relative',
                    isActive ? 'bg-[#2A2A2C] text-text' : 'text-muted hover:text-text hover:bg-[#1E1E20]'
                  )}
                >
                  <Icon size={14} />
                  <span>{label}</span>
                  {label === '승인 인박스' && pendingApprovals > 0 && (
                    <span className="ml-auto bg-primary text-white text-[10px] px-1.5 py-0.5 rounded-full">
                      {pendingApprovals}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </div>
      </aside>

      {/* 메인 */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}

const BOT_EMOJI: Record<string, string> = {
  research: '🔬', build: '🔨', design: '🎨',
  content: '✍️', growth: '📈', ops: '⚙️',
  integration: '🔗', n8n: '⚡', ceo: '👔',
}
