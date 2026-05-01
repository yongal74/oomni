import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { agentsApi, researchApi, type FeedItem, type ResearchItem } from '../../../lib/api'
import { Copy, Check, FileText, Download, Upload, X, ArrowUpDown, ExternalLink, Newspaper, Briefcase } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { ArchiveButton } from '../shared/ArchiveButton'
import { NextBotDropdown } from '../shared/NextBotDropdown'

const CONTENT_TYPES = [
  { key: 'blog', label: '블로그 포스트', emoji: '📝' },
  { key: 'newsletter', label: '뉴스레터', emoji: '📧' },
  { key: 'twitter', label: '트위터 스레드', emoji: '🐦' },
  { key: 'linkedin', label: 'LinkedIn', emoji: '💼' },
  { key: 'youtube_script', label: '유튜브 스크립트', emoji: '🎬' },
]

// LEFT: 콘텐츠 타입 + 리서치 연결
export function ContentLeftPanel({ missionId, selectedType, onTypeChange, onItemSelect }: {
  missionId: string
  selectedType: string
  onTypeChange: (type: string) => void
  onItemSelect?: (item: ResearchItem) => void
}) {
  const [uploadedFile, setUploadedFile] = useState<{ name: string; content: string } | null>(null)

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
            {keptItems.slice(0, 10).map(item => (
              <button
                key={item.id}
                onClick={() => onItemSelect?.(item)}
                className="w-full flex items-start gap-2 px-2 py-1.5 rounded bg-bg hover:bg-primary/5 hover:border-primary/20 border border-transparent transition-colors text-left"
              >
                <span className="text-green-400 text-xs mt-0.5 shrink-0">✓</span>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-xs text-dim leading-snug line-clamp-2">{item.title}</span>
                  {(item.summary || item.content) && (
                    <span className="text-[10px] text-muted/70 leading-snug line-clamp-1">
                      {(item.summary ?? item.content ?? '').slice(0, 80)}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-xs text-muted uppercase tracking-widest mb-3">파일 업로드</p>
        {uploadedFile ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg border border-green-500/30">
            <FileText size={12} className="text-green-400 shrink-0" />
            <span className="text-xs text-dim truncate flex-1">{uploadedFile.name}</span>
            <button onClick={() => setUploadedFile(null)} className="text-muted hover:text-red-400">
              <X size={10} />
            </button>
          </div>
        ) : (
          <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border text-dim hover:border-primary/40 hover:text-text cursor-pointer transition-colors">
            <Upload size={13} />
            <span className="text-xs">파일 선택 (.txt, .md)</span>
            <input
              type="file"
              accept=".txt,.md,.csv"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                const text = await file.text()
                setUploadedFile({ name: file.name, content: text })
              }}
            />
          </label>
        )}
      </div>
    </div>
  )
}

// ── 산출물 탭 타입 ─────────────────────────────────────────────────────────────
type OutputTab = 'all' | 'informational' | 'business'
type SortBy = 'date' | 'signal' | 'type'

// ── 신호강도 배지 ──────────────────────────────────────────────────────────────
function SignalBadge({ level }: { level: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    HIGH: { cls: 'bg-green-500/15 text-green-400 border-green-500/30', label: 'HIGH' },
    MEDIUM: { cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', label: 'MEDIUM' },
    LOW: { cls: 'bg-border text-muted border-border', label: 'LOW' },
  }
  const s = map[level.toUpperCase()] ?? map.LOW
  return (
    <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-semibold', s.cls)}>
      {s.label}
    </span>
  )
}

// ── 신호강도 파싱 ──────────────────────────────────────────────────────────────
function extractSignalLevel(content: string): string {
  const match = content.match(/\[신호\s*강도\]\s*(HIGH|MEDIUM|LOW)/i)
    || content.match(/신호\s*강도[:\s]*(HIGH|MEDIUM|LOW)/i)
    || content.match(/(HIGH|MEDIUM|LOW)\s*—\s*해당\s*콘텐츠/i)
  if (match) return match[1].toUpperCase()
  return 'MEDIUM'
}

// ── 산출물 유형 감지 ───────────────────────────────────────────────────────────
function detectOutputType(content: string): 'informational' | 'business' | 'general' {
  if (/Executive\s*Summary|시장\s*분석|투자자|사업\s*제안|전략적\s*권고|Next\s*Steps/i.test(content)) return 'business'
  if (/Actionable\s*Takeaways|기술\s*트렌드|뉴스레터|교육/i.test(content)) return 'informational'
  return 'general'
}

// ── AIWX 포스팅 초안 파싱 ─────────────────────────────────────────────────────
function parseAiwxDraft(content: string): { title: string; body: string; tags: string; publishTime: string } | null {
  const titleMatch = content.match(/\[제목\]\s*\n(.*?)(?=\n\[|$)/s)
  const bodyMatch = content.match(/\[본문\]\s*\n(.*?)(?=\n\[|$)/s)
  const tagsMatch = content.match(/\[태그\]\s*\n(.*?)(?=\n\[|$)/s)
  const timeMatch = content.match(/\[발행\s*시간\]\s*\n(.*?)(?=\n\[|$)/s)
  if (!titleMatch) return null
  return {
    title: titleMatch[1].trim(),
    body: bodyMatch?.[1].trim() ?? content,
    tags: tagsMatch?.[1].trim() ?? '',
    publishTime: timeMatch?.[1].trim() ?? '',
  }
}

// ── 콘텐츠 타이틀 파싱 ────────────────────────────────────────────────────────
function parseContentTitle(content: string): { title: string; preview: string } {
  // # 제목 형식
  const h1 = content.match(/^#\s+(.+)$/m)
  if (h1) return { title: h1[1].trim(), preview: content.replace(h1[0], '').trim().slice(0, 200) }
  // [제목] 형식 (AIWX 등)
  const bracket = content.match(/\[제목\]\s*\n([^\n]+)/)
  if (bracket) return { title: bracket[1].trim(), preview: content.replace(bracket[0], '').trim().slice(0, 200) }
  // **볼드** 첫 줄
  const bold = content.match(/^\*\*(.+?)\*\*/m)
  if (bold) return { title: bold[1].trim(), preview: content.replace(bold[0], '').trim().slice(0, 200) }
  // 첫 줄 fallback
  const firstLine = content.split('\n')[0].trim()
  return { title: firstLine.slice(0, 80), preview: content.slice(firstLine.length).trim().slice(0, 200) }
}

// ── 결과물 카드 ────────────────────────────────────────────────────────────────
function OutputCard({
  item,
  isSelected,
  onSelect,
  onCopy,
}: {
  item: FeedItem
  isSelected: boolean
  onSelect: () => void
  onCopy: (text: string) => void
}) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const outputType = detectOutputType(item.content)
  const signalLevel = extractSignalLevel(item.content)
  const aiwxDraft = parseAiwxDraft(item.content)
  const isAiwx = !!aiwxDraft
  const { title, preview } = parseContentTitle(item.content)

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    onCopy(text)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div
      className={cn(
        'rounded-xl border transition-all',
        isSelected
          ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20'
          : 'border-border bg-bg hover:border-primary/20'
      )}
    >
      {/* 카드 헤더 */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <button
          onClick={onSelect}
          className={cn(
            'w-4 h-4 rounded border shrink-0 transition-colors',
            isSelected
              ? 'bg-primary border-primary'
              : 'border-border hover:border-primary/50'
          )}
        >
          {isSelected && <Check size={10} className="text-white m-auto" />}
        </button>

        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {outputType === 'informational' && (
            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30 font-medium shrink-0">
              <Newspaper size={9} /> 정보성
            </span>
          )}
          {outputType === 'business' && (
            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 border border-orange-500/30 font-medium shrink-0">
              <Briefcase size={9} /> 사업성
            </span>
          )}
          {isAiwx && (
            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 border border-purple-500/30 font-medium shrink-0">
              ✦ AIWX
            </span>
          )}
          <SignalBadge level={signalLevel} />
        </div>

        <span className="text-[10px] text-muted shrink-0">
          {new Date(item.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* AIWX 드래프트 전용 표시 */}
      {isAiwx && aiwxDraft ? (
        <div className="px-4 pb-3 space-y-2">
          <p className="text-sm font-semibold text-text leading-snug">{aiwxDraft.title}</p>
          <p className="text-xs text-dim line-clamp-3 leading-relaxed">{aiwxDraft.body}</p>
          {aiwxDraft.tags && (
            <p className="text-[10px] text-muted">태그: {aiwxDraft.tags}</p>
          )}
          {aiwxDraft.publishTime && (
            <p className="text-[10px] text-primary/80">발행: {aiwxDraft.publishTime}</p>
          )}
          <div className="flex gap-1.5 pt-1">
            <button
              onClick={() => handleCopy(item.content)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-xs transition-colors"
            >
              {copied ? <Check size={10} /> : <Copy size={10} />}
              전체 초안 복사
            </button>
            <a
              href="https://aiwx2035.blogspot.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface hover:bg-border text-dim text-xs transition-colors"
            >
              <ExternalLink size={10} />
              블로그 열기
            </a>
          </div>
        </div>
      ) : (
        <div className="px-4 pb-3 space-y-2">
          {title && title !== item.content.slice(0, title.length) && (
            <p className="text-sm font-semibold text-text leading-snug">{title}</p>
          )}
          <p className={cn('text-xs text-dim leading-relaxed', expanded ? '' : 'line-clamp-3')}>
            {expanded ? item.content : preview}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setExpanded(v => !v)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface hover:bg-border text-muted hover:text-text text-xs transition-colors"
            >
              {expanded ? '접기' : '전체 보기'}
            </button>
            <button
              onClick={() => handleCopy(item.content)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface hover:bg-border text-muted hover:text-text text-xs transition-colors"
            >
              {copied ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}
              복사
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// CENTER: 생성된 콘텐츠 에디터
export function ContentCenterPanel({ agentId, selectedType, streamOutput, isRunning }: {
  agentId: string
  selectedType?: string
  streamOutput?: string
  isRunning?: boolean
}) {
  const [activeTab, setActiveTab] = useState<OutputTab>('all')
  const [sortBy, setSortBy] = useState<SortBy>('date')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [aiwxDraft, setAiwxDraft] = useState<string | null>(null)
  const [aiwxCopied, setAiwxCopied] = useState(false)

  const { data: feed = [] } = useQuery({
    queryKey: ['bot-feed', agentId],
    queryFn: () => agentsApi.runs(agentId),
    select: (data: FeedItem[]) => data.filter(f => f.type === 'result'),
    refetchInterval: 3000,
  })

  // 탭별 필터링
  const filteredFeed = feed.filter(item => {
    if (activeTab === 'all') return true
    const type = detectOutputType(item.content)
    return type === activeTab
  })

  // 소팅
  const sortedFeed = [...filteredFeed].sort((a, b) => {
    if (sortBy === 'date') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    if (sortBy === 'signal') {
      const order: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 }
      return (order[extractSignalLevel(b.content)] ?? 1) - (order[extractSignalLevel(a.content)] ?? 1)
    }
    if (sortBy === 'type') return detectOutputType(a.content).localeCompare(detectOutputType(b.content))
    return 0
  })

  const latest = feed[0]

  // AIWX 포스팅 초안 생성 (선택된 항목들 합성)
  const handleAiwxDraft = () => {
    const selectedItems = feed.filter(f => selectedIds.has(f.id))
    if (selectedItems.length === 0 && latest) {
      setAiwxDraft(latest.content)
    } else {
      const combined = selectedItems.map(i => i.content).join('\n\n---\n\n')
      setAiwxDraft(combined)
    }
  }

  const handleAiwxCopy = async () => {
    if (!aiwxDraft) return
    await navigator.clipboard.writeText(aiwxDraft)
    setAiwxCopied(true)
    setTimeout(() => setAiwxCopied(false), 1500)
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (isRunning) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-surface shrink-0">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-sm text-muted">콘텐츠 생성 중...</span>
        </div>
        <div className="h-full overflow-y-auto p-5">
          <pre className="text-base text-dim leading-relaxed whitespace-pre-wrap font-sans">{streamOutput || ''}</pre>
        </div>
      </div>
    )
  }

  if (!latest) {
    if (streamOutput) {
      return (
        <div className="h-full overflow-y-auto p-5">
          <p className="text-xs text-muted mb-3 uppercase tracking-widest">마지막 실행 결과</p>
          <pre className="text-base text-dim leading-relaxed whitespace-pre-wrap font-sans">{streamOutput}</pre>
        </div>
      )
    }
    const typeLabels: Record<string, string> = {
      blog: '블로그 포스트',
      newsletter: '뉴스레터',
      twitter: '트위터 스레드',
      linkedin: 'LinkedIn',
      youtube_script: '유튜브 스크립트',
    }
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
        <FileText size={36} className="text-muted/30" />
        <p className="text-base text-muted">
          {selectedType ? `${typeLabels[selectedType] ?? selectedType} 생성을 지시하세요` : '하단 입력창에서 콘텐츠 생성을 지시하세요'}
        </p>
        <p className="text-sm text-muted/60">
          {selectedType === 'blog' ? '"AI 트렌드 블로그 포스트 작성해줘"' :
           selectedType === 'linkedin' ? '"LinkedIn 포스트 작성해줘"' :
           selectedType === 'newsletter' ? '"이번 주 뉴스레터 작성해줘"' :
           '"콘텐츠 생성을 지시하세요"'}
        </p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 탭 헤더 */}
      <div className="shrink-0 border-b border-border bg-surface px-4 pt-2">
        <div className="flex items-center gap-0.5">
          {([
            { key: 'all', label: `전체 (${feed.length})` },
            { key: 'informational', label: '정보성' },
            { key: 'business', label: '사업성' },
          ] as Array<{ key: OutputTab; label: string }>).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap',
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-text'
              )}
            >
              {tab.key === 'informational' && <Newspaper size={11} />}
              {tab.key === 'business' && <Briefcase size={11} />}
              {tab.label}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2 pb-1">
            {/* 소팅 */}
            <div className="flex items-center gap-1">
              <ArrowUpDown size={11} className="text-muted" />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as SortBy)}
                className="text-xs bg-transparent text-muted hover:text-text border-0 outline-none cursor-pointer"
              >
                <option value="date">날짜순</option>
                <option value="signal">신호강도순</option>
                <option value="type">유형순</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* AIWX 포스팅 초안 영역 */}
      {aiwxDraft && (
        <div className="shrink-0 border-b border-purple-500/30 bg-purple-500/5 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-400 flex items-center gap-1.5">
              ✦ AIWX 포스팅 초안
              <a
                href="https://aiwx2035.blogspot.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400/60 hover:text-purple-400 transition-colors"
              >
                <ExternalLink size={10} />
              </a>
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleAiwxCopy}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 text-xs transition-colors"
              >
                {aiwxCopied ? <Check size={10} /> : <Copy size={10} />}
                {aiwxCopied ? '복사됨!' : '복사'}
              </button>
              <button
                onClick={() => setAiwxDraft(null)}
                className="text-muted hover:text-text transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto rounded-lg bg-bg border border-purple-500/20 px-3 py-2">
            <pre className="text-xs text-dim leading-relaxed whitespace-pre-wrap font-sans">{aiwxDraft}</pre>
          </div>
        </div>
      )}

      {/* 결과물 카드 목록 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {sortedFeed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
            <FileText size={28} className="text-muted/30" />
            <p className="text-sm text-muted">이 탭에 해당하는 결과물이 없습니다</p>
          </div>
        ) : (
          sortedFeed.map(item => (
            <OutputCard
              key={item.id}
              item={item}
              isSelected={selectedIds.has(item.id)}
              onSelect={() => toggleSelect(item.id)}
              onCopy={() => {}}
            />
          ))
        )}
      </div>

      {/* AIWX 포스팅 버튼 (하단 고정) */}
      <div className="shrink-0 px-4 py-3 border-t border-border bg-surface/50">
        <button
          onClick={handleAiwxDraft}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-400 hover:text-purple-300 text-sm font-medium border border-purple-500/30 hover:border-purple-500/50 transition-all"
        >
          ✦ AIWX 포스팅 초안 생성
          {selectedIds.size > 0 && (
            <span className="text-xs bg-purple-500/30 px-1.5 py-0.5 rounded-full">
              {selectedIds.size}개 선택
            </span>
          )}
        </button>
      </div>
    </div>
  )
}

const CONTENT_SKILLS = [
  { label: '블로그 글 (4단계)', prompt: '[outputType:blog] 리서치 데이터를 기반으로 4단계 구조와 최진석 교수체로 블로그 글을 작성해줘 (1800~2200자)' },
  { label: 'LinkedIn (900자)', prompt: '[outputType:linkedin] 리서치 데이터를 기반으로 4단계 구조와 최진석 교수체로 LinkedIn 포스트를 작성해줘 (900자 내외)' },
  { label: '숏폼 스크립트', prompt: '/short-form-script 솔로 창업자를 위한 60초 숏폼 영상 스크립트를 훅 3가지 변형으로 작성해줘' },
  { label: '소셜 패키지', prompt: '/social-pack 최신 블로그 포스트를 트위터/LinkedIn/인스타 포맷으로 변환해줘' },
  { label: '뉴스레터', prompt: '/newsletter 이번 주 주요 인사이트를 담은 뉴스레터를 작성해줘' },
  { label: '트위터 스레드', prompt: '/thread-twitter 핵심 인사이트를 8-12개 트윗 스레드로 작성해줘' },
]

// 정보성 / 사업성 빠른 실행 스킬
const INFORMATIONAL_SKILLS = [
  { label: '기술 트렌드 포스트', prompt: '[outputType:informational] 최신 AI 기술 트렌드를 정보성 블로그 포스트로 작성해줘' },
  { label: '교육 콘텐츠', prompt: '[outputType:informational] 스타트업 팀을 위한 AI 도구 활용 교육 콘텐츠를 작성해줘' },
  { label: '뉴스레터 형식', prompt: '[outputType:informational] 이번 주 기술/AI 인사이트를 뉴스레터 형식으로 작성해줘' },
]

const BUSINESS_SKILLS = [
  { label: '시장 분석 리포트', prompt: '[outputType:business] 현재 AI 시장 현황을 분석 리포트 형식으로 작성해줘' },
  { label: '투자자 브리핑', prompt: '[outputType:business] 최신 리서치를 기반으로 투자자 브리핑 문서를 작성해줘' },
  { label: '사업 제안서', prompt: '[outputType:business] 리서치 인사이트를 바탕으로 사업 제안서 초안을 작성해줘' },
]

const AIWX_SKILLS = [
  { label: 'AIWX 포스팅', prompt: '[platform:aiwx_blog] 리서치 데이터를 기반으로 AIWX 블로그 포스팅 초안을 작성해줘' },
  { label: '콘텐츠 소팅', prompt: '리서치 아이템들을 콘텐츠 제작 우선순위로 소팅해줘' },
]

const MARKETING_SKILLS = [
  { label: '주간 성장 보고서', prompt: '/weekly-report 이번 주 사용자 증가, 전환율, 이탈률 지표를 분석하고 개선 방안을 제시해줘' },
  { label: '사용자 세그먼트', prompt: '/segment-users RFM 분석으로 사용자를 세그먼트하고 각 그룹별 액션 플랜을 만들어줘' },
  { label: '캠페인 기획',     prompt: '/campaign-plan 다음 달 성장 캠페인을 채널별 실행 계획과 KPI와 함께 기획해줘' },
  { label: 'A/B 테스트',     prompt: '/ab-test 온보딩 전환율을 높이기 위한 A/B 테스트를 설계하고 PostHog Feature Flag 코드를 작성해줘' },
  { label: '퍼널 분석',      prompt: '/funnel-analysis 현재 전환 퍼널의 병목 구간을 찾고 ICE 스코어로 개선 우선순위를 정해줘' },
  { label: 'SEO 키워드',     prompt: '현재 서비스의 SEO 키워드 전략과 메타 태그 최적화 방안을 제시해줘' },
]

// RIGHT: 발행 옵션 + 다음봇
export function ContentRightPanel({ agentId, onSkillSelect, currentRole = 'content', content = '' }: {
  agentId: string
  nextBotName?: string
  onNextBot?: () => void
  onSkillSelect?: (prompt: string) => void
  currentRole?: string
  content?: string
}) {
  const [copied, setCopied] = useState(false)
  const [skillTab, setSkillTab] = useState<'general' | 'informational' | 'business' | 'aiwx' | 'marketing'>('general')

  const { data: feed = [] } = useQuery({
    queryKey: ['bot-feed', agentId],
    queryFn: () => agentsApi.runs(agentId),
    select: (data: FeedItem[]) => data.filter(f => f.type === 'result'),
    refetchInterval: 3000,
  })
  const latest = feed[0]

  const handleCopy = async () => {
    if (!latest) return
    await navigator.clipboard.writeText(latest.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleDownload = () => {
    if (!latest) return
    const dateStr = new Date().toISOString().slice(0, 10)
    const safeTitle = latest.content.slice(0, 40).replace(/[\\/:*?"<>|\n]/g, '_').trim()
    const fileName = `${dateStr}_${safeTitle}.md`
    const blob = new Blob([latest.content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  }

  const skillTabConfig = [
    { key: 'general' as const, label: '일반' },
    { key: 'informational' as const, label: '정보성' },
    { key: 'business' as const, label: '사업성' },
    { key: 'aiwx' as const, label: 'AIWX' },
    { key: 'marketing' as const, label: '마케팅' },
  ]

  const currentSkills =
    skillTab === 'informational' ? INFORMATIONAL_SKILLS
    : skillTab === 'business' ? BUSINESS_SKILLS
    : skillTab === 'aiwx' ? AIWX_SKILLS
    : skillTab === 'marketing' ? MARKETING_SKILLS
    : CONTENT_SKILLS

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
          <button
            onClick={handleDownload}
            disabled={!latest}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-border text-dim hover:border-primary/40 hover:text-text transition-colors disabled:opacity-40"
          >
            <Download size={14} />
            <span className="text-sm">파일 다운로드 (.md)</span>
          </button>
          {/* AIWX 블로그 바로가기 */}
          <a
            href="https://aiwx2035.blogspot.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-purple-500/30 text-purple-400 hover:border-purple-500/50 hover:bg-purple-500/5 transition-colors"
          >
            <ExternalLink size={14} />
            <span className="text-sm">AIWX 블로그 열기</span>
          </a>
        </div>
      </div>

      {/* 빠른 실행 — 탭 구분 */}
      <div>
        <p className="text-xs text-muted uppercase tracking-widest mb-2.5">빠른 실행</p>
        {/* 탭 */}
        <div className="flex rounded-lg overflow-hidden border border-border mb-2.5">
          {skillTabConfig.map(tab => (
            <button
              key={tab.key}
              onClick={() => setSkillTab(tab.key)}
              className={cn(
                'flex-1 py-1.5 text-[11px] font-medium transition-colors',
                skillTab === tab.key
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted hover:text-text hover:bg-surface'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {currentSkills.map(skill => (
            <button
              key={skill.label}
              onClick={() => onSkillSelect?.(skill.prompt)}
              title={skill.prompt}
              className={cn(
                'px-2.5 py-1.5 rounded-lg border bg-bg text-xs transition-colors',
                skillTab === 'aiwx'
                  ? 'border-purple-500/30 text-purple-400 hover:border-purple-500/50 hover:bg-purple-500/5'
                  : skillTab === 'informational'
                  ? 'border-blue-500/30 text-blue-400 hover:border-blue-500/50 hover:bg-blue-500/5'
                  : skillTab === 'business'
                  ? 'border-orange-500/30 text-orange-400 hover:border-orange-500/50 hover:bg-orange-500/5'
                  : skillTab === 'marketing'
                  ? 'border-pink-500/30 text-pink-400 hover:border-pink-500/50 hover:bg-pink-500/5'
                  : 'border-border text-dim hover:border-primary/40 hover:text-primary hover:bg-primary/5'
              )}
            >
              {skill.label}
            </button>
          ))}
        </div>
      </div>

      <ArchiveButton
        content={latest?.content ?? ''}
        title={latest?.content?.slice(0, 50)}
        botRole="content"
        tags={['OOMNI', 'content']}
      />

      <NextBotDropdown currentAgentId={agentId} currentRole={currentRole} content={content} />
    </div>
  )
}
