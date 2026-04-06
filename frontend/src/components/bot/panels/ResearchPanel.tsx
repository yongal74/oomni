import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { researchApi, type ResearchItem } from '../../../lib/api'
import { Check, Eye, X, ChevronRight, FileText } from 'lucide-react'
import { cn } from '../../../lib/utils'

interface Props {
  missionId: string
  onItemClick?: (item: ResearchItem) => void
}

const DEFAULT_SOURCES = [
  { label: 'TechCrunch', emoji: '📰' },
  { label: 'Product Hunt', emoji: '🚀' },
  { label: 'Hacker News', emoji: '🔶' },
  { label: 'YouTube 최신', emoji: '▶️' },
  { label: 'Reddit r/artificial', emoji: '🤖' },
  { label: 'Reddit r/startups', emoji: '💼' },
]
const DEFAULT_KEYWORDS = ['AI startup', 'Claude API', 'SaaS growth']

const STORAGE_KEY_SOURCES = 'oomni_research_sources'
const STORAGE_KEY_KEYWORDS = 'oomni_research_keywords'

function loadFromStorage<T>(key: string, defaultVal: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? '') } catch { return defaultVal }
}

// LEFT: 소스 설정 패널 (Research Bot 전용)
export function ResearchLeftPanel({ missionId: _missionId }: { missionId: string }) {
  const [sources, setSources] = useState<Array<{ label: string; emoji: string }>>(
    () => loadFromStorage(STORAGE_KEY_SOURCES, DEFAULT_SOURCES)
  )
  const [keywords, setKeywords] = useState<string[]>(
    () => loadFromStorage(STORAGE_KEY_KEYWORDS, DEFAULT_KEYWORDS)
  )
  const [newSource, setNewSource] = useState('')
  const [newKeyword, setNewKeyword] = useState('')
  const [showSourceInput, setShowSourceInput] = useState(false)
  const [showKeywordInput, setShowKeywordInput] = useState(false)

  const saveAndSetSources = (next: typeof sources) => {
    setSources(next)
    localStorage.setItem(STORAGE_KEY_SOURCES, JSON.stringify(next))
  }
  const saveAndSetKeywords = (next: string[]) => {
    setKeywords(next)
    localStorage.setItem(STORAGE_KEY_KEYWORDS, JSON.stringify(next))
  }

  const addSource = () => {
    if (!newSource.trim()) return
    saveAndSetSources([...sources, { label: newSource.trim(), emoji: '📡' }])
    setNewSource('')
    setShowSourceInput(false)
  }

  const addKeyword = () => {
    if (!newKeyword.trim()) return
    saveAndSetKeywords([...keywords, newKeyword.trim()])
    setNewKeyword('')
    setShowKeywordInput(false)
  }

  return (
    <div className="p-4 space-y-5">
      <div>
        <p className="text-xs text-muted uppercase tracking-widest mb-3">수집 소스</p>
        <div className="space-y-1.5">
          {sources.map((s, i) => (
            <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-bg hover:bg-border/20 group transition-colors">
              <div className="flex items-center gap-2">
                <span className="text-sm">{s.emoji}</span>
                <span className="text-sm text-dim">{s.label}</span>
              </div>
              <button
                onClick={() => saveAndSetSources(sources.filter((_, j) => j !== i))}
                className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-400 transition-all"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>

        {showSourceInput ? (
          <div className="mt-2 flex gap-2">
            <input
              autoFocus
              value={newSource}
              onChange={e => setNewSource(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addSource(); if (e.key === 'Escape') setShowSourceInput(false) }}
              placeholder="소스 이름..."
              className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-muted/60 focus:outline-none focus:border-primary/60"
            />
            <button onClick={addSource} className="px-3 py-2 bg-primary/10 text-primary rounded-lg text-sm hover:bg-primary/20 transition-colors">추가</button>
          </div>
        ) : (
          <button
            onClick={() => setShowSourceInput(true)}
            className="mt-2 text-sm text-muted hover:text-primary transition-colors flex items-center gap-1.5"
          >
            + 소스 추가
          </button>
        )}
      </div>

      <div>
        <p className="text-xs text-muted uppercase tracking-widest mb-3">키워드</p>
        <div className="space-y-1.5">
          {keywords.map((k, i) => (
            <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-bg hover:bg-border/20 group transition-colors">
              <span className="text-sm text-dim">{k}</span>
              <button
                onClick={() => saveAndSetKeywords(keywords.filter((_, j) => j !== i))}
                className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-400 transition-all"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>

        {showKeywordInput ? (
          <div className="mt-2 flex gap-2">
            <input
              autoFocus
              value={newKeyword}
              onChange={e => setNewKeyword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addKeyword(); if (e.key === 'Escape') setShowKeywordInput(false) }}
              placeholder="키워드..."
              className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-muted/60 focus:outline-none focus:border-primary/60"
            />
            <button onClick={addKeyword} className="px-3 py-2 bg-primary/10 text-primary rounded-lg text-sm hover:bg-primary/20 transition-colors">추가</button>
          </div>
        ) : (
          <button
            onClick={() => setShowKeywordInput(true)}
            className="mt-2 text-sm text-muted hover:text-primary transition-colors flex items-center gap-1.5"
          >
            + 키워드 추가
          </button>
        )}
      </div>
    </div>
  )
}

// CENTER: AI 채점된 아이템 소팅 공간
export function ResearchCenterPanel({ missionId, onItemClick }: Props) {
  const qc = useQueryClient()
  const { data: items = [], isLoading } = useQuery<ResearchItem[]>({
    queryKey: ['research', missionId],
    queryFn: () => researchApi.list(missionId),
    enabled: !!missionId,
    refetchInterval: 5000,
  })

  const filter = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'keep' | 'drop' | 'watch' }) =>
      researchApi.filter(id, decision),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['research', missionId] }),
  })

  const pending = items.filter(i => i.filter_decision === 'pending')
  const kept = items.filter(i => i.filter_decision === 'keep')

  if (isLoading) return (
    <div className="flex items-center justify-center h-full text-muted text-[13px]">
      로딩 중...
    </div>
  )

  if (items.length === 0) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
      <div className="text-3xl opacity-30">🔬</div>
      <p className="text-[13px] text-muted">하단 입력창에서 리서치를 시작하세요</p>
      <p className="text-[11px] text-muted/60">"오늘 AI 트렌드 수집해줘" 라고 입력해보세요</p>
    </div>
  )

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {pending.length > 0 && (
        <div>
          <p className="text-[10px] text-muted uppercase tracking-widest mb-3">
            소팅 필요 ({pending.length})
          </p>
          <div className="space-y-2">
            {pending.map(item => (
              <ResearchCard
                key={item.id}
                item={item}
                onFilter={(decision) => filter.mutate({ id: item.id, decision })}
                onClick={() => onItemClick?.(item)}
              />
            ))}
          </div>
        </div>
      )}

      {kept.length > 0 && (
        <div>
          <p className="text-[10px] text-muted uppercase tracking-widest mb-3">
            보관됨 ({kept.length})
          </p>
          <div className="space-y-2">
            {kept.map(item => (
              <ResearchCard
                key={item.id}
                item={item}
                onFilter={(decision) => filter.mutate({ id: item.id, decision })}
                onClick={() => onItemClick?.(item)}
                dimmed
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ResearchCard({
  item, onFilter, onClick, dimmed
}: {
  item: ResearchItem
  onFilter: (d: 'keep' | 'drop' | 'watch') => void
  onClick: () => void
  dimmed?: boolean
}) {
  const score = item.signal_score ?? 0
  const scoreColor = score >= 70 ? 'text-green-400' : score >= 40 ? 'text-yellow-400' : 'text-red-400'
  const barWidth = `${score}%`

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-lg border border-border p-3 cursor-pointer hover:border-primary/40 transition-colors',
        dimmed ? 'bg-bg/50 opacity-60' : 'bg-bg'
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className={cn('text-[12px] font-medium text-text leading-snug', dimmed && 'text-dim')}>
          {item.title}
        </span>
        <span className={cn('text-[11px] font-mono shrink-0', scoreColor)}>{score}</span>
      </div>

      {/* 신호강도 바 */}
      <div className="h-0.5 bg-border rounded-full mb-2.5">
        <div
          className={cn('h-full rounded-full transition-all', score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-500')}
          style={{ width: barWidth }}
        />
      </div>

      {item.summary && (
        <p className="text-[11px] text-muted leading-relaxed mb-2.5 line-clamp-2">{item.summary}</p>
      )}

      {item.filter_decision === 'pending' && (
        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); onFilter('keep') }}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
          >
            <Check size={10} /> keep
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onFilter('watch') }}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-colors"
          >
            <Eye size={10} /> watch
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onFilter('drop') }}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
          >
            <X size={10} /> drop
          </button>
        </div>
      )}
    </div>
  )
}

