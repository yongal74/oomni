import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { researchApi, type ResearchItem } from '../../../lib/api'
import { Check, Eye, X, FileText, Copy, Upload, Download } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { ArchiveButton } from '../shared/ArchiveButton'
import { NextBotDropdown } from '../shared/NextBotDropdown'

interface Props {
  missionId: string
  onItemClick?: (item: ResearchItem) => void
  streamOutput?: string
  isRunning?: boolean
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
export function ResearchCenterPanel({ missionId, onItemClick, streamOutput, isRunning }: Props) {
  const [selectedItem, setSelectedItem] = useState<ResearchItem | null>(null)
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
    <div className="flex items-center justify-center h-full text-muted text-sm">
      로딩 중...
    </div>
  )

  if (isRunning) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-surface shrink-0">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-sm text-muted">리서치 중...</span>
        </div>
        <div className="h-full overflow-y-auto p-5">
          <pre className="text-sm text-dim leading-relaxed whitespace-pre-wrap font-sans">{streamOutput || ''}</pre>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    if (streamOutput) {
      return (
        <div className="h-full overflow-y-auto p-5">
          <p className="text-xs text-muted mb-3 uppercase tracking-widest">마지막 실행 결과</p>
          <pre className="text-sm text-dim leading-relaxed whitespace-pre-wrap font-sans">{streamOutput}</pre>
        </div>
      )
    }
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
        <div className="text-3xl opacity-30">🔬</div>
        <p className="text-sm text-muted">하단 입력창에서 리서치를 시작하세요</p>
        <p className="text-xs text-muted/60">"오늘 AI 트렌드 수집해줘" 라고 입력해보세요</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {pending.length > 0 && (
        <div>
          <p className="text-xs text-muted uppercase tracking-widest mb-3">
            소팅 필요 ({pending.length})
          </p>
          <div className="space-y-2">
            {pending.map(item => (
              <ResearchCard
                key={item.id}
                item={item}
                onFilter={(decision) => filter.mutate({ id: item.id, decision })}
                onClick={() => { setSelectedItem(item); onItemClick?.(item) }}
                isSelected={selectedItem?.id === item.id}
              />
            ))}
          </div>
        </div>
      )}

