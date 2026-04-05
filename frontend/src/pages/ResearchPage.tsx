/**
 * Research Studio Page
 * A: Source Registration → B: AI Filter Results → C: Manual Filter → D: Convert
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, X, Check, Eye, Trash2, Copy, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '../lib/utils'
import { researchApi, type ResearchItem } from '../lib/api'
import { useAppStore } from '../store/app.store'

// ── Helpers ──────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 70) return 'text-green-400'
  if (score >= 40) return 'text-yellow-400'
  return 'text-red-400'
}

function scoreBarColor(score: number): string {
  if (score >= 70) return 'bg-green-500'
  if (score >= 40) return 'bg-yellow-500'
  return 'bg-red-500'
}

function decisionBadge(decision: ResearchItem['filter_decision']) {
  switch (decision) {
    case 'keep': return 'bg-green-500/20 text-green-400 border border-green-500/30'
    case 'drop': return 'bg-red-500/20 text-red-400 border border-red-500/30'
    case 'watch': return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
    default: return 'bg-border/40 text-muted border border-border'
  }
}

// ── Source Type Tabs ──────────────────────────────────────────

type SourceType = 'url' | 'rss' | 'keyword' | 'manual'

const SOURCE_TABS: { type: SourceType; label: string; placeholder: string }[] = [
  { type: 'url', label: 'URL', placeholder: 'https://example.com' },
  { type: 'rss', label: 'RSS', placeholder: 'https://example.com/feed.xml' },
  { type: 'keyword', label: '키워드', placeholder: '검색 키워드 입력' },
  { type: 'manual', label: '직접입력', placeholder: '수집할 텍스트를 직접 입력하세요' },
]

// ── Filter Tabs ───────────────────────────────────────────────

type FilterTab = 'all' | 'pending' | 'keep' | 'watch' | 'drop'
const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'pending', label: '대기중' },
  { key: 'keep', label: 'Keep' },
  { key: 'watch', label: 'Watch' },
  { key: 'drop', label: 'Drop' },
]

// ── Convert Modal ─────────────────────────────────────────────

const OUTPUT_TYPES = [
  { type: 'blog', icon: '📝', label: '블로그' },
  { type: 'report', icon: '📊', label: '리포트' },
  { type: 'ppt', icon: '📑', label: 'PPT' },
  { type: 'prd', icon: '📋', label: 'PRD' },
  { type: 'archive', icon: '🗄', label: '아카이브' },
]

interface ConvertModalProps {
  item: ResearchItem
  onClose: () => void
}

function ConvertModal({ item, onClose }: ConvertModalProps) {
  const [convertedContent, setConvertedContent] = useState<string | null>(null)
  const [converting, setConverting] = useState(false)
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleConvert = async (outputType: string) => {
    setSelectedType(outputType)
    setConverting(true)
    setConvertedContent(null)
    try {
      const result = await researchApi.convert(item.id, outputType)
      setConvertedContent(result?.content ?? '')
    } catch {
      setConvertedContent('변환 중 오류가 발생했습니다.')
    } finally {
      setConverting(false)
    }
  }

  const handleCopy = async () => {
    if (!convertedContent) return
    await navigator.clipboard.writeText(convertedContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-text font-semibold text-base">콘텐츠 변환</h2>
            <p className="text-muted text-sm mt-0.5 truncate max-w-md">{item.title}</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-text">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 border-b border-border">
          <div className="flex gap-2">
            {OUTPUT_TYPES.map(({ type, icon, label }) => (
              <button
                key={type}
                onClick={() => handleConvert(type)}
                disabled={converting}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors',
                  selectedType === type
                    ? 'bg-primary/20 border-primary/50 text-primary'
                    : 'border-border text-muted hover:text-text hover:border-primary/50',
                  converting && 'opacity-50 cursor-not-allowed'
                )}
              >
                <span>{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {converting && (
            <div className="flex items-center justify-center gap-2 text-muted py-12">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">AI가 변환 중입니다...</span>
            </div>
          )}
          {!converting && convertedContent && (
            <pre className="text-text text-sm whitespace-pre-wrap font-sans leading-relaxed">{convertedContent}</pre>
          )}
          {!converting && !convertedContent && (
            <div className="text-muted text-sm text-center py-12">
              위에서 변환 형식을 선택하세요
            </div>
          )}
        </div>

        {convertedContent && (
          <div className="px-6 py-4 border-t border-border">
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-[#C4662B] transition-colors"
            >
              <Copy size={14} />
              {copied ? '복사됨!' : '클립보드에 복사'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Research Card ─────────────────────────────────────────────

interface ResearchCardProps {
  item: ResearchItem
  onFilter: (id: string, decision: 'keep' | 'drop' | 'watch') => void
  onDelete: (id: string) => void
  onConvert: (item: ResearchItem) => void
  isFiltering: boolean
}

function ResearchCard({ item, onFilter, onDelete, onConvert, isFiltering }: ResearchCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <div
        className="p-4 cursor-pointer hover:bg-surface transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', decisionBadge(item.filter_decision))}>
                {item.filter_decision === 'pending' ? '대기중'
                  : item.filter_decision === 'keep' ? 'Keep'
                  : item.filter_decision === 'watch' ? 'Watch'
                  : 'Drop'}
              </span>
              <span className="text-xs text-muted capitalize">{item.source_type}</span>
            </div>
            <h3 className="text-text text-sm font-medium truncate">{item.title}</h3>
            {item.summary && (
              <p className="text-muted text-xs mt-1 line-clamp-2">{item.summary}</p>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className={cn('text-sm font-bold', scoreColor(item.signal_score))}>
                {item.signal_score}
              </div>
              <div className="text-[10px] text-muted">점수</div>
            </div>
            {expanded ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
          </div>
        </div>

        {/* Signal score bar */}
        <div className="mt-3 h-1 bg-bg rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', scoreBarColor(item.signal_score))}
            style={{ width: `${item.signal_score}%` }}
          />
        </div>

        {/* Tags */}
        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {item.tags.map((tag, i) => (
              <span key={i} className="text-[10px] bg-bg text-muted px-1.5 py-0.5 rounded">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Expanded content */}
      {expanded && item.content && (
        <div className="px-4 pb-3 border-t border-border mt-0">
          <p className="text-text text-xs mt-3 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
            {item.content}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="px-4 py-3 border-t border-border flex items-center gap-2">
        {item.filter_decision !== 'keep' && (
          <button
            onClick={() => onFilter(item.id, 'keep')}
            disabled={isFiltering}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20 transition-colors"
          >
            <Check size={11} />Keep
          </button>
        )}
        {item.filter_decision !== 'watch' && (
          <button
            onClick={() => onFilter(item.id, 'watch')}
            disabled={isFiltering}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 border border-yellow-500/20 transition-colors"
          >
            <Eye size={11} />Watch
          </button>
        )}
        {item.filter_decision !== 'drop' && (
          <button
            onClick={() => onFilter(item.id, 'drop')}
            disabled={isFiltering}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors"
          >
            <X size={11} />Drop
          </button>
        )}
        {item.filter_decision === 'keep' && (
          <button
            onClick={() => onConvert(item)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors ml-1"
          >
            변환하기
          </button>
        )}
        <button
          onClick={() => onDelete(item.id)}
          className="ml-auto text-muted hover:text-red-400 transition-colors"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────

export default function ResearchPage() {
  const { currentMission } = useAppStore()
  const queryClient = useQueryClient()

  const [sourceType, setSourceType] = useState<SourceType>('url')
  const [sourceInput, setSourceInput] = useState('')
  const [filterTab, setFilterTab] = useState<FilterTab>('all')
  const [convertTarget, setConvertTarget] = useState<ResearchItem | null>(null)

  const missionId = currentMission?.id ?? ''

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['research', missionId],
    queryFn: () => researchApi.list(missionId),
    enabled: !!missionId,
  })

  const collectMutation = useMutation({
    mutationFn: (payload: { source_type: string; source_url?: string; keyword?: string; content?: string }) =>
      researchApi.collect({ mission_id: missionId, ...payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['research', missionId] })
      setSourceInput('')
    },
  })

  const filterMutation = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'keep' | 'drop' | 'watch' }) =>
      researchApi.filter(id, decision),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['research', missionId] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => researchApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['research', missionId] })
    },
  })

  const handleCollect = () => {
    if (!sourceInput.trim() || !missionId) return

    const payload: Parameters<typeof collectMutation.mutate>[0] = {
      source_type: sourceType,
    }

    if (sourceType === 'url' || sourceType === 'rss') {
      payload.source_url = sourceInput.trim()
    } else if (sourceType === 'keyword') {
      payload.keyword = sourceInput.trim()
    } else {
      payload.content = sourceInput.trim()
    }

    collectMutation.mutate(payload)
  }

  const filteredItems = items.filter(item => {
    if (filterTab === 'all') return true
    return item.filter_decision === filterTab
  })

  const currentTab = SOURCE_TABS.find(t => t.type === sourceType)!

  if (!missionId) {
    return (
      <div className="p-8 text-center text-muted text-sm">
        미션을 먼저 선택해주세요
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-text text-xl font-bold flex items-center gap-2">
          <Search size={20} className="text-primary" />
          Research Studio
        </h1>
        <p className="text-muted text-sm mt-1">소스를 수집하고 AI로 분석·필터링합니다</p>
      </div>

      {/* Section A: Source Registration */}
      <div className="bg-surface border border-border rounded-xl p-4 mb-6">
        <h2 className="text-text text-sm font-semibold mb-3">소스 등록</h2>

        {/* Source type tabs */}
        <div className="flex gap-1 mb-3">
          {SOURCE_TABS.map(tab => (
            <button
              key={tab.type}
              onClick={() => { setSourceType(tab.type); setSourceInput('') }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                sourceType === tab.type
                  ? 'bg-primary text-white'
                  : 'text-muted hover:text-text hover:bg-border/40'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          {sourceType === 'manual' ? (
            <textarea
              value={sourceInput}
              onChange={e => setSourceInput(e.target.value)}
              placeholder={currentTab.placeholder}
              rows={4}
              className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:border-primary resize-none"
            />
          ) : (
            <input
              type="text"
              value={sourceInput}
              onChange={e => setSourceInput(e.target.value)}
              placeholder={currentTab.placeholder}
              onKeyDown={e => e.key === 'Enter' && handleCollect()}
              className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:border-primary"
            />
          )}
          <button
            onClick={handleCollect}
            disabled={!sourceInput.trim() || collectMutation.isPending}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
              sourceInput.trim() && !collectMutation.isPending
                ? 'bg-primary text-white hover:bg-[#C4662B]'
                : 'bg-border/40 text-muted cursor-not-allowed'
            )}
          >
            {collectMutation.isPending ? (
              <><Loader2 size={14} className="animate-spin" />분석 중...</>
            ) : (
              <><Plus size={14} />수집 시작</>
            )}
          </button>
        </div>

        {collectMutation.isError && (
          <p className="text-red-400 text-xs mt-2">수집 중 오류가 발생했습니다. 다시 시도해주세요.</p>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-4">
        {FILTER_TABS.map(tab => {
          const count = tab.key === 'all' ? items.length : items.filter(i => i.filter_decision === tab.key).length
          return (
            <button
              key={tab.key}
              onClick={() => setFilterTab(tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                filterTab === tab.key
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'text-muted hover:text-text border border-transparent hover:border-border'
              )}
            >
              {tab.label}
              {count > 0 && (
                <span className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-full',
                  filterTab === tab.key ? 'bg-primary/30' : 'bg-border/40'
                )}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Sections B+C+D: Card Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted gap-2">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">로딩 중...</span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-16 text-muted text-sm">
          {items.length === 0
            ? '아직 수집된 리서치가 없습니다. 위에서 소스를 등록해보세요.'
            : '해당 필터에 맞는 항목이 없습니다.'}
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredItems.map(item => (
            <ResearchCard
              key={item.id}
              item={item}
              onFilter={(id, decision) => filterMutation.mutate({ id, decision })}
              onDelete={id => deleteMutation.mutate(id)}
              onConvert={setConvertTarget}
              isFiltering={filterMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* Convert Modal */}
      {convertTarget && (
        <ConvertModal
          item={convertTarget}
          onClose={() => setConvertTarget(null)}
        />
      )}
    </div>
  )
}
