import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { feedApi, researchApi, videoApi, type FeedItem, type ResearchItem, type ShortFormScript } from '../../../lib/api'
import { ChevronRight, Copy, Check, FileText, Video, Download, Film } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { Player } from '@remotion/player'
import { ShortFormVideo } from '../../video/ShortFormVideo'

const CONTENT_TYPES = [
  { key: 'blog', label: '블로그 포스트', emoji: '📝' },
  { key: 'newsletter', label: '뉴스레터', emoji: '📧' },
  { key: 'twitter', label: '트위터 스레드', emoji: '🐦' },
  { key: 'linkedin', label: 'LinkedIn', emoji: '💼' },
  { key: 'youtube_script', label: '유튜브 스크립트', emoji: '🎬' },
  { key: 'shortform', label: '숏폼 영상', emoji: '📱' },
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
              {type.key === 'shortform' && (
                <span className="ml-auto text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-semibold">
                  NEW
                </span>
              )}
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

// ── 숏폼 영상 패널 ────────────────────────────────────────────────────────────
function ShortformVideoPanel() {
  const queryClient = useQueryClient()
  const [topic, setTopic] = useState('')
  const [selectedScript, setSelectedScript] = useState<ShortFormScript | null>(null)
  const [selectedVariant, setSelectedVariant] = useState(0)
  const [renderStatus, setRenderStatus] = useState<string | null>(null)

  const { data: scripts = [] } = useQuery({
    queryKey: ['video-scripts'],
    queryFn: () => videoApi.listScripts().then(r => r.scripts),
    refetchInterval: 5000,
  })

  const generateMutation = useMutation({
    mutationFn: (t: string) => videoApi.generateScript(t, 'content'),
    onSuccess: (data) => {
      setSelectedScript(data.script)
      queryClient.invalidateQueries({ queryKey: ['video-scripts'] })
    },
  })

  const renderMutation = useMutation({
    mutationFn: ({ id, variant }: { id: string; variant: number }) =>
      videoApi.renderVideo(id, variant),
    onSuccess: (data) => {
      setRenderStatus(data.message)
      setTimeout(() => setRenderStatus(null), 4000)
    },
  })

  const vrewMutation = useMutation({
    mutationFn: (id: string) => videoApi.vrewExport(id),
    onSuccess: (data) => {
      setRenderStatus(`Vrew 저장 완료: ${data.file_path}`)
      setTimeout(() => setRenderStatus(null), 4000)
    },
  })

  const currentVariant = selectedScript?.variants[selectedVariant]
  const remotionProps = currentVariant?.remotion_props

  return (
    <div className="h-full flex flex-col gap-4 overflow-y-auto p-5">
      {/* Script generation */}
      <div>
        <p className="text-xs text-muted uppercase tracking-widest mb-3">스크립트 생성</p>
        <div className="flex gap-2">
          <input
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="주제 입력 (예: AI 생산성 도구)"
            className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-primary/50"
            onKeyDown={e => e.key === 'Enter' && topic && generateMutation.mutate(topic)}
          />
          <button
            onClick={() => topic && generateMutation.mutate(topic)}
            disabled={!topic || generateMutation.isPending}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
          >
            {generateMutation.isPending ? '생성 중...' : '생성'}
          </button>
        </div>
      </div>

      {/* Script list */}
      {scripts.length > 0 && (
        <div>
          <p className="text-xs text-muted uppercase tracking-widest mb-2">저장된 스크립트</p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {scripts.map(s => (
              <button
                key={s.id}
                onClick={() => videoApi.getScript(s.id).then(r => {
                  setSelectedScript(r.script)
                  setSelectedVariant(0)
                })}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                  selectedScript?.id === s.id
                    ? 'bg-primary/10 border border-primary/30 text-text'
                    : 'bg-bg border border-border text-dim hover:border-primary/20'
                )}
              >
                <span className="font-medium">{s.title}</span>
                <span className="text-muted text-xs ml-2">{s.topic}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Script preview + Player */}
      {selectedScript && currentVariant && (
        <>
          {/* Variant selector */}
          <div>
            <p className="text-xs text-muted uppercase tracking-widest mb-2">변형 선택</p>
            <div className="flex gap-1.5">
              {selectedScript.variants.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedVariant(i)}
                  className={cn(
                    'flex-1 py-1.5 rounded text-xs font-medium transition-colors',
                    selectedVariant === i
                      ? 'bg-primary text-white'
                      : 'bg-bg border border-border text-dim hover:border-primary/30'
                  )}
                >
                  변형 {i + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Remotion Player Preview */}
          {remotionProps && (
            <div>
              <p className="text-xs text-muted uppercase tracking-widest mb-2">미리보기</p>
              <div className="rounded-xl overflow-hidden border border-border bg-black" style={{ aspectRatio: '9/16' }}>
                <Player
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  component={ShortFormVideo as any}
                  inputProps={remotionProps}
                  durationInFrames={remotionProps.durationInFrames}
                  fps={remotionProps.fps}
                  compositionWidth={remotionProps.width}
                  compositionHeight={remotionProps.height}
                  style={{ width: '100%', height: '100%' }}
                  controls
                  loop
                />
              </div>
            </div>
          )}

          {/* Script text */}
          <div className="bg-bg rounded-lg border border-border p-4 space-y-3">
            <div>
              <span className="text-xs font-semibold text-purple-400">HOOK</span>
              <p className="text-sm text-dim mt-1">{currentVariant.hook}</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-red-400">PROBLEM</span>
              <p className="text-sm text-dim mt-1">{currentVariant.problem}</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-green-400">SOLUTION</span>
              <ol className="mt-1 space-y-0.5">
                {currentVariant.solution.map((s, i) => (
                  <li key={i} className="text-sm text-dim">{i + 1}. {s}</li>
                ))}
              </ol>
            </div>
            <div>
              <span className="text-xs font-semibold text-blue-400">PROOF</span>
              <p className="text-sm text-dim mt-1">{currentVariant.proof}</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-pink-400">CTA</span>
              <p className="text-sm text-dim mt-1">{currentVariant.cta}</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-2">
            <button
              onClick={() => renderMutation.mutate({ id: selectedScript.id, variant: selectedVariant })}
              disabled={renderMutation.isPending}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
            >
              <Film size={14} />
              {renderMutation.isPending ? '렌더링 중...' : '영상 렌더링 (MP4)'}
            </button>
            <button
              onClick={() => vrewMutation.mutate(selectedScript.id)}
              disabled={vrewMutation.isPending}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-border text-dim hover:border-primary/40 hover:text-text text-sm rounded-lg disabled:opacity-50 transition-colors"
            >
              <Download size={14} />
              {vrewMutation.isPending ? '저장 중...' : 'Vrew 내보내기 (.txt)'}
            </button>
          </div>

          {/* Status message */}
          {renderStatus && (
            <div className="px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg">
              <p className="text-xs text-green-400">{renderStatus}</p>
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!selectedScript && !generateMutation.isPending && (
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
          <Video size={36} className="text-muted/30" />
          <p className="text-sm text-muted">주제를 입력하고 스크립트를 생성하세요</p>
          <p className="text-xs text-muted/60">TikTok, YouTube Shorts, Instagram Reels 최적화</p>
        </div>
      )}

      {generateMutation.isPending && (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted">Claude가 스크립트 3개를 생성하는 중...</p>
        </div>
      )}

      {generateMutation.isError && (
        <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-xs text-red-400">스크립트 생성 실패. 다시 시도해주세요.</p>
        </div>
      )}
    </div>
  )
}

// CENTER: 생성된 콘텐츠 에디터
export function ContentCenterPanel({ agentId, selectedType, streamOutput, isRunning }: { agentId: string; selectedType?: string; streamOutput?: string; isRunning?: boolean }) {
  const { data: feed = [] } = useQuery({
    queryKey: ['bot-feed', agentId],
    queryFn: () => feedApi.list({ limit: 10 }),
    select: (data: FeedItem[]) => data.filter(f => f.agent_id === agentId && f.type === 'result'),
    refetchInterval: 3000,
  })

  // Show shortform video panel when shortform type is selected
  if (selectedType === 'shortform') {
    return <ShortformVideoPanel />
  }

  const latest = feed[0]

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
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
        <FileText size={36} className="text-muted/30" />
        <p className="text-base text-muted">하단 입력창에서 콘텐츠 생성을 지시하세요</p>
        <p className="text-sm text-muted/60">"AI 트렌드 블로그 포스트 써줘" 등</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs text-muted">
          {new Date(latest.created_at).toLocaleString('ko-KR')}
        </span>
      </div>
      <div className="prose prose-invert max-w-none">
        <div className="text-base text-dim leading-relaxed whitespace-pre-wrap">
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

const CONTENT_SKILLS = [
  { label: '블로그 포스트', prompt: '/blog-post AI/스타트업 트렌드를 주제로 SEO 최적화된 블로그 포스트를 작성해줘' },
  { label: '숏폼 스크립트', prompt: '/short-form-script 솔로 창업자를 위한 60초 숏폼 영상 스크립트를 훅 3가지 변형으로 작성해줘' },
  { label: '소셜 패키지', prompt: '/social-pack 최신 블로그 포스트를 트위터/LinkedIn/인스타 포맷으로 변환해줘' },
  { label: '뉴스레터', prompt: '/newsletter 이번 주 주요 인사이트를 담은 뉴스레터를 작성해줘' },
  { label: '트위터 스레드', prompt: '/thread-twitter 핵심 인사이트를 8-12개 트윗 스레드로 작성해줘' },
]

// RIGHT: 발행 옵션 + 다음봇
export function ContentRightPanel({ agentId, nextBotName, onNextBot, onSkillSelect }: {
  agentId: string
  nextBotName?: string
  onNextBot?: () => void
  onSkillSelect?: (prompt: string) => void
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
      {/* 빠른 실행 */}
      <div>
        <p className="text-xs text-muted uppercase tracking-widest mb-2.5">빠른 실행</p>
        <div className="flex flex-wrap gap-1.5">
          {CONTENT_SKILLS.map(skill => (
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
