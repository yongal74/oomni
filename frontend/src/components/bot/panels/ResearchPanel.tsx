import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { researchApi, type ResearchItem } from '../../../lib/api'
import { Check, Eye, X, FileText, Copy, Upload, Download } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { ArchiveButton } from '../shared/ArchiveButton'
import { NextBotDropdown } from '../shared/NextBotDropdown'

// ── 트랙 타입 ──────────────────────────────────────────────────────────────
type ResearchTrack = 'business' | 'informational'

// ── Props ─────────────────────────────────────────────────────────────────
interface Props {
  missionId: string
  onItemClick?: (item: ResearchItem) => void
  streamOutput?: string
  isRunning?: boolean
}

// ── 기본 소스/키워드 (트랙별) ─────────────────────────────────────────────
const DEFAULT_SOURCES_BUSINESS = [
  { label: 'Crunchbase', emoji: '🔴' },
  { label: 'TechCrunch M&A', emoji: '🔴' },
  { label: 'Bloomberg Tech', emoji: '🔴' },
  { label: 'CB Insights', emoji: '🔴' },
  { label: 'Product Hunt', emoji: '🟡' },
  { label: 'Hacker News (Show HN)', emoji: '🟡' },
  { label: 'AngelList', emoji: '🟡' },
  { label: 'Substack 비즈니스', emoji: '🟢' },
  { label: 'VC 블로그', emoji: '🟢' },
  { label: 'LinkedIn 업계 리포트', emoji: '🟢' },
]
const DEFAULT_SOURCES_INFORMATIONAL = [
  { label: 'arXiv 최신 논문', emoji: '🔴' },
  { label: 'GitHub 트렌딩', emoji: '🔴' },
  { label: 'Stack Overflow', emoji: '🔴' },
  { label: 'Reddit r/MachineLearning', emoji: '🟡' },
  { label: 'Hacker News', emoji: '🟡' },
  { label: 'DEV.to', emoji: '🟡' },
  { label: 'Medium 기술 블로그', emoji: '🟢' },
  { label: 'Anthropic/OpenAI 블로그', emoji: '🟢' },
  { label: 'YouTube 교육 채널', emoji: '🟢' },
  { label: 'Quora 질문', emoji: '🟢' },
]
const DEFAULT_KEYWORDS_BUSINESS = ['AI SaaS 수익화', 'M&A 트렌드', '스타트업 투자']
const DEFAULT_KEYWORDS_INFORMATIONAL = ['AI 기술 트렌드', '머신러닝 논문', '오픈소스 LLM']

// 사전 필터링 조건 (표시용)
const FILTER_CONDITIONS_BUSINESS = [
  'ROI/수익화 가능성이 명확한 신호',
  '경쟁사 움직임 또는 시장 구조 변화',
  '투자·M&A 관련 정보',
  '신규 비즈니스 모델 또는 수익 구조',
  'SaaS/플랫폼/마켓플레이스 성장 지표',
]
const FILTER_CONDITIONS_INFORMATIONAL = [
  '교육적 가치가 높고 독자에게 즉각 유용한 정보',
  '최신 기술·연구 논문·오픈소스 발표',
  '커뮤니티에서 활발히 논의되는 정보성 주제',
  '개념·방법론·도구 사용법 설명 가치',
  '일반인도 이해 가능한 주제',
]

// localStorage 키 (트랙별)
const SK = (track: ResearchTrack, type: 'sources' | 'keywords') =>
  `oomni_research_${track}_${type}`

function loadFromStorage<T>(key: string, defaultVal: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? '') } catch { return defaultVal }
}

