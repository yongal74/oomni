import React, { useEffect, useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAppStore } from '../../store/app.store'
import { agentsApi } from '../../lib/api'
import {
  Bell, BookOpen,
  ChevronLeft, Code2, Crown, DollarSign,
  LayoutDashboard, Palette, Plus,
  Settings2, Telescope, Workflow,
  CheckSquare, Rocket, Database,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { oomniWs } from '../../lib/ws'

// ─── 타입 ────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyIcon = React.ComponentType<any>

type NavIconItem = {
  to: string
  icon: AnyIcon
  label: string
  end?: boolean
  badge?: boolean
}

// ─── 봇 역할별 아이콘 / 색상 ─────────────────────────────────────────────────
const BOT_ICON: Record<string, AnyIcon> = {
  research: Telescope,
  build:    Code2,
  design:   Palette,
  content:  BookOpen,
  ops:      Workflow,
  ceo:      Crown,
}

const BOT_COLOR: Record<string, string> = {
  research: 'text-sky-400',
  build:    'text-orange-400',
  design:   'text-purple-400',
  content:  'text-emerald-400',
  ops:      'text-yellow-400',
  ceo:      'text-amber-400',
}

// ─── 네비게이션 그룹 ──────────────────────────────────────────────────────────
const NAV_ITEMS: NavIconItem[] = [
  { to: '/dashboard',                 icon: LayoutDashboard, label: '대시보드',     end: true },
  { to: '/dashboard/board',           icon: CheckSquare,     label: 'Mission Board' },
  { to: '/dashboard/research',        icon: Telescope,       label: 'Research Hub' },
  { to: '/dashboard/growth',          icon: Rocket,          label: 'Growth Studio' },
  { to: '/dashboard/design-studio',   icon: Palette,         label: 'Design Studio' },
  { to: '/dashboard/ops',             icon: Workflow,        label: 'Ops Center' },
  { to: '/dashboard/cdp',            icon: Database,        label: 'CDP 뷰' },
  { to: '/dashboard/approvals',       icon: Bell,            label: '승인 인박스',  badge: true },
  { to: '/dashboard/cost',            icon: DollarSign,      label: '비용 추적' },
  { to: '/dashboard/settings',        icon: Settings2,       label: '설정' },
]

// ─── 단일 아이콘 버튼 (툴팁 포함) ────────────────────────────────────────────
function IconBtn({
  icon: Icon,
  label,
  to,
  end,
  badge,
  badgeCount = 0,
  iconClass,
  onClick,
}: {
  icon: AnyIcon
  label: string
  to?: string
  end?: boolean
  badge?: boolean
  badgeCount?: number
  iconClass?: string
  onClick?: () => void
}) {
  const showDot = badge && badgeCount > 0

  const baseClass = (active: boolean) =>
    cn(
      'relative group flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-150',
      active
        ? 'bg-primary/15 text-primary'
        : 'text-[#666] hover:text-[#ccc] hover:bg-white/[0.06]'
    )

  const Tooltip = () => (
    <span className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 z-50 whitespace-nowrap rounded-lg bg-[#18181b] border border-[#27272a] px-2.5 py-1.5 text-xs font-medium text-[#e4e4e7] shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-100">
      {label}
      {showDot && (
        <span className="ml-1.5 bg-primary text-white text-[10px] px-1.5 py-0.5 rounded-full">
          {badgeCount}
        </span>
      )}
    </span>
  )

  if (to) {
    return (
      <NavLink to={to} end={end} className={({ isActive }) => baseClass(isActive)}>
        <Icon size={15} className={iconClass} />
        {showDot && (
          <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-primary pointer-events-none" />
        )}
        <Tooltip />
      </NavLink>
    )
  }

  return (
    <button onClick={onClick} className={baseClass(false)}>
      <Icon size={15} className={iconClass} />
      <Tooltip />
    </button>
  )
}

// ─── 봇 서브패널 ──────────────────────────────────────────────────────────────
function BotSubPanel({
  agents,
  onClose,
  pendingApprovals,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  agents: any[]
  onClose: () => void
  pendingApprovals: number
}) {
  const navigate = useNavigate()
  const ceoList   = agents.filter(a => a.role === 'ceo')
  const otherList = agents.filter(a => a.role !== 'ceo')

  return (
    <div className="flex flex-col h-full w-52 bg-[#111113] border-r border-[#1c1c20] shrink-0">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1c1c20] shrink-0">
        <span className="text-[10px] font-semibold text-[#52525b] uppercase tracking-widest">봇</span>
        <button
          onClick={onClose}
          className="text-[#52525b] hover:text-[#a1a1aa] transition-colors p-0.5 rounded"
        >
          <ChevronLeft size={13} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {/* CEO */}
        {ceoList.length > 0 ? (
          <>
            {ceoList.map(agent => {
              const Icon = BOT_ICON[agent.role] ?? Crown
              return (
                <NavLink
                  key={agent.id}
                  to={`/dashboard/bots/${agent.id}`}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[12px] border transition-colors',
                      isActive
                        ? 'bg-primary/10 border-primary/40 text-primary'
                        : 'border-amber-500/20 text-amber-400/70 hover:bg-amber-500/5 hover:text-amber-400 hover:border-amber-500/30'
                    )
                  }
                >
                  <Icon size={12} className="shrink-0 text-amber-400" />
                  <span className="truncate font-semibold">{agent.name}</span>
                  <div className={cn('ml-auto w-1.5 h-1.5 rounded-full shrink-0', agent.is_active ? 'bg-green-500' : 'bg-[#333]')} />
                </NavLink>
              )
            })}
            <NavLink
              to="/dashboard/ceo"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 px-3 py-1 rounded text-[11px] transition-colors',
                  isActive ? 'text-primary' : 'text-[#52525b] hover:text-amber-400/70'
                )
              }
            >
              <Crown size={10} className="shrink-0" />
              <span>CEO 대시보드</span>
            </NavLink>
            <div className="border-t border-[#1c1c20] my-1" />
          </>
        ) : (
          <button
            onClick={() => { navigate('/dashboard?addBot=true&role=ceo'); onClose() }}
            className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-[11px] border border-dashed border-[#27272a] text-[#52525b] hover:border-primary/30 hover:text-primary/70 w-full transition-colors"
          >
            <Crown size={11} className="shrink-0" />
            <span className="truncate">CEO 추가</span>
            <Plus size={10} className="ml-auto shrink-0" />
          </button>
        )}

        {/* 팀 봇 */}
        {otherList.length > 0 && (
          <p className="text-[10px] text-[#52525b] uppercase tracking-widest px-2 pt-1 pb-0.5">팀 봇</p>
        )}
        {otherList.map(agent => {
          const Icon  = BOT_ICON[agent.role]  ?? Settings2
          const color = BOT_COLOR[agent.role] ?? 'text-[#71717a]'
          return (
            <NavLink
              key={agent.id}
              to={`/dashboard/bots/${agent.id}`}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] transition-colors',
                  isActive
                    ? 'bg-[#1e1e22] text-[#e4e4e7]'
                    : 'text-[#71717a] hover:text-[#e4e4e7] hover:bg-[#18181b]'
                )
              }
            >
              <Icon size={12} className={cn('shrink-0', color)} />
              <span className="truncate">{agent.name}</span>
              <div className={cn('ml-auto w-1.5 h-1.5 rounded-full shrink-0', agent.is_active ? 'bg-green-500' : 'bg-[#333]')} />
            </NavLink>
          )
        })}

        <button
          onClick={() => { navigate('/dashboard?addBot=true'); onClose() }}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] text-[#52525b] hover:text-[#e4e4e7] w-full mt-0.5 transition-colors"
        >
          <Plus size={11} />
          봇 추가
        </button>
      </div>

      {/* 하단 승인 링크 */}
      {pendingApprovals > 0 && (
        <div className="border-t border-[#1c1c20] px-3 py-2 shrink-0">
          <NavLink
            to="/dashboard/approvals"
            className="flex items-center gap-2 text-[11px] text-primary hover:text-primary/80 transition-colors"
          >
            <Bell size={11} />
            승인 대기 {pendingApprovals}건
          </NavLink>
        </div>
      )}
    </div>
  )
}

