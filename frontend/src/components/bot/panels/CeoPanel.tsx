import { useQuery } from '@tanstack/react-query'
import { feedApi, agentsApi, type FeedItem, type Agent } from '../../../lib/api'
import { ChevronRight, CheckCircle, XCircle } from 'lucide-react'
import { cn } from '../../../lib/utils'

const BOT_EMOJI: Record<string, string> = {
  research: '🔬', build: '🔨', design: '🎨', content: '✍️',
  growth: '📈', ops: '⚙️', integration: '🔗', n8n: '⚡', ceo: '👔',
}

// LEFT: 전체 봇 현황
export function CeoLeftPanel({ missionId }: { missionId: string }) {
  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ['agents', missionId],
    queryFn: () => agentsApi.list(missionId),
    enabled: !!missionId,
    refetchInterval: 10000,
  })

  return (
    <div className="p-4 space-y-4">
      <p className="text-xs text-muted uppercase tracking-widest">봇 현황</p>
      <div className="space-y-2">
        {agents.filter(a => a.role !== 'ceo').map(agent => (
          <div key={agent.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-bg border border-border">
            <span className="text-base">{BOT_EMOJI[agent.role] ?? '🤖'}</span>
            <span className="text-sm text-dim flex-1 truncate">{agent.name}</span>
            <div className={cn(
              'w-2 h-2 rounded-full shrink-0',
              agent.is_active ? 'bg-green-500' : 'bg-border'
            )} />
          </div>
        ))}
        {agents.length === 0 && (
          <p className="text-sm text-muted/60">등록된 봇이 없습니다</p>
        )}
      </div>
    </div>
  )
}

// CENTER: CEO 브리핑
export function CeoCenterPanel({ agentId }: { agentId: string }) {
  const { data: feed = [] } = useQuery({
    queryKey: ['bot-feed', agentId],
    queryFn: () => feedApi.list({ limit: 10 }),
    select: (data: FeedItem[]) => data.filter(f => f.agent_id === agentId && f.type === 'result'),
    refetchInterval: 5000,
  })

  const latest = feed[0]

  if (!latest) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
      <span className="text-5xl opacity-30">👔</span>
      <p className="text-sm text-muted">CEO 브리핑을 생성하세요</p>
      <p className="text-xs text-muted/60">"이번 주 전체 현황 브리핑해줘" 등</p>
    </div>
  )

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-4">
        <p className="text-xs text-muted mb-1">
          {new Date(latest.created_at).toLocaleString('ko-KR')}
        </p>
      </div>
      <div className="text-sm text-dim leading-loose whitespace-pre-wrap">
        {latest.content}
      </div>
      {feed.length > 1 && (
        <div className="mt-8 border-t border-border pt-6">
          <p className="text-xs text-muted uppercase tracking-widest mb-4">이전 브리핑</p>
          {feed.slice(1).map(item => (
            <div key={item.id} className="mb-4 pb-4 border-b border-border/50 last:border-0">
              <p className="text-xs text-muted mb-2">
                {new Date(item.created_at).toLocaleString('ko-KR')}
              </p>
              <p className="text-sm text-dim leading-relaxed line-clamp-4">{item.content}</p>
            </div>
          ))}
        </div>
      )}
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

// RIGHT: 승인 대기 + 다음봇
export function CeoRightPanel({ missionId, nextBotName, onNextBot, onSkillSelect }: {
  missionId: string
  nextBotName?: string
  onNextBot?: () => void
  onSkillSelect?: (prompt: string) => void
}) {
  const { data: allFeed = [] } = useQuery({
    queryKey: ['feed', missionId],
    queryFn: () => feedApi.list({ approval_only: true, limit: 10 }),
    refetchInterval: 5000,
  })

  const pending = allFeed.filter(f => f.requires_approval && !f.approved_at && !f.rejected_at)

  return (
    <div className="p-4 h-full flex flex-col gap-4">
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
      {/* 빠른 실행 */}
      <div>
        <p className="text-[10px] text-muted uppercase tracking-widest mb-2.5">빠른 실행</p>
        <div className="flex flex-wrap gap-1.5">
          {CEO_SKILLS.map(skill => (
            <button
              key={skill.label}
              onClick={() => onSkillSelect?.(skill.prompt)}
              title={skill.prompt}
              className="px-2.5 py-1.5 rounded-lg border border-border bg-bg text-[11px] text-dim hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-colors"
            >
              {skill.label}
            </button>
          ))}
        </div>
      </div>

      {nextBotName && (
        <div className="pt-3 border-t border-border">
          <button
            onClick={onNextBot}
            className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-primary/30 text-primary hover:bg-primary/5 transition-colors"
          >
            <span className="text-sm">{nextBotName}으로 이어서</span>
            <ChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  )
}
