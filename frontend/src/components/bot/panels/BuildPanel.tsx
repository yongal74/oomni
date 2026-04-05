import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { issuesApi, feedApi, type Issue, type FeedItem } from '../../../lib/api'
import { ChevronRight, FileCode, Check } from 'lucide-react'
import { cn } from '../../../lib/utils'

const STATUS_LABELS = { open: '대기', in_progress: '진행중', done: '완료', cancelled: '취소' }
const STATUS_COLORS = {
  open: 'text-muted border-border',
  in_progress: 'text-primary border-primary/40',
  done: 'text-green-400 border-green-500/30',
  cancelled: 'text-muted/50 border-border/50',
}

// LEFT: 태스크 목록
export function BuildLeftPanel({ missionId }: { missionId: string }) {
  const qc = useQueryClient()
  const { data: issues = [] } = useQuery<Issue[]>({
    queryKey: ['issues', missionId],
    queryFn: () => issuesApi.list({ mission_id: missionId }),
    enabled: !!missionId,
    refetchInterval: 5000,
  })

  const updateIssue = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      issuesApi.update(id, { status: status as Issue['status'] }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['issues', missionId] }),
  })

  const byStatus = {
    open: issues.filter(i => i.status === 'open'),
    in_progress: issues.filter(i => i.status === 'in_progress'),
    done: issues.filter(i => i.status === 'done'),
  }

  return (
    <div className="p-4 space-y-5">
      {(['in_progress', 'open', 'done'] as const).map(status => (
        <div key={status}>
          <div className="flex items-center gap-2 mb-3">
            <span className={cn('text-xs font-medium uppercase tracking-widest', STATUS_COLORS[status].split(' ')[0])}>
              {STATUS_LABELS[status]}
            </span>
            <span className="text-xs text-muted bg-border/40 px-1.5 py-0.5 rounded-full">
              {byStatus[status].length}
            </span>
          </div>
          <div className="space-y-2">
            {byStatus[status].map(issue => (
              <div
                key={issue.id}
                className={cn('rounded-lg border px-3 py-2.5', STATUS_COLORS[status])}
              >
                <p className="text-sm text-dim leading-snug">{issue.title}</p>
                {status === 'open' && (
                  <button
                    onClick={() => updateIssue.mutate({ id: issue.id, status: 'in_progress' })}
                    className="mt-1.5 text-xs text-primary hover:text-primary-hover transition-colors"
                  >
                    시작 →
                  </button>
                )}
                {status === 'in_progress' && (
                  <button
                    onClick={() => updateIssue.mutate({ id: issue.id, status: 'done' })}
                    className="mt-1.5 flex items-center gap-1 text-xs text-green-400 hover:text-green-300 transition-colors"
                  >
                    <Check size={11} /> 완료 처리
                  </button>
                )}
              </div>
            ))}
            {byStatus[status].length === 0 && (
              <p className="text-xs text-muted/50 px-1">없음</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// CENTER: 코드/결과 출력
export function BuildCenterPanel({ agentId }: { agentId: string }) {
  const { data: feed = [] } = useQuery({
    queryKey: ['bot-feed', agentId],
    queryFn: () => feedApi.list({ limit: 20 }),
    select: (data: FeedItem[]) => data.filter(f => f.agent_id === agentId && f.type === 'result'),
    refetchInterval: 3000,
  })

  if (feed.length === 0) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
      <FileCode size={36} className="text-muted/30" />
      <p className="text-sm text-muted">하단 입력창에서 개발 태스크를 지시하세요</p>
      <p className="text-xs text-muted/60">"로그인 페이지 컴포넌트 만들어줘" 등</p>
    </div>
  )

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {feed.map(item => (
        <div key={item.id} className="bg-bg rounded-lg border border-border overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 bg-surface border-b border-border">
            <FileCode size={13} className="text-primary" />
            <span className="text-xs text-muted">
              {new Date(item.created_at).toLocaleString('ko-KR')}
            </span>
          </div>
          <pre className="p-4 text-sm text-dim font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
            {item.content}
          </pre>
        </div>
      ))}
    </div>
  )
}

// RIGHT: 파일 목록 + 다음봇
export function BuildRightPanel({ agentId, nextBotName, onNextBot }: {
  agentId: string
  nextBotName?: string
  onNextBot?: () => void
}) {
  const { data: feed = [] } = useQuery({
    queryKey: ['bot-feed', agentId],
    queryFn: () => feedApi.list({ limit: 10 }),
    select: (data: FeedItem[]) => data.filter(f => f.agent_id === agentId),
    refetchInterval: 3000,
  })

  const results = feed.filter(f => f.type === 'result')

  return (
    <div className="p-4 h-full flex flex-col gap-4">
      <div>
        <p className="text-xs text-muted uppercase tracking-widest mb-3">생성된 결과</p>
        {results.length === 0 ? (
          <p className="text-sm text-muted/60">결과가 없습니다</p>
        ) : (
          <div className="space-y-2">
            {results.slice(0, 5).map((item, i) => (
              <div key={item.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg border border-border">
                <FileCode size={13} className="text-primary shrink-0" />
                <span className="text-sm text-dim truncate">결과 #{i + 1}</span>
              </div>
            ))}
          </div>
        )}
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