// ─── AppLayout ────────────────────────────────────────────────────────────────
export function AppLayout() {
  const { currentMission, pendingApprovals, agents, setAgents } = useAppStore()
  const navigate = useNavigate()
  const [botPanelOpen, setBotPanelOpen] = useState(false)

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

  const activeCount = agents.filter(a => a.is_active).length

  return (
    <div className="flex h-screen bg-[#0d0d0f] overflow-hidden">

      {/* ── 좌측 아이콘 바 (w-12 = 48px) ──────────────────────────── */}
      <aside className="w-12 bg-[#0d0d0f] border-r border-[#1c1c20] flex flex-col items-center py-3 gap-0.5 shrink-0 z-30">

        {/* 로고 */}
        <button
          onClick={() => navigate('/dashboard')}
          className="mb-2 w-7 h-7 rounded-lg bg-primary/90 flex items-center justify-center hover:bg-primary transition-colors"
          title={currentMission ? `OOMNI — ${currentMission.name}` : 'OOMNI'}
        >
          <span className="text-[10px] font-black text-white tracking-tight select-none">O</span>
        </button>

        <div className="w-5 h-px bg-[#27272a] mb-2" />

        {/* 봇 패널 토글 */}
        <div className="relative group">
          <button
            onClick={() => setBotPanelOpen(o => !o)}
            className={cn(
              'relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-150',
              botPanelOpen
                ? 'bg-primary/15 text-primary'
                : 'text-[#666] hover:text-[#ccc] hover:bg-white/[0.06]'
            )}
          >
            {/* 5-dot 그리드 아이콘 */}
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <circle cx="3.5"  cy="3.5"  r="1.4" fill="currentColor" opacity="0.9" />
              <circle cx="11.5" cy="3.5"  r="1.4" fill="currentColor" opacity="0.9" />
              <circle cx="3.5"  cy="11.5" r="1.4" fill="currentColor" opacity="0.9" />
              <circle cx="11.5" cy="11.5" r="1.4" fill="currentColor" opacity="0.9" />
              <circle cx="7.5"  cy="7.5"  r="1.4" fill="currentColor" opacity="0.45" />
            </svg>
            {/* 활성 봇 수 뱃지 */}
            {activeCount > 0 && (
              <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-green-500 pointer-events-none" />
            )}
          </button>
          <span className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 z-50 whitespace-nowrap rounded-lg bg-[#18181b] border border-[#27272a] px-2.5 py-1.5 text-xs font-medium text-[#e4e4e7] shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-100">
            봇 목록
          </span>
        </div>

        {/* 봇별 아이콘 (최대 6개 직접 노출) */}
        {agents.slice(0, 6).map(agent => {
          const Icon  = BOT_ICON[agent.role]  ?? Settings2
          const color = BOT_COLOR[agent.role] ?? 'text-[#666]'
          return (
            <IconBtn
              key={agent.id}
              icon={Icon}
              label={agent.name}
              to={`/dashboard/bots/${agent.id}`}
              iconClass={color}
            />
          )
        })}

        {agents.length > 6 && (
          <IconBtn
            icon={Plus}
            label={`봇 더 보기 (${agents.length - 6}개)`}
            onClick={() => setBotPanelOpen(true)}
          />
        )}

        <div className="w-5 h-px bg-[#27272a] my-1.5" />

        {/* 네비게이션 아이콘 */}
        {NAV_ITEMS.map(item => (
          <IconBtn
            key={item.to}
            icon={item.icon}
            label={item.label}
            to={item.to}
            end={item.end}
            badge={item.badge}
            badgeCount={item.badge ? pendingApprovals : 0}
          />
        ))}

        <div className="flex-1" />

        {/* 봇 추가 — 하단 고정 */}
        <div className="w-5 h-px bg-[#27272a] mb-1.5" />
        <IconBtn
          icon={Plus}
          label="봇 추가"
          onClick={() => navigate('/dashboard?addBot=true')}
        />
      </aside>

      {/* ── 봇 서브패널 (슬라이드 오픈) ────────────────────────────── */}
      <div
        className={cn(
          'transition-[width] duration-200 ease-in-out overflow-hidden shrink-0',
          botPanelOpen ? 'w-52' : 'w-0'
        )}
      >
        {botPanelOpen && (
          <BotSubPanel
            agents={agents}
            onClose={() => setBotPanelOpen(false)}
            pendingApprovals={pendingApprovals}
          />
        )}
      </div>

      {/* ── 메인 콘텐츠 ─────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto min-w-0">
        <Outlet />
      </main>
    </div>
  )
}
