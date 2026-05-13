/**
 * GrowthStudio.tsx — AI Lead Generation 스튜디오
 * v5.2.0 — URL 인제스트 → 콘텐츠 생성 → SNS 발사 → 리드 추적
 */
import React, { useState, useEffect } from 'react'
import {
  Rocket, Link2, Sparkles, Send, BarChart2,
  Loader2, CheckCircle, AlertTriangle,
  Copy, RefreshCw, Twitter, Instagram, Youtube,
  Linkedin, FileText, Music2, Zap, Package, Users,
  Target, Video, Play, ExternalLink, Film, Mic, Image,
  BookOpen, Search, TrendingUp, Bot,
  Megaphone,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '../store/app.store'
import { growthApi, type GrowthContent, type LeadStats, type LeadRow, type AttributionReport } from '../lib/api'
import { cn } from '../lib/utils'

type TabId = 'perf' | 'content' | 'crm' | 'brand' | 'growth' | 'solo' | 'assets' | 'leads' | 'cdp'

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

const JOB_TABS: { id: TabId; label: string; icon: React.ElementType; color: string }[] = [
  { id: 'perf',    label: '퍼포먼스',  icon: TrendingUp,   color: 'text-blue-400' },
  { id: 'content', label: '콘텐츠',   icon: Sparkles,     color: 'text-pink-400' },
  { id: 'crm',     label: 'CRM',     icon: Users,        color: 'text-green-400' },
  { id: 'brand',   label: '브랜드',   icon: Megaphone,    color: 'text-amber-400' },
  { id: 'growth',  label: 'Growth',  icon: Rocket,       color: 'text-purple-400' },
  { id: 'solo',    label: '1인',     icon: Bot,          color: 'text-emerald-400' },
]
const COMMON_TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'assets', label: '에셋허브', icon: BookOpen },
  { id: 'leads',  label: '리드',    icon: Target },
  { id: 'cdp',    label: 'CDP',    icon: BarChart2 },
]

export default function GrowthStudio() {
  const [tab, setTab] = useState<TabId>('perf')
  const { currentMission } = useAppStore()
  const currentMissionId = currentMission?.id

  return (
    <div className="flex flex-col h-full bg-bg">
      <div className="flex flex-col shrink-0">
        <div className="flex items-center gap-3 px-6 py-3 border-b border-border-muted">
          <Rocket size={18} className="text-pink-400" />
          <span className="text-[17px] font-semibold text-text">Growth Bot</span>
          <div className="flex items-center gap-1 text-[13px] text-pink-400/70 bg-pink-500/10 border border-pink-500/20 px-2 py-0.5 rounded-full">
            <Zap size={9} />v5.14
          </div>
        </div>
        {/* 탭 바 — 직무별 + 공통 */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-border-muted overflow-x-auto scrollbar-hide">
          {JOB_TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[14px] transition-colors border whitespace-nowrap shrink-0',
                tab === t.id ? 'bg-primary/20 text-primary border-primary/30' : 'text-muted hover:text-dim border-transparent',
              )}>
              <t.icon size={12} />{t.label}
            </button>
          ))}
          <div className="w-px h-5 bg-[#27272a] mx-1 shrink-0" />
          {COMMON_TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[14px] transition-colors border whitespace-nowrap shrink-0',
                tab === t.id ? 'bg-primary/20 text-primary border-primary/30' : 'text-muted hover:text-dim border-transparent',
              )}>
              <t.icon size={12} />{t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {!currentMissionId && (tab === 'content' || tab === 'assets' || tab === 'leads' || tab === 'cdp') ? (
          <div className="flex items-center justify-center h-40 text-muted text-sm">
            <AlertTriangle size={18} className="mr-2" /> 미션을 먼저 선택해주세요
          </div>
        ) : (
          <>
            {tab === 'perf'    && <JobRoleTab role="perf" />}
            {tab === 'content' && <ContentTab missionId={currentMissionId!} />}
            {tab === 'crm'     && <JobRoleTab role="crm" />}
            {tab === 'brand'   && <JobRoleTab role="brand" />}
            {tab === 'growth'  && <JobRoleTab role="growth" />}
            {tab === 'solo'    && <JobRoleTab role="solo" />}
            {tab === 'assets'  && <AssetHubTab missionId={currentMissionId!} />}
            {tab === 'leads'   && <LeadsTab    missionId={currentMissionId!} />}
            {tab === 'cdp'     && <CdpIdGraphTab missionId={currentMissionId!} />}
          </>
        )}
      </div>
    </div>
  )
}

// ── 직무 역할 탭 (퍼포먼스 / CRM / 브랜드 / Growth / 1인) ──────────────────────

