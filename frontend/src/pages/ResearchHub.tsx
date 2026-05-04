/**
 * ResearchHub.tsx — Research Hub 재설계
 * v5.0.1
 *
 * 탭 구조:
 *   Items — 리서치 결과 목록, 필터, 상세 패널, Growth 연결
 *   Sources — 149개+ 소스 관리 (on/off, 커스텀 추가)
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/app.store'
import { researchApi, type ResearchItem, type ResearchSource } from '../lib/api'
import {
  Telescope, Rss, Youtube, Twitter, Globe,
  Plus, X, ChevronRight, Tag, Link2, RefreshCw,
  Zap, BarChart2, Trash2,
  ArrowRight, FileText, Linkedin, BookOpen,
  type LucideIcon,
  AlertCircle, ToggleLeft, ToggleRight, Search,
  ExternalLink, Rocket,
} from 'lucide-react'
import { cn } from '../lib/utils'

// ─── 타입 ─────────────────────────────────────────────────────────────────────
type Tab = 'items' | 'sources'
type FilterDecision = 'all' | 'pending' | 'keep' | 'watch' | 'drop'
type ScoreFilter = 'all' | '70' | '50' | '30'
type SourceType = 'rss' | 'youtube' | 'x' | 'special'

const CONVERT_TYPES = [
  { id: 'blog',        label: '블로그',       icon: FileText },
  { id: 'linkedin',    label: 'LinkedIn',     icon: Linkedin },
  { id: 'newsletter',  label: '뉴스레터',     icon: BookOpen },
  { id: 'action_plan', label: '액션 플랜',    icon: Zap },
  { id: 'report',      label: '리포트',       icon: BarChart2 },
  { id: 'prd',         label: 'PRD',          icon: FileText },
] as const

// ─── 유틸 ─────────────────────────────────────────────────────────────────────
function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400'
  if (score >= 60) return 'text-sky-400'
  if (score >= 40) return 'text-yellow-400'
  return 'text-[#52525b]'
}

function scoreBg(score: number): string {
  if (score >= 80) return 'bg-emerald-500/15 border-emerald-500/30'
  if (score >= 60) return 'bg-sky-500/15 border-sky-500/30'
  if (score >= 40) return 'bg-yellow-500/15 border-yellow-500/30'
  return 'bg-[#27272a] border-[#3f3f46]'
}

const DECISION_STYLES: Record<string, string> = {
  pending: 'text-[#71717a] bg-[#27272a] border-[#3f3f46]',
  keep:    'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
  watch:   'text-yellow-400 bg-yellow-500/15 border-yellow-500/30',
  drop:    'text-red-400 bg-red-500/15 border-red-500/30',
}
const DECISION_LABELS: Record<string, string> = {
  pending: '대기', keep: '보관', watch: '관찰', drop: '제외',
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return '방금'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  const d = Math.floor(h / 24)
  return d < 30 ? `${d}일 전` : new Date(dateStr).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

const SOURCE_TYPE_ICON: Record<SourceType, LucideIcon> = {
  rss:     Rss,
  youtube: Youtube,
  x:       Twitter,
  special: Globe,
}
const SOURCE_TYPE_COLOR: Record<SourceType, string> = {
  rss:     'text-orange-400',
  youtube: 'text-red-400',
  x:       'text-sky-400',
  special: 'text-purple-400',
}

// ─── 아이템 상세 패널 ─────────────────────────────────────────────────────────
function ItemDetailPanel({
  item,
  onClose,
  onFilter,
  onGrowth,
}: {
  item: ResearchItem
  onClose: () => void
  onFilter: (id: string, decision: 'keep' | 'drop' | 'watch') => void
  onGrowth: (item: ResearchItem) => void
}) {
  const qc = useQueryClient()
  const [converting, setConverting]   = useState<string | null>(null)
  const [convertedText, setConvertedText] = useState<string | null>(item.converted_output ?? null)
  const [activeConvertType, setActiveConvertType] = useState<string | null>(null)

  const convertMut = useMutation({
    mutationFn: ({ id, type }: { id: string; type: string }) =>
      researchApi.convert(id, type),
    onSuccess: (data, vars) => {
      setConvertedText(data.content)
      setActiveConvertType(vars.type)
      qc.invalidateQueries({ queryKey: ['research'] })
    },
    onSettled: () => setConverting(null),
  })

  const handleConvert = (type: string) => {
    setConverting(type)
    convertMut.mutate({ id: item.id, type })
  }

  const copyToClipboard = () => {
    if (convertedText) navigator.clipboard.writeText(convertedText)
  }

  return (
    <div className="w-[460px] bg-[#111113] border-l border-[#1c1c20] flex flex-col h-full shrink-0">
      {/* 헤더 */}
      <div className="flex items-start justify-between px-5 py-4 border-b border-[#1c1c20]">
        <div className="flex-1 mr-3">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded border', DECISION_STYLES[item.filter_decision])}>
              {DECISION_LABELS[item.filter_decision]}
            </span>
            <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded border', scoreBg(item.signal_score), scoreColor(item.signal_score))}>
              {item.signal_score}점
            </span>
          </div>
          <h2 className="text-[13px] font-semibold text-[#e4e4e7] leading-snug line-clamp-2">
            {item.title}
          </h2>
        </div>
        <button onClick={onClose} className="text-[#52525b] hover:text-[#a1a1aa] p-1 rounded transition-colors shrink-0">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* 메타 & 요약 */}
        <div className="px-5 py-4 border-b border-[#1c1c20]">
          {item.source_url && (
            <a
              href={item.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[11px] text-primary hover:underline mb-2"
            >
              <ExternalLink size={10} />
              <span className="truncate max-w-xs">{item.source_url}</span>
            </a>
          )}
          {item.summary && (
            <p className="text-[12px] text-[#a1a1aa] leading-relaxed">{item.summary}</p>
          )}
          {(item.tags as string[]).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {(item.tags as string[]).map((tag: string) => (
                <span key={tag} className="flex items-center gap-1 text-[10px] text-[#52525b] bg-[#27272a] border border-[#3f3f46] px-1.5 py-0.5 rounded">
                  <Tag size={8} />
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 필터 결정 버튼 */}
        <div className="px-5 py-3 border-b border-[#1c1c20]">
          <p className="text-[10px] text-[#52525b] uppercase tracking-widest mb-2">필터 결정</p>
          <div className="flex gap-2">
            {(['keep', 'watch', 'drop'] as const).map(d => (
              <button
                key={d}
                onClick={() => onFilter(item.id, d)}
                className={cn(
                  'flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-colors border',
                  item.filter_decision === d
                    ? DECISION_STYLES[d]
                    : 'bg-[#18181b] text-[#71717a] border-[#27272a] hover:text-[#a1a1aa]'
                )}
              >
                {DECISION_LABELS[d]}
              </button>
            ))}
          </div>
        </div>

        {/* 변환 버튼 */}
        <div className="px-5 py-3 border-b border-[#1c1c20]">
          <p className="text-[10px] text-[#52525b] uppercase tracking-widest mb-2">콘텐츠 변환</p>
          <div className="grid grid-cols-3 gap-2">
            {CONVERT_TYPES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => handleConvert(id)}
                disabled={converting !== null}
                className={cn(
                  'flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg text-[10px] font-medium transition-colors border',
                  activeConvertType === id
                    ? 'bg-primary/15 text-primary border-primary/40'
                    : 'bg-[#18181b] text-[#71717a] border-[#27272a] hover:text-[#a1a1aa] hover:border-[#52525b]',
                  converting === id && 'opacity-50'
                )}
              >
                {converting === id ? (
                  <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Icon size={12} />
                )}
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Growth 연결 */}
        <div className="px-5 py-3 border-b border-[#1c1c20]">
          <button
            onClick={() => onGrowth(item)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary/10 border border-primary/30 text-primary text-[12px] font-medium hover:bg-primary/15 transition-colors"
          >
            <Rocket size={12} />
            Growth Studio로 보내기
            <ArrowRight size={12} />
          </button>
        </div>

        {/* 변환 결과 */}
        {convertedText && (
          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] text-[#52525b] uppercase tracking-widest">
                변환 결과 {activeConvertType ? `(${activeConvertType})` : ''}
              </p>
              <button
                onClick={copyToClipboard}
                className="text-[10px] text-[#52525b] hover:text-primary transition-colors"
              >
                복사
              </button>
            </div>
            <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-3 max-h-64 overflow-y-auto">
              <pre className="text-[11px] text-[#a1a1aa] whitespace-pre-wrap font-mono leading-relaxed">
                {convertedText}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 수집 모달 ─────────────────────────────────────────────────────────────────
function CollectModal({
  missionId,
  onClose,
}: {
  missionId: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [url, setUrl] = useState('')
  const [keyword, setKeyword] = useState('')
  const [content, setContent] = useState('')
  const [mode, setMode] = useState<'url' | 'keyword' | 'manual'>('url')

  const collectMut = useMutation({
    mutationFn: () => researchApi.collect({
      mission_id: missionId,
      source_type: mode === 'manual' ? 'manual' : mode,
      source_url: mode === 'url' ? url : undefined,
      keyword: mode === 'keyword' ? keyword : undefined,
      content: mode === 'manual' ? content : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['research', missionId] })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#111113] border border-[#1c1c20] rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1c1c20]">
          <h3 className="text-[13px] font-semibold text-[#e4e4e7]">리서치 수집</h3>
          <button onClick={onClose} className="text-[#52525b] hover:text-[#a1a1aa] p-1 rounded transition-colors">
            <X size={14} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {/* 모드 선택 */}
          <div className="flex gap-1 bg-[#18181b] border border-[#27272a] rounded-xl p-1">
            {(['url', 'keyword', 'manual'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  'flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-colors',
                  mode === m ? 'bg-primary/15 text-primary' : 'text-[#71717a] hover:text-[#a1a1aa]'
                )}
              >
                {m === 'url' ? 'URL' : m === 'keyword' ? '키워드' : '직접 입력'}
              </button>
            ))}
          </div>

          {mode === 'url' && (
            <div className="space-y-1">
              <label className="text-[11px] text-[#52525b]">URL</label>
              <div className="flex items-center gap-2 bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-2">
                <Link2 size={12} className="text-[#52525b] shrink-0" />
                <input
                  type="url"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://..."
                  className="flex-1 bg-transparent text-[12px] text-[#e4e4e7] placeholder:text-[#52525b] outline-none"
                />
              </div>
            </div>
          )}

          {mode === 'keyword' && (
            <div className="space-y-1">
              <label className="text-[11px] text-[#52525b]">키워드</label>
              <input
                type="text"
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                placeholder="AI 에이전트 최신 동향"
                className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-2 text-[12px] text-[#e4e4e7] placeholder:text-[#52525b] outline-none"
              />
            </div>
          )}

          {mode === 'manual' && (
            <div className="space-y-1">
              <label className="text-[11px] text-[#52525b]">콘텐츠</label>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="분석할 내용을 직접 입력하세요..."
                rows={5}
                className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-2 text-[12px] text-[#e4e4e7] placeholder:text-[#52525b] outline-none resize-none"
              />
            </div>
          )}

          <button
            onClick={() => collectMut.mutate()}
            disabled={collectMut.isPending || (!url && !keyword && !content)}
            className="w-full py-2.5 rounded-xl bg-primary text-white text-[12px] font-medium disabled:opacity-40 hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            {collectMut.isPending ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Claude 분석 중…
              </>
            ) : (
              <>
                <Zap size={13} />
                AI 분석 수집
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 소스 탭 ──────────────────────────────────────────────────────────────────
function SourcesTab() {
  const qc = useQueryClient()
  const [typeFilter, setTypeFilter] = useState<'all' | SourceType>('all')
  const [search, setSearch] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newSource, setNewSource] = useState({ name: '', url: '', type: 'rss' as SourceType, category: 'custom' })

  const { data: sources = [], isLoading } = useQuery<ResearchSource[]>({
    queryKey: ['research-sources'],
    queryFn: () => researchApi.listSources(),
    staleTime: 60000,
  })

  const toggleMut = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      researchApi.toggleSource(id, is_active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['research-sources'] }),
  })

  const addMut = useMutation({
    mutationFn: () => researchApi.addSource(newSource),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['research-sources'] })
      setShowAddForm(false)
      setNewSource({ name: '', url: '', type: 'rss', category: 'custom' })
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => researchApi.deleteSource(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['research-sources'] }),
  })

  // 집계
  const counts = { rss: 0, youtube: 0, x: 0, special: 0 }
  for (const s of sources) counts[s.type] = (counts[s.type] ?? 0) + 1

  const filtered = sources.filter(s => {
    if (typeFilter !== 'all' && s.type !== typeFilter) return false
    if (!search) return true
    return s.name.toLowerCase().includes(search.toLowerCase()) ||
           s.url.toLowerCase().includes(search.toLowerCase()) ||
           s.category.toLowerCase().includes(search.toLowerCase())
  })

  return (
    <div className="flex flex-col h-full">
      {/* 상단 필터 */}
      <div className="px-6 py-3 border-b border-[#1c1c20] flex items-center gap-3 shrink-0">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#52525b]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="소스 검색…"
            className="bg-[#18181b] border border-[#27272a] rounded-lg pl-7 pr-3 py-1.5 text-[11px] text-[#e4e4e7] placeholder:text-[#52525b] outline-none w-48"
          />
        </div>
        <div className="flex gap-1.5">
          {(['all', 'rss', 'youtube', 'x', 'special'] as const).map(t => {
            const Icon = t === 'all' ? Globe : SOURCE_TYPE_ICON[t]
            const color = t === 'all' ? 'text-[#71717a]' : SOURCE_TYPE_COLOR[t]
            return (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-medium transition-colors border',
                  typeFilter === t
                    ? 'bg-primary/15 text-primary border-primary/40'
                    : 'bg-[#18181b] text-[#71717a] border-[#27272a] hover:text-[#a1a1aa]'
                )}
              >
                <Icon size={11} className={typeFilter === t ? '' : color} />
                {t === 'all' ? `전체 ${sources.length}` : `${t.toUpperCase()} ${counts[t]}`}
              </button>
            )
          })}
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/30 text-primary text-[11px] font-medium hover:bg-primary/15 transition-colors"
        >
          <Plus size={12} />
          소스 추가
        </button>
      </div>

      {/* 소스 테이블 */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-[#52525b] gap-2">
            <Rss size={24} />
            <p className="text-sm">소스가 없습니다</p>
          </div>
        ) : (
          <div className="bg-[#111113] border border-[#1c1c20] rounded-xl overflow-hidden">
            {/* 헤더 */}
            <div className="grid grid-cols-[40px_1fr_200px_80px_60px] gap-3 px-4 py-2 bg-[#18181b] border-b border-[#1c1c20]">
              {['타입', '이름 / URL', '카테고리', '커스텀', 'ON'].map(h => (
                <span key={h} className="text-[10px] text-[#52525b] uppercase tracking-widest">{h}</span>
              ))}
            </div>
            {filtered.map((src, i) => {
              const Icon = SOURCE_TYPE_ICON[src.type] ?? Globe
              const color = SOURCE_TYPE_COLOR[src.type] ?? 'text-[#71717a]'
              const isActive = src.is_active === 1

              return (
                <div
                  key={src.id}
                  className={cn('grid grid-cols-[40px_1fr_200px_80px_60px] gap-3 items-center px-4 py-2.5',
                    i !== 0 && 'border-t border-[#1c1c20]',
                    !isActive && 'opacity-40'
                  )}
                >
                  <Icon size={14} className={color} />
                  <div className="min-w-0">
                    <p className="text-[12px] text-[#e4e4e7] truncate">{src.name}</p>
                    <p className="text-[10px] text-[#52525b] truncate">{src.url}</p>
                  </div>
                  <span className="text-[10px] text-[#71717a] bg-[#27272a] px-2 py-0.5 rounded w-fit">{src.category}</span>
                  <span className="text-[10px] text-[#52525b]">
                    {src.is_custom === 1 ? '커스텀' : '기본'}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleMut.mutate({ id: src.id, is_active: !isActive })}
                      className="transition-colors"
                      title={isActive ? '비활성화' : '활성화'}
                    >
                      {isActive ? (
                        <ToggleRight size={20} className="text-primary" />
                      ) : (
                        <ToggleLeft size={20} className="text-[#52525b]" />
                      )}
                    </button>
                    {src.is_custom === 1 && (
                      <button
                        onClick={() => deleteMut.mutate(src.id)}
                        className="text-[#3f3f46] hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 소스 추가 폼 */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111113] border border-[#1c1c20] rounded-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1c1c20]">
              <h3 className="text-[13px] font-semibold text-[#e4e4e7]">소스 추가</h3>
              <button onClick={() => setShowAddForm(false)} className="text-[#52525b] hover:text-[#a1a1aa] p-1 rounded">
                <X size={14} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <input
                value={newSource.name}
                onChange={e => setNewSource(s => ({ ...s, name: e.target.value }))}
                placeholder="소스 이름"
                className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-2 text-[12px] text-[#e4e4e7] placeholder:text-[#52525b] outline-none"
              />
              <input
                value={newSource.url}
                onChange={e => setNewSource(s => ({ ...s, url: e.target.value }))}
                placeholder="URL (RSS 피드, 채널 등)"
                className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-2 text-[12px] text-[#e4e4e7] placeholder:text-[#52525b] outline-none"
              />
              <div className="flex gap-2">
                <select
                  value={newSource.type}
                  onChange={e => setNewSource(s => ({ ...s, type: e.target.value as SourceType }))}
                  className="flex-1 bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-2 text-[12px] text-[#e4e4e7] outline-none"
                >
                  <option value="rss">RSS</option>
                  <option value="youtube">YouTube</option>
                  <option value="x">X (Twitter)</option>
                  <option value="special">Special</option>
                </select>
                <input
                  value={newSource.category}
                  onChange={e => setNewSource(s => ({ ...s, category: e.target.value }))}
                  placeholder="카테고리"
                  className="flex-1 bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-2 text-[12px] text-[#e4e4e7] placeholder:text-[#52525b] outline-none"
                />
              </div>
              <button
                onClick={() => addMut.mutate()}
                disabled={addMut.isPending || !newSource.name || !newSource.url}
                className="w-full py-2 rounded-xl bg-primary text-white text-[12px] font-medium disabled:opacity-40 hover:bg-primary/90 transition-colors"
              >
                {addMut.isPending ? '추가 중…' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 메인 Research Hub ────────────────────────────────────────────────────────
export default function ResearchHub() {
  const { currentMission } = useAppStore()
  const navigate = useNavigate()
  const missionId = currentMission?.id ?? ''
  const qc = useQueryClient()

  const [tab, setTab]               = useState<Tab>('items')
  const [selectedItem, setSelectedItem] = useState<ResearchItem | null>(null)
  const [decisionFilter, setDecisionFilter] = useState<FilterDecision>('all')
  const [scoreFilter, setScoreFilter]   = useState<ScoreFilter>('all')
  const [search, setSearch]             = useState('')
  const [showCollect, setShowCollect]   = useState(false)

  const { data: items = [], isLoading, isFetching } = useQuery<ResearchItem[]>({
    queryKey: ['research', missionId],
    queryFn: () => researchApi.list(missionId),
    enabled: !!missionId,
    staleTime: 30000,
  })

  const filterMut = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'keep' | 'drop' | 'watch' }) =>
      researchApi.filter(id, decision),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['research', missionId] })
      if (selectedItem?.id === vars.id) {
        setSelectedItem(prev => prev ? { ...prev, filter_decision: vars.decision } : null)
      }
    },
  })

  // 필터 적용
  const filtered = items.filter(item => {
    if (decisionFilter !== 'all' && item.filter_decision !== decisionFilter) return false
    if (scoreFilter !== 'all' && item.signal_score < Number(scoreFilter)) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      item.title.toLowerCase().includes(q) ||
      (item.summary ?? '').toLowerCase().includes(q) ||
      (item.tags as string[]).some((t: string) => t.toLowerCase().includes(q))
    )
  })

  // 통계
  const keepCount    = items.filter(i => i.filter_decision === 'keep').length
  const highSigCount = items.filter(i => i.signal_score >= 70).length
  const pendingCount = items.filter(i => i.filter_decision === 'pending').length

  const handleGrowth = (item: ResearchItem) => {
    // Growth Studio로 이동 (추후 seed content 전달 연동)
    navigate('/dashboard/growth', { state: { seed: item.title + '\n' + (item.summary ?? '') } })
  }

  if (!missionId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full gap-3 text-[#52525b]">
        <AlertCircle size={32} />
        <p className="text-sm">미션을 먼저 선택해주세요</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#0d0d0f]">
      {/* 헤더 */}
      <div className="px-6 py-4 border-b border-[#1c1c20] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <Telescope size={16} className="text-sky-400" />
          <h1 className="text-[15px] font-semibold text-[#e4e4e7]">Research Hub</h1>
          <span className="text-[11px] text-[#52525b] bg-[#111113] border border-[#27272a] px-2 py-0.5 rounded">
            {items.length} 아이템
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ['research', missionId] })}
            disabled={isFetching}
            className="flex items-center gap-1.5 text-[11px] text-[#52525b] hover:text-[#a1a1aa] transition-colors disabled:opacity-50"
          >
            <RefreshCw size={11} className={cn(isFetching && 'animate-spin')} />
          </button>
          <button
            onClick={() => setShowCollect(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/30 text-primary text-[12px] font-medium hover:bg-primary/15 transition-colors"
          >
            <Zap size={12} />
            수집하기
          </button>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex border-b border-[#1c1c20] shrink-0">
        {(['items', 'sources'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-5 py-2.5 text-[12px] font-medium border-b-2 transition-colors',
              tab === t
                ? 'text-[#e4e4e7] border-primary'
                : 'text-[#52525b] border-transparent hover:text-[#a1a1aa]'
            )}
          >
            {t === 'items' ? `아이템 ${items.length}` : '소스 관리'}
          </button>
        ))}
      </div>

      {tab === 'sources' ? (
        <div className="flex-1 overflow-hidden">
          <SourcesTab />
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* 좌측 — 목록 */}
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            {/* 통계 바 */}
            <div className="px-6 py-3 grid grid-cols-4 gap-3 border-b border-[#1c1c20] shrink-0">
              {[
                { label: '전체', value: items.length, color: 'text-[#a1a1aa]' },
                { label: '고신호 (70+)', value: highSigCount, color: 'text-emerald-400' },
                { label: '보관됨', value: keepCount, color: 'text-sky-400' },
                { label: '대기 중', value: pendingCount, color: 'text-yellow-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-[#111113] border border-[#1c1c20] rounded-xl p-3">
                  <p className="text-[10px] text-[#52525b] mb-1">{label}</p>
                  <p className={cn('text-xl font-bold', color)}>{value}</p>
                </div>
              ))}
            </div>

            {/* 필터 */}
            <div className="px-6 py-2.5 flex items-center gap-2.5 border-b border-[#1c1c20] shrink-0 flex-wrap">
              <div className="relative">
                <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#52525b]" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="검색…"
                  className="bg-[#18181b] border border-[#27272a] rounded-lg pl-7 pr-3 py-1 text-[11px] text-[#e4e4e7] placeholder:text-[#52525b] outline-none w-32"
                />
              </div>
              <div className="flex gap-1">
                {(['all', 'pending', 'keep', 'watch', 'drop'] as const).map(d => (
                  <button
                    key={d}
                    onClick={() => setDecisionFilter(d)}
                    className={cn(
                      'px-2.5 py-1 rounded text-[10px] font-medium transition-colors border',
                      decisionFilter === d
                        ? d === 'all' ? 'bg-primary/15 text-primary border-primary/40' : cn(DECISION_STYLES[d])
                        : 'bg-[#18181b] text-[#71717a] border-[#27272a] hover:text-[#a1a1aa]'
                    )}
                  >
                    {d === 'all' ? '전체' : DECISION_LABELS[d]}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                {(['all', '70', '50', '30'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setScoreFilter(s)}
                    className={cn(
                      'px-2.5 py-1 rounded text-[10px] font-medium transition-colors border',
                      scoreFilter === s
                        ? 'bg-primary/15 text-primary border-primary/40'
                        : 'bg-[#18181b] text-[#71717a] border-[#27272a] hover:text-[#a1a1aa]'
                    )}
                  >
                    {s === 'all' ? '점수 전체' : `${s}점+`}
                  </button>
                ))}
              </div>
            </div>

            {/* 아이템 목록 */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {isLoading ? (
                <div className="flex items-center justify-center h-40">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-[#52525b] gap-2">
                  <Telescope size={24} />
                  <p className="text-sm">{items.length === 0 ? '리서치 아이템이 없습니다' : '필터 결과 없음'}</p>
                  {items.length === 0 && (
                    <button
                      onClick={() => setShowCollect(true)}
                      className="mt-1 text-[11px] text-primary hover:underline"
                    >
                      + 수집 시작하기
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map(item => {
                    const isSelected = selectedItem?.id === item.id
                    return (
                      <button
                        key={item.id}
                        onClick={() => setSelectedItem(isSelected ? null : item)}
                        className={cn(
                          'w-full text-left bg-[#111113] border rounded-xl p-4 transition-all',
                          isSelected
                            ? 'border-primary/40 bg-primary/5'
                            : 'border-[#1c1c20] hover:border-[#27272a] hover:bg-[#18181b]'
                        )}
                      >
                        <div className="flex items-start gap-3">
                          {/* 점수 */}
                          <div className={cn('text-xl font-black shrink-0 w-10 text-center leading-none mt-0.5', scoreColor(item.signal_score))}>
                            {item.signal_score}
                          </div>
                          {/* 내용 */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded border', DECISION_STYLES[item.filter_decision])}>
                                {DECISION_LABELS[item.filter_decision]}
                              </span>
                              <span className="text-[10px] text-[#52525b]">
                                {item.source_type.toUpperCase()}
                              </span>
                              <span className="text-[10px] text-[#3f3f46]">{relativeTime(item.created_at)}</span>
                            </div>
                            <p className="text-[12px] text-[#e4e4e7] font-medium line-clamp-1">{item.title}</p>
                            {item.summary && (
                              <p className="text-[11px] text-[#71717a] line-clamp-1 mt-0.5">{item.summary}</p>
                            )}
                            {(item.tags as string[]).length > 0 && (
                              <div className="flex gap-1 mt-1.5 flex-wrap">
                                {(item.tags as string[]).slice(0, 4).map((tag: string) => (
                                  <span key={tag} className="text-[9px] text-[#52525b] bg-[#27272a] px-1.5 py-0.5 rounded">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <ChevronRight size={13} className={cn(
                            'shrink-0 mt-1 transition-transform',
                            isSelected ? 'rotate-90 text-primary' : 'text-[#3f3f46]'
                          )} />
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 우측 — 상세 패널 */}
          {selectedItem && (
            <ItemDetailPanel
              item={selectedItem}
              onClose={() => setSelectedItem(null)}
              onFilter={(id, decision) => filterMut.mutate({ id, decision })}
              onGrowth={handleGrowth}
            />
          )}
        </div>
      )}

      {/* 수집 모달 */}
      {showCollect && (
        <CollectModal
          missionId={missionId}
          onClose={() => setShowCollect(false)}
        />
      )}
    </div>
  )
}
