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
    <div className="flex items-center gap-0 px-6 py-4 border-b border-border bg-surface overflow-x-auto">
      {stages.map((stage, i) => {
        const isDone = currentIdx > i
        const isActive = currentStage === stage.key
        return (
          <div key={stage.key} className="flex items-center shrink-0">
            <div className="flex items-center gap-2.5">
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                isDone ? 'bg-primary text-white shadow-sm' :
                isActive ? 'bg-primary/20 border-2 border-primary text-primary' :
                'bg-border/60 text-muted border border-border'
              )}>
                {isDone ? '✓' : i + 1}
              </div>
              <div className="flex flex-col">
                <span className={cn(
                  'text-sm font-medium transition-colors whitespace-nowrap',
                  isDone ? 'text-text' :
                  isActive ? 'text-primary' :
                  'text-muted'
                )}>
                  {stage.label}
                </span>
                {isActive && (
                  <span className="text-xs text-primary/60 animate-pulse">진행 중...</span>
                )}
              </div>
            </div>
            {i < stages.length - 1 && (
              <div className={cn(
                'w-10 h-px mx-4 transition-colors',
                isDone ? 'bg-primary/60' : 'bg-border'
              )} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// 역할별 파이프라인 단계 정의 (5~6단계)
export const ROLE_STAGES: Record<string, Stage[]> = {
  research: [
    { key: 'collecting', label: '소스 수집' },
    { key: 'fetching', label: '콘텐츠 가져오기' },
    { key: 'scoring', label: 'AI 신호 채점' },
    { key: 'sorting', label: '사람 소팅' },
    { key: 'converting', label: '산출물 변환' },
    { key: 'done', label: '완료' },
  ],
  content: [
    { key: 'preparing', label: '리서치 연결' },
    { key: 'outlining', label: '아웃라인 작성' },
    { key: 'writing', label: 'AI 초안 생성' },
    { key: 'editing', label: '검토 및 편집' },
    { key: 'publishing', label: '발행 준비' },
    { key: 'done', label: '완료' },
  ],
  build: [
    { key: 'planning', label: '요구사항 분석' },
    { key: 'designing', label: '설계' },
    { key: 'coding', label: '코드 생성' },
    { key: 'testing', label: '테스트' },
    { key: 'review', label: '코드 리뷰' },
    { key: 'done', label: '완료' },
  ],
  growth: [
    { key: 'collecting', label: '데이터 수집' },
    { key: 'segmenting', label: '세그먼트 분석' },
    { key: 'analyzing', label: 'AI 인사이트' },
    { key: 'planning', label: '캠페인 기획' },
    { key: 'executing', label: '실행' },
    { key: 'done', label: '성과 측정' },
  ],
  ops: [
    { key: 'monitoring', label: '현황 모니터링' },
    { key: 'analyzing', label: '문제 분석' },
    { key: 'generating_workflow', label: '자동화 워크플로우 생성' },
    { key: 'deploying', label: '배포 및 활성화' },
    { key: 'verifying', label: '검증' },
    { key: 'done', label: '완료' },
  ],
  ceo: [
    { key: 'aggregating', label: '봇 현황 수집' },
    { key: 'analyzing', label: '데이터 분석' },
    { key: 'briefing', label: 'CEO 브리핑 작성' },
    { key: 'prioritizing', label: '우선순위 결정' },
    { key: 'reporting', label: '보고 및 지시' },
    { key: 'done', label: '완료' },
  ],
  design: [
    { key: 'briefing', label: '디자인 브리핑' },
    { key: 'planning', label: '레이아웃 기획' },
    { key: 'generating', label: 'AI 디자인 생성' },
    { key: 'review', label: '검토' },
    { key: 'exporting', label: '내보내기' },
    { key: 'done', label: '완료' },
  ],
  default: [
    { key: 'preparing', label: '준비' },
    { key: 'analyzing', label: '분석' },
    { key: 'running', label: '실행' },
    { key: 'review', label: '검토' },
    { key: 'finalizing', label: '마무리' },
    { key: 'done', label: '완료' },
  ],
}