const RESEARCH_SKILLS = [
  { label: 'AI 트렌드 수집', prompt: '/collect 이번 주 AI/스타트업 트렌드 수집하고 신호강도 채점해줘' },
  { label: '경쟁사 분석', prompt: '/collect 주요 경쟁 서비스 분석 리포트 작성해줘' },
  { label: '신호강도 채점', prompt: '/score 수집된 리서치 아이템들을 신호강도 0-100으로 채점해줘' },
  { label: '보고서 변환', prompt: '/convert-report 리서치 결과를 구조화된 인사이트 보고서로 변환해줘' },
  { label: '주간 다이제스트', prompt: '/weekly-digest 이번 주 리서치 결과를 요약한 주간 다이제스트를 작성해줘' },
]

// RIGHT: 클릭한 아이템 상세 + 다음봇 연결
export function ResearchRightPanel({ item, nextBotName, onNextBot, onSkillSelect }: {
  item: ResearchItem | null
  nextBotName?: string
  onNextBot?: () => void
  onSkillSelect?: (prompt: string) => void
}) {
  const [converting, setConverting] = useState(false)
  const [output, setOutput] = useState('')

  const handleConvert = async (outputType: string) => {
    if (!item) return
    setConverting(true)
    try {
      const result = await researchApi.convert(item.id, outputType)
      setOutput(result.content)
    } finally {
      setConverting(false)
    }
  }

  if (!item) return (
    <div className="flex items-center justify-center h-full px-4 text-center">
      <p className="text-[12px] text-muted">아이템을 클릭하면<br />상세 내용이 표시됩니다</p>
    </div>
  )

  return (
    <div className="p-4 h-full overflow-y-auto space-y-4">
      <div>
        <h3 className="text-[13px] font-semibold text-text mb-1 leading-snug">{item.title}</h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted">신호강도</span>
          <span className="text-[11px] text-primary font-mono">{item.signal_score}</span>
        </div>
      </div>

      {item.summary && (
        <div>
          <p className="text-[10px] text-muted uppercase tracking-widest mb-1.5">요약</p>
          <p className="text-[12px] text-dim leading-relaxed">{item.summary}</p>
        </div>
      )}

      {item.source_url && (
        <a
          href={item.source_url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-[11px] text-primary/70 hover:text-primary transition-colors"
        >
          <FileText size={11} /> 원문 보기
        </a>
      )}

      <div>
        <p className="text-[10px] text-muted uppercase tracking-widest mb-2">산출물로 변환</p>
        <div className="space-y-1.5">
          {['trend_report', 'action_plan', 'newsletter'].map(type => (
            <button
              key={type}
              onClick={() => handleConvert(type)}
              disabled={converting}
              className="w-full text-left px-3 py-2 rounded border border-border text-[12px] text-dim hover:border-primary/40 hover:text-text transition-colors"
            >
              {type === 'trend_report' ? '트렌드 리포트' :
               type === 'action_plan' ? '액션 플랜' : '뉴스레터'}
            </button>
          ))}
        </div>
      </div>

      {output && (
        <div className="bg-bg rounded-lg border border-border p-3">
          <p className="text-[11px] text-dim leading-relaxed whitespace-pre-wrap">{output}</p>
        </div>
      )}

      {/* 빠른 실행 */}
      <div>
        <p className="text-[10px] text-muted uppercase tracking-widest mb-2.5">빠른 실행</p>
        <div className="flex flex-wrap gap-1.5">
          {RESEARCH_SKILLS.map(skill => (
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
        <div className="pt-2 border-t border-border">
          <button
            onClick={onNextBot}
            className="w-full flex items-center justify-between px-3 py-2 rounded border border-primary/30 text-primary hover:bg-primary/5 transition-colors"
          >
            <span className="text-[12px]">{nextBotName}으로 이어서</span>
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