// ── 스킬 버튼 데이터 ────────────────────────────────────────────────────────
const SKILLS_BUSINESS = [
  { label: '시장 기회 분석', prompt: '시장 규모·성장성·수익화 가능성 중심으로 사업성 리서치 수행해줘', highlight: false },
  { label: '🔴 경쟁사 동향', prompt: '주요 경쟁사 움직임과 M&A 트렌드 분석해줘', highlight: true },
  { label: '투자 트렌드', prompt: '최근 AI/스타트업 투자 트렌드와 주목받는 카테고리 분석해줘', highlight: false },
  { label: '수익성 신호', prompt: 'SaaS·플랫폼 수익화 성공 사례와 수익성 신호 수집해줘', highlight: false },
]
const SKILLS_INFORMATIONAL = [
  { label: 'AI 기술 트렌드', prompt: '최신 AI/ML 기술 트렌드와 연구 동향 수집해줘', highlight: false },
  { label: '🔴 논문 요약', prompt: '최신 arXiv·학술 논문 요약하고 정보성 리서치 수행해줘', highlight: true },
  { label: '오픈소스 동향', prompt: 'GitHub 트렌딩·오픈소스 프로젝트 동향 분석해줘', highlight: false },
  { label: '커뮤니티 인사이트', prompt: 'Reddit·Hacker News·DEV.to 커뮤니티 핫 토픽 수집해줘', highlight: false },
]

