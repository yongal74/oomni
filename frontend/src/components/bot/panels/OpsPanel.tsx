import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { agentsApi, schedulesApi, type FeedItem, type Schedule } from '../../../lib/api'
import { Zap, Download, ChevronDown, ChevronRight, Copy } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { ArchiveButton } from '../shared/ArchiveButton'
import { NextBotDropdown } from '../shared/NextBotDropdown'

const OPS_TABS = [
  { key: 'automation', label: '자동화' },
  { key: 'finance', label: '재무' },
  { key: 'tax', label: '세무' },
  { key: 'hr', label: '인사' },
]

// ── 카테고리별 자동화 프리셋 정의 ────────────────────────────────────────────
interface AutomationPreset {
  name: string
  /** schedules API에 POST할 기본값 */
  triggerType: 'interval' | 'cron'
  triggerValue: string
}

interface AutomationCategory {
  id: string
  label: string
  presets: AutomationPreset[]
}

const AUTOMATION_CATEGORIES: AutomationCategory[] = [
  {
    id: 'general',
    label: '일반',
    presets: [
      { name: '이슈 자동생성', triggerType: 'cron', triggerValue: '0 9 * * 1-5' },
      { name: '일일 리포트 자동화', triggerType: 'cron', triggerValue: '0 18 * * 1-5' },
      { name: '주간 비용 정산', triggerType: 'cron', triggerValue: '0 10 * * 1' },
    ],
  },
  {
    id: 'finance',
    label: '재무',
    presets: [
      { name: '월별 손익계산서 자동생성', triggerType: 'cron', triggerValue: '0 9 1 * *' },
      { name: 'Stripe 매출 집계', triggerType: 'cron', triggerValue: '0 8 * * 1' },
      { name: '미수금 알림', triggerType: 'cron', triggerValue: '0 10 * * 3' },
    ],
  },
  {
    id: 'tax',
    label: '세무',
    presets: [
      { name: '분기별 부가세 정리', triggerType: 'cron', triggerValue: '0 9 1 1,4,7,10 *' },
      { name: '영수증 수집/분류', triggerType: 'cron', triggerValue: '0 9 * * 1' },
    ],
  },
  {
    id: 'hr',
    label: '인사',
    presets: [
      { name: '주간 업무일지', triggerType: 'cron', triggerValue: '0 17 * * 5' },
      { name: '월간 성과 정리', triggerType: 'cron', triggerValue: '0 9 28 * *' },
    ],
  },
]