const JOB_ROLE_DATA: Record<string, {
  title: string; desc: string; color: string; borderColor: string; bgColor: string;
  tools: { name: string; badge: string; desc: string; url: string }[];
  prompts: { title: string; text: string }[];
}> = {
  perf: {
    title: '퍼포먼스 마케터', desc: '광고 효율을 데이터로 증명하고 ROAS를 극대화하는 역할',
    color: 'text-blue-400', borderColor: 'border-blue-500/30', bgColor: 'bg-blue-500/10',
    tools: [
      { name: 'GA4', badge: 'Analytics', desc: 'UTM 파라미터 추적, 전환 이벤트, 퍼널 분석', url: 'https://analytics.google.com' },
      { name: 'Google Ads', badge: 'Paid', desc: '스마트 입찰, 반응형 광고, ROAS 목표 설정', url: 'https://ads.google.com' },
      { name: 'Meta Ads', badge: 'Paid', desc: '유사 타겟, 리타겟, Advantage+ 캠페인', url: 'https://adsmanager.facebook.com' },
      { name: 'Search Console', badge: 'SEO', desc: 'CTR, 노출, 키워드 포지션 추적', url: 'https://search.google.com/search-console' },
    ],
    prompts: [
      { title: '주간 광고 성과 분석', text: '이번 주 GA4 데이터를 기반으로 채널별 전환율과 CPA를 비교 분석하고 예산 재배분 전략을 제안해줘' },
      { title: 'Google Ads ROAS 개선', text: '현재 ROAS가 목표치보다 낮은 캠페인을 분석하고 입찰 전략, 광고 소재, 타겟 개선 방안을 3가지 제안해줘' },
      { title: 'Meta 광고 A/B 테스트 설계', text: '제품명과 타겟 세그먼트를 알려줄게. Meta 광고에서 어떤 변수를 A/B 테스트해야 CTR을 높일 수 있는지 설계해줘' },
      { title: 'UTM 캠페인 구조 설계', text: '우리 마케팅 채널에 맞는 UTM 파라미터 네이밍 컨벤션과 GA4 추적 구조를 설계해줘' },
      { title: '광고 소재 카피라이팅', text: '제품 핵심 USP를 알려줄게. Google Ads RSA용 헤드라인 15개와 설명 4개를 작성해줘' },
    ],
  },
  crm: {
    title: 'CRM 마케터', desc: '고객 라이프사이클을 설계하고 LTV를 높이는 자동화 전문가',
    color: 'text-green-400', borderColor: 'border-green-500/30', bgColor: 'bg-green-500/10',
    tools: [
      { name: 'HubSpot', badge: 'CRM', desc: '리드 스코어링, 파이프라인, 이메일 시퀀스', url: 'https://app.hubspot.com' },
      { name: 'Mailchimp', badge: 'Email', desc: '자동화 플로우, 세그먼트, A/B 테스트', url: 'https://mailchimp.com' },
      { name: 'Notion', badge: 'DB', desc: '고객 데이터베이스, 파이프라인 대시보드', url: 'https://notion.so' },
      { name: 'n8n', badge: 'Auto', desc: '이메일 트리거, CRM 자동 업데이트, 알림', url: 'http://localhost:5678' },
    ],
    prompts: [
      { title: '이탈 고객 재활성화 시퀀스', text: '90일 이상 구매 없는 고객을 위한 3단계 이메일 시퀀스(제목+본문)를 작성해줘. 개인화 요소와 인센티브 타이밍도 포함해줘' },
      { title: '신규 고객 온보딩 플로우', text: '첫 구매 후 30일 이내 고객을 재구매로 전환하는 온보딩 이메일 플로우를 설계해줘. 각 단계의 발송 타이밍과 CTA를 포함해줘' },
      { title: '고객 세그먼트 분류 기준', text: '우리 제품 구매 데이터를 기반으로 RFM 분석(최근성/빈도/금액)으로 세그먼트를 분류하는 기준을 설계해줘' },
      { title: 'VIP 고객 리텐션 전략', text: '상위 20% VIP 고객의 이탈을 예방하는 전용 혜택과 커뮤니케이션 전략을 제안해줘' },
      { title: '뉴스레터 주제 캘린더', text: '이번 달 주 1회 발송할 뉴스레터 4개의 주제, 제목 후보 3개씩, 핵심 CTA를 기획해줘' },
    ],
  },
  brand: {
    title: '브랜드 마케터', desc: '브랜드 아이덴티티를 수호하고 일관된 포지셔닝을 구축',
    color: 'text-amber-400', borderColor: 'border-amber-500/30', bgColor: 'bg-amber-500/10',
    tools: [
      { name: 'Figma', badge: 'Design', desc: '브랜드 에셋, 디자인 시스템, 소셜 템플릿', url: 'https://figma.com' },
      { name: 'Canva', badge: 'Design', desc: '빠른 콘텐츠 제작, 템플릿 커스터마이징', url: 'https://canva.com' },
      { name: 'Notion', badge: 'Docs', desc: '브랜드 가이드라인, 메시지 하우스', url: 'https://notion.so' },
      { name: 'Google Trends', badge: 'Insights', desc: '트렌드 모니터링, 경쟁사 검색 분석', url: 'https://trends.google.com' },
    ],
    prompts: [
      { title: '브랜드 포지셔닝 문장', text: '우리 브랜드의 타겟, 카테고리, 차별점, 혜택을 알려줄게. 포지셔닝 스테이트먼트와 엘리베이터 피치(30초)를 작성해줘' },
      { title: '경쟁사 브랜드 분석', text: '경쟁사 3개를 알려줄게. 각각의 브랜드 포지셔닝, 메시지 톤, 시각적 아이덴티티 차이를 분석하고 우리 브랜드의 차별화 포인트를 도출해줘' },
      { title: '소셜 미디어 톤앤매너 가이드', text: '우리 브랜드 성격(3형용사)을 알려줄게. 채널별(인스타/X/LinkedIn) 톤앤매너 가이드와 피해야 할 표현을 정리해줘' },
      { title: '브랜드 키워드 전략', text: '브랜드 핵심 메시지와 제품 카테고리를 알려줄게. SEO와 광고에 활용할 브랜드 키워드 리스트와 우선순위를 제안해줘' },
      { title: '캠페인 콘셉트 기획', text: '다음 분기 마케팅 캠페인 콘셉트 3가지를 제안해줘. 각각 캠페인 명, 핵심 메시지, 채널 믹스, 예상 임팩트를 포함해줘' },
    ],
  },
  growth: {
    title: 'Growth 해커', desc: '실험 기반으로 빠른 성장 루프를 찾아 반복하는 실험가',
    color: 'text-purple-400', borderColor: 'border-purple-500/30', bgColor: 'bg-purple-500/10',
    tools: [
      { name: 'PostHog', badge: 'Analytics', desc: 'Product analytics, funnel, session replay', url: 'https://app.posthog.com' },
      { name: 'Supabase', badge: 'Backend', desc: '실험 데이터 저장, 실시간 이벤트 추적', url: 'https://supabase.com' },
      { name: 'n8n', badge: 'Auto', desc: '실험 자동화, 결과 알림, 데이터 파이프라인', url: 'http://localhost:5678' },
      { name: 'Vercel', badge: 'Deploy', desc: 'A/B 테스트 배포, Edge Functions, 피처 플래그', url: 'https://vercel.com' },
    ],
    prompts: [
      { title: 'A/B 테스트 실험 설계', text: '가설: [가설 작성]. 이 A/B 테스트의 실험 변수, 대조군/실험군 설계, 최소 샘플 사이즈, 성공 지표를 설계해줘' },
      { title: '퍼널 병목 구간 분석', text: 'TOFU→MOFU→BOFU 각 단계의 전환율을 알려줄게. 이탈이 가장 큰 구간의 원인을 분석하고 해결 실험 3가지를 제안해줘' },
      { title: '바이럴 루프 설계', text: '현재 제품/서비스를 알려줄게. K-factor를 높이기 위한 바이럴 루프(초대 메커니즘, 인센티브, 공유 트리거)를 설계해줘' },
      { title: '온보딩 최적화 실험', text: '신규 가입자의 활성화율이 낮아. 온보딩 첫 7일 경험을 개선하기 위한 실험 백로그 5개를 우선순위 기준과 함께 제안해줘' },
      { title: 'ICE 스코어링 프레임워크', text: '다음 실험 아이디어 목록을 알려줄게. ICE(Impact/Confidence/Ease) 기준으로 스코어링하고 실행 우선순위를 정해줘' },
    ],
  },
  solo: {
    title: '1인 마케터', desc: '혼자 모든 채널을 운영하는 솔로프리너의 자동화 생존 전략',
    color: 'text-emerald-400', borderColor: 'border-emerald-500/30', bgColor: 'bg-emerald-500/10',
    tools: [
      { name: 'n8n', badge: 'Auto', desc: '반복 업무 자동화, 채널 통합, 스케줄 발행', url: 'http://localhost:5678' },
      { name: 'Claude', badge: 'AI', desc: '콘텐츠 생성, 분석 리포트, 아이디어 브레인스토밍', url: 'https://claude.ai' },
      { name: 'Notion', badge: 'Hub', desc: '콘텐츠 캘린더, 리드 DB, 운영 SOP', url: 'https://notion.so' },
      { name: 'Make.com', badge: 'Auto', desc: '앱 간 연결, 간단한 워크플로우 자동화', url: 'https://make.com' },
    ],
    prompts: [
      { title: '주간 콘텐츠 캘린더 생성', text: '이번 주 내가 다뤄야 할 핵심 키워드 3개를 알려줄게. 인스타/블로그/뉴스레터 각 채널에 맞는 주간 콘텐츠 캘린더를 만들어줘' },
      { title: '채널 원클릭 발행 자동화 설계', text: 'n8n으로 블로그 글을 인스타그램 카드뉴스 + X 쓰레드 + 뉴스레터로 자동 변환해서 발행하는 워크플로우를 설계해줘' },
      { title: '월간 성과 리포트 자동화', text: 'GA4, 인스타, 뉴스레터 데이터를 매월 자동으로 수집해서 Notion에 성과 리포트를 작성하는 n8n 워크플로우를 설계해줘' },
      { title: '콘텐츠 재활용 전략', text: '긴 유튜브 영상 1개로 쇼츠/인스타 릴스/블로그/뉴스레터/X 쓰레드 5가지 콘텐츠를 만드는 재활용 전략을 알려줘' },
      { title: '고객 DM 자동 응대 설계', text: '자주 오는 DM 질문 유형을 알려줄게. 자동으로 맞춤 응대하는 카카오/인스타 DM 봇을 n8n으로 어떻게 만들 수 있는지 설계해줘' },
    ],
  },
}

