import React from 'react'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { feedApi, agentsApi, type FeedItem, type Agent } from '../../../lib/api'
import { CheckCircle, XCircle, Telescope, Code2, Palette, BookOpen, TrendingUp, Workflow, Plug, Crown, Bot } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { ArchiveButton } from '../shared/ArchiveButton'
import { NextBotDropdown } from '../shared/NextBotDropdown'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'

const BOT_ICONS_MAP: Record<string, React.ElementType> = {
  research: Telescope, build: Code2, design: Palette, content: BookOpen,
  growth: TrendingUp, ops: Workflow, integration: Plug, ceo: Crown,
}
function BotRoleIcon({ role, size = 14 }: { role?: string; size?: number }) {
  const Icon = (role && BOT_ICONS_MAP[role]) || Bot
  return <Icon size={size} />
}

// LEFT: 전체 봇 현황 + 실시간 피드
export function CeoLeftPanel({ missionId }: { missionId: string }) {
  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ['agents', missionId],
    queryFn: () => agentsApi.list(missionId),
    enabled: !!missionId,
    refetchInterval: 10000,
  })

  const { data: recentFeed = [] } = useQuery({
    queryKey: ['feed-recent', missionId],
    queryFn: () => feedApi.list({ mission_id: missionId, limit: 20 }),
    enabled: !!missionId,
    refetchInterval: 5000,
  })

  return (
    <div className="p-3 space-y-4 h-full overflow-y-auto">
      {/* 봇 상태 */}
      <div>
        <p className="text-xs text-muted uppercase tracking-widest mb-2">봇 현황</p>
        <div className="space-y-1">
          {agents.filter(a => a.role !== 'ceo').map(agent => (
            <div key={agent.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-bg">
              <span className="text-muted"><BotRoleIcon role={agent.role} size={13} /></span>
              <span className="text-xs text-dim flex-1 truncate">{agent.name}</span>
              <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', agent.is_active ? 'bg-green-500 animate-pulse' : 'bg-border')} />
            </div>
          ))}
          {agents.length === 0 && (
            <p className="text-sm text-muted/60">등록된 봇이 없습니다</p>
          )}
        </div>
      </div>

      {/* 실시간 피드 */}
      <div>
        <p className="text-xs text-muted uppercase tracking-widest mb-2">● 실시간 활동</p>
        <div className="space-y-2">
          {(recentFeed as FeedItem[]).slice(0, 8).map(item => (
            <div key={item.id} className="px-2 py-1.5 rounded bg-bg border-l-2 border-primary/30">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-muted"><BotRoleIcon role={item.agent_role} size={11} /></span>
                <span className="text-[10px] text-muted">{formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ko })}</span>
              </div>
              <p className="text-[11px] text-dim line-clamp-2 leading-snug">{item.content}</p>
            </div>
          ))}
          {recentFeed.length === 0 && (
            <p className="text-xs text-muted/60">봇 활동이 없습니다</p>
          )}
        </div>
      </div>
    </div>
  )
}