      {kept.length > 0 && (
        <div>
          <p className="text-xs text-muted uppercase tracking-widest mb-3">
            보관됨 ({kept.length})
          </p>
          <div className="space-y-2">
            {kept.map(item => (
              <ResearchCard
                key={item.id}
                item={item}
                onFilter={(decision) => filter.mutate({ id: item.id, decision })}
                onClick={() => { setSelectedItem(item); onItemClick?.(item) }}
                dimmed
                isSelected={selectedItem?.id === item.id}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ResearchCard({
  item, onFilter, onClick, dimmed, isSelected
}: {
  item: ResearchItem
  onFilter: (d: 'keep' | 'drop' | 'watch') => void
  onClick: () => void
  dimmed?: boolean
  isSelected?: boolean
}) {
  const score = item.signal_score ?? 0
  const scoreColor = score >= 70 ? 'text-green-400' : score >= 40 ? 'text-yellow-400' : 'text-red-400'
  const barWidth = `${score}%`

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-lg border p-3 cursor-pointer hover:border-primary/40 transition-colors',
        isSelected ? 'border-primary bg-primary/10' : 'border-border',
        dimmed && !isSelected ? 'bg-bg/50 opacity-60' : !isSelected ? 'bg-bg' : ''
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className={cn('text-sm font-medium text-text leading-snug', dimmed && 'text-dim')}>
          {item.title}
        </span>
        <span className={cn('text-xs font-mono shrink-0', scoreColor)}>{score}</span>
      </div>

      {/* 신호강도 바 */}
      <div className="h-0.5 bg-border rounded-full mb-2.5">
        <div
          className={cn('h-full rounded-full transition-all', score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-500')}
          style={{ width: barWidth }}
        />
      </div>

      {item.summary && (
        <p className="text-xs text-muted leading-relaxed mb-2.5 line-clamp-2">{item.summary}</p>
      )}

      {item.filter_decision === 'pending' && (
        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); onFilter('keep') }}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
          >
            <Check size={10} /> keep
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onFilter('watch') }}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-colors"
          >
            <Eye size={10} /> watch
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onFilter('drop') }}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
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
export function ResearchRightPanel({ item, onSkillSelect, agentId, onFileUpload }: {
  item: ResearchItem | null
  nextBotName?: string
  onNextBot?: () => void
  onSkillSelect?: (prompt: string) => void
  agentId?: string
  onFileUpload?: (content: string, filename: string) => void
}) {
  // 산출물별 개별 로딩 + 결과 관리
  const [convertingType, setConvertingType] = useState<string | null>(null)
  const [outputs, setOutputs] = useState<Record<string, string>>({})
  const [expandedType, setExpandedType] = useState<string | null>(null)
  // 아이템 변경 시 변환 결과 초기화 (LinkedIn 연속 포스팅 등)
  useEffect(() => {
    setOutputs({})
    setExpandedType(null)
    setConvertingType(null)
  }, [item?.id])

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleConvert = async (outputType: string) => {
    if (!item || convertingType) return
    setConvertingType(outputType)
    try {
      const result = await researchApi.convert(item.id, outputType)
      setOutputs(prev => ({ ...prev, [outputType]: result.content }))
      setExpandedType(outputType)
    } finally {
      setConvertingType(null)
    }
  }

  const handleDownload = (type: string, content: string) => {
    const typeLabels: Record<string, string> = {
      linkedin: 'linkedin', blog: 'blog', newsletter: 'newsletter',
      report: 'report', prd: 'prd', ppt: 'ppt', action_plan: 'action_plan',
    }
    const filename = `${item?.title?.slice(0, 30).replace(/[^\w가-힣]/g, '_') ?? 'output'}_${typeLabels[type] ?? type}.md`
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  const handleFileRead = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = reader.result as string
      onFileUpload?.(text, file.name)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  if (!item) return (
    <div className="p-4 h-full flex flex-col gap-4">
      <div>
        <p className="text-xs text-muted uppercase tracking-widest mb-2.5">빠른 실행</p>
        <div className="flex flex-wrap gap-1.5">
          {RESEARCH_SKILLS.map(skill => (
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
      {onFileUpload && (
        <div>
          <p className="text-xs text-muted uppercase tracking-widest mb-2">파일 업로드</p>
          <input ref={fileInputRef} type="file" accept=".txt,.md,.pdf,.docx,.csv" className="hidden" onChange={handleFileRead} />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border text-xs text-muted hover:border-primary/40 hover:text-primary w-full transition-colors"
          >
            <Upload size={12} /> 파일을 업로드하여 리서치 분석
          </button>
        </div>
      )}
      <div className="flex-1 flex items-center justify-center">
        <p className="text-xs text-muted/60 text-center">좌측 아이템 클릭 시<br />변환 옵션이 표시됩니다</p>
      </div>
      {agentId && (
        <div className="border-t border-border pt-4">
          <NextBotDropdown currentAgentId={agentId} currentRole="research" />
        </div>
      )}
    </div>
  )

  return (
    <div className="p-4 h-full overflow-y-auto space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-text mb-1 leading-snug">{item.title}</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">신호강도</span>
          <span className="text-xs text-primary font-mono">{item.signal_score}</span>
        </div>
      </div>

      {item.summary && (
        <div>
          <p className="text-xs text-muted uppercase tracking-widest mb-1.5">요약</p>
          <p className="text-sm text-dim leading-relaxed">{item.summary}</p>
        </div>
      )}

      {item.source_url && (
        <a
          href={item.source_url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-xs text-primary/70 hover:text-primary transition-colors"
        >
          <FileText size={11} /> 원문 보기
        </a>
      )}

      <div>
        <p className="text-xs text-muted uppercase tracking-widest mb-2">산출물로 변환</p>
        <div className="space-y-1.5">
          {[
            { type: 'linkedin', label: '💼 LinkedIn 포스트' },
            { type: 'blog', label: '📝 블로그 포스트' },
            { type: 'newsletter', label: '📧 뉴스레터' },
            { type: 'report', label: '📊 분석 리포트' },
            { type: 'prd', label: '📋 PRD (기획서)' },
            { type: 'ppt', label: '🎤 PPT 스크립트' },
            { type: 'action_plan', label: '✅ 액션 플랜' },
          ].map(({ type, label }) => (
            <div key={type}>
              <button
                onClick={() => outputs[type] ? setExpandedType(expandedType === type ? null : type) : handleConvert(type)}
                disabled={convertingType !== null && convertingType !== type}
                className="w-full text-left px-3 py-2 rounded border border-border text-sm text-dim hover:border-primary/40 hover:text-text transition-colors disabled:opacity-40 flex items-center justify-between"
              >
                <span>{convertingType === type ? '⏳ 변환 중...' : label}</span>
                {outputs[type] && (
                  <span className="text-xs text-primary/60">{expandedType === type ? '▲' : '▼'}</span>
                )}
              </button>

              {expandedType === type && outputs[type] && (
                <div className="mt-1 bg-bg rounded-lg border border-border p-3 relative">
                  <div className="flex items-center gap-1.5 absolute top-2 right-2">
                    <button
                      onClick={() => navigator.clipboard.writeText(outputs[type])}
                      className="text-muted hover:text-text p-1 rounded hover:bg-border/30"
                      title="클립보드 복사"
                    >
                      <Copy size={12} />
                    </button>
                    <button
                      onClick={() => handleDownload(type, outputs[type])}
                      className="text-muted hover:text-text p-1 rounded hover:bg-border/30"
                      title="파일 저장"
                    >
                      <Download size={12} />
                    </button>
                  </div>
                  <p className="text-xs text-dim leading-relaxed whitespace-pre-wrap pr-12 max-h-48 overflow-y-auto">{outputs[type]}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {Object.keys(outputs).length > 0 && (
        <ArchiveButton
          content={outputs[expandedType ?? Object.keys(outputs)[0]] ?? ''}
          title={item?.title}
          botRole="research"
          tags={['OOMNI', 'research', ...(item?.tags ? (Array.isArray(item.tags) ? item.tags : []) : [])]}
        />
      )}

      {/* 빠른 실행 */}
      <div>
        <p className="text-xs text-muted uppercase tracking-widest mb-2.5">빠른 실행</p>
        <div className="flex flex-wrap gap-1.5">
          {RESEARCH_SKILLS.map(skill => (
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

      {onFileUpload && (
        <div>
          <p className="text-xs text-muted uppercase tracking-widest mb-2">파일 업로드</p>
          <input ref={fileInputRef} type="file" accept=".txt,.md,.pdf,.docx,.csv" className="hidden" onChange={handleFileRead} />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border text-xs text-muted hover:border-primary/40 hover:text-primary w-full transition-colors"
          >
            <Upload size={12} /> 파일을 업로드하여 리서치 분석
          </button>
        </div>
      )}

      {agentId && (
        <div className="pt-2 border-t border-border">
          <NextBotDropdown currentAgentId={agentId} currentRole="research" content={(expandedType ? outputs[expandedType] : undefined) || item?.summary || ''} />
        </div>
      )}
    </div>
  )
}
