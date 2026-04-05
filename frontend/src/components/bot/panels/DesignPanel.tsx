
import { useQuery } from '@tanstack/react-query'
import { feedApi, type FeedItem } from '../../../lib/api'
import { ChevronRight, Palette, Layout } from 'lucide-react'
import { cn } from '../../../lib/utils'

const TEMPLATES = [
  { key: 'landing', label: '랜딩 히어로', emoji: '🏠' },
  { key: 'dashboard', label: '대시보드 UI', emoji: '📊' },
  { key: 'mobile', label: '모바일 스크린', emoji: '📱' },
  { key: 'email', label: '이메일 템플릿', emoji: '📧' },
  { key: 'social', label: '소셜 카드', emoji: '🃏' },
]

// LEFT: 템플릿 선택
export function DesignLeftPanel({ selectedTemplate, onTemplateChange }: {
  selectedTemplate: string
  onTemplateChange: (t: string) => void
}) {
  return (
    <div className="p-4 space-y-5">
      <div>
        <p className="text-xs text-muted uppercase tracking-widest mb-3">템플릿</p>
        <div className="space-y-1.5">
          {TEMPLATES.map(t => (
            <button
              key={t.key}
              onClick={() => onTemplateChange(t.key)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
                selectedTemplate === t.key
                  ? 'bg-primary/10 border border-primary/40 text-text'
                  : 'hover:bg-surface text-dim'
              )}
            >
              <span className="text-base">{t.emoji}</span>
              <span className="text-sm">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs text-muted uppercase tracking-widest mb-3">디자인 도구</p>
        <div className="space-y-2">
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border text-dim hover:border-primary/40 hover:text-text transition-colors">
            <Layout size={14} />
            <span className="text-sm">Pencil.dev 열기</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// CENTER: 생성된 디자인 출력
export function DesignCenterPanel({ agentId }: { agentId: string }) {
  const { data: feed = [] } = useQuery({
    queryKey: ['bot-feed', agentId],
    queryFn: () => feedApi.list({ limit: 10 }),
    select: (data: FeedItem[]) => data.filter(f => f.agent_id === agentId && f.type === 'result'),
    refetchInterval: 3000,
  })

  const latest = feed[0]

  if (!latest) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
      <Palette size={36} className="text-muted/30" />
      <p className="text-sm text-muted">하단 입력창에서 디자인을 지시하세요</p>
      <p className="text-xs text-muted/60">"다크 테마 랜딩 히어로 섹션 디자인해줘" 등</p>
    </div>
  )

  return (
    <div className="h-full overflow-y-auto p-5">
      <p className="text-xs text-muted mb-4">
        {new Date(latest.created_at).toLocaleString('ko-KR')}
      </p>
      <div className="text-sm text-dim leading-relaxed whitespace-pre-wrap">
        {latest.content}
      </div>
    </div>
  )
}

// RIGHT: 내보내기 + 다음봇
export function DesignRightPanel({ nextBotName, onNextBot }: {
  agentId?: string
  nextBotName?: string
  onNextBot?: () => void
}) {
  return (
    <div className="p-4 h-full flex flex-col gap-4">
      <div className="flex-1">
        <p className="text-xs text-muted uppercase tracking-widest mb-3">내보내기</p>
        <div className="space-y-2">
          {['PNG 내보내기', 'Figma 복사', 'CSS 코드 추출'].map(label => (
            <button
              key={label}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-border text-dim hover:border-primary/40 hover:text-text transition-colors"
            >
              <span className="text-sm">{label}</span>
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