function JobRoleTab({ role }: { role: 'perf' | 'crm' | 'brand' | 'growth' | 'solo' }) {
  const d = JOB_ROLE_DATA[role]
  const [copied, setCopied] = useState<number | null>(null)

  const copy = (i: number, text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(i)
    setTimeout(() => setCopied(null), 2000)
  }

  const openTool = (url: string) => {
    if ((window as any).electronAPI?.openExternal) {
      (window as any).electronAPI.openExternal(url)
    } else {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div className="w-full space-y-5">
      {/* 역할 카드 */}
      <div className={cn('rounded-xl border p-4', d.borderColor, d.bgColor)}>
        <p className={cn('text-[16px] font-bold mb-1', d.color)}>{d.title}</p>
        <p className="text-[14px] text-muted">{d.desc}</p>
      </div>

      {/* 핵심 도구 그리드 */}
      <div>
        <p className="text-[13px] font-bold text-muted uppercase tracking-widest mb-3">핵심 도구 / 연동</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {d.tools.map(t => (
            <button
              key={t.name}
              onClick={() => openTool(t.url)}
              className="bg-surface border border-border-muted hover:border-primary/40 rounded-xl p-3 flex items-start gap-3 text-left transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[15px] font-semibold text-text">{t.name}</span>
                  <span className="text-[13px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-full">{t.badge}</span>
                </div>
                <p className="text-[13px] text-muted">{t.desc}</p>
              </div>
              <ExternalLink size={13} className="text-muted group-hover:text-primary shrink-0 mt-0.5 transition-colors" />
            </button>
          ))}
        </div>
      </div>

      {/* AI 프롬프트 템플릿 */}
      <div>
        <p className="text-[13px] font-bold text-muted uppercase tracking-widest mb-3">AI 프롬프트 템플릿</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {d.prompts.map((p, i) => (
            <div key={i} className="bg-surface border border-border-muted rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-text mb-1">{p.title}</p>
                  <p className="text-[13px] text-muted leading-relaxed line-clamp-2">{p.text}</p>
                </div>
                <button
                  onClick={() => copy(i, p.text)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-[13px] border border-border hover:border-primary/40 rounded-lg text-muted hover:text-primary transition-colors shrink-0"
                >
                  {copied === i ? <CheckCircle size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  {copied === i ? '복사됨' : '복사'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── 콘텐츠 탭 (생성 + 영상 서브탭) ────────────────────────────────────────────

function ContentTab({ missionId }: { missionId: string }) {
  const [sub, setSub] = useState<'generate' | 'video'>('generate')
  return (
    <div>
      <div className="flex gap-1 mb-5">
        {([
          { id: 'generate' as const, label: 'AI 콘텐츠 생성', icon: Sparkles },
          { id: 'video'    as const, label: '영상 제작',       icon: Video },
        ]).map(s => (
          <button key={s.id} onClick={() => setSub(s.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[14px] border transition-colors',
              sub === s.id ? 'bg-primary/20 text-primary border-primary/30' : 'text-muted border-transparent hover:text-dim'
            )}>
            <s.icon size={12} />{s.label}
          </button>
        ))}
      </div>
      {sub === 'generate' && <GenerateTab missionId={missionId} />}
      {sub === 'video'    && <VideoProductionTab />}
    </div>
  )
}

// ── 에셋허브 탭 (프롬프트 라이브러리 + 콘텐츠 목록) ────────────────────────────

function AssetHubTab({ missionId }: { missionId: string }) {
  const [sub, setSub] = useState<'library' | 'contents'>('library')
  return (
    <div>
      <div className="flex gap-1 mb-5">
        {([
          { id: 'library'  as const, label: '프롬프트 라이브러리', icon: BookOpen },
          { id: 'contents' as const, label: '발행 콘텐츠 목록',    icon: Package },
        ]).map(s => (
          <button key={s.id} onClick={() => setSub(s.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[14px] border transition-colors',
              sub === s.id ? 'bg-primary/20 text-primary border-primary/30' : 'text-muted border-transparent hover:text-dim'
            )}>
            <s.icon size={12} />{s.label}
          </button>
        ))}
      </div>
      {sub === 'library'  && <PromptLibraryTab />}
      {sub === 'contents' && <ContentsTab missionId={missionId} />}
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
  const [imageProvider,  setImageProvider]  = useState<string | null>(null)
  const [videoProvider,  setVideoProvider]  = useState<string | null>(null)
  const [withAudio,      setWithAudio]      = useState(false)
  const [audioProvider,  setAudioProvider]  = useState<'elevenlabs' | 'openai_tts'>('elevenlabs')
  const [withStock,      setWithStock]      = useState(false)
  const [videoDuration,  setVideoDuration]  = useState<'5' | '10' | '20' | '60'>('10')
  // 하위 호환 — API로 전송할 bool
  const withImage = imageProvider !== null
  const withVideo = videoProvider !== null
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
      image_provider: imageProvider ?? undefined,
      video_provider: videoProvider ?? undefined,
      with_audio: withAudio, audio_provider: withAudio ? audioProvider : undefined,
      with_stock: withStock,
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
      <div className="bg-surface border border-border-muted rounded-xl p-4">
        <p className="text-[14px] text-muted uppercase tracking-widest mb-3">
          <span className="text-primary mr-2">01</span>상품 URL 또는 정보 입력
        </p>
        {!manualMode ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Link2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleIngest()}
                  placeholder="상품 URL (스마트스토어, 쿠팡 등)"
                  className="w-full pl-8 pr-3 py-2 bg-bg border border-border rounded-lg text-[16px] text-text placeholder:text-muted focus:outline-none focus:border-primary/50"
                />
              </div>
              <button
                onClick={handleIngest}
                disabled={!url.trim() || ingestLoading}
                className="px-4 py-2 bg-primary text-white rounded-lg text-[16px] font-medium disabled:opacity-40 flex items-center gap-1.5 shrink-0"
              >
                {ingestLoading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                추출
              </button>
            </div>
            <button onClick={() => setManualMode(true)} className="text-[14px] text-muted hover:text-dim">
              URL 없이 직접 입력 →
            </button>
            {ingestError && <p className="text-[14px] text-amber-400 flex items-center gap-1"><AlertTriangle size={13} />{ingestError}</p>}
          </div>
        ) : (
          <div className="space-y-2">
            <textarea
              value={productInfo}
              onChange={e => setProductInfo(e.target.value)}
              placeholder="상품명, 특징, 가격, 대상 고객 등..."
              rows={4}
              className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-[16px] text-text placeholder:text-muted focus:outline-none focus:border-primary/50 resize-none"
            />
            <button onClick={() => { setManualMode(false); setProductInfo(''); setUrl('') }} className="text-[14px] text-muted hover:text-dim">
              ← URL 입력으로
            </button>
          </div>
        )}
      </div>

      {/* Step 2: 채널 / 톤 / 세그먼트 */}
      <div className="bg-surface border border-border-muted rounded-xl p-4 space-y-3">
        <p className="text-[14px] text-muted uppercase tracking-widest">
          <span className="text-primary mr-2">02</span>채널 · 톤 · 세그먼트
        </p>

        <div>
          <p className="text-[13px] text-muted mb-1.5">채널</p>
          <div className="flex flex-wrap gap-1.5">
            {CHANNELS.map(c => (
              <button key={c.id} onClick={() => setChannel(c.id)}
                className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[14px] border transition-colors',
                  channel === c.id ? `${c.bg} ${c.color} ${c.border}` : 'bg-bg text-muted border-border hover:border-border'
                )}>
                <c.icon size={13} />{c.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[13px] text-muted mb-1.5">톤</p>
          <div className="flex flex-wrap gap-1.5">
            {TONES.map(t => (
              <button key={t} onClick={() => setTone(t)}
                className={cn('px-2.5 py-1 rounded-lg text-[14px] border transition-colors',
                  tone === t ? 'bg-primary/20 text-primary border-primary/30' : 'bg-bg text-muted border-border hover:border-border'
                )}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[13px] text-muted mb-1.5">세그먼트</p>
          <div className="flex flex-wrap gap-1.5">
            {SEGMENTS.map(s => (
              <button key={s.id} onClick={() => setSegment(s.id)}
                className={cn('px-2.5 py-1 rounded-lg text-[14px] border transition-colors',
                  segment === s.id ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-bg text-muted border-border hover:border-border'
                )}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* 미디어 생성 */}
        <div className="space-y-3">
          <p className="text-[13px] text-muted font-medium uppercase tracking-wider">미디어 생성</p>

          {/* 이미지 AI */}
          <div>
            <p className="text-[13px] text-muted mb-1.5">이미지 생성 AI (택 1)</p>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'ideogram',    label: 'Ideogram' },
                { id: 'dalle3',      label: 'DALL-E 3' },
                { id: 'flux',        label: 'Flux 1.1 Pro' },
                { id: 'stability',   label: 'Stable Diffusion XL' },
                { id: 'google_img',  label: 'Google Imagen 3' },
              ].map(p => (
                <button key={p.id}
                  onClick={() => setImageProvider(imageProvider === p.id ? null : p.id)}
                  className={cn('px-2.5 py-1 rounded-lg text-[14px] border transition-colors',
                    imageProvider === p.id
                      ? 'bg-primary/20 text-primary border-primary/40'
                      : 'bg-bg text-muted border-border hover:border-border'
                  )}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* 영상 AI */}
          <div>
            <p className="text-[13px] text-muted mb-1.5">영상 생성 AI (택 1)</p>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'kling',    label: 'Kling 3.0' },
                { id: 'veo2',     label: 'Google Veo 2 ✦' },
                { id: 'runway',   label: 'Runway Gen-3' },
                { id: 'luma',     label: 'Luma Ray 2' },
                { id: 'heygen',   label: 'HeyGen 아바타' },
              ].map(p => (
                <button key={p.id}
                  onClick={() => setVideoProvider(videoProvider === p.id ? null : p.id)}
                  className={cn('px-2.5 py-1 rounded-lg text-[14px] border transition-colors',
                    videoProvider === p.id
                      ? 'bg-primary/20 text-primary border-primary/40'
                      : 'bg-bg text-muted border-border hover:border-border'
                  )}>
                  {p.label}
                </button>
              ))}
            </div>
            {withVideo && (
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <span className="text-[13px] text-muted">길이:</span>
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
                    <span className="text-[14px] text-dim">{d.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* 음성/스톡 */}
          <div className="flex flex-wrap gap-4">
            <div>
              <p className="text-[13px] text-muted mb-1.5">음성 나레이션</p>
              <div className="flex gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={withAudio} onChange={e => setWithAudio(e.target.checked)} className="w-3.5 h-3.5 accent-primary" />
                  <span className="text-[15px] text-dim">AI 음성 추가</span>
                </label>
                {withAudio && (
                  <select value={audioProvider} onChange={e => setAudioProvider(e.target.value as 'elevenlabs' | 'openai_tts')}
                    className="text-[14px] bg-bg border border-border text-dim rounded px-2 py-0.5">
                    <option value="elevenlabs">ElevenLabs</option>
                    <option value="openai_tts">OpenAI TTS</option>
                  </select>
                )}
              </div>
            </div>
            <div>
              <p className="text-[13px] text-muted mb-1.5">스톡 미디어</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={withStock} onChange={e => setWithStock(e.target.checked)} className="w-3.5 h-3.5 accent-primary" />
                <span className="text-[15px] text-dim">Pexels B-roll</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* 생성 버튼 */}
      <button
        onClick={() => generateMutation.mutate()}
        disabled={!productInfo.trim() || generateMutation.isPending || !canGenerate}
        className="w-full py-3 bg-primary hover:bg-primary/90 text-white rounded-xl text-[17px] font-semibold flex items-center justify-center gap-2 disabled:opacity-40 transition-colors"
      >
        {generateMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
        {generateMutation.isPending ? '생성 중...' : 'AI 콘텐츠 생성'}
      </button>

      {generateMutation.isError && (
        <div className="p-3 bg-red-900/10 border border-red-800/30 rounded-xl text-[15px] text-red-400 flex items-center gap-2">
          <AlertTriangle size={15} />
          {generateMutation.error instanceof Error ? generateMutation.error.message : '생성 실패'}
        </div>
      )}

      {/* 결과 */}
      {result && (
        <div className="bg-surface border border-primary/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[14px] text-primary flex items-center gap-1.5">
              <CheckCircle size={13} />생성 완료
            </p>
            <div className="flex gap-1 text-[13px] text-muted">
              <span className="bg-surface-3 px-2 py-0.5 rounded">{result.channel}</span>
              {result.segment && <span className="bg-surface-3 px-2 py-0.5 rounded">{result.segment}</span>}
            </div>
          </div>

          <div className="bg-bg rounded-lg p-3 mb-3">
            <p className="text-[16px] text-text whitespace-pre-wrap leading-relaxed">{result.content}</p>
          </div>

          {/* 미디어 미리보기 */}
          {(result.image_url || result.video_url) && (
            <div className="flex gap-2 mb-3">
              {result.image_url && !result.image_url.startsWith('__STUB') && (
                <img src={result.image_url} alt="생성된 이미지" className="h-20 w-20 object-cover rounded-lg border border-border" />
              )}
              {result.image_url?.startsWith('__STUB') && (
                <div className="h-20 w-20 bg-surface-3 rounded-lg border border-dashed border-[#444] flex items-center justify-center text-[9px] text-muted">이미지 준비중</div>
              )}
              {result.video_url && !result.video_url.startsWith('__STUB') && (
                <div className="h-20 w-20 bg-purple-500/10 rounded-lg border border-purple-500/20 flex items-center justify-center text-[13px] text-purple-400">영상</div>
              )}
            </div>
          )}

          {/* 발행 채널 멀티 선택 */}
          <div className="mb-2">
            <p className="text-[13px] text-muted mb-1.5">발행 채널 선택</p>
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map(c => {
                const checked = publishPlatforms.includes(c.id)
                return (
                  <label key={c.id} className={cn(
                    'flex items-center gap-1.5 px-2 py-1 rounded-lg border cursor-pointer text-[14px] transition-colors',
                    checked ? `${c.bg} ${c.color} ${c.border}` : 'text-muted border-border hover:border-border'
                  )}>
                    <input type="checkbox" className="hidden"
                      checked={checked}
                      onChange={e => setPublishPlatforms(prev =>
                        e.target.checked ? [...prev, c.id] : prev.filter(p => p !== c.id)
                      )}
                    />
                    <c.icon size={12} />{c.label}
                  </label>
                )
              })}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => { navigator.clipboard.writeText(result.content); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-3 hover:bg-[#27272a] text-dim rounded-lg text-[15px] transition-colors"
            >
              {copied ? <CheckCircle size={14} className="text-green-400" /> : <Copy size={14} />}
              {copied ? '복사됨' : '복사'}
            </button>
            <button
              onClick={handlePublish}
              disabled={publishLoading || publishPlatforms.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/20 text-primary border border-primary/30 rounded-lg text-[15px] hover:bg-primary/30 disabled:opacity-40 transition-colors"
            >
              {publishLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {publishPlatforms.length > 1 ? `${publishPlatforms.length}채널 발사` : publishPlatforms[0] ? `${publishPlatforms[0]} 발사` : '채널 선택'}
            </button>
          </div>

          {publishResult && (
            <p className={cn('mt-2 text-[15px]', publishResult.startsWith('✓') ? 'text-green-400' : 'text-amber-400')}>
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
          className={cn('px-2.5 py-1 rounded-lg text-[14px] border', channelFilter === 'all' ? 'bg-primary/20 text-primary border-primary/30' : 'text-muted border-border')}>
          전체
        </button>
        {CHANNELS.map(c => (
          <button key={c.id} onClick={() => setChannelFilter(c.id)}
            className={cn('flex items-center gap-1 px-2.5 py-1 rounded-lg text-[14px] border transition-colors',
              channelFilter === c.id ? `${c.bg} ${c.color} ${c.border}` : 'text-muted border-border hover:border-border'
            )}>
            <c.icon size={12} />{c.label}
          </button>
        ))}
        <button onClick={() => refetch()} className="ml-auto text-muted hover:text-dim">
          <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-primary" /></div>
      ) : contents.length === 0 ? (
        <div className="text-center py-12 text-muted text-[16px]">아직 생성된 콘텐츠 없음</div>
      ) : (
        <div className="space-y-3">
          {contents.map(item => {
            const ch = CHANNELS.find(c => c.id === item.channel)
            return (
              <div key={item.id} className="bg-surface border border-border-muted rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {ch && <ch.icon size={14} className={ch.color} />}
                    <span className={cn('text-[14px] font-medium', ch?.color ?? 'text-dim')}>{item.channel}</span>
                    {item.segment && <span className="text-[13px] text-muted bg-surface-3 px-2 py-0.5 rounded">{item.segment}</span>}
                    <span className={cn('text-[9px] px-1.5 py-0.5 rounded border',
                      item.status === 'posted'    ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                      item.status === 'scheduled' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                      'bg-surface-3 text-muted border-border'
                    )}>
                      {item.status === 'posted' ? '발사완료' : item.status === 'scheduled' ? '예약됨' : '대기중'}
                    </span>
                  </div>
                  <span className="text-[13px] text-muted">{new Date(item.created_at).toLocaleDateString('ko-KR')}</span>
                </div>

                <p className="text-[15px] text-dim whitespace-pre-wrap line-clamp-4 mb-3">{item.content}</p>

                <div className="flex items-center gap-2 flex-wrap">
                  {item.image_url && !item.image_url.startsWith('__STUB') && (
                    <img src={item.image_url} alt="" className="h-12 w-12 object-cover rounded-md border border-border" />
                  )}
                  {item.video_url && !item.video_url.startsWith('__STUB') && (
                    <div className="h-12 w-12 bg-purple-500/10 rounded-md border border-purple-500/20 flex items-center justify-center text-[9px] text-purple-400">영상</div>
                  )}
                  <div className="ml-auto flex gap-1.5">
                    {/* 이미지만 재생성 */}
                    <button onClick={() => handleRegen(item, true, false)} disabled={regenId === item.id}
                      title="이미지만 재생성 (텍스트 재활용)"
                      className="flex items-center gap-1 px-2 py-1 text-[13px] text-muted hover:text-pink-400 border border-border hover:border-pink-500/30 rounded-lg transition-colors disabled:opacity-40">
                      {regenId === item.id ? <Loader2 size={9} className="animate-spin" /> : <RefreshCw size={9} />}이미지
                    </button>
                    {/* 영상만 재생성 */}
                    <button onClick={() => handleRegen(item, false, true)} disabled={regenId === item.id}
                      title="영상만 재생성 (텍스트 재활용)"
                      className="flex items-center gap-1 px-2 py-1 text-[13px] text-muted hover:text-purple-400 border border-border hover:border-purple-500/30 rounded-lg transition-colors disabled:opacity-40">
                      {regenId === item.id ? <Loader2 size={9} className="animate-spin" /> : <RefreshCw size={9} />}영상
                    </button>
                    <button onClick={() => navigator.clipboard.writeText(item.content)}
                      className="flex items-center gap-1 px-2 py-1 text-[13px] text-muted hover:text-dim border border-border rounded-lg transition-colors">
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
          { label: '전체',    value: stats.total,   color: 'text-text', bg: 'bg-surface',       border: 'border-[#1c1c20]' },
          { label: '🔥 Hot',  value: stats.hot,     color: 'text-red-400',   bg: 'bg-red-500/10',      border: 'border-red-500/20' },
          { label: '🌱 Nurture', value: stats.nurture, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
          { label: '❄️ Cold', value: stats.cold,    color: 'text-slate-400', bg: 'bg-slate-500/10',    border: 'border-slate-500/20' },
        ].map(s => (
          <div key={s.label} className={cn('rounded-xl p-3 border text-center', s.bg, s.border)}>
            <p className={cn('text-[22px] font-bold leading-none', s.color)}>{s.value}</p>
            <p className="text-[13px] text-muted mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* 평균 점수 + CDP 트리거 + 리타겟 */}
      <div className="flex items-center justify-between bg-surface border border-border-muted rounded-xl p-3">
        <div className="flex items-center gap-3">
          <BarChart2 size={16} className="text-primary" />
          <span className="text-[15px] text-dim">평균 점수</span>
          <span className="text-[20px] font-bold text-primary">{stats.avgScore}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {(triggerMsg || retargetMsg) && (
            <span className="text-[14px] text-green-400">{retargetMsg || triggerMsg}</span>
          )}
          <button onClick={handleRetarget} disabled={retargetLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg text-[14px] hover:bg-amber-500/20 disabled:opacity-40 transition-colors">
            {retargetLoading ? <Loader2 size={13} className="animate-spin" /> : <Target size={13} />}
            리타겟
          </button>
          <button onClick={handleTrigger} disabled={triggerLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/20 text-primary border border-primary/30 rounded-lg text-[14px] hover:bg-primary/30 disabled:opacity-40 transition-colors">
            {triggerLoading ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
            CDP 트리거
          </button>
        </div>
      </div>

      {/* AI Attribution 채널 기여도 */}
      {attribution && attribution.channels.length > 0 && (
        <div className="bg-surface border border-border-muted rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <BarChart2 size={14} className="text-purple-400" />
            <span className="text-[14px] text-muted uppercase tracking-widest">AI Attribution — 채널 기여도</span>
            <span className="ml-auto text-[13px] text-muted">Top: {attribution.topChannel}</span>
          </div>
          <div className="space-y-1.5">
            {attribution.channels.slice(0, 5).map(ch => {
              const c = CHANNELS.find(x => x.id === ch.channel)
              return (
                <div key={ch.channel} className="flex items-center gap-2">
                  <div className="flex items-center gap-1 w-24 shrink-0">
                    {c && <c.icon size={9} className={c.color} />}
                    <span className="text-[13px] text-dim truncate">{ch.channel}</span>
                  </div>
                  <div className="flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500/60 rounded-full transition-all"
                      style={{ width: `${ch.attributionPct}%` }} />
                  </div>
                  <span className="text-[13px] text-muted w-8 text-right shrink-0">{ch.attributionPct}%</span>
                  <span className="text-[13px] text-muted w-10 text-right shrink-0">{ch.leadsAttr}건</span>
                </div>
              )
            })}
          </div>
          <div className="mt-2 pt-2 border-t border-border-muted grid grid-cols-3 gap-2 text-center">
            {[
              { label: '발행', value: attribution.kpis.totalReach },
              { label: '전환율', value: `${attribution.kpis.conversionRate}%` },
              { label: '참여율', value: `${attribution.kpis.engagementRate}x` },
            ].map(k => (
              <div key={k.label}>
                <p className="text-[17px] font-bold text-purple-400">{k.value}</p>
                <p className="text-[9px] text-muted">{k.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 티어 필터 */}
      <div className="flex items-center gap-1.5">
        {([undefined, 'hot', 'nurture', 'cold'] as const).map(t => (
          <button key={t ?? 'all'} onClick={() => setTierFilter(t)}
            className={cn('px-3 py-1.5 rounded-lg text-[14px] border transition-colors',
              tierFilter === t
                ? t === 'hot'     ? 'bg-red-500/20 text-red-400 border-red-500/30'
                : t === 'nurture' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                : t === 'cold'    ? 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                :                   'bg-primary/20 text-primary border-primary/30'
                : 'text-muted border-border hover:border-border'
            )}>
            {t === undefined ? '전체' : t === 'hot' ? '🔥 Hot' : t === 'nurture' ? '🌱 Nurture' : '❄️ Cold'}
          </button>
        ))}
        <button onClick={() => refetch()} className="ml-auto text-muted hover:text-dim">
          <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* 리드 목록 */}
      {isDummy && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/8 border border-amber-500/20 rounded-lg text-[13px] text-amber-400">
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
              <div key={lead.id} className="bg-surface border border-border-muted rounded-xl p-3 flex items-center gap-3">
                <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-[14px] font-bold shrink-0',
                  lead.tier === 'hot'     ? 'bg-red-500/20 text-red-400' :
                  lead.tier === 'nurture' ? 'bg-yellow-500/20 text-yellow-400' :
                                            'bg-slate-500/20 text-slate-400')}>
                  {lead.score}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[15px] text-dim font-mono truncate">
                      {lead.profile_id ? `Profile ${lead.profile_id.slice(0, 8)}` : '미션 집계'}
                    </span>
                    <span className={cn('text-[9px] px-1.5 py-0.5 rounded border shrink-0',
                      lead.tier === 'hot'     ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                      lead.tier === 'nurture' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                                                'bg-slate-500/10 text-slate-400 border-slate-500/20')}>
                      {lead.tier.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[13px] text-muted">
                    {sigs.slice(-3).map((s, i) => (
                      <span key={i} className="bg-surface-3 px-1.5 py-0.5 rounded">{s.type}</span>
                    ))}
                    <span className="ml-auto">{new Date(lead.last_signal_at).toLocaleDateString('ko-KR')}</span>
                  </div>
                </div>
                <div className="w-16 shrink-0">
                  <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full',
                      lead.tier === 'hot' ? 'bg-red-400' : lead.tier === 'nurture' ? 'bg-yellow-400' : 'bg-slate-400')}
                      style={{ width: `${Math.min(100, lead.score)}%` }} />
                  </div>
                  <p className="text-[9px] text-center text-muted mt-0.5">{lead.score}pt</p>
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
          <p className="text-[16px] font-semibold text-text">CDP ID Graph</p>
          <p className="text-[14px] text-muted">동일 사용자의 여러 식별자를 하나의 통합 프로파일로 연결합니다</p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-[13px] text-amber-400 bg-amber-500/8 border border-amber-500/20 px-2.5 py-1.5 rounded-lg">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
          더미 데이터 표시 중
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: '통합 프로파일', value: '5',  color: 'text-text', bg: 'bg-surface', border: 'border-[#1c1c20]' },
          { label: '🔥 Hot',        value: '2',  color: 'text-red-400',    bg: 'bg-red-500/10', border: 'border-red-500/20' },
          { label: '🌱 Nurture',    value: '2',  color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
          { label: '식별자 수',     value: '12', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
        ].map(s => (
          <div key={s.label} className={cn('rounded-xl p-3 border text-center', s.bg, s.border)}>
            <p className={cn('text-[22px] font-bold leading-none', s.color)}>{s.value}</p>
            <p className="text-[13px] text-muted mt-1">{s.label}</p>
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
                  : 'bg-surface border-border-muted hover:border-border'
              )}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-[14px] font-bold shrink-0',
                  profile.tier === 'hot'     ? 'bg-red-500/20 text-red-400' :
                  profile.tier === 'nurture' ? 'bg-yellow-500/20 text-yellow-400' :
                                               'bg-slate-500/20 text-slate-400'
                )}>
                  {profile.score}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] text-text font-medium truncate">{profile.name}</p>
                  <p className="text-[9px] text-muted">{profile.identifiers.length}개 식별자</p>
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
                  <span key={i} className="text-[9px] bg-surface-3 px-1.5 py-0.5 rounded text-muted">
                    {id.icon} {id.type}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>

        {/* 프로파일 상세 */}
        <div className="flex-1 bg-surface border border-border-muted rounded-xl overflow-hidden">
          {selectedProfile ? (
            <div className="p-4 h-full overflow-y-auto">
              {/* 헤더 */}
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border-muted">
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center text-[16px] font-bold shrink-0',
                  selectedProfile.tier === 'hot'     ? 'bg-red-500/20 text-red-400' :
                  selectedProfile.tier === 'nurture' ? 'bg-yellow-500/20 text-yellow-400' :
                                                       'bg-slate-500/20 text-slate-400'
                )}>
                  {selectedProfile.score}
                </div>
                <div>
                  <p className="text-[17px] font-semibold text-text">{selectedProfile.name}</p>
                  <p className="text-[13px] text-muted">
                    첫 방문: {selectedProfile.firstSeen} · 최근: {selectedProfile.lastSeen}
                  </p>
                </div>
              </div>

              {/* 연결된 식별자 (ID Graph) */}
              <div className="mb-4">
                <p className="text-[13px] font-semibold text-muted uppercase tracking-widest mb-2">연결된 식별자 (ID Graph)</p>
                <div className="space-y-1.5">
                  {selectedProfile.identifiers.map((id, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 bg-bg border border-border rounded-lg">
                      <span className="text-sm shrink-0">{id.icon}</span>
                      <span className="text-[13px] text-muted w-16 shrink-0 uppercase">{id.type}</span>
                      <code className="text-[14px] text-emerald-400 flex-1 truncate">{id.value}</code>
                      {i > 0 && (
                        <span className="text-[9px] text-indigo-400 shrink-0">→ 동일 사용자</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 터치포인트 */}
              <div>
                <p className="text-[13px] font-semibold text-muted uppercase tracking-widest mb-2">터치포인트 히스토리</p>
                <div className="space-y-1">
                  {selectedProfile.touchpoints.map((tp, i) => (
                    <div key={i} className="flex items-center gap-2 text-[14px] text-muted">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500/60 shrink-0" />
                      {tp}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted p-8">
              <Target size={32} strokeWidth={1.5} />
              <p className="text-sm text-muted">왼쪽에서 프로파일을 선택하면<br />연결된 식별자와 터치포인트를 확인할 수 있습니다</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 영상 제작 탭 (vibe-video 파이프라인) ──────────────────────────────────────

const VIDEO_PIPELINE_STEPS = [
  {
    step: 1, icon: Film, color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20',
    title: '원본 영상 준비',
    desc: 'footage/ 폴더에 원본 영상(mp4, mov)을 넣으세요. 인터뷰, 강의, 제품 소개 등 어떤 영상이든 가능합니다.',
    action: null,
  },
  {
    step: 2, icon: Mic, color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/20',
    title: 'AI 트랜스크립션 + 자막',
    desc: 'ElevenLabs로 자동 트랜스크립션 → filler word 제거 → SRT 자막 생성. Claude Code에서 video-use 스킬이 자동 실행됩니다.',
    action: null,
  },
  {
    step: 3, icon: Image, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20',
    title: 'Pexels B-roll + 색보정',
    desc: 'Pexels API로 관련 B-roll 영상 자동 검색·삽입 + 색보정 자동 적용. edit/ 폴더에 편집본 출력.',
    action: null,
  },
  {
    step: 4, icon: Play, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20',
    title: 'Remotion 모션그래픽 합성',
    desc: 'VibeIntro / LowerThird / VibeOutro 컴포지션을 렌더링해서 편집본과 합성. out/ 폴더에 최종 MP4 출력.',
    action: null,
  },
]

const VIDEO_TEMPLATES = [
  { id: 'tutorial', label: '튜토리얼 영상', desc: '단계별 설명 + 화면 녹화 편집', duration: '5-15분', platform: 'YouTube' },
  { id: 'shorts',   label: '쇼츠/릴스',    desc: '하이라이트 컷 + 자막 강조',   duration: '60초',   platform: 'YouTube/Instagram' },
  { id: 'talking',  label: '토킹헤드',      desc: 'filler word 제거 + B-roll',  duration: '2-10분', platform: '전 채널' },
  { id: 'product',  label: '제품 소개',     desc: '제품 클로즈업 + 나레이션',    duration: '1-3분',  platform: '전 채널' },
  { id: 'podcast',  label: '팟캐스트 클립', desc: '오디오→영상 변환 + 자막',    duration: '1-5분',  platform: 'YouTube/TikTok' },
]

const CLAUDE_COMMANDS = [
  { label: '자막 추가 + filler 제거', cmd: '"footage 폴더의 영상에 자막 추가하고 filler word 제거해줘"' },
  { label: '쇼츠용 하이라이트 추출', cmd: '"영상에서 핵심 30초 하이라이트 추출해서 쇼츠 버전 만들어줘"' },
  { label: 'B-roll + 색보정',        cmd: '"footage 영상에 B-roll 삽입하고 시네마틱 색보정 적용해줘"' },
  { label: '인트로/아웃트로 합성',    cmd: '"VibeIntro와 VibeOutro를 편집본에 합성해서 최종 영상 만들어줘"' },
]

function VideoProductionTab() {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [copiedCmd, setCopiedCmd] = useState<number | null>(null)

  const copyCmd = (idx: number, cmd: string) => {
    navigator.clipboard.writeText(cmd)
    setCopiedCmd(idx)
    setTimeout(() => setCopiedCmd(null), 2000)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
          <Video size={20} className="text-violet-400" />
        </div>
        <div>
          <h2 className="text-[18px] font-bold text-text">영상 제작 파이프라인</h2>
          <p className="text-[14px] text-muted">vibe-video × ElevenLabs × Pexels × Remotion</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-[13px] text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2.5 py-1 rounded-full">
          <Play size={9} />Claude Code video-use 스킬 필요
        </div>
      </div>

      {/* 파이프라인 단계 */}
      <div>
        <p className="text-[14px] font-bold text-muted uppercase tracking-widest mb-3">제작 파이프라인</p>
        <div className="space-y-2">
          {VIDEO_PIPELINE_STEPS.map(s => (
            <div key={s.step} className={`flex items-start gap-3 p-3.5 rounded-xl border ${s.bg} ${s.border}`}>
              <div className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center bg-black/20`}>
                <s.icon size={16} className={s.color} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-[9px] font-black ${s.color} opacity-60`}>STEP {s.step}</span>
                  <span className="text-[15px] font-semibold text-text">{s.title}</span>
                </div>
                <p className="text-[14px] text-muted leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 영상 템플릿 선택 */}
      <div>
        <p className="text-[14px] font-bold text-muted uppercase tracking-widest mb-3">영상 유형 선택</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {VIDEO_TEMPLATES.map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedTemplate(selectedTemplate === t.id ? null : t.id)}
              className={cn(
                'text-left p-3 rounded-xl border-2 transition-all',
                selectedTemplate === t.id
                  ? 'bg-primary/10 border-primary/40'
                  : 'bg-white/3 border-white/8 hover:bg-white/6 hover:border-white/15',
              )}
            >
              <p className={cn('text-[15px] font-semibold mb-0.5', selectedTemplate === t.id ? 'text-primary' : 'text-text')}>{t.label}</p>
              <p className="text-[13px] text-muted mb-1">{t.desc}</p>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-muted bg-white/5 px-1.5 py-0.5 rounded">{t.duration}</span>
                <span className="text-[9px] text-muted">{t.platform}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Claude Code 명령어 */}
      <div>
        <p className="text-[14px] font-bold text-muted uppercase tracking-widest mb-3">Claude Code 명령어 (복사 후 터미널에서 실행)</p>
        <div className="space-y-2">
          {CLAUDE_COMMANDS.map((c, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-surface border border-border-muted rounded-lg px-3 py-2.5">
              <span className="text-[14px] text-muted shrink-0 w-32">{c.label}</span>
              <code className="flex-1 text-[14px] text-emerald-400/80 font-mono truncate">{c.cmd}</code>
              <button
                onClick={() => copyCmd(idx, c.cmd)}
                className="shrink-0 text-muted hover:text-dim transition-colors"
              >
                {copiedCmd === idx ? <CheckCircle size={15} className="text-emerald-400" /> : <Copy size={15} />}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Remotion 컴포지션 */}
      <div>
        <p className="text-[14px] font-bold text-muted uppercase tracking-widest mb-3">Remotion 모션그래픽 컴포지션</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: 'VibeIntro',   label: '인트로 타이틀',  cmd: 'npx remotion render VibeIntro out/intro.mp4' },
            { id: 'LowerThird', label: '로워서드 자막',   cmd: 'npx remotion render LowerThird out/lower.mp4' },
            { id: 'VibeOutro',  label: '아웃트로',        cmd: 'npx remotion render VibeOutro out/outro.mp4' },
            { id: 'MotionTitle', label: '모션 타이틀',    cmd: 'npx remotion render MotionTitle out/title.mp4' },
          ].map(comp => (
            <div key={comp.id} className="bg-surface border border-border-muted rounded-lg p-3">
              <p className="text-[15px] font-semibold text-text mb-0.5">{comp.label}</p>
              <code className="text-[13px] text-violet-400/70 font-mono">{comp.id}</code>
              <div className="mt-2 flex gap-1">
                <button
                  onClick={() => { navigator.clipboard.writeText(comp.cmd) }}
                  className="flex items-center gap-1 text-[13px] text-muted hover:text-dim bg-white/5 px-2 py-1 rounded transition-colors"
                >
                  <Copy size={12} />명령어 복사
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 워크스페이스 경로 안내 */}
      <div className="p-4 bg-surface border border-border-muted rounded-xl">
        <p className="text-[14px] font-bold text-muted uppercase tracking-widest mb-3">워크스페이스 구조</p>
        <pre className="text-[14px] text-muted font-mono leading-relaxed">{`C:\\workspace\\vibe-video\\
  footage/     ← 원본 영상 넣는 곳
  edit/        ← 편집된 클립 출력
  out/         ← 최종 MP4 출력
  src/compositions/  ← Remotion 컴포지션`}</pre>
        <div className="mt-3 flex gap-2">
          <a
            href="https://remotion.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[13px] text-violet-400 hover:text-violet-300 transition-colors"
            onClick={e => { e.preventDefault(); (window as {electronAPI?: {openExternal?: (u:string)=>void}}).electronAPI?.openExternal?.('https://remotion.dev') }}
          >
            <ExternalLink size={12} />Remotion 문서
          </a>
          <span className="text-muted">·</span>
          <a
            href="https://elevenlabs.io"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[13px] text-sky-400 hover:text-sky-300 transition-colors"
            onClick={e => { e.preventDefault(); (window as {electronAPI?: {openExternal?: (u:string)=>void}}).electronAPI?.openExternal?.('https://elevenlabs.io') }}
          >
            <ExternalLink size={12} />ElevenLabs
          </a>
          <span className="text-muted">·</span>
          <a
            href="https://pexels.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[13px] text-emerald-400 hover:text-emerald-300 transition-colors"
            onClick={e => { e.preventDefault(); (window as {electronAPI?: {openExternal?: (u:string)=>void}}).electronAPI?.openExternal?.('https://pexels.com/api') }}
          >
            <ExternalLink size={12} />Pexels API
          </a>
        </div>
      </div>
    </div>
  )
}

// ── 프롬프트 라이브러리 탭 ────────────────────────────────────────────────────

type PromptCategory = 'all' | 'sns' | 'blog' | 'email' | 'ad' | 'video' | 'strategy'

interface PromptTemplate {
  id: string
  title: string
  category: Exclude<PromptCategory, 'all'>
  desc: string
  prompt: string
}

const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'sns-hook',
    category: 'sns',
    title: '인스타그램 훅 문장 생성',
    desc: '첫 1-2줄로 스크롤을 멈추는 강력한 훅 문장 5개',
    prompt: `다음 제품/서비스에 대해 인스타그램 피드를 스크롤하다가 멈추게 만드는 훅 문장 5개를 작성해주세요.

[제품/서비스]:

조건:
- 각 훅은 1~2문장, 40자 이내
- 감정 트리거 (궁금증·공감·충격·희망) 중 하나를 사용
- 해시태그 없이 본문 텍스트만 작성
- 마지막에 클릭 유도 문구 포함`,
  },
  {
    id: 'sns-carousel',
    category: 'sns',
    title: '카드뉴스 슬라이드 구성',
    desc: '7장 카드뉴스 각 슬라이드 텍스트 완성',
    prompt: `다음 주제로 인스타그램 카드뉴스 7장을 구성해주세요.

[주제]:

슬라이드 구성:
1. 커버 — 충격적인 숫자나 질문
2. 문제 제기 — 공감 유도
3. 핵심 인사이트 1
4. 핵심 인사이트 2
5. 핵심 인사이트 3
6. 솔루션/CTA
7. 마무리 + 팔로우 유도

각 슬라이드: 제목(15자↓) + 본문(50자↓) + 이모지 1개`,
  },
  {
    id: 'sns-thread',
    category: 'sns',
    title: 'X(트위터) 스레드 작성',
    desc: '10개 트윗으로 구성된 바이럴 스레드',
    prompt: `다음 주제로 X(트위터) 스레드 10개를 작성해주세요.

[주제]:

규칙:
- 1번 트윗: 훅 (숫자·질문·반전 중 하나)
- 2~9번 트윗: 각각 독립된 인사이트, 280자 이내
- 10번 트윗: 요약 + 팔로우 CTA
- 각 트윗 앞에 번호 표기 (예: 1/)`,
  },
  {
    id: 'sns-reels',
    category: 'sns',
    title: '릴스/쇼츠 스크립트 (60초)',
    desc: '60초 릴스 영상 스크립트 (훅→내용→CTA)',
    prompt: `다음 주제로 60초 릴스/쇼츠 스크립트를 작성해주세요.

[주제/제품]:

형식:
[0~3초] 훅 — 화면에 표시되는 자막 + 내레이션 텍스트
[3~50초] 핵심 내용 3포인트 (각 15초)
[50~60초] CTA — 팔로우·저장·링크 클릭 유도

추가 정보: 배경음악 무드, 텍스트 오버레이 위치 제안 포함`,
  },
  {
    id: 'blog-seo',
    category: 'blog',
    title: 'SEO 블로그 포스트 완성',
    desc: '검색 1페이지를 노리는 2000자 SEO 블로그',
    prompt: `다음 키워드로 네이버/구글 검색 상위 노출을 위한 블로그 포스트를 작성해주세요.

[메인 키워드]:
[서브 키워드 2~3개]:

구조:
1. SEO 제목 (키워드 포함, 30자↓)
2. 메타 설명 (160자↓)
3. 도입부 (200자 — 검색 의도 충족)
4. H2 섹션 3개 (각 300자, 소제목에 키워드 포함)
5. FAQ 3가지
6. 결론 + CTA

총 2,000자 이상, 자연스러운 키워드 밀도 유지`,
  },
  {
    id: 'blog-listicle',
    category: 'blog',
    title: '리스티클 블로그 (Top 10)',
    desc: '"Top 10" 형식의 높은 공유율 블로그 포스트',
    prompt: `다음 주제로 "Top 10" 리스티클 블로그 포스트를 작성해주세요.

[주제]:

형식:
- 제목: "2024년 [주제] Top 10 — 전문가가 직접 선정"
- 각 항목: 번호 + 소제목 + 150자 설명 + 실용 팁 1가지
- 도입부와 결론에 자연스러운 CTA 삽입
- 총 1,500자 이상`,
  },
  {
    id: 'blog-case-study',
    category: 'blog',
    title: '케이스 스터디 블로그',
    desc: '성공 사례 기반 신뢰도 높은 블로그 포스트',
    prompt: `다음 성공 사례를 기반으로 케이스 스터디 블로그 포스트를 작성해주세요.

[성공 사례 or 수치]:
[업종/제품]:

구조:
- 제목 (결과 수치 포함)
- Before: 문제 상황
- Solution: 어떻게 해결했나
- After: 구체적 결과 수치
- Key Takeaway 3가지
- 독자에게 적용 방법`,
  },
  {
    id: 'email-welcome',
    category: 'email',
    title: '웰컴 이메일 시퀀스 (5통)',
    desc: '신규 구독자를 팬으로 만드는 5통 이메일',
    prompt: `신규 구독자를 위한 웰컴 이메일 시퀀스 5통을 작성해주세요.

[브랜드/제품]:
[핵심 가치 제안]:

각 이메일:
1일차: 환영 + 즉시 가치 제공 (리소스/팁)
3일차: 창업자 스토리 + 왜 이걸 만들었나
5일차: 고객 성공 사례 + 사회적 증명
7일차: 핵심 기능/혜택 교육
10일차: 첫 구매 유도 (한정 혜택)

각 이메일: 제목 + 미리보기 텍스트 + 본문(300자↓) + CTA`,
  },
  {
    id: 'email-promo',
    category: 'email',
    title: '프로모션 이메일 (긴급성)',
    desc: '오픈율 높은 한정 할인 프로모션 이메일',
    prompt: `다음 프로모션을 위한 긴급성 있는 이메일을 작성해주세요.

[제품/서비스]:
[할인율/혜택]:
[마감 기한]:

포함 요소:
- 제목: 숫자 + 긴급성 키워드 (오늘만/마감/한정)
- 미리보기: 호기심 유발
- 본문: PAS 구조 (Problem → Agitate → Solve)
- 혜택 3가지 불릿 포인트
- 카운트다운 멘션
- 강력한 CTA 버튼 텍스트`,
  },
  {
    id: 'email-reengagement',
    category: 'email',
    title: '휴면 고객 재활성화 이메일',
    desc: '90일 이상 비활성 구독자를 돌아오게 만드는 이메일',
    prompt: `90일 이상 비활성 구독자를 위한 재활성화 이메일을 작성해주세요.

[브랜드]:
[새로 추가된 기능/혜택]:

구조:
- 제목: 솔직한 인정 or 그동안 무슨 일이 있었나
- 본문: 그동안 업데이트된 것들 간결하게 + 감사 표현
- 특별 복귀 혜택 제시
- 이탈 방지: "구독 해지" 링크도 명시
- CTA: 돌아오기 or 설정 변경`,
  },
  {
    id: 'ad-meta',
    category: 'ad',
    title: 'Meta 광고 카피 (3세트)',
    desc: 'A/B 테스트용 Meta 광고 카피 3세트',
    prompt: `다음 제품/서비스의 Meta(페이스북/인스타) 광고 카피 3세트를 작성해주세요.

[제품/서비스]:
[타깃 고객]:
[핵심 혜택]:

각 세트:
- 메인 텍스트 (125자↓, 훅 포함)
- 헤드라인 (40자↓, 가치 제안)
- 설명 (30자↓, 긴급성or사회적 증명)
- CTA 버튼 텍스트

세트 1: 감정 어필 / 세트 2: 로직/수치 / 세트 3: 사회적 증명`,
  },
  {
    id: 'ad-google',
    category: 'ad',
    title: '구글 검색광고 (RSA) 에셋',
    desc: '반응형 검색광고 헤드라인 15개 + 설명 4개',
    prompt: `다음 키워드로 구글 반응형 검색광고(RSA) 에셋을 작성해주세요.

[메인 키워드]:
[랜딩페이지 핵심 메시지]:
[경쟁 우위]:

산출물:
- 헤드라인 15개 (30자↓, 키워드 포함 5개 이상)
- 설명문 4개 (90자↓, 혜택과 CTA 포함)
- 헤드라인 그룹 분류: 키워드형/혜택형/CTA형`,
  },
  {
    id: 'ad-landing',
    category: 'ad',
    title: '랜딩페이지 카피 전체',
    desc: 'Hero부터 CTA까지 랜딩페이지 전체 카피',
    prompt: `다음 제품/서비스의 랜딩페이지 카피 전체를 작성해주세요.

[제품/서비스]:
[타깃]:
[핵심 고통 포인트]:

섹션별 카피:
1. Hero: 헤드라인 + 서브헤드 + CTA
2. 문제 인식: 3가지 고통 포인트
3. 솔루션: 기능 3개 (제목+설명+아이콘 제안)
4. 사회적 증명: 가상 후기 3개 (구체적 수치 포함)
5. FAQ: 5가지
6. 최종 CTA: 긴급성 + 리스크 제거 문구`,
  },
  {
    id: 'video-youtube',
    category: 'video',
    title: '유튜브 스크립트 (10분)',
    desc: '구독자를 팬으로 만드는 10분 유튜브 대본',
    prompt: `다음 주제로 10분 유튜브 영상 스크립트를 작성해주세요.

[주제]:
[채널 콘셉트/타깃]:

구조:
[0:00~0:30] 훅 — 시청 이유 + 약속
[0:30~1:30] 공감 — 시청자의 문제 정의
[1:30~8:00] 핵심 내용 3파트 (각 2분)
[8:00~9:30] 실행 가이드 + 사례
[9:30~10:00] CTA — 좋아요·구독·다음 영상 안내

내레이션 텍스트 + 화면 지시사항(B-roll 제안) 포함`,
  },
  {
    id: 'video-shorts',
    category: 'video',
    title: '유튜브 쇼츠 시리즈 5편',
    desc: '연속 시청 유도하는 쇼츠 시리즈 5편',
    prompt: `다음 주제로 유튜브 쇼츠 시리즈 5편을 작성해주세요.

[주제/카테고리]:

각 편 구성 (50~60초):
- 편 제목 (클릭율 높은 숫자/질문 형식)
- [0~3초] 훅 자막 + 나레이션
- [3~50초] 핵심 내용 (3포인트)
- [50~60초] 다음 편 예고 + 구독 CTA

5편 스토리 아크: 도입→심화→심화→심화→총정리`,
  },
  {
    id: 'strategy-content-calendar',
    category: 'strategy',
    title: '30일 콘텐츠 캘린더',
    desc: '채널별 30일 콘텐츠 발행 계획표',
    prompt: `다음 브랜드를 위한 30일 콘텐츠 캘린더를 작성해주세요.

[브랜드/제품]:
[주력 채널 2~3개]:
[이달의 마케팅 목표]:

형식: 표 형태
| 날짜 | 채널 | 콘텐츠 유형 | 주제/키워드 | 목표 |

주 4회 발행 기준, 채널 믹스 포함
특별 이벤트(주말·공휴일) 고려한 스케줄링`,
  },
  {
    id: 'strategy-competitor',
    category: 'strategy',
    title: '경쟁사 콘텐츠 전략 분석',
    desc: '경쟁사 분석 → 화이트스페이스 → 차별화 방향 도출',
    prompt: `다음 경쟁사들의 콘텐츠 전략을 분석하고 차별화 방향을 제시해주세요.

[우리 브랜드]:
[경쟁사 3개]:
[주력 채널]:

분석 항목:
1. 각 경쟁사 콘텐츠 포맷·주제·톤 요약
2. 공통 패턴 (업계 표준)
3. 우리가 파고들 수 있는 빈틈(화이트스페이스) 3가지
4. 차별화 콘텐츠 아이디어 5개
5. 즉시 실행 가능한 우선순위 액션 3가지`,
  },
  {
    id: 'strategy-persona',
    category: 'strategy',
    title: '고객 페르소나 3종 완성',
    desc: '마케팅 실행에 바로 쓸 수 있는 페르소나 3종',
    prompt: `다음 제품/서비스의 고객 페르소나 3종을 완성해주세요.

[제품/서비스]:
[현재 주요 고객 특성]:

각 페르소나:
- 이름·나이·직업·소득
- 하루 루틴 요약
- 핵심 고통 포인트 3가지
- 정보 탐색 채널 (SNS·검색어)
- 구매 결정 요인 3가지
- 메시지 프레임 제안
- 최적 광고 채널 + 톤앤매너`,
  },
  {
    id: 'strategy-launch',
    category: 'strategy',
    title: '제품 런칭 마케팅 플랜',
    desc: '출시 4주 전~1주 후 마케팅 타임라인',
    prompt: `다음 제품의 런칭 마케팅 플랜을 작성해주세요.

[제품/서비스]:
[출시 예정일]:
[예산 규모]:
[핵심 타깃]:

타임라인:
D-28~D-14: 티저·대기자 명단 확보 전략
D-14~D-7: 얼리버드·미디어 아웃리치
D-7~D-1: 카운트다운·앰배서더 활성화
D-Day: 런칭 이벤트·실시간 대응
D+1~D+7: 후기 수집·초기 리텐션

채널별 예산 배분 + KPI 제안 포함`,
  },
  {
    id: 'strategy-ab-test',
    category: 'strategy',
    title: 'A/B 테스트 실험 설계',
    desc: '마케팅 가설 → 실험 설계 → KPI 측정 플랜',
    prompt: `다음 마케팅 가설에 대한 A/B 테스트 실험 계획을 작성해주세요.

[가설]:
[테스트 대상 (랜딩·이메일·광고 등)]:
[현재 기준 수치]:

실험 계획:
1. 가설 명확화 (If/Then/Because 형식)
2. 대조군(A) vs 실험군(B) 정의
3. 측정 KPI 3개 + 성공 기준
4. 필요 샘플 수 계산 근거
5. 실험 기간 및 오염 변수 통제 방법
6. 결과 해석 기준 (유의미한 차이 정의)`,
  },
]

const CATEGORY_LABELS: Record<PromptCategory, string> = {
  all: '전체',
  sns: 'SNS',
  blog: '블로그',
  email: '이메일',
  ad: '광고',
  video: '영상',
  strategy: '전략',
}

function PromptLibraryTab() {
  const [category, setCategory] = useState<PromptCategory>('all')
  const [search, setSearch] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const filtered = PROMPT_TEMPLATES.filter(t => {
    const matchCat = category === 'all' || t.category === category
    const q = search.toLowerCase()
    const matchSearch = !q || t.title.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q)
    return matchCat && matchSearch
  })

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-semibold text-text flex items-center gap-2">
            <BookOpen size={17} className="text-primary" />
            프롬프트 라이브러리
          </h2>
          <p className="text-[15px] text-muted mt-0.5">
            {PROMPT_TEMPLATES.length}개 검증된 마케팅 프롬프트 — 복사해서 바로 사용하세요
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="프롬프트 검색..."
            className="w-full bg-surface border border-border-muted rounded-lg pl-8 pr-3 py-2 text-[15px] text-text placeholder-[#3f3f46] focus:outline-none focus:border-primary/50 transition-colors"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(CATEGORY_LABELS) as PromptCategory[]).map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                'px-2.5 py-1 rounded-full text-[14px] font-medium border transition-all',
                category === cat
                  ? 'bg-primary/20 text-primary border-primary/40'
                  : 'bg-surface text-muted border-border-muted hover:border-border hover:text-dim',
              )}
            >
              {CATEGORY_LABELS[cat]}
              {cat !== 'all' && (
                <span className="ml-1 opacity-60">
                  {PROMPT_TEMPLATES.filter(t => t.category === cat).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-muted text-sm">
          검색 결과가 없습니다
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(t => {
            const isExpanded = expanded === t.id
            const isCopied = copied === t.id
            return (
              <div
                key={t.id}
                className="bg-surface border border-border-muted rounded-xl p-4 hover:border-border transition-colors"
              >
                <div className="flex items-start gap-2 mb-2">
                  <div>
                    <span className={cn(
                      'inline-block text-[13px] px-1.5 py-0.5 rounded font-medium mb-1.5',
                      t.category === 'sns'      && 'bg-pink-500/15 text-pink-400',
                      t.category === 'blog'     && 'bg-green-500/15 text-green-400',
                      t.category === 'email'    && 'bg-blue-500/15 text-blue-400',
                      t.category === 'ad'       && 'bg-yellow-500/15 text-yellow-400',
                      t.category === 'video'    && 'bg-purple-500/15 text-purple-400',
                      t.category === 'strategy' && 'bg-primary/15 text-primary',
                    )}>
                      {CATEGORY_LABELS[t.category]}
                    </span>
                    <h3 className="text-[16px] font-semibold text-text leading-tight">{t.title}</h3>
                  </div>
                </div>
                <p className="text-[14px] text-muted mb-3 leading-relaxed">{t.desc}</p>

                <div
                  className={cn(
                    'bg-bg border border-border-muted rounded-lg p-3 text-[14px] text-muted font-mono leading-relaxed mb-3 cursor-pointer whitespace-pre-wrap transition-all',
                    !isExpanded && 'line-clamp-3',
                  )}
                  onClick={() => setExpanded(isExpanded ? null : t.id)}
                >
                  {t.prompt}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setExpanded(isExpanded ? null : t.id)}
                    className="text-[14px] text-muted hover:text-dim transition-colors"
                  >
                    {isExpanded ? '접기' : '전체 보기'}
                  </button>
                  <button
                    onClick={() => handleCopy(t.id, t.prompt)}
                    className={cn(
                      'ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[14px] font-medium border transition-all',
                      isCopied
                        ? 'bg-green-500/15 text-green-400 border-green-500/30'
                        : 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20',
                    )}
                  >
                    {isCopied ? <CheckCircle size={13} /> : <Copy size={13} />}
                    {isCopied ? '복사됨!' : '복사'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
