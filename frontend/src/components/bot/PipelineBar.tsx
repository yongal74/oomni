import { cn } from '../../lib/utils'

interface Stage {
  key: string
  label: string
}

interface Props {
  stages: Stage[]
  currentStage: string | null
}

export function PipelineBar({ stages, currentStage }: Props) {
  const currentIdx = stages.findIndex(s => s.key === currentStage)

  return (
    <div className="flex items-center gap-0 px-6 py-3 border-b border-border bg-surface">
      {stages.map((stage, i) => {
        const isDone = currentIdx > i
        const isActive = currentStage === stage.key
        return (
          <div key={stage.key} className="flex items-center">
            <div className="flex items-center gap-2">
              <div className={cn(
                'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold transition-colors',
                isDone ? 'bg-primary text-white' :
                isActive ? 'bg-primary/20 border border-primary text-primary' :
                'bg-border text-muted'
              )}>
                {isDone ? '✓' : i + 1}
              </div>
              <span className={cn(
                'text-[12px] transition-colors',
                isDone ? 'text-text' :
                isActive ? 'text-primary font-medium' :
                'text-muted'
              )}>
                {stage.label}
              </span>
            </div>
            {i < stages.length - 1 && (
              <div className={cn(
                'w-8 h-px mx-3 transition-colors',
                isDone ? 'bg-primary/50' : 'bg-border'
              )} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// 역할별 파이프라인 단계 정의
export const ROLE_STAGES: Record<string, Stage[]> = {
  research: [
    { key: 'collecting', label: '소스 수집' },
    { key: 'scoring', label: 'AI 채점' },
    { key: 'sorting', label: '사람 소팅' },
    { key: 'done', label: '산출물 생성' },
  ],
  content: [
    { key: 'preparing', label: '주제 선택' },
    { key: 'writing', label: '초안 생성' },
    { key: 'editing', label: '편집' },
    { key: 'done', label: '발행' },
  ],
  build: [
    { key: 'planning', label: '기획' },
    { key: 'coding', label: '개발' },
    { key: 'review', label: '리뷰' },
    { key: 'done', label: '완료' },
  ],
  growth: [
    { key: 'collecting', label: '데이터 수집' },
    { key: 'analyzing', label: 'AI 분석' },
    { key: 'executing', label: '실행' },
    { key: 'done', label: '성과 측정' },
  ],
  ops: [
    { key: 'analyzing', label: '현황 분석' },
    { key: 'generating_workflow', label: '자동화 생성' },
    { key: 'deploying', label: '배포' },
    { key: 'done', label: '완료' },
  ],
  ceo: [
    { key: 'aggregating', label: '현황 수집' },
    { key: 'briefing', label: '종합 분석' },
    { key: 'reporting', label: '브리핑' },
    { key: 'done', label: '의사결정' },
  ],
  design: [
    { key: 'planning', label: '기획' },
    { key: 'generating', label: '생성' },
    { key: 'review', label: '검토' },
    { key: 'done', label: '확정' },
  ],
  default: [
    { key: 'preparing', label: '준비' },
    { key: 'running', label: '실행' },
    { key: 'review', label: '검토' },
    { key: 'done', label: '완료' },
  ],
}
