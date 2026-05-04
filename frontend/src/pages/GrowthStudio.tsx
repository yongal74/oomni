/**
 * GrowthStudio.tsx — AI Lead Generation 스튜디오
 * v5.2.0 — URL 인제스트 → 콘텐츠 생성 → SNS 발사 → 리드 추적
 */
import { useState } from 'react'
import {
  Rocket, Link2, Sparkles, Send, BarChart2,
  Settings, Loader2, CheckCircle, AlertTriangle,
  Copy, RefreshCw, Twitter, Instagram, Youtube,
  Linkedin, FileText, Music2, Zap, Package, Users,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '../store/app.store'
import { growthApi, type GrowthContent, type LeadStats, type LeadRow } from '../lib/api'
import { cn } from '../lib/utils'

type TabId = 'generate' | 'contents' | 'leads' | 'settings'

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
    { id: 'generate' as TabId, label: '콘텐츠 생성', icon: Sparkles },
    { id: 'contents' as TabId, label: '생성 목록',   icon: Package },
    { id: 'leads'    as TabId, label: '리드 현황',   icon: Users },
    { id: 'settings' as TabId, label: '설정',        icon: Settings },
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
            {tab === 'settings' && <SettingsTab />}
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
  const [withImage,   setWithImage]   = useState(false)
  const [withVideo,   setWithVideo]   = useState(false)
  const [ingestLoading, setIngestLoading] = useState(false)
  const [ingestError,   setIngestError]   = useState('')
  const [result,       setResult]       = useState<GrowthContent | null>(null)
  const [copied,       setCopied]       = useState(false)
  const [publishLoading, setPublishLoading] = useState(false)
  const [publishResult,  setPublishResult]  = useState('')

  const { data: status } = useQuery({
    queryKey: ['growth-status'],
    queryFn: () => growthApi.status(),
  })

  const generateMutation = useMutation({
    mutationFn: () => growthApi.generate({
      mission_id: missionId, channel,
      seed_content: productInfo, tone, segment,
      with_image: withImage, with_video: withVideo,
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
        content_id: result.id, mission_id: missionId, platforms: [channel],
      }) as Array<{ success: boolean; error?: string }>
      setPublishResult(res[0]?.success ? `✓ ${channel} 발사 완료` : `⚠ ${res[0]?.error ?? '발사 실패'}`)
    } catch {
      setPublishResult('발사 실패 — SNS 연결을 확인해주세요')
    } finally {
      setPublishLoading(false)
    }
  }

  const canGenerate = withImage ? status?.gemini_configured : true

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
          <p className="text-[10px] text-[#444] mb-1.5">
            미디어 생성
            {!status?.gemini_configured && <span className="ml-1 text-amber-400/70">(설정에서 API 키 입력 필요)</span>}
          </p>
          <div className="flex gap-4">
            {[
              { id: 'image', label: '이미지 (Ideogram)', val: withImage, set: setWithImage },
              { id: 'video', label: '영상 (Veo 3.1)',    val: withVideo, set: setWithVideo },
            ].map(m => (
              <label key={m.id} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={m.val}
                  onChange={e => m.set(e.target.checked)}
                  disabled={!status?.gemini_configured}
                  className="w-3.5 h-3.5 accent-primary disabled:opacity-40"
                />
                <span className={cn('text-[12px]', !status?.gemini_configured ? 'text-[#444]' : 'text-[#a1a1aa]')}>{m.label}</span>
              </label>
            ))}
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
              disabled={publishLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/20 text-primary border border-primary/30 rounded-lg text-[12px] hover:bg-primary/30 disabled:opacity-40 transition-colors"
            >
              {publishLoading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              {channel} 발사
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
  const [tierFilter, setTierFilter] = useState<'hot' | 'nurture' | 'cold' | undefined>()
  const [triggerLoading, setTriggerLoading] = useState(false)
  const [triggerMsg,     setTriggerMsg]     = useState('')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['growth-leads', missionId, tierFilter],
    queryFn: () => growthApi.getLeads(missionId, tierFilter),
    refetchInterval: 30_000,
  })

  const stats: LeadStats  = data?.stats ?? { hot: 0, nurture: 0, cold: 0, total: 0, avgScore: 0 }
  const leads: LeadRow[] = data?.leads ?? []

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

      {/* 평균 점수 + CDP 트리거 */}
      <div className="flex items-center justify-between bg-[#111113] border border-[#1c1c20] rounded-xl p-3">
        <div className="flex items-center gap-3">
          <BarChart2 size={14} className="text-primary" />
          <span className="text-[12px] text-[#a1a1aa]">평균 점수</span>
          <span className="text-[18px] font-bold text-primary">{stats.avgScore}</span>
        </div>
        <div className="flex items-center gap-2">
          {triggerMsg && <span className="text-[11px] text-green-400">{triggerMsg}</span>}
          <button onClick={handleTrigger} disabled={triggerLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/20 text-primary border border-primary/30 rounded-lg text-[11px] hover:bg-primary/30 disabled:opacity-40 transition-colors">
            {triggerLoading ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
            CDP 트리거
          </button>
        </div>
      </div>

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
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-primary" /></div>
      ) : leads.length === 0 ? (
        <div className="text-center py-12 text-[#52525b] text-[13px]">
          리드 없음 — 콘텐츠를 생성하고 발사하면 시그널이 수집됩니다
        </div>
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

// ── 설정 탭 ──────────────────────────────────────────────────────────────────

function SettingsTab() {
  return (
    <div className="space-y-4 max-w-md">
      <div className="bg-[#111113] border border-primary/20 rounded-xl p-5">
        <p className="text-[13px] font-medium text-[#e4e4e7] mb-2">SNS & AI 설정</p>
        <p className="text-[11px] text-[#52525b] mb-4">
          Ideogram API 키, Gemini API 키, n8n 웹훅 URL, SNS OAuth 자격증명을 관리합니다.
        </p>
        <button
          onClick={() => { window.location.hash = '/sns-settings' }}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary/20 text-primary border border-primary/30 rounded-lg text-[13px] font-medium hover:bg-primary/30 transition-colors"
        >
          <Settings size={14} />SNS &amp; AI 설정 열기
        </button>
      </div>
      <div className="bg-[#111113] border border-[#1c1c20] rounded-xl p-4">
        <p className="text-[11px] text-[#52525b] uppercase tracking-widest mb-3">n8n 자동화 현황</p>
        <div className="space-y-2 text-[12px] text-[#666]">
          <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-green-400" />Instagram → n8n webhook 자동 업로드</div>
          <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-green-400" />TikTok → n8n webhook 자동 업로드</div>
          <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />X / LinkedIn / Naver Blog → OAuth 직접 연결</div>
        </div>
      </div>
    </div>
  )
}
