import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { feedApi, researchApi, type FeedItem, type ResearchItem } from '../../../lib/api'
import { ChevronRight, Copy, Check, FileText } from 'lucide-react'
import { cn } from '../../../lib/utils'

const CONTENT_TYPES = [
  { key: 'blog', label: '블로그 포스트', emoji: '📝' },
  { key: 'newsletter', label: '뉴스레터', emoji: '📧' },
  { key: 'twitter', label: '트위터 스레드', emoji: '🐦' },
  { key: 'linkedin', label: 'LinkedIn', emoji: '💼' },
  { key: 'youtube_script', label: '유튜브 스크립트', emoji: '🎬' },
]

// LEFT: 콘텐츠 타입 + 리서치 연결
export function ContentLeftPanel({ missionId, selectedType, onTypeChange }: {
  missionId: string
  selectedType: string
  onTypeChange: (type: string) => void
}) {
  const { data: keptItems = [] } = useQuery<ResearchItem[]>({
    queryKey: ['research', missionId],
    queryFn: () => researchApi.list(missionId),
    select: (data: ResearchItem[]) => data.filter(i => i.filter_decision === 'keep'),
    enabled: !!missionId,
  })

  return (
    <div className="p-4 space-y-5">
      <div>
        <p className="text-xs text-muted uppercase tracking-widest mb-3">콘텐츠 타입</p>
        <div className="space-y-1.5">
          {CONTENT_TYPES.map(type => (
            <button
              key={type.key}
              onClick={() => onTypeChange(type.key)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
                selectedType === type.key
                  ? 'bg-primary/10 border border-primary/40 text-text'
                  : 'hover:bg-surface text-dim'
              )}
            >
              <span className="text-base">{type.emoji}</span>
              <span className="text-sm">{type.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs text-muted uppercase tracking-widest mb-3">
          리서치 연결 ({keptItems.length}개)
        </p>
        {keptItems.length === 0 ? (
          <p className="text-xs text-muted/60">Research Bot에서 keep한 아이템이 없습니다</p>
        ) : (
          <div className="space-y-1.5">
            {keptItems.slice(0, 5).map(item => (
              <div key={item.id} className="flex items-start gap-2 px-2 py-1.5 rounded bg-bg">
                <span className="text-green-400 text-xs mt-0.5 shrink-0">✓</span>
                <span className="text-xs text-dim leading-snug line-clamp-2">{item.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// CENTER: 생성된 콘텐츠 에디터
export function ContentCenterPanel({ agentId }: { agentId: string }) {
  const { data: feed = [] } = useQuery({
    queryKey: ['bot-feed', agentId],
    queryFn: () => feedApi.list({ limit: 10 }),
    select: (data: FeedItem[]) => data.filter(f => f.agent_id === agentId && f.type === 'result'),
    refetchInterval: 3000,
  })

  const latest = feed[0]

  if (!latest) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
      <FileText size={36} className="text-muted/30" />
      <p className="text-sm text-muted">하단 입력창에서 콘텐츠 생성을 지시하세요</p>
      <p className="text-xs text-muted/60">"AI 트렌드 블로그 포스트 써줘" 등</p>
    </div>
  )

  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs text-muted">
          {new Date(latest.created_at).toLocaleString('ko-KR')}
        </span>
      </div>
      <div className="prose prose-invert max-w-none">
        <div className="text-sm text-dim leading-relaxed whitespace-pre-wrap">
          {latest.content}
        </div>
      </div>
      {feed.length > 1 && (
        <div className="mt-8 border-t border-border pt-6 space-y-4">
          <p className="text-xs text-muted uppercase tracking-widest">이전 결과</p>
          {feed.slice(1).map(item => (
            <div key={item.id} className="bg-bg rounded-lg border border-border p-4">
              <p className="text-xs text-muted mb-2">
                {new Date(item.created_at).toLocaleString('ko-KR')}
              </p>
              <p className="text-sm text-dim leading-relaxed line-clamp-3">{item.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// RIGHT: 발행 옵션 + 다음봇
export function ContentRightPanel({ agentId, nextBotName, onNextBot }: {
  agentId: string
  nextBotName?: string
  onNextBot?: () => void
}) {
  const [copied, setCopied] = useState(false)
  const { data: feed = [] } = useQuery({
    queryKey: ['bot-feed', agentId],
    queryFn: () => feedApi.list({ limit: 5 }),
    select: (data: FeedItem[]) => data.filter(f => f.agent_id === agentId && f.type === 'result'),
    refetchInterval: 3000,
  })
  const latest = feed[0]

  const handleCopy = async () => {
    if (!latest) return
    await navigator.clipboard.writeText(latest.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-4 h-full flex flex-col gap-4">
      <div>
        <p className="text-xs text-muted uppercase tracking-widest mb-3">내보내기</p>
        <div className="space-y-2">
          <button
            onClick={handleCopy}
            disabled={!latest}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-border text-dim hover:border-primary/40 hover:text-text transition-colors disabled:opacity-40"
          >
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            <span className="text-sm">{copied ? '복사됨!' : '클립보드 복사'}</span>
          </button>
          {['Notion에 저장', '이메일로 보내기', '슬랙 공유'].map(label => (
            <button
              key={label}
              disabled={!latest}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-border text-dim hover:border-primary/40 hover:text-text transition-colors disabled:opacity-40"
            >
              <span className="text-sm">{label}</span>
            </button>
          ))}
        </div>
      </div>
      {nextBotName && (
        <div className="mt-auto pt-3 border-t border-border">
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