// ── LEFT 패널 ──────────────────────────────────────────────────────────────
export function ResearchLeftPanel({
  missionId: _missionId,
  activeTrack,
  onTrackChange,
  onRunWithTrack,
}: {
  missionId: string
  activeTrack: ResearchTrack
  onTrackChange: (track: ResearchTrack) => void
  onRunWithTrack: (track: ResearchTrack, prompt: string) => void
}) {
  const [sources, setSources] = useState<Array<{ label: string; emoji: string }>>(() =>
    loadFromStorage(SK(activeTrack, 'sources'),
      activeTrack === 'business' ? DEFAULT_SOURCES_BUSINESS : DEFAULT_SOURCES_INFORMATIONAL)
  )
  const [keywords, setKeywords] = useState<string[]>(() =>
    loadFromStorage(SK(activeTrack, 'keywords'),
      activeTrack === 'business' ? DEFAULT_KEYWORDS_BUSINESS : DEFAULT_KEYWORDS_INFORMATIONAL)
  )
  const [showFilters, setShowFilters] = useState(false)
  const [newSource, setNewSource] = useState('')
  const [newKeyword, setNewKeyword] = useState('')
  const [showSourceInput, setShowSourceInput] = useState(false)
  const [showKeywordInput, setShowKeywordInput] = useState(false)

  // 트랙 변경 시 소스/키워드 다시 로드
  useEffect(() => {
    setSources(loadFromStorage(SK(activeTrack, 'sources'),
      activeTrack === 'business' ? DEFAULT_SOURCES_BUSINESS : DEFAULT_SOURCES_INFORMATIONAL))
    setKeywords(loadFromStorage(SK(activeTrack, 'keywords'),
      activeTrack === 'business' ? DEFAULT_KEYWORDS_BUSINESS : DEFAULT_KEYWORDS_INFORMATIONAL))
    setShowSourceInput(false)
    setShowKeywordInput(false)
  }, [activeTrack])

  const saveSources = (next: typeof sources) => {
    setSources(next)
    localStorage.setItem(SK(activeTrack, 'sources'), JSON.stringify(next))
  }
  const saveKeywords = (next: string[]) => {
    setKeywords(next)
    localStorage.setItem(SK(activeTrack, 'keywords'), JSON.stringify(next))
  }

  const addSource = () => {
    if (!newSource.trim()) return
    saveSources([...sources, { label: newSource.trim(), emoji: '📡' }])
    setNewSource('')
    setShowSourceInput(false)
  }
  const addKeyword = () => {
    if (!newKeyword.trim()) return
    saveKeywords([...keywords, newKeyword.trim()])
    setNewKeyword('')
    setShowKeywordInput(false)
  }

  const filterConditions =
    activeTrack === 'business' ? FILTER_CONDITIONS_BUSINESS : FILTER_CONDITIONS_INFORMATIONAL

  const trackPrompt = activeTrack === 'business'
    ? keywords.join(', ') + ' 관련 사업성 리서치 수행해줘'
    : keywords.join(', ') + ' 관련 정보성 리서치 수행해줘'

  return (
    <div className="p-4 space-y-4">
      {/* 트랙 탭 */}
      <div className="flex rounded-lg bg-bg overflow-hidden border border-border">
        <button
          onClick={() => onTrackChange('business')}
          className={cn(
            'flex-1 py-2 text-xs font-medium transition-colors',
            activeTrack === 'business'
              ? 'bg-orange-500/15 text-orange-400 border-r border-border'
              : 'text-muted hover:text-text border-r border-border'
          )}
        >
          📊 사업성
        </button>
        <button
          onClick={() => onTrackChange('informational')}
          className={cn(
            'flex-1 py-2 text-xs font-medium transition-colors',
            activeTrack === 'informational'
              ? 'bg-blue-500/15 text-blue-400'
              : 'text-muted hover:text-text'
          )}
        >
          💡 정보성
        </button>
      </div>

      {/* 트랙 실행 버튼 */}
      <button
        onClick={() => onRunWithTrack(activeTrack, `__track:${activeTrack}__ ${trackPrompt}`)}
        className={cn(
          'w-full py-2 rounded-lg text-xs font-semibold transition-colors border',
          activeTrack === 'business'
            ? 'bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20'
            : 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20'
        )}
      >
        {activeTrack === 'business' ? '📊 사업성 리서치 실행' : '💡 정보성 리서치 실행'}
      </button>

      {/* 수집 소스 */}
      <div>
        <p className="text-xs text-muted uppercase tracking-widest mb-2">수집 소스</p>
        <div className="space-y-1">
          {sources.map((s, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 px-2.5 rounded-md bg-bg hover:bg-border/20 group transition-colors">
              <div className="flex items-center gap-2">
                <span className="text-xs">{s.emoji}</span>
                <span className="text-xs text-dim">{s.label}</span>
              </div>
              <button
                onClick={() => saveSources(sources.filter((_, j) => j !== i))}
                className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-400 transition-all"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
        {showSourceInput ? (
          <div className="mt-1.5 flex gap-1.5">
            <input
              autoFocus
              value={newSource}
              onChange={e => setNewSource(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addSource(); if (e.key === 'Escape') setShowSourceInput(false) }}
              placeholder="소스 이름..."
              className="flex-1 bg-bg border border-border rounded-md px-2.5 py-1.5 text-xs text-text placeholder-muted/60 focus:outline-none focus:border-primary/60"
            />
            <button onClick={addSource} className="px-2 py-1.5 bg-primary/10 text-primary rounded-md text-xs hover:bg-primary/20 transition-colors">추가</button>
          </div>
        ) : (
          <button
            onClick={() => setShowSourceInput(true)}
            className="mt-1.5 text-xs text-muted hover:text-primary transition-colors flex items-center gap-1"
          >
            + 소스 추가
          </button>
        )}
      </div>

      {/* 키워드 */}
      <div>
        <p className="text-xs text-muted uppercase tracking-widest mb-2">키워드</p>
        <div className="space-y-1">
          {keywords.map((k, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 px-2.5 rounded-md bg-bg hover:bg-border/20 group transition-colors">
              <span className="text-xs text-dim truncate">{k}</span>
              <button
                onClick={() => saveKeywords(keywords.filter((_, j) => j !== i))}
                className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-400 transition-all shrink-0"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
        {showKeywordInput ? (
          <div className="mt-1.5 flex gap-1.5">
            <input
              autoFocus
              value={newKeyword}
              onChange={e => setNewKeyword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addKeyword(); if (e.key === 'Escape') setShowKeywordInput(false) }}
              placeholder="키워드..."
              className="flex-1 bg-bg border border-border rounded-md px-2.5 py-1.5 text-xs text-text placeholder-muted/60 focus:outline-none focus:border-primary/60"
            />
            <button onClick={addKeyword} className="px-2 py-1.5 bg-primary/10 text-primary rounded-md text-xs hover:bg-primary/20 transition-colors">추가</button>
          </div>
        ) : (
          <button
            onClick={() => setShowKeywordInput(true)}
            className="mt-1.5 text-xs text-muted hover:text-primary transition-colors flex items-center gap-1"
          >
            + 키워드 추가
          </button>
        )}
      </div>

      {/* 사전 필터링 조건 */}
      <div>
        <button
          onClick={() => setShowFilters(f => !f)}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-text transition-colors w-full"
        >
          <span className="uppercase tracking-widest">사전 필터링 조건</span>
          <span className="ml-auto">{showFilters ? '▲' : '▼'}</span>
        </button>
        {showFilters && (
          <div className="mt-2 space-y-1">
            {filterConditions.map((cond, i) => (
              <div key={i} className="flex items-start gap-1.5 py-1 px-2 rounded bg-bg/60 border border-border/40">
                <span className={cn('text-[9px] mt-0.5 shrink-0', activeTrack === 'business' ? 'text-orange-400' : 'text-blue-400')}>✓</span>
                <span className="text-[10px] text-dim leading-relaxed">{cond}</span>
              </div>
            ))}
            <p className="text-[9px] text-muted/50 pt-1">* AI가 자동으로 적용하는 조건입니다</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── CENTER 패널 ────────────────────────────────────────────────────────────
export function ResearchCenterPanel({
  missionId,
  onItemClick,
  streamOutput,
  isRunning,
  activeTrack,
}: Props & { activeTrack?: ResearchTrack }) {
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

  // 트랙별 필터링 (태그 기반)
  const filterByTrack = (item: ResearchItem) => {
    if (!activeTrack) return true
    const tags: string[] = Array.isArray(item.tags) ? item.tags : []
    const srcType = item.source_type as string
    // source_type='keyword'/'manual'/기타 (트랙 미지정 직접 입력) → 현재 탭에서 항상 표시
    if (srcType !== 'business' && srcType !== 'informational') return true
    if (activeTrack === 'business') return tags.some(t => t.includes('사업성')) || srcType === 'business'
    if (activeTrack === 'informational') return tags.some(t => t.includes('정보성')) || srcType === 'informational'
    return true
  }

  const visibleItems = items.filter(filterByTrack)
  const pending = visibleItems.filter(i => i.filter_decision === 'pending')
  const kept = visibleItems.filter(i => i.filter_decision === 'keep')

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
          <span className="text-sm text-muted">
            {activeTrack === 'business' ? '📊 사업성 리서치 중...' :
             activeTrack === 'informational' ? '💡 정보성 리서치 중...' :
             '리서치 중...'}
          </span>
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
        <p className="text-sm text-muted">좌측 패널에서 트랙을 선택하고 리서치를 시작하세요</p>
        <p className="text-xs text-muted/60">📊 사업성 / 💡 정보성 트랙 선택 후 실행 버튼 클릭</p>
      </div>
    )
  }

  if (visibleItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-8">
        <p className="text-sm text-muted">
          {activeTrack === 'business' ? '📊 사업성 리서치 결과가 없습니다' : '💡 정보성 리서치 결과가 없습니다'}
        </p>
        <p className="text-xs text-muted/60">해당 트랙으로 리서치를 실행해보세요</p>
      </div>
    )
  }

  const businessItems = visibleItems.filter(i => {
    const tags: string[] = Array.isArray(i.tags) ? i.tags : []
    const srcType = i.source_type as string
    return tags.some(t => t.includes('사업성')) || srcType === 'business'
  })
  const informationalItems = visibleItems.filter(i => {
    const tags: string[] = Array.isArray(i.tags) ? i.tags : []
    const srcType = i.source_type as string
    return tags.some(t => t.includes('정보성')) || srcType === 'informational'
  })

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* AI 1차 필터링 결과 요약 */}
      {(businessItems.length > 0 || informationalItems.length > 0) && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-border">
          <span className="text-[10px] text-muted uppercase tracking-widest">AI 1차 필터링 완료</span>
          <div className="flex items-center gap-1.5 ml-auto">
            {businessItems.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                📊 사업성 {businessItems.length}개
              </span>
            )}
            {informationalItems.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                💡 정보성 {informationalItems.length}개
              </span>
            )}
            <span className="text-[10px] text-muted/60">→ 2차 소팅 필요</span>
          </div>
        </div>
      )}

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
                activeTrack={activeTrack}
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
                activeTrack={activeTrack}
                onFilter={(decision) => filter.mutate({ id: item.id, decision })}
                onClick={() => { setSelectedItem(item); onItemClick?.(item) }}
                dimmed
                isSelected={selectedItem?.id === item.id}
              />
            ))}
          </div>
          <div className="mt-3 p-2 rounded-lg border border-green-500/20 bg-green-500/5">
            <p className="text-[10px] text-green-400 font-medium mb-1.5">✅ {kept.length}개 KEEP 완료</p>
            <p className="text-[10px] text-muted/70">우측 패널 하단의 "다음 봇으로 전달" 버튼을 눌러 Content Bot으로 전달하세요</p>
          </div>
        </div>
      )}
    </div>
  )
}

