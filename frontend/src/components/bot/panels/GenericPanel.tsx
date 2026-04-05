/**
 * 공통 Right 패널 + 역할별 Left/Center 기본 패널
 * Content / Build / Growth / Ops / CEO / Design / Integration 봇 공통
 */
import { useQuery } from '@tanstack/react-query'
import { feedApi, type FeedItem } from '../../../lib/api'
import { ChevronRight, Copy, Check } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { useState } from 'react'

// ─── Right 패널: 결과 피드 + 다음봇 연결 ─────────────────────────────
interface RightPanelProps {
  agentId: string
  nextBotName?: string
  onNextBot?: () => void
}

export function CommonRightPanel({ agentId, nextBotName, onNextBot }: RightPanelProps) {
  const { data: feed = [] } = useQuery({
    queryKey: ['bot-feed', agentId],
    queryFn: () => feedApi.list({ limit: 20 }),
    select: (data: FeedItem[]) => data.filter(f => f.agent_id === agentId),
    refetchInterval: 3000,
  })

  const results = feed.filter(f => f.type === 'result')

  return (
    <div className="h-full flex flex-col p-4 gap-4">
      <div className="flex-1 overflow-y-auto space-y-3">
        <p className="text-[10px] text-muted uppercase tracking-widest">최근 결과</p>
        {results.length === 0 ? (
          <p className="text-[12px] text-muted/60">실행 결과가 여기에 표시됩니다</p>
        ) : (
          results.slice(0, 5).map(item => (
            <ResultCard key={item.id} item={item} />
          ))
        )}
      </div>

      {nextBotName && (
        <div className="border-t border-border pt-3">
          <button
            onClick={onNextBot}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded border border-primary/30 text-primary hover:bg-primary/5 transition-colors"
          >
            <span className="text-[12px]">{nextBotName}으로 이어서</span>
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

function ResultCard({ item }: { item: FeedItem }) {
  const [copied, setCopied] = useState(false)
  const preview = item.content.slice(0, 120) + (item.content.length > 120 ? '...' : '')

  const handleCopy = async () => {
    await navigator.clipboard.writeText(item.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="bg-bg rounded-lg border border-border p-3 group">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-[10px] text-muted">
          {new Date(item.created_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </span>
        <button
          onClick={handleCopy}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted hover:text-text"
        >
          {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
        </button>
      </div>
      <p className="text-[12px] text-dim leading-relaxed">{preview}</p>
    </div>
  )
}

// ─── Center 패널: 활동 피드 (공통) ────────────────────────────────────
export function CommonCenterPanel({ agentId }: { agentId: string }) {
  const { data: feed = [], isLoading } = useQuery({
    queryKey: ['bot-feed', agentId],
    queryFn: () => feedApi.list({ limit: 30 }),
    select: (data: FeedItem[]) => data.filter(f => f.agent_id === agentId),
    refetchInterval: 3000,
  })

  if (isLoading) return (
    <div className="flex items-center justify-center h-full text-muted text-[13px]">로딩 중...</div>
  )

  if (feed.length === 0) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
      <div className="text-3xl opacity-20">💬</div>
      <p className="text-[13px] text-muted">하단 입력창에서 봇을 실행하세요</p>
    </div>
  )

  return (
    <div className="h-full overflow-y-auto p-4 space-y-3">
      {feed.map(item => (
        <FeedCard key={item.id} item={item} />
      ))}
    </div>
  )
}

function FeedCard({ item }: { item: FeedItem }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = item.content.length > 200
  const display = expanded ? item.content : item.content.slice(0, 200)

  const typeStyle = {
    info: 'border-l-2 border-muted/40',
    result: 'border-l-2 border-primary/60',
    error: 'border-l-2 border-red-500/60',
    approval: 'border-l-2 border-yellow-500/60',
  }[item.type]

  return (
    <div className={cn('bg-bg rounded-lg p-3 pl-4', typeStyle)}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className={cn(
          'text-[10px] font-medium uppercase',
          item.type === 'result' ? 'text-primary' :
          item.type === 'error' ? 'text-red-400' :
          item.type === 'approval' ? 'text-yellow-400' :
          'text-muted'
        )}>
          {item.type === 'result' ? '결과' :
           item.type === 'error' ? '오류' :
           item.type === 'approval' ? '승인 필요' : '정보'}
        </span>
        <span className="text-[10px] text-muted/60">
          {new Date(item.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <p className="text-[12px] text-dim leading-relaxed whitespace-pre-wrap">{display + (isLong && !expanded ? '...' : '')}</p>
      {isLong && (
        <button onClick={() => setExpanded(e => !e)} className="mt-1.5 text-[11px] text-primary/70 hover:text-primary">
          {expanded ? '접기' : '더 보기'}
        </button>
      )}
    </div>
  )
}

// ─── Left 패널: 봇 설정 (공통) ────────────────────────────────────────
export function CommonLeftPanel({ agent, onUpdate }: {
  agent: { id: string; name: string; role: string; schedule: string; system_prompt: string; budget_cents: number }
  onUpdate: (data: Partial<typeof agent>) => void
}) {
  const [prompt, setPrompt] = useState(agent.system_prompt)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    onUpdate({ system_prompt: prompt })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="p-4 space-y-5">
      <div>
        <p className="text-[10px] text-muted uppercase tracking-widest mb-3">역할 설정</p>
        <div className="space-y-1 text-[12px]">
          <div className="flex items-center justify-between py-1">
            <span className="text-muted">역할</span>
            <span className="text-dim capitalize">{agent.role}</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-muted">스케줄</span>
            <span className="text-dim">
              {{ manual: '수동', hourly: '매시간', daily: '매일', weekly: '매주' }[agent.schedule] ?? agent.schedule}
            </span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-muted">예산</span>
            <span className="text-dim">${(agent.budget_cents / 100).toFixed(0)}/월</span>
          </div>
        </div>
      </div>

      <div>
        <p className="text-[10px] text-muted uppercase tracking-widest mb-2">시스템 프롬프트</p>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          rows={6}
          className="w-full bg-bg border border-border rounded px-3 py-2 text-[11px] text-dim font-mono focus:outline-none focus:border-primary/60 resize-none leading-relaxed"
        />
        <button
          onClick={handleSave}
          className={cn(
            'mt-2 w-full py-1.5 rounded text-[12px] transition-colors',
            saved ? 'bg-green-500/10 text-green-400' : 'bg-primary/10 text-primary hover:bg-primary/20'
          )}
        >
          {saved ? '저장됨 ✓' : '저장'}
        </button>
      </div>
    </div>
  )
}
