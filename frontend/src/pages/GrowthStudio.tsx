/**
 * GrowthStudio.tsx — AI Lead Generation 스튜디오
 * v5.2.0 — URL 인제스트 → 콘텐츠 생성 → SNS 발사 → 리드 추적
 */
import { useState, useEffect } from 'react'
import {
  Rocket, Link2, Sparkles, Send, BarChart2,
  Loader2, CheckCircle, AlertTriangle,
  Copy, RefreshCw, Twitter, Instagram, Youtube,
  Linkedin, FileText, Music2, Zap, Package, Users,
  Target,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '../store/app.store'
import { growthApi, type GrowthContent, type LeadStats, type LeadRow, type AttributionReport } from '../lib/api'
import { cn } from '../lib/utils'

type TabId = 'generate' | 'contents' | 'leads' | 'cdp'

const CHANNELS = [
  { id: 'instagram', icon: Instagram, label: 'Instagram',    color: 'text-pink-400',    bg: 'bg-pink-500/10',    border: 'border-pink-500/20' },
  { id: 'x',        icon: Twitter,   label: 'X',            color: 'text-sky-400',     bg: 'bg-sky-500/10',     border: 'border-sky-500/20' },
  { id: 'youtube',  icon: Youtube,   label: 'YouTube',      color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/20' },
  { id: 'tiktok',   icon: Music2,    label: 'TikTok',       color: 'text-purple-400',  bg: 'bg-purple-500/10',  border: 'border-purple-500/20' },
  { id: 'naver_blog', icon: FileText, label: '네이버블로그', color: 'text-green-400',   bg: 'bg-green-500/10',   border: 'border-green-500/20' },
  { id: 'linkedin', icon: Linkedin,  label: 'LinkedIn',     color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20' },
] as const

const TONES    = ['humor', 'authority', 'empathy', 'contrarian', 'proof'] as const
const SEGMENTS = [
  { id: 'new_visitor', label: '신규 방문자' },
  { id: 're_purchase', label: '재구매' },
  { id: 'churn_risk',  label: '이탈 위험' },
  { id: 'vip',         label: 'VIP' },
] as const

// ── 메인 ─────────────────────────────────────────────────────────────────────

export default function GrowthStudio() {
  const [tab, setTab] = useState<TabId>('generate')
  const { currentMission } = useAppStore()
  const currentMissionId = currentMission?.id

  const TABS = [
    { id: 'generate' as TabId, label: '콘텐츠 생성',    icon: Sparkles },
    { id: 'contents' as TabId, label: '콘텐츠 목록',    icon: Package },
    { id: 'leads'    as TabId, label: '리드 현황',       icon: Users },
    { id: 'cdp'      as TabId, label: 'CDP ID-Graph',  icon: Target },
  ]

  return (
    <div className="flex flex-col h-full bg-[#0d0d0f]">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[#1c1c20] shrink-0">
        <Rocket size={16} className="text-pink-400" />
        <span className="text-[14px] font-semibold text-[#e4e4e7]">AI Lead Generation</span>
        <div className="flex items-center gap-1 text-[10px] text-pink-400/70 bg-pink-500/10 border border-pink-500/20 px-2 py-0.5 rounded-full">
          <Zap size={9} />v5.2.0
        </div>
        <div className="ml-auto flex gap-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] transition-colors border',
                tab === t.id
                  ? 'bg-primary/20 text-primary border-primary/30'
                  : 'text-[#52525b] hover:text-[#a1a1aa] border-transparent',
              )}
            >
              <t.icon size={10} />{t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {!currentMissionId ? (
          <div className="flex items-center justify-center h-40 text-[#52525b] text-sm">
            <AlertTriangle size={16} className="mr-2" /> 미션을 먼저 선택해주세요
          </div>
        ) : (
          <>
            {tab === 'generate' && <GenerateTab missionId={currentMissionId} />}
            {tab === 'contents' && <ContentsTab missionId={currentMissionId} />}
            {tab === 'leads'    && <LeadsTab    missionId={currentMissionId} />}
            {tab === 'cdp'      && <CdpIdGraphTab missionId={currentMissionId} />}
          </>
        )}
      </div>
    </div>
  )
}

// ── 콘텐츠 생성 탭 ────────────────────────────────────────────────────────────

function GenerateTab({ missionId }: { missionId: string }) {
  const qc = useQueryClient()
  const [url,         setUrl]         = useState('')
  const [productInfo, setProductInfo] = useState('')
  const [manualMode,  setManualMode]  = useState(false)
  const [channel,     setChannel]     = useState('instagram')
  const [tone,        setTone]        = useState('humor')
  const [segment,     setSegment]     = useState('new_visitor')
  const [withImage,     setWithImage]     = useState(false)
  const [withVideo,     setWithVideo]     = useState(false)
  const [videoDuration, setVideoDuration] = useState<'5' | '10' | '20' | '60'>('10')
  const [ingestLoading, setIngestLoading] = useState(false)
  const [ingestError,   setIngestError]   = useState('')
  const [result,       setResult]       = useState<GrowthContent | null>(null)
  const [copied,       setCopied]       = useState(false)
  const [publishLoading,   setPublishLoading]   = useState(false)
  const [publishResult,    setPublishResult]    = useState('')
  const [publishPlatforms, setPublishPlatforms] = useState<string[]>([])

  // 채널 변경 시 기본 발행 플랫폼 동기화
  useEffect(() => { setPublishPlatforms([channel]) }, [channel])

  const generateMutation = useMutation({
    mutationFn: () => growthApi.generate({
      mission_id: missionId, channel,
      seed_content: productInfo, tone, segment,
      with_image: withImage, with_video: withVideo, video_duration: videoDuration,
    }),
    onSuccess: data => {
      setResult(data)
      qc.invalidateQueries({ queryKey: ['growth-contents', missionId] })
    },
  })

  const handleIngest = async () => {
    if (!url.trim()) return
    setIngestLoading(true); setIngestError('')
    try {
      const data = await growthApi.ingest({ url: url.trim() }) as {
        name?: string; description?: string; price?: string; features?: string[]
      }
      setProductInfo([
        data.name        ? `상품명: ${data.name}` : '',
        data.description ? `설명: ${data.description}` : '',
        data.price       ? `가격: ${data.price}` : '',
        (data.features ?? []).length > 0 ? `특징: ${data.features!.join(', ')}` : '',
      ].filter(Boolean).join('\n'))
      setManualMode(true)
    } catch {
      setIngestError('URL 추출 실패. 직접 입력해 주세요.')
      setManualMode(true)
    } finally {
      setIngestLoading(false)
    }
  }

  const handlePublish = async () => {
    if (!result) return
    setPublishLoading(true); setPublishResult('')
    try {
      const res = await growthApi.publish({
        content_id: result.id, mission_id: missionId,
        platforms: publishPlatforms.length > 0 ? publishPlatforms : [channel],
      }) as Array<{ success: boolean; error?: string }>
      setPublishResult(res[0]?.success ? `✓ ${channel} 발사 완료` : `⚠ ${res[0]?.error ?? '발사 실패'}`)
    } catch {
      setPublishResult('발사 실패 — SNS 연결을 확인해주세요')
    } finally {
      setPublishLoading(false)
    }
  }

  const canGenerate = true

  return (
    <div className="space-y-4 max-w-2xl">

      {/* Step 1: 상품 정보 */}
      <div className="bg-[#111113] border border-[#1c1c20] rounded-xl p-4">
        <p className="text-[11px] text-[#52525b] uppercase tracking-widest mb-3">
          <span className="text-primary mr-2">01</span>상품 URL 또는 정보 입력
        </p>
        {!manualMode ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Link2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#52525b]" />
                <input
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleIngest()}
                  placeholder="상품 URL (스마트스토어, 쿠팡 등)"
                  className="w-full pl-8 pr-3 py-2 bg-[#0d0d0f] border border-[#27272a] rounded-lg text-[13px] text-[#e4e4e7] placeholder:text-[#52525b] focus:outline-none focus:border-primary/50"
                />
              </div>
              <button
                onClick={handleIngest}
                disabled={!url.trim() || ingestLoading}
                className="px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium disabled:opacity-40 flex items-center gap-1.5 shrink-0"
              >
                {ingestLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                추출
              </button>
            </div>
            <button onClick={() => setManualMode(true)} className="text-[11px] text-[#52525b] hover:text-[#a1a1aa]">
              URL 없이 직접 입력 →
            </button>
            {ingestError && <p className="text-[11px] text-amber-400 flex items-center gap-1"><AlertTriangle size={11} />{ingestError}</p>}
          </div>
        ) : (
          <div className="space-y-2">
            <textarea
              value={productInfo}
              onChange={e => setProductInfo(e.target.value)}
              placeholder="상품명, 특징, 가격, 대상 고객 등..."
              rows={4}
              className="w-full px-3 py-2 bg-[#0d0d0f] border border-[#27272a] rounded-lg text-[13px] text-[#e4e4e7] placeholder:text-[#52525b] focus:outline-none focus:border-primary/50 resize-none"
            />
            <button onClick={() => { setManualMode(false); setProductInfo(''); setUrl('') }} className="text-[11px] text-[#52525b] hover:text-[#a1a1aa]">
              ← URL 입력으로
            </button>
          </div>
        )}
      </div>

      {/* Step 2: 채널 / 톤 / 세그먼트 */}
      <div className="bg-[#111113] border border-[#1c1c20] rounded-xl p-4 space-y-3">
        <p className="text-[11px] text-[#52525b] uppercase tracking-widest">
          <span className="text-primary mr-2">02</span>채널 · 톤 · 세그먼트
        </p>

        <div>
          <p className="text-[10px] text-[#444] mb-1.5">채널</p>
          <div className="flex flex-wrap gap-1.5">
            {CHANNELS.map(c => (
              <button key={c.id} onClick={() => setChannel(c.id)}
                className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] border transition-colors',
                  channel === c.id ? `${c.bg} ${c.color} ${c.border}` : 'bg-[#0d0d0f] text-[#52525b] border-[#27272a] hover:border-[#444]'
                )}>
                <c.icon size={11} />{c.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] text-[#444] mb-1.5">톤</p>
          <div className="flex flex-wrap gap-1.5">
            {TONES.map(t => (
              <button key={t} onClick={() => setTone(t)}
                className={cn('px-2.5 py-1 rounded-lg text-[11px] border transition-colors',
                  tone === t ? 'bg-primary/20 text-primary border-primary/30' : 'bg-[#0d0d0f] text-[#52525b] border-[#27272a] hover:border-[#444]'
                )}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] text-[#444] mb-1.5">세그먼트</p>
          <div className="flex flex-wrap gap-1.5">
            {SEGMENTS.map(s => (
              <button key={s.id} onClick={() => setSegment(s.id)}
                className={cn('px-2.5 py-1 rounded-lg text-[11px] border transition-colors',
                  segment === s.id ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-[#0d0d0f] text-[#52525b] border-[#27272a] hover:border-[#444]'
                )}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] text-[#444] mb-1.5">미디어 생성</p>
          <div className="flex flex-col gap-2">
            <div className="flex gap-4">
              {[
                { id: 'image', label: '이미지 (Ideogram)' , val: withImage, set: setWithImage },
                { id: 'video', label: '영상 (Kling 3.0)',   val: withVideo, set: setWithVideo },
              ].map(m => (
                <label key={m.id} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={m.val}
                    onChange={e => m.set(e.target.checked)}
                    className="w-3.5 h-3.5 accent-primary"
                  />
                  <span className="text-[12px] text-[#a1a1aa]">{m.label}</span>
                </label>
              ))}
            </div>
            {withVideo && (
              <div className="flex items-center gap-3 ml-5 flex-wrap">
                <span className="text-[10px] text-[#555]">길이:</span>
                {([
                  { val: '5',  label: '5초' },
                  { val: '10', label: '10초' },
                  { val: '20', label: '20초 (2클립)' },
                  { val: '60', label: '1분 (6클립)' },
                ] as const).map(d => (
                  <label key={d.val} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="videoDuration"
                      checked={videoDuration === d.val}
                      onChange={() => setVideoDuration(d.val)}
                      className="accent-primary"
                    />
                    <span className="text-[11px] text-[#a1a1aa]">{d.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 생성 버튼 */}
      <button
        onClick={() => generateMutation.mutate()}
        disabled={!productInfo.trim() || generateMutation.isPending || !canGenerate}
        className="w-full py-3 bg-primary hover:bg-primary/90 text-white rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 disabled:opacity-40 transition-colors"
      >
        {generateMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
        {generateMutation.isPending ? '생성 중...' : 'AI 콘텐츠 생성'}
      </button>

      {generateMutation.isError && (
        <div className="p-3 bg-red-900/10 border border-red-800/30 rounded-xl text-[12px] text-red-400 flex items-center gap-2">
          <AlertTriangle size={13} />
          {generateMutation.error instanceof Error ? generateMutation.error.message : '생성 실패'}
        </div>
      )}

      {/* 결과 */}
      {result && (
        <div className="bg-[#111113] border border-primary/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] text-primary flex items-center gap-1.5">
              <CheckCircle size={11} />생성 완료
            </p>
            <div className="flex gap-1 text-[10px] text-[#52525b]">
              <span className="bg-[#1c1c20] px-2 py-0.5 rounded">{result.channel}</span>
              {result.segment && <span className="bg-[#1c1c20] px-2 py-0.5 rounded">{result.segment}</span>}
            </div>
          </div>

          <div className="bg-[#0d0d0f] rounded-lg p-3 mb-3">
            <p className="text-[13px] text-[#e4e4e7] whitespace-pre-wrap leading-relaxed">{result.content}</p>
          </div>

          {/* 미디어 미리보기 */}
          {(result.image_url || result.video_url) && (
            <div className="flex gap-2 mb-3">
              {result.image_url && !result.image_url.startsWith('__STUB') && (
                <img src={result.image_url} alt="생성된 이미지" className="h-20 w-20 object-cover rounded-lg border border-[#27272a]" />
              )}
              {result.image_url?.startsWith('__STUB') && (
                <div className="h-20 w-20 bg-[#1c1c20] rounded-lg border border-dashed border-[#444] flex items-center justify-center text-[9px] text-[#52525b]">이미지 준비중</div>
              )}
              {result.video_url && !result.video_url.startsWith('__STUB') && (
                <div className="h-20 w-20 bg-purple-500/10 rounded-lg border border-purple-500/20 flex items-center justify-center text-[10px] text-purple-400">영상</div>
              )}
            </div>
          )}

          {/* 발행 채널 멀티 선택 */}
          <div className="mb-2">
            <p className="text-[10px] text-[#444] mb-1.5">발행 채널 선택</p>
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map(c => {
                const checked = publishPlatforms.includes(c.id)
                return (
                  <label key={c.id} className={cn(
                    'flex items-center gap-1.5 px-2 py-1 rounded-lg border cursor-pointer text-[11px] transition-colors',
                    checked ? `${c.bg} ${c.color} ${c.border}` : 'text-[#52525b] border-[#27272a] hover:border-[#444]'
                  )}>
                    <input type="checkbox" className="hidden"
                      checked={checked}
                      onChange={e => setPublishPlatforms(prev =>
                        e.target.checked ? [...prev, c.id] : prev.filter(p => p !== c.id)
                      )}
                    />
                    <c.icon size={10} />{c.label}
                  </label>
                )
              })}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => { navigator.clipboard.writeText(result.content); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1c1c20] hover:bg-[#27272a] text-[#a1a1aa] rounded-lg text-[12px] transition-colors"
            >
              {copied ? <CheckCircle size={12} className="text-green-400" /> : <Copy size={12} />}
              {copied ? '복사됨' : '복사'}
            </button>
            <button
              onClick={handlePublish}
              disabled={publishLoading || publishPlatforms.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/20 text-primary border border-primary/30 rounded-lg text-[12px] hover:bg-primary/30 disabled:opacity-40 transition-colors"
            >
              {publishLoading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              {publishPlatforms.length > 1 ? `${publishPlatforms.length}채널 발사` : publishPlatforms[0] ? `${publishPlatforms[0]} 발사` : '채널 선택'}
            </button>
          </div>

          {publishResult && (
            <p className={cn('mt-2 text-[12px]', publishResult.startsWith('✓') ? 'text-green-400' : 'text-amber-400')}>
              {publishResult}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── 콘텐츠 목록 탭 ───────────────────────────────────────────────────────────

function ContentsTab({ missionId }: { missionId: string }) {
  const qc = useQueryClient()
  const [channelFilter, setChannelFilter] = useState('all')
  const [regenId, setRegenId] = useState<string | null>(null)

  const { data: contents = [], isLoading, refetch } = useQuery({
    queryKey: ['growth-contents', missionId, channelFilter],
    queryFn: () => growthApi.listContent(missionId, channelFilter === 'all' ? undefined : channelFilter),
    refetchInterval: 30_000,
  })

  // 이미지/영상만 재생성 (텍스트 재활용)
  const handleRegen = async (item: GrowthContent, withImage: boolean, withVideo: boolean) => {
    setRegenId(item.id)
    try {
      await growthApi.generate({
        mission_id: missionId,
        channel: item.channel,
        seed_content: item.content.slice(0, 500),
        with_image: withImage,
        with_video: withVideo,
      })
      qc.invalidateQueries({ queryKey: ['growth-contents', missionId] })
    } finally {
      setRegenId(null)
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setChannelFilter('all')}
          className={cn('px-2.5 py-1 rounded-lg text-[11px] border', channelFilter === 'all' ? 'bg-primary/20 text-primary border-primary/30' : 'text-[#52525b] border-[#27272a]')}>
          전체
        </button>
        {CHANNELS.map(c => (
          <button key={c.id} onClick={() => setChannelFilter(c.id)}
            className={cn('flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] border transition-colors',
              channelFilter === c.id ? `${c.bg} ${c.color} ${c.border}` : 'text-[#52525b] border-[#27272a] hover:border-[#444]'
            )}>
            <c.icon size={10} />{c.label}
          </button>
        ))}
        <button onClick={() => refetch()} className="ml-auto text-[#52525b] hover:text-[#a1a1aa]">
          <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-primary" /></div>
      ) : contents.length === 0 ? (
        <div className="text-center py-12 text-[#52525b] text-[13px]">아직 생성된 콘텐츠 없음</div>
      ) : (
        <div className="space-y-3">
          {contents.map(item => {
            const ch = CHANNELS.find(c => c.id === item.channel)
            return (
              <div key={item.id} className="bg-[#111113] border border-[#1c1c20] rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {ch && <ch.icon size={12} className={ch.color} />}
                    <span className={cn('text-[11px] font-medium', ch?.color ?? 'text-[#a1a1aa]')}>{item.channel}</span>
                    {item.segment && <span className="text-[10px] text-[#52525b] bg-[#1c1c20] px-2 py-0.5 rounded">{item.segment}</span>}
                    <span className={cn('text-[9px] px-1.5 py-0.5 rounded border',
                      item.status === 'posted'    ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                      item.status === 'scheduled' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                      'bg-[#1c1c20] text-[#52525b] border-[#27272a]'
                    )}>
                      {item.status === 'posted' ? '발사완료' : item.status === 'scheduled' ? '예약됨' : '대기중'}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#444]">{new Date(item.created_at).toLocaleDateString('ko-KR')}</span>
                </div>

                <p className="text-[12px] text-[#a1a1aa] whitespace-pre-wrap line-clamp-4 mb-3">{item.content}</p>

                <div className="flex items-center gap-2 flex-wrap">
                  {item.image_url && !item.image_url.startsWith('__STUB') && (
                    <img src={item.image_url} alt="" className="h-12 w-12 object-cover rounded-md border border-[#27272a]" />
                  )}
                  {item.video_url && !item.video_url.startsWith('__STUB') && (
                    <div className="h-12 w-12 bg-purple-500/10 rounded-md border border-purple-500/20 flex items-center justify-center text-[9px] text-purple-400">영상</div>
                  )}
                  <div className="ml-auto flex gap-1.5">
                    {/* 이미지만 재생성 */}
                    <button onClick={() => handleRegen(item, true, false)} disabled={regenId === item.id}
                      title="이미지만 재생성 (텍스트 재활용)"
                      className="flex items-center gap-1 px-2 py-1 text-[10px] text-[#52525b] hover:text-pink-400 border border-[#27272a] hover:border-pink-500/30 rounded-lg transition-colors disabled:opacity-40">
                      {regenId === item.id ? <Loader2 size={9} className="animate-spin" /> : <RefreshCw size={9} />}이미지
                    </button>
                    {/* 영상만 재생성 */}
                    <button onClick={() => handleRegen(item, false, true)} disabled={regenId === item.id}
                      title="영상만 재생성 (텍스트 재활용)"
                      className="flex items-center gap-1 px-2 py-1 text-[10px] text-[#52525b] hover:text-purple-400 border border-[#27272a] hover:border-purple-500/30 rounded-lg transition-colors disabled:opacity-40">
                      {regenId === item.id ? <Loader2 size={9} className="animate-spin" /> : <RefreshCw size={9} />}영상
                    </button>
                    <button onClick={() => navigator.clipboard.writeText(item.content)}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] text-[#52525b] hover:text-[#a1a1aa] border border-[#27272a] rounded-lg transition-colors">
                      <Copy size={9} />복사
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── 리드 현황 탭 (T11) ────────────────────────────────────────────────────────

function LeadsTab({ missionId }: { missionId: string }) {
  const [tierFilter,      setTierFilter]      = useState<'hot' | 'nurture' | 'cold' | undefined>()
  const [triggerLoading,  setTriggerLoading]  = useState(false)
  const [triggerMsg,      setTriggerMsg]      = useState('')
  const [retargetLoading, setRetargetLoading] = useState(false)
  const [retargetMsg,     setRetargetMsg]     = useState('')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['growth-leads', missionId, tierFilter],
    queryFn: () => growthApi.getLeads(missionId, tierFilter),
    refetchInterval: 30_000,
  })

  const { data: attribution } = useQuery<AttributionReport>({
    queryKey: ['growth-attribution', missionId],
    queryFn:  () => growthApi.attribution(missionId),
    refetchInterval: 60_000,
  })

  const now = new Date().toISOString()
  const DUMMY_LEADS: LeadRow[] = [
    { id: 'd1', profile_id: 'prof-a1b2c3d4', tier: 'hot',     score: 88, signals: JSON.stringify([{ type: 'click' }, { type: 'view' }, { type: 'purchase_intent' }]), last_signal_at: new Date(Date.now() - 3600000).toISOString(),   created_at: now, updated_at: now, mission_id: missionId ?? '' },
    { id: 'd2', profile_id: 'prof-e5f6a7b8', tier: 'hot',     score: 76, signals: JSON.stringify([{ type: 'click' }, { type: 'signup' }]),                                last_signal_at: new Date(Date.now() - 7200000).toISOString(),   created_at: now, updated_at: now, mission_id: missionId ?? '' },
    { id: 'd3', profile_id: 'prof-c9d0e1f2', tier: 'nurture', score: 54, signals: JSON.stringify([{ type: 'view' }, { type: 'scroll' }]),                                  last_signal_at: new Date(Date.now() - 86400000).toISOString(),  created_at: now, updated_at: now, mission_id: missionId ?? '' },
    { id: 'd4', profile_id: 'prof-g3h4i5j6', tier: 'nurture', score: 41, signals: JSON.stringify([{ type: 'view' }]),                                                        last_signal_at: new Date(Date.now() - 172800000).toISOString(), created_at: now, updated_at: now, mission_id: missionId ?? '' },
    { id: 'd5', profile_id: 'prof-k7l8m9n0', tier: 'cold',    score: 18, signals: JSON.stringify([{ type: 'impression' }]),                                                  last_signal_at: new Date(Date.now() - 604800000).toISOString(), created_at: now, updated_at: now, mission_id: missionId ?? '' },
  ]
  const rawLeads: LeadRow[] = data?.leads ?? []
  const leads: LeadRow[]    = rawLeads.length > 0 ? rawLeads : DUMMY_LEADS
  const isDummy             = rawLeads.length === 0
  const stats: LeadStats    = data?.stats ?? { hot: isDummy ? 2 : 0, nurture: isDummy ? 2 : 0, cold: isDummy ? 1 : 0, total: isDummy ? 5 : 0, avgScore: isDummy ? 55 : 0 }

  const handleTrigger = async () => {
    setTriggerLoading(true); setTriggerMsg('')
    try {
      await growthApi.trigger(missionId, 'UI 수동 트리거')
      setTriggerMsg('CDP 트리거 실행됨')
      refetch()
    } catch {
      setTriggerMsg('트리거 실패')
    } finally {
      setTriggerLoading(false)
    }
  }

  const handleRetarget = async () => {
    setRetargetLoading(true); setRetargetMsg('')
    try {
      const r = await growthApi.retarget(missionId) as { targeted: number; segments: Record<string, number> }
      setRetargetMsg(`리타겟 ${r.targeted}명 → Growth Bot 대기열`)
      refetch()
    } catch {
      setRetargetMsg('리타겟 실패')
    } finally {
      setRetargetLoading(false)
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: '전체',    value: stats.total,   color: 'text-[#e4e4e7]', bg: 'bg-[#111113]',       border: 'border-[#1c1c20]' },
          { label: '🔥 Hot',  value: stats.hot,     color: 'text-red-400',   bg: 'bg-red-500/10',      border: 'border-red-500/20' },
          { label: '🌱 Nurture', value: stats.nurture, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
          { label: '❄️ Cold', value: stats.cold,    color: 'text-slate-400', bg: 'bg-slate-500/10',    border: 'border-slate-500/20' },
        ].map(s => (
          <div key={s.label} className={cn('rounded-xl p-3 border text-center', s.bg, s.border)}>
            <p className={cn('text-[22px] font-bold leading-none', s.color)}>{s.value}</p>
            <p className="text-[10px] text-[#52525b] mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* 평균 점수 + CDP 트리거 + 리타겟 */}
      <div className="flex items-center justify-between bg-[#111113] border border-[#1c1c20] rounded-xl p-3">
        <div className="flex items-center gap-3">
          <BarChart2 size={14} className="text-primary" />
          <span className="text-[12px] text-[#a1a1aa]">평균 점수</span>
          <span className="text-[18px] font-bold text-primary">{stats.avgScore}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {(triggerMsg || retargetMsg) && (
            <span className="text-[11px] text-green-400">{retargetMsg || triggerMsg}</span>
          )}
          <button onClick={handleRetarget} disabled={retargetLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg text-[11px] hover:bg-amber-500/20 disabled:opacity-40 transition-colors">
            {retargetLoading ? <Loader2 size={11} className="animate-spin" /> : <Target size={11} />}
            리타겟
          </button>
          <button onClick={handleTrigger} disabled={triggerLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/20 text-primary border border-primary/30 rounded-lg text-[11px] hover:bg-primary/30 disabled:opacity-40 transition-colors">
            {triggerLoading ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
            CDP 트리거
          </button>
        </div>
      </div>

      {/* AI Attribution 채널 기여도 */}
      {attribution && attribution.channels.length > 0 && (
        <div className="bg-[#111113] border border-[#1c1c20] rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <BarChart2 size={12} className="text-purple-400" />
            <span className="text-[11px] text-[#52525b] uppercase tracking-widest">AI Attribution — 채널 기여도</span>
            <span className="ml-auto text-[10px] text-[#3f3f46]">Top: {attribution.topChannel}</span>
          </div>
          <div className="space-y-1.5">
            {attribution.channels.slice(0, 5).map(ch => {
              const c = CHANNELS.find(x => x.id === ch.channel)
              return (
                <div key={ch.channel} className="flex items-center gap-2">
                  <div className="flex items-center gap-1 w-24 shrink-0">
                    {c && <c.icon size={9} className={c.color} />}
                    <span className="text-[10px] text-[#a1a1aa] truncate">{ch.channel}</span>
                  </div>
                  <div className="flex-1 h-1.5 bg-[#1c1c20] rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500/60 rounded-full transition-all"
                      style={{ width: `${ch.attributionPct}%` }} />
                  </div>
                  <span className="text-[10px] text-[#52525b] w-8 text-right shrink-0">{ch.attributionPct}%</span>
                  <span className="text-[10px] text-[#3f3f46] w-10 text-right shrink-0">{ch.leadsAttr}건</span>
                </div>
              )
            })}
          </div>
          <div className="mt-2 pt-2 border-t border-[#1c1c20] grid grid-cols-3 gap-2 text-center">
            {[
              { label: '발행', value: attribution.kpis.totalReach },
              { label: '전환율', value: `${attribution.kpis.conversionRate}%` },
              { label: '참여율', value: `${attribution.kpis.engagementRate}x` },
            ].map(k => (
              <div key={k.label}>
                <p className="text-[14px] font-bold text-purple-400">{k.value}</p>
                <p className="text-[9px] text-[#52525b]">{k.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 티어 필터 */}
      <div className="flex items-center gap-1.5">
        {([undefined, 'hot', 'nurture', 'cold'] as const).map(t => (
          <button key={t ?? 'all'} onClick={() => setTierFilter(t)}
            className={cn('px-3 py-1.5 rounded-lg text-[11px] border transition-colors',
              tierFilter === t
                ? t === 'hot'     ? 'bg-red-500/20 text-red-400 border-red-500/30'
                : t === 'nurture' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                : t === 'cold'    ? 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                :                   'bg-primary/20 text-primary border-primary/30'
                : 'text-[#52525b] border-[#27272a] hover:border-[#444]'
            )}>
            {t === undefined ? '전체' : t === 'hot' ? '🔥 Hot' : t === 'nurture' ? '🌱 Nurture' : '❄️ Cold'}
          </button>
        ))}
        <button onClick={() => refetch()} className="ml-auto text-[#52525b] hover:text-[#a1a1aa]">
          <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* 리드 목록 */}
      {isDummy && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/8 border border-amber-500/20 rounded-lg text-[10px] text-amber-400">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
          실제 리드 없음 — 더미 데이터 표시 중. 콘텐츠를 발사하면 실제 시그널이 수집됩니다.
        </div>
      )}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-2">
          {leads.map(lead => {
            const sigs = (() => { try { return JSON.parse(lead.signals) as Array<{ type: string }> } catch { return [] } })()
            return (
              <div key={lead.id} className="bg-[#111113] border border-[#1c1c20] rounded-xl p-3 flex items-center gap-3">
                <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0',
                  lead.tier === 'hot'     ? 'bg-red-500/20 text-red-400' :
                  lead.tier === 'nurture' ? 'bg-yellow-500/20 text-yellow-400' :
                                            'bg-slate-500/20 text-slate-400')}>
                  {lead.score}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[12px] text-[#a1a1aa] font-mono truncate">
                      {lead.profile_id ? `Profile ${lead.profile_id.slice(0, 8)}` : '미션 집계'}
                    </span>
                    <span className={cn('text-[9px] px-1.5 py-0.5 rounded border shrink-0',
                      lead.tier === 'hot'     ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                      lead.tier === 'nurture' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                                                'bg-slate-500/10 text-slate-400 border-slate-500/20')}>
                      {lead.tier.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-[#52525b]">
                    {sigs.slice(-3).map((s, i) => (
                      <span key={i} className="bg-[#1c1c20] px-1.5 py-0.5 rounded">{s.type}</span>
                    ))}
                    <span className="ml-auto">{new Date(lead.last_signal_at).toLocaleDateString('ko-KR')}</span>
                  </div>
                </div>
                <div className="w-16 shrink-0">
                  <div className="h-1.5 bg-[#1c1c20] rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full',
                      lead.tier === 'hot' ? 'bg-red-400' : lead.tier === 'nurture' ? 'bg-yellow-400' : 'bg-slate-400')}
                      style={{ width: `${Math.min(100, lead.score)}%` }} />
                  </div>
                  <p className="text-[9px] text-center text-[#52525b] mt-0.5">{lead.score}pt</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


// ── CDP ID-Graph 탭 ──────────────────────────────────────────────────────────

const CDP_DUMMY_PROFILES = [
  {
    id: 'cdp-U001',
    name: '김 마케터',
    score: 88,
    tier: 'hot' as const,
    identifiers: [
      { type: 'email',     value: 'marketer.kim@company.kr',  icon: '✉️' },
      { type: 'instagram', value: '@kim_biz_growth',           icon: '📸' },
      { type: 'phone',     value: '010-****-1234',             icon: '📱' },
      { type: 'cookie',    value: 'ck_ab12cd34ef56',           icon: '🍪' },
    ],
    touchpoints: ['인스타 광고 클릭', '랜딩페이지 방문', '이메일 오픈', '가격 페이지 2회'],
    firstSeen: '2026-04-20', lastSeen: '2026-05-05',
  },
  {
    id: 'cdp-U002',
    name: '이 창업자',
    score: 76,
    tier: 'hot' as const,
    identifiers: [
      { type: 'email',    value: 'ceo@startup.io',             icon: '✉️' },
      { type: 'x',        value: '@lee_founder_kr',             icon: '𝕏' },
      { type: 'linkedin', value: 'linkedin/in/lee-startup',     icon: '💼' },
    ],
    touchpoints: ['X 게시물 클릭', '데모 신청', 'Calendly 예약'],
    firstSeen: '2026-04-28', lastSeen: '2026-05-04',
  },
  {
    id: 'cdp-U003',
    name: 'Anonymous 003',
    score: 54,
    tier: 'nurture' as const,
    identifiers: [
      { type: 'cookie',   value: 'ck_gh78ij90kl12',             icon: '🍪' },
      { type: 'instagram', value: '@marketing.pro.kr',           icon: '📸' },
    ],
    touchpoints: ['YouTube 광고 시청', '블로그 포스트 2건', '뉴스레터 구독'],
    firstSeen: '2026-05-01', lastSeen: '2026-05-03',
  },
  {
    id: 'cdp-U004',
    name: 'Anonymous 004',
    score: 41,
    tier: 'nurture' as const,
    identifiers: [
      { type: 'email',   value: 'buyer@brand.kr',               icon: '✉️' },
      { type: 'cookie',  value: 'ck_mn34op56qr78',              icon: '🍪' },
    ],
    touchpoints: ['이메일 오픈', '페이지 방문 1회'],
    firstSeen: '2026-05-02', lastSeen: '2026-05-02',
  },
  {
    id: 'cdp-U005',
    name: 'Anonymous 005',
    score: 18,
    tier: 'cold' as const,
    identifiers: [
      { type: 'cookie', value: 'ck_st90uv12wx34',               icon: '🍪' },
    ],
    touchpoints: ['광고 노출 1회'],
    firstSeen: '2026-04-15', lastSeen: '2026-04-15',
  },
]

function CdpIdGraphTab({ missionId: _missionId }: { missionId: string }) {
  const [selected, setSelected] = useState<string | null>(null)
  const selectedProfile = CDP_DUMMY_PROFILES.find(p => p.id === selected)

  return (
    <div className="space-y-4 max-w-3xl">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <div>
          <p className="text-[13px] font-semibold text-[#e4e4e7]">CDP ID Graph</p>
          <p className="text-[11px] text-[#52525b]">동일 사용자의 여러 식별자를 하나의 통합 프로파일로 연결합니다</p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-[10px] text-amber-400 bg-amber-500/8 border border-amber-500/20 px-2.5 py-1.5 rounded-lg">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
          더미 데이터 표시 중
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: '통합 프로파일', value: '5',  color: 'text-[#e4e4e7]', bg: 'bg-[#111113]', border: 'border-[#1c1c20]' },
          { label: '🔥 Hot',        value: '2',  color: 'text-red-400',    bg: 'bg-red-500/10', border: 'border-red-500/20' },
          { label: '🌱 Nurture',    value: '2',  color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
          { label: '식별자 수',     value: '12', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
        ].map(s => (
          <div key={s.label} className={cn('rounded-xl p-3 border text-center', s.bg, s.border)}>
            <p className={cn('text-[22px] font-bold leading-none', s.color)}>{s.value}</p>
            <p className="text-[10px] text-[#52525b] mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* 2-panel: profile list + detail */}
      <div className="flex gap-3 min-h-[320px]">
        {/* 프로파일 목록 */}
        <div className="w-[260px] shrink-0 space-y-1.5">
          {CDP_DUMMY_PROFILES.map(profile => (
            <button
              key={profile.id}
              onClick={() => setSelected(profile.id === selected ? null : profile.id)}
              className={cn(
                'w-full text-left rounded-xl p-3 border transition-all',
                selected === profile.id
                  ? 'bg-indigo-500/15 border-indigo-500/50'
                  : 'bg-[#111113] border-[#1c1c20] hover:border-[#27272a]'
              )}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0',
                  profile.tier === 'hot'     ? 'bg-red-500/20 text-red-400' :
                  profile.tier === 'nurture' ? 'bg-yellow-500/20 text-yellow-400' :
                                               'bg-slate-500/20 text-slate-400'
                )}>
                  {profile.score}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-[#e4e4e7] font-medium truncate">{profile.name}</p>
                  <p className="text-[9px] text-[#52525b]">{profile.identifiers.length}개 식별자</p>
                </div>
                <span className={cn(
                  'text-[8px] px-1.5 py-0.5 rounded border shrink-0',
                  profile.tier === 'hot'     ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                  profile.tier === 'nurture' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                                               'bg-slate-500/10 text-slate-400 border-slate-500/20'
                )}>
                  {profile.tier.toUpperCase()}
                </span>
              </div>
              {/* ID badges */}
              <div className="flex gap-1 flex-wrap">
                {profile.identifiers.map((id, i) => (
                  <span key={i} className="text-[9px] bg-[#1c1c20] px-1.5 py-0.5 rounded text-[#71717a]">
                    {id.icon} {id.type}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>

        {/* 프로파일 상세 */}
        <div className="flex-1 bg-[#111113] border border-[#1c1c20] rounded-xl overflow-hidden">
          {selectedProfile ? (
            <div className="p-4 h-full overflow-y-auto">
              {/* 헤더 */}
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[#1c1c20]">
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0',
                  selectedProfile.tier === 'hot'     ? 'bg-red-500/20 text-red-400' :
                  selectedProfile.tier === 'nurture' ? 'bg-yellow-500/20 text-yellow-400' :
                                                       'bg-slate-500/20 text-slate-400'
                )}>
                  {selectedProfile.score}
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-[#e4e4e7]">{selectedProfile.name}</p>
                  <p className="text-[10px] text-[#52525b]">
                    첫 방문: {selectedProfile.firstSeen} · 최근: {selectedProfile.lastSeen}
                  </p>
                </div>
              </div>

              {/* 연결된 식별자 (ID Graph) */}
              <div className="mb-4">
                <p className="text-[10px] font-semibold text-[#52525b] uppercase tracking-widest mb-2">연결된 식별자 (ID Graph)</p>
                <div className="space-y-1.5">
                  {selectedProfile.identifiers.map((id, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 bg-[#0d0d0f] border border-[#27272a] rounded-lg">
                      <span className="text-sm shrink-0">{id.icon}</span>
                      <span className="text-[10px] text-[#52525b] w-16 shrink-0 uppercase">{id.type}</span>
                      <code className="text-[11px] text-emerald-400 flex-1 truncate">{id.value}</code>
                      {i > 0 && (
                        <span className="text-[9px] text-indigo-400 shrink-0">→ 동일 사용자</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 터치포인트 */}
              <div>
                <p className="text-[10px] font-semibold text-[#52525b] uppercase tracking-widest mb-2">터치포인트 히스토리</p>
                <div className="space-y-1">
                  {selectedProfile.touchpoints.map((tp, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px] text-[#71717a]">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500/60 shrink-0" />
                      {tp}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-[#3f3f46] p-8">
              <Target size={32} strokeWidth={1.5} />
              <p className="text-sm text-[#71717a]">왼쪽에서 프로파일을 선택하면<br />연결된 식별자와 터치포인트를 확인할 수 있습니다</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