function ResearchCard({
  item, activeTrack, onFilter, onClick, dimmed, isSelected
}: {
  item: ResearchItem
  activeTrack?: ResearchTrack
  onFilter: (d: 'keep' | 'drop' | 'watch') => void
  onClick: () => void
  dimmed?: boolean
  isSelected?: boolean
}) {
  const score = item.signal_score ?? 0
  const scoreColor = score >= 70 ? 'text-green-400' : score >= 40 ? 'text-yellow-400' : 'text-red-400'
  const barColor = score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-500'

  const tags: string[] = Array.isArray(item.tags) ? item.tags : []
  const srcType = item.source_type as string
  const isBusiness = tags.some(t => t.includes('사업성')) || srcType === 'business'
  const isInformational = tags.some(t => t.includes('정보성')) || srcType === 'informational'

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
        <div className="flex items-center gap-1.5 flex-wrap">
          {(isBusiness || (!activeTrack && isBusiness)) && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 shrink-0">📊</span>
          )}
          {(isInformational || (!activeTrack && isInformational)) && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">💡</span>
          )}
          <span className={cn('text-sm font-medium text-text leading-snug', dimmed && 'text-dim')}>
            {item.title}
          </span>
        </div>
        <span className={cn('text-xs font-mono shrink-0', scoreColor)}>{score}</span>
      </div>

      <div className="h-0.5 bg-border rounded-full mb-2.5">
        <div
          className={cn('h-full rounded-full transition-all', barColor)}
          style={{ width: `${score}%` }}
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

