import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { feedApi, type FeedItem } from '../../../lib/api'
import { ChevronRight, Zap, Download } from 'lucide-react'
import { cn } from '../../../lib/utils'

const OPS_TABS = [
  { key: 'automation', label: '자동화' },
  { key: 'finance', label: '재무' },
  { key: 'tax', label: '세무' },
  { key: 'hr', label: '인사' },
]

const WORKFLOW_TEMPLATES = [
  { name: 'Slack → 이슈 자동 생성', status: 'active' },
  { name: '일일 리포트 자동화', status: 'active' },
  { name: '주간 비용 정산', status: 'inactive' },
  { name: '신규 가입 환영 메일', status: 'inactive' },
]

// LEFT: n8n 워크플로우 목록
export function OpsLeftPanel({ agentId }: { agentId: string }) {
  const { data: feed = [] } = useQuery({
    queryKey: ['bot-feed', agentId],
    queryFn: () => feedApi.list({ limit: 10 }),
    select: (data: FeedItem[]) => data.filter(f => f.agent_id === agentId && f.type === 'result'),
    refetchInterval: 5000,
  })

  // Extract n8n workflows from results
  const workflows = feed.filter(f => f.content.includes('"nodes"'))

  return (
    <div className="p-4 space-y-5">
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-muted uppercase tracking-widest">n8n 워크플로우</p>
          <a
            href="http://localhost:5678"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-primary hover:text-primary-hover transition-colors"
          >
            n8n 열기 ↗
          </a>
        </div>
        <div className="space-y-2">
          {WORKFLOW_TEMPLATES.map(wf => (
            <div key={wf.name} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-bg border border-border">
              <div className={cn(
                'w-2 h-2 rounded-full shrink-0',
                wf.status === 'active' ? 'bg-green-500' : 'bg-border'
              )} />
              <span className="text-sm text-dim leading-snug">{wf.name}</span>
            </div>
          ))}
        </div>
      </div>

      {workflows.length > 0 && (
        <div>
          <p className="text-xs text-muted uppercase tracking-widest mb-3">생성된 워크플로우</p>
          {workflows.map((wf, i) => (
            <div key={wf.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-primary/5 border border-primary/20 mb-2">
              <Zap size={13} className="text-primary shrink-0" />
              <span className="text-sm text-dim">워크플로우 #{i + 1}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// CENTER: 운영 탭
export function OpsCenterPanel({ agentId, streamOutput, isRunning }: { agentId: string; streamOutput?: string; isRunning?: boolean }) {
  const [activeTab, setActiveTab] = useState('automation')
  const { data: feed = [] } = useQuery({
    queryKey: ['bot-feed', agentId],
    queryFn: () => feedApi.list({ limit: 20 }),
    select: (data: FeedItem[]) => data.filter(f => f.agent_id === agentId && f.type === 'result'),
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

// RIGHT: n8n import + 다음봇
export function OpsRightPanel({ agentId, nextBotName, onNextBot, onSkillSelect }: {
  agentId: string
  nextBotName?: string
  onNextBot?: () => void
  onSkillSelect?: (prompt: string) => void
}) {
  const { data: feed = [] } = useQuery({
    queryKey: ['bot-feed', agentId],
    queryFn: () => feedApi.list({ limit: 5 }),
    select: (data: FeedItem[]) => data.filter(f => f.agent_id === agentId && f.type === 'result'),
    refetchInterval: 3000,
  })

  const workflowResults = feed.filter(f => f.content.includes('"nodes"'))

  const handleDownloadWorkflow = (content: string) => {
    const jsonMatch = content.match(/```json\n([\s\S]+?)\n```/)
    const json = jsonMatch ? jsonMatch[1] : content
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'oomni-workflow.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-4 h-full flex flex-col gap-4">
      <div className="flex-1">
        <p className="text-xs text-muted uppercase tracking-widest mb-3">워크플로우 관리</p>
        {workflowResults.length === 0 ? (
          <p className="text-sm text-muted/60">생성된 워크플로우가 없습니다</p>
        ) : (
          <div className="space-y-2">
            {workflowResults.map((wf, i) => (
              <div key={wf.id} className="px-3 py-3 rounded-lg bg-bg border border-border">
                <p className="text-sm text-dim mb-2">워크플로우 #{i + 1}</p>
                <button
                  onClick={() => handleDownloadWorkflow(wf.content)}
                  className="flex items-center gap-2 text-xs text-primary hover:text-primary-hover transition-colors"
                >
                  <Download size={12} />
                  JSON 다운로드 후 n8n Import
                </button>
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

      {nextBotName && (
        <div className="pt-3 border-t border-border">
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