// ── CategoryAccordion ─────────────────────────────────────────────────────────
function CategoryAccordion({
  category,
  activeScheduleNames,
  onPresetClick,
}: {
  category: AutomationCategory
  activeScheduleNames: Set<string>
  onPresetClick: (preset: AutomationPreset) => void
}) {
  const [open, setOpen] = useState(true)

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full px-3 py-2 bg-surface hover:bg-border/30 transition-colors"
      >
        <span className="text-xs font-medium text-dim">{category.label}</span>
        {open
          ? <ChevronDown size={12} className="text-muted" />
          : <ChevronRight size={12} className="text-muted" />}
      </button>

      {/* Presets */}
      {open && (
        <div className="divide-y divide-border/50">
          {category.presets.map(preset => {
            const isActive = activeScheduleNames.has(preset.name)
            return (
              <button
                key={preset.name}
                onClick={() => onPresetClick(preset)}
                title={isActive ? '활성 자동화 스케줄 — 클릭하여 관리' : '클릭하여 자동화 스케줄 생성'}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 bg-bg hover:bg-surface/60 transition-colors text-left group"
              >
                {/* 파란 불 (활성 표시) */}
                <div
                  className={cn(
                    'w-2 h-2 rounded-full shrink-0 transition-colors',
                    isActive
                      ? 'bg-blue-500 shadow-[0_0_4px_1px_rgba(59,130,246,0.5)]'
                      : 'bg-border group-hover:bg-border/80'
                  )}
                />
                <span className="text-sm text-dim flex-1 leading-snug">{preset.name}</span>
                {isActive && (
                  <span className="text-[10px] text-blue-400 shrink-0">활성</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// LEFT: 카테고리별 자동화 프리셋 + n8n 상태
export function OpsLeftPanel({ agentId, onSkillSelect }: { agentId: string; onSkillSelect?: (task: string) => void }) {
  const [n8nLocal, setN8nLocal] = useState<'checking' | 'online' | 'offline'>('checking')
  const [creatingPreset, setCreatingPreset] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch('http://localhost:5678', { mode: 'no-cors', signal: controller.signal })
      .then(() => setN8nLocal('online'))
      .catch(() => setN8nLocal('offline'))
    return () => controller.abort()
  }, [])

  // 현재 agentId에 연결된 스케줄 목록 조회
  const { data: schedulesData, refetch: refetchSchedules } = useQuery({
    queryKey: ['schedules', agentId],
    queryFn: () => schedulesApi.list({ agent_id: agentId }),
    refetchInterval: 10000,
    staleTime: 5000,
  })

  const activeScheduleNames = new Set<string>(
    ((schedulesData ?? []) as Schedule[])
      .filter(s => s.is_active)
      .map(s => s.name)
  )

  // 프리셋 클릭: AI로 n8n JSON 생성 + 스케줄 등록
  const handlePresetClick = async (preset: AutomationPreset) => {
    setCreatingPreset(preset.name)

    // 1) AI 봇 실행: n8n 워크플로우 JSON 생성
    const n8nTask = `"${preset.name}" n8n 워크플로우를 생성해줘. Cron 스케줄: ${preset.triggerValue}. 실제로 n8n에 import할 수 있는 완전한 JSON을 만들어줘.`
    onSkillSelect?.(n8nTask)

    // 2) 스케줄 등록 (이미 활성이면 스킵)
    if (!activeScheduleNames.has(preset.name)) {
      try {
        await schedulesApi.create({
          agent_id: agentId,
          mission_id: agentId,
          name: preset.name,
          trigger_type: preset.triggerType,
          trigger_value: preset.triggerValue,
        })
        await refetchSchedules()
      } catch {
        // 스케줄 생성 실패는 조용히 무시 (n8n JSON 생성은 이미 시작됨)
      }
    }

    setCreatingPreset(null)
  }

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      {/* n8n 상태 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted uppercase tracking-widest">n8n 연동</p>
          <div className="flex items-center gap-1">
            <div className={cn(
              'w-1.5 h-1.5 rounded-full',
              n8nLocal === 'online' ? 'bg-green-500' :
              n8nLocal === 'offline' ? 'bg-red-400' :
              'bg-yellow-400 animate-pulse'
            )} />
            <span className="text-[10px] text-muted">
              {n8nLocal === 'online' ? '로컬 실행 중' :
               n8nLocal === 'offline' ? '미실행' : '확인 중'}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <a
            href="http://localhost:5678"
            target="_blank"
            rel="noreferrer"
            className={cn(
              'flex-1 text-center py-1.5 rounded text-xs border transition-colors',
              n8nLocal === 'online'
                ? 'border-green-500/40 text-green-400 hover:bg-green-500/10'
                : 'border-border text-muted/40 pointer-events-none'
            )}
          >
            로컬 열기
          </a>
          <a
            href="https://n8n.cloud"
            target="_blank"
            rel="noreferrer"
            className="flex-1 text-center py-1.5 rounded text-xs border border-primary/30 text-primary hover:bg-primary/5 transition-colors"
          >
            n8n.cloud ↗
          </a>
        </div>
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-1.5 px-1">
        <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_4px_1px_rgba(59,130,246,0.5)]" />
        <span className="text-[10px] text-muted">활성화된 자동화 스케줄</span>
      </div>

      {/* 카테고리별 자동화 프리셋 */}
      <div className="space-y-2">
        {AUTOMATION_CATEGORIES.map(cat => (
          <CategoryAccordion
            key={cat.id}
            category={cat}
            activeScheduleNames={activeScheduleNames}
            onPresetClick={handlePresetClick}
          />
        ))}
      </div>

      {creatingPreset && (
        <p className="text-[10px] text-muted text-center animate-pulse">
          "{creatingPreset}" 스케줄 생성 중...
        </p>
      )}
    </div>
  )
}

// CENTER: 운영 탭
export function OpsCenterPanel({ agentId, streamOutput, isRunning }: { agentId: string; streamOutput?: string; isRunning?: boolean }) {
  const [activeTab, setActiveTab] = useState('automation')
  const { data: feed = [] } = useQuery({
    queryKey: ['bot-feed', agentId],
    queryFn: () => agentsApi.runs(agentId),
    select: (data: FeedItem[]) => data.filter(f => f.type === 'result'),
    refetchInterval: 3000,
  })

  const latest = feed[0]

  return (
    <div className="h-full flex flex-col">
      <div className="flex border-b border-border px-4 shrink-0">
        {OPS_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-3 text-sm border-b-2 -mb-px transition-colors',
              activeTab === tab.key
                ? 'border-primary text-text'
                : 'border-transparent text-muted hover:text-dim'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {isRunning ? (
          <pre className="text-base text-dim leading-relaxed whitespace-pre-wrap font-sans">{streamOutput || '자동화 구성 중...'}</pre>
        ) : !latest ? (
          streamOutput ? (
            <pre className="text-base text-dim leading-relaxed whitespace-pre-wrap font-sans">{streamOutput}</pre>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <Zap size={36} className="text-muted/30" />
              <p className="text-base text-muted">하단 입력창에서 자동화를 지시하세요</p>
              <p className="text-sm text-muted/60">"Slack 알림 자동화 워크플로우 만들어줘" 등</p>
            </div>
          )
        ) : (
          <div className="text-base text-dim leading-relaxed whitespace-pre-wrap">
            {latest.content}
          </div>
        )}
      </div>
    </div>
  )
}

const OPS_SKILLS = [
  { label: 'n8n 워크플로우', prompt: '/new-n8n-workflow Slack 메시지가 오면 자동으로 이슈를 생성하는 n8n 워크플로우를 만들어줘' },
  { label: '월간 재무', prompt: '/monthly-finance 이번 달 수입/지출 현황을 정리하고 MRR, 순이익, API 비용을 분석해줘' },
  { label: '비용 감사', prompt: '/audit-costs 현재 모든 구독 서비스와 API 비용을 감사하고 절감 방안을 제시해줘' },
  { label: '장애 보고서', prompt: '/incident-report 오늘 발생한 장애의 원인, 영향, 재발 방지 방안을 정리해줘' },
  { label: '세금 준비', prompt: '/tax-prep 이번 분기 세금 신고를 위한 수입/지출 데이터를 정리해줘' },
]

// RIGHT: n8n 워크플로우 관리 + import + 다음봇
export function OpsRightPanel({ agentId, onSkillSelect, currentRole = 'ops', content = '' }: {
  agentId: string
  nextBotName?: string
  onNextBot?: () => void
  onSkillSelect?: (prompt: string) => void
  currentRole?: string
  content?: string
}) {
  const [n8nStatus, setN8nStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    fetch('http://localhost:5678', { mode: 'no-cors', signal: ctrl.signal })
      .then(() => setN8nStatus('online'))
      .catch(() => setN8nStatus('offline'))
    return () => ctrl.abort()
  }, [])

  const { data: feed = [] } = useQuery({
    queryKey: ['bot-feed', agentId],
    queryFn: () => agentsApi.runs(agentId),
    select: (data: FeedItem[]) => data.filter(f => f.type === 'result'),
    refetchInterval: 3000,
  })

  const workflowResults = feed.filter(f => f.content.includes('"nodes"'))

  const extractJson = (wfContent: string): string => {
    const match = wfContent.match(/```json\n([\s\S]+?)\n```/)
    return match ? match[1] : wfContent
  }

  const handleDownloadWorkflow = (wfContent: string, idx: number) => {
    const json = extractJson(wfContent)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `oomni-workflow-${idx + 1}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleCopyWorkflow = (wfContent: string) => {
    navigator.clipboard.writeText(extractJson(wfContent))
    setImportMsg('클립보드에 복사됨!')
    setTimeout(() => setImportMsg(null), 2000)
  }

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const json = ev.target?.result as string
        JSON.parse(json) // validate
        const blob = new Blob([json], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = file.name
        a.click()
        URL.revokeObjectURL(url)
        setImportMsg('다운로드 완료! n8n에서 Import하세요')
      } catch {
        setImportMsg('유효하지 않은 JSON 파일입니다')
      }
      setTimeout(() => setImportMsg(null), 3000)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="p-4 h-full flex flex-col gap-4 overflow-y-auto">
      {/* n8n 연동 상태 */}
      <div>
        <p className="text-xs text-muted uppercase tracking-widest mb-2">n8n 연동</p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-bg border border-border">
            <div className="flex items-center gap-2">
              <div className={cn('w-2 h-2 rounded-full', n8nStatus === 'online' ? 'bg-green-500' : n8nStatus === 'offline' ? 'bg-red-400' : 'bg-yellow-400 animate-pulse')} />
              <span className="text-xs text-dim">로컬 n8n</span>
            </div>
            {n8nStatus === 'online' ? (
              <a href="http://localhost:5678" target="_blank" rel="noreferrer" className="text-[10px] text-primary hover:underline">열기 ↗</a>
            ) : (
              <span className="text-[10px] text-muted">미실행</span>
            )}
          </div>
          <a href="https://n8n.cloud" target="_blank" rel="noreferrer"
            className="flex items-center justify-between px-3 py-2 rounded-lg bg-bg border border-border hover:border-primary/40 transition-colors">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-400" />
              <span className="text-xs text-dim">n8n Cloud</span>
            </div>
            <span className="text-[10px] text-primary">접속 ↗</span>
          </a>
        </div>
      </div>

      <div className="flex-1">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted uppercase tracking-widest">워크플로우 관리</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-[10px] text-primary border border-primary/30 rounded px-1.5 py-0.5 hover:bg-primary/5 transition-colors"
          >
            JSON 불러오기
          </button>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
        </div>

        {importMsg && (
          <div className="mb-2 px-2 py-1.5 rounded bg-primary/10 border border-primary/20 text-[11px] text-primary">
            {importMsg}
          </div>
        )}

        {workflowResults.length === 0 ? (
          <div className="text-center py-3">
            <p className="text-xs text-muted/60 mb-1">AI가 생성한 워크플로우가 없습니다</p>
            <p className="text-[10px] text-muted/40">봇에게 n8n 워크플로우 생성을 요청하세요</p>
          </div>
        ) : (
          <div className="space-y-2">
            {workflowResults.map((wf, i) => (
              <div key={wf.id} className="px-3 py-3 rounded-lg bg-bg border border-border">
                <p className="text-xs text-dim mb-2 font-medium">워크플로우 #{i + 1}</p>
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    onClick={() => handleDownloadWorkflow(wf.content, i)}
                    className="flex items-center gap-1 text-[10px] text-primary border border-primary/30 rounded px-1.5 py-0.5 hover:bg-primary/5 transition-colors"
                  >
                    <Download size={9} /> 다운로드
                  </button>
                  <button
                    onClick={() => handleCopyWorkflow(wf.content)}
                    className="flex items-center gap-1 text-[10px] text-muted border border-border rounded px-1.5 py-0.5 hover:text-text transition-colors"
                  >
                    <Copy size={9} /> 복사
                  </button>
                  {n8nStatus === 'online' && (
                    <a
                      href="http://localhost:5678/workflow/new"
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => handleCopyWorkflow(wf.content)}
                      className="flex items-center gap-1 text-[10px] text-green-400 border border-green-500/30 rounded px-1.5 py-0.5 hover:bg-green-500/10 transition-colors"
                      title="JSON이 클립보드에 복사됩니다. n8n에서 붙여넣기 하세요."
                    >
                      n8n Import ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* 빠른 실행 */}
      <div>
        <p className="text-xs text-muted uppercase tracking-widest mb-2.5">빠른 실행</p>
        <div className="flex flex-wrap gap-1.5">
          {OPS_SKILLS.map(skill => (
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

      <ArchiveButton
        content={feed[0]?.content ?? ''}
        title={feed[0]?.content?.slice(0, 50)}
        botRole="ops"
        tags={['OOMNI', 'ops']}
      />

      <NextBotDropdown currentAgentId={agentId} currentRole={currentRole} content={content} />
    </div>
  )
}