// ── RIGHT 패널 ─────────────────────────────────────────────────────────────
export function ResearchRightPanel({
  item,
  onSkillSelect,
  agentId,
  missionId,
  onFileUpload,
  activeTrack,
}: {
  item: ResearchItem | null
  nextBotName?: string
  onNextBot?: () => void
  onSkillSelect?: (prompt: string) => void
  agentId?: string
  missionId?: string
  onFileUpload?: (content: string, filename: string) => void
  activeTrack?: ResearchTrack
}) {
  const [convertingType, setConvertingType] = useState<string | null>(null)
  const [outputsMap, setOutputsMap] = useState<Record<string, Record<string, string>>>({})
  const outputs = item ? (outputsMap[item.id] ?? {}) : {}
  const [expandedType, setExpandedType] = useState<string | null>(null)

  // kept 항목 목록 (2차 분석용)
  const { data: allItems = [] } = useQuery<ResearchItem[]>({
    queryKey: ['research', missionId],
    queryFn: () => researchApi.list(missionId!),
    enabled: !!missionId && !item,
    staleTime: 5000,
  })
  const keptItems = allItems.filter(i => i.filter_decision === 'keep')

  useEffect(() => {
    setExpandedType(null)
    setConvertingType(null)
    if (!item) return
    if (!outputsMap[item.id]) {
      researchApi.loadOutputs(item.id).then(saved => {
        if (saved && Object.keys(saved).length > 0) {
          setOutputsMap(prev => ({ ...prev, [item.id]: saved }))
        }
      }).catch(() => {})
    }
  }, [item?.id])

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleConvert = async (outputType: string) => {
    if (!item || convertingType) return
    setConvertingType(outputType)
    try {
      const result = await researchApi.convert(item.id, outputType)
      if (item) {
        const newOutputs = { ...(outputsMap[item.id] ?? {}), [outputType]: result.content }
        setOutputsMap(prev => ({ ...prev, [item.id]: newOutputs }))
        researchApi.saveOutputs(item.id, newOutputs).catch(() => {})
      }
      setExpandedType(outputType)
    } finally {
      setConvertingType(null)
    }
  }

  const handleDownload = (type: string, content: string) => {
    const typeLabels: Record<string, string> = {
      report: 'report', prd: 'prd', ppt: 'ppt', action_plan: 'action_plan',
      linkedin: 'linkedin', blog: 'blog', newsletter: 'newsletter',
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
    reader.onload = () => { onFileUpload?.(reader.result as string, file.name) }
    reader.readAsText(file)
    e.target.value = ''
  }

  // 트랙에 맞는 스킬 버튼
  const skills = activeTrack === 'business' ? SKILLS_BUSINESS :
                 activeTrack === 'informational' ? SKILLS_INFORMATIONAL :
                 [...SKILLS_BUSINESS, ...SKILLS_INFORMATIONAL]

  const trackPrefix = activeTrack ? `__track:${activeTrack}__ ` : ''

  if (!item) return (
    <div className="p-4 h-full flex flex-col gap-4 overflow-y-auto">
      {/* 스킬 버튼 */}
      <div>
        <p className="text-xs text-muted uppercase tracking-widest mb-2">
          {activeTrack === 'business' ? '📊 사업성 스킬' :
           activeTrack === 'informational' ? '💡 정보성 스킬' :
           '리서치 스킬'}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {skills.map(skill => (
            <button
              key={skill.label}
              onClick={() => onSkillSelect?.(trackPrefix + skill.prompt)}
              title={skill.prompt}
              className={cn(
                'px-2.5 py-1.5 rounded-lg border text-xs transition-colors',
                skill.highlight
                  ? 'border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 font-medium'
                  : 'border-border bg-bg text-dim hover:border-primary/40 hover:text-primary hover:bg-primary/5'
              )}
            >
              {skill.label}
            </button>
          ))}
        </div>
      </div>

      {/* 보관 항목 2차 분석 */}
      {keptItems.length > 0 && (
        <div>
          <p className="text-xs text-muted uppercase tracking-widest mb-2">
            ✅ 보관 항목 ({keptItems.length})
          </p>
          <div className="space-y-1 mb-2 max-h-32 overflow-y-auto">
            {keptItems.map(ki => (
              <div key={ki.id} className="text-[11px] text-dim px-2 py-1 rounded bg-bg border border-border/60 truncate">
                {ki.title}
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              const keptSummary = keptItems.map((ki, idx) =>
                `[${idx + 1}] ${ki.title}\n${ki.summary ?? ''}`
              ).join('\n\n')
              const trackNote = activeTrack === 'business' ? '사업성' : activeTrack === 'informational' ? '정보성' : ''
              onSkillSelect?.(`${trackNote ? `__track:${activeTrack}__ ` : ''}보관된 리서치 항목 ${keptItems.length}개를 종합 분석하고 핵심 인사이트와 액션 플랜을 도출해줘:\n\n${keptSummary}`)
            }}
            className="w-full py-2 px-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-medium hover:bg-green-500/20 transition-colors"
          >
            📊 보관 항목 종합 분석
          </button>
          {agentId && (
            <div className="mt-2">
              <NextBotDropdown
                currentAgentId={agentId}
                currentRole="research"
                content={keptItems.map((ki, idx) => `[${idx + 1}] ${ki.title}\n${ki.summary ?? ''}`).join('\n\n')}
              />
            </div>
          )}
        </div>
      )}

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
      {keptItems.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-muted/60 text-center">좌측 아이템 클릭 시<br />상세 정보가 표시됩니다</p>
        </div>
      )}
      {agentId && keptItems.length === 0 && (
        <div className="border-t border-border pt-4">
          <NextBotDropdown currentAgentId={agentId} currentRole="research" />
        </div>
      )}
    </div>
  )

  return (
    <div className="p-4 h-full overflow-y-auto space-y-4">
      <div>
        <div className="flex items-center gap-1.5 mb-1">
          {(Array.isArray(item.tags) ? item.tags : []).some((t: string) => t.includes('사업성')) && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">📊 사업성</span>
          )}
          {(Array.isArray(item.tags) ? item.tags : []).some((t: string) => t.includes('정보성')) && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">💡 정보성</span>
          )}
        </div>
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

      {/* 산출물 변환 — 분석 리포트·기획서·PPT·액션플랜만 유지 (콘텐츠봇으로 이전) */}
      <div>
        <p className="text-xs text-muted uppercase tracking-widest mb-2">분석 산출물</p>
        <p className="text-[10px] text-muted/50 mb-2">블로그·뉴스레터·SNS 산출물은 콘텐츠봇에서 생성하세요</p>
        <div className="space-y-1.5">
          {[
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
          <NextBotDropdown
            currentAgentId={agentId}
            currentRole="research"
            content={(expandedType ? outputs[expandedType] : undefined) || item?.summary || ''}
          />
        </div>
      )}
    </div>
  )
}