// CENTER: CEO 브리핑 탭
export function CeoCenterPanel({ agentId, streamOutput, isRunning }: { agentId: string; streamOutput?: string; isRunning?: boolean }) {
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'okr' | 'investor'>('daily')

  const { data: feed = [] } = useQuery({
    queryKey: ['bot-feed', agentId],
    queryFn: () => agentsApi.runs(agentId),
    select: (data: FeedItem[]) => data.filter(f => f.type === 'result'),
    refetchInterval: 5000,
  })

  const TABS = [
    { key: 'daily' as const, label: '일간' },
    { key: 'weekly' as const, label: '주간' },
    { key: 'okr' as const, label: 'OKR' },
    { key: 'investor' as const, label: '투자자' },
  ]

  // 탭별 키워드 필터링, 매칭 없으면 최신 항목 fallback
  const TAB_KEYWORDS: Record<string, string[]> = {
    daily:    ['일간', '오늘', '일일', 'today', '데일리', '당일'],
    weekly:   ['주간', '이번 주', '주별', 'weekly', '위클리', '한 주'],
    okr:      ['OKR', 'KR ', '목표', 'Objective', 'Key Result', '분기'],
    investor: ['투자자', '투자', '펀딩', 'investor', '재무', 'IR '],
  }
  const keywords = TAB_KEYWORDS[activeTab] ?? []
  const tabItems = feed.filter(item =>
    keywords.some(kw => item.content.toLowerCase().includes(kw.toLowerCase()))
  )
  const displayItem = tabItems.length > 0 ? tabItems[0] : feed[0]

  return (
    <div className="h-full flex flex-col">
      {/* 탭 */}
      <div className="flex border-b border-border px-4 shrink-0">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-3 text-sm border-b-2 -mb-px transition-colors',
              activeTab === tab.key ? 'border-primary text-text' : 'border-transparent text-muted hover:text-dim'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-y-auto p-5">
        {isRunning ? (
          <div className="h-full flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-sm text-muted">브리핑 작성 중...</span>
            </div>
            <pre className="text-base text-dim leading-loose whitespace-pre-wrap font-sans">{streamOutput || ''}</pre>
          </div>
        ) : displayItem ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-muted">{new Date(displayItem.created_at).toLocaleString('ko-KR')}</p>
              <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">{TABS.find(t => t.key === activeTab)?.label}</span>
            </div>
            <div className="text-base text-dim leading-loose whitespace-pre-wrap">
              {displayItem.content}
            </div>
          </div>
        ) : streamOutput ? (
          <div className="h-full overflow-y-auto">
            <p className="text-xs text-muted mb-4 uppercase tracking-widest">마지막 브리핑</p>
            <pre className="text-base text-dim leading-loose whitespace-pre-wrap font-sans">{streamOutput}</pre>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <span className="text-4xl opacity-20">📊</span>
            <div>
              <p className="text-base text-muted mb-1">CEO 브리핑을 생성하세요</p>
              <p className="text-sm text-muted/60">하단 입력창에서 지시하거나 오른쪽 빠른 실행을 사용하세요</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const CEO_SKILLS = [
  { label: '주간 브리핑', prompt: '/weekly-brief 이번 주 전체 봇 활동 결과를 종합해서 CEO 주간 브리핑을 작성해줘' },
  { label: '우선순위 매트릭스', prompt: '/priority-matrix 현재 진행 중인 이니셔티브들을 Impact x Effort 매트릭스로 분석하고 이번 주 TOP 3를 알려줘' },
  { label: 'OKR 점검', prompt: '/okr-check 이번 분기 OKR 달성률을 점검하고 위험 항목의 회복 방안을 제시해줘' },
  { label: '투자자 업데이트', prompt: '/investor-update 이번 달 투자자/멘토 업데이트 레터를 작성해줘' },
  { label: '의사결정 기록', prompt: '/decision-log 오늘의 주요 비즈니스 결정을 배경, 대안, 예상 결과와 함께 기록해줘' },
]

// RIGHT: 승인 대기 + 우선순위 TOP3 + 다음봇
export function CeoRightPanel({ missionId, onSkillSelect, agentId, currentRole = 'ceo', content = '' }: {
  missionId: string
  nextBotName?: string
  onNextBot?: () => void
  onSkillSelect?: (prompt: string) => void
  agentId?: string
  currentRole?: string
  content?: string
}) {
  const { data: allFeed = [] } = useQuery({
    queryKey: ['feed', missionId],
    queryFn: () => feedApi.list({ approval_only: true, limit: 10 }),
    refetchInterval: 5000,
  })

  const pending = (allFeed as FeedItem[]).filter(f => f.requires_approval && !f.approved_at && !f.rejected_at)

  // Load top priority items from localStorage — 실시간 동기화
  const [topTodos, setTopTodos] = useState<Array<{id: string; text: string}>>(() => {
    try { return (JSON.parse(localStorage.getItem('oomni_todos') ?? '[]') as Array<{id:string;text:string}>).slice(0, 3) } catch { return [] }
  })

  useEffect(() => {
    const sync = () => {
      try {
        const todos = JSON.parse(localStorage.getItem('oomni_todos') ?? '[]') as Array<{id: string; text: string}>
        setTopTodos(todos.slice(0, 3))
      } catch {}
    }
    sync()
    window.addEventListener('storage', sync)
    window.addEventListener('oomni-todos-updated', sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('oomni-todos-updated', sync)
    }
  }, [])

  // latest feed for archiving
  const { data: feed = [] } = useQuery({
    queryKey: ['bot-feed', agentId],
    queryFn: () => agentId ? agentsApi.runs(agentId) : Promise.resolve([]),
    select: (data: FeedItem[]) => data.filter(f => f.type === 'result'),
    enabled: !!agentId,
  })
  const latest = feed[0]

  return (
    <div className="p-4 h-full flex flex-col gap-4 overflow-y-auto">
      {/* 승인 대기 */}
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-3">
          <p className="text-xs text-muted uppercase tracking-widest">승인 대기</p>
          {pending.length > 0 && (
            <span className="bg-primary text-white text-xs px-2 py-0.5 rounded-full">
              {pending.length}
            </span>
          )}
        </div>
        {pending.length === 0 ? (
          <p className="text-sm text-muted/60">승인 대기 항목이 없습니다</p>
        ) : (
          <div className="space-y-3">
            {pending.map(item => (
              <div key={item.id} className="px-3 py-3 rounded-lg bg-bg border border-yellow-500/30">
                <p className="text-sm text-dim leading-snug mb-3 line-clamp-3">{item.content}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => feedApi.approve(item.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-green-500/10 text-green-400 text-xs hover:bg-green-500/20 transition-colors"
                  >
                    <CheckCircle size={12} /> 승인
                  </button>
                  <button
                    onClick={() => feedApi.reject(item.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20 transition-colors"
                  >
                    <XCircle size={12} /> 거절
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 우선순위 TOP 3 */}
      {topTodos.length > 0 && (
        <div>
          <p className="text-xs text-muted uppercase tracking-widest mb-2">📌 우선순위 TOP {topTodos.length}</p>
          <div className="space-y-1.5">
            {topTodos.map((item, i) => (
              <div key={item.id} className="flex items-center gap-2 px-3 py-2 rounded bg-bg border border-border">
                <span className="text-xs font-bold text-primary">{i + 1}</span>
                <span className="text-xs text-dim leading-snug flex-1">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Obsidian 아카이브 */}
      {latest && (
        <ArchiveButton
          content={latest.content}
          title="CEO 브리핑"
          botRole="ceo"
          tags={['OOMNI', 'ceo', 'briefing']}
        />
      )}

      {/* NextBot dropdown */}
      {agentId && <NextBotDropdown currentAgentId={agentId} currentRole={currentRole} content={content} />}

      {/* 빠른 실행 */}
      <div>
        <p className="text-xs text-muted uppercase tracking-widest mb-2.5">빠른 실행</p>
        <div className="flex flex-wrap gap-1.5">
          {CEO_SKILLS.map(skill => (
            <button
              key={skill.label}
              onClick={() => onSkillSelect?.(skill.prompt)}
              title={skill.prompt}
              className="px-2.5 py-1.5 rounded-lg border border-border bg-bg text-xs text-dim hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-colors"
            >
              {skill.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
