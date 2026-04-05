import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/app.store'
import { BarChart2, Bell, Calendar, DollarSign, LayoutDashboard, Plug, Plus, Search, Ticket, Wrench, Zap } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useEffect } from 'react'
import { oomniWs } from '../../lib/ws'

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: '대시보드', end: true },
  { to: '/dashboard/approvals', icon: Bell, label: '승인 인박스' },
  { to: '/dashboard/issues', icon: Ticket, label: '티켓' },
  { to: '/dashboard/cost', icon: DollarSign, label: '비용 추적' },
  { to: '/dashboard/schedules', icon: Calendar, label: '자동화' },
  { to: '/dashboard/reports', icon: BarChart2, label: '리포트' },
  { to: '/dashboard/research', icon: Search, label: 'Research Studio' },
  { to: '/dashboard/integrations', icon: Plug, label: '서비스 연동' },
  { to: '/dashboard/n8n', icon: Zap, label: 'n8n 자동화' },
  { to: '/dashboard/devtools', icon: Wrench, label: '개발 환경' },
]

export function AppLayout() {
  const { currentMission, pendingApprovals, agents } = useAppStore()
  const navigate = useNavigate()

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
          <div className="text-[10px] text-muted uppercase tracking-widest px-2 mb-2">봇</div>
          {agents.map(agent => (
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
          {NAV.map(({ to, icon: Icon, label, end }) => (
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
