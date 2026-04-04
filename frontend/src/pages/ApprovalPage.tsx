import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { feedApi, type FeedItem } from '../lib/api'
import { useAppStore } from '../store/app.store'
import { Check, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'

const BOT_EMOJI: Record<string, string> = {
  research: '🔬', build: '🔨', design: '🎨', content: '✍️',
  growth: '📈', ops: '⚙️', integration: '🔗', n8n: '⚡',
}

export default function ApprovalPage() {
  const qc = useQueryClient()
  const missionId = useAppStore(s => s.currentMission?.id)

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['approvals', missionId],
    queryFn: () => feedApi.list({ mission_id: missionId, approval_only: true }),
    enabled: !!missionId,
    refetchInterval: 15000,
  })

  const approve = useMutation({
    mutationFn: feedApi.approve,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approvals'] }),
  })
  const reject = useMutation({
    mutationFn: feedApi.reject,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approvals'] }),
  })

  const pending = items.filter((i: FeedItem) => !i.approved_at && !i.rejected_at)
  const processed = items.filter((i: FeedItem) => i.approved_at || i.rejected_at)

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-semibold text-text">승인 인박스</h1>
        {pending.length > 0 && (
          <span className="bg-primary text-white text-[11px] px-2 py-0.5 rounded-full">{pending.length}</span>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : pending.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-12 text-center">
          <Check size={32} className="text-green-400 mx-auto mb-3" />
          <p className="text-text font-medium">승인 대기 없음</p>
          <p className="text-muted text-sm mt-1">봇들이 자율적으로 처리했습니다</p>
        </div>
      ) : (
        <div className="space-y-3 mb-6">
          {pending.map((item: FeedItem) => (
            <div key={item.id} className="bg-surface border border-yellow-800/30 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <span className="text-xl">{BOT_EMOJI[item.agent_role ?? ''] ?? '🤖'}</span>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[13px] font-medium text-text">{item.agent_name}</span>
                      <span className="text-[10px] text-muted">
                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ko })}
                      </span>
                    </div>
                    <p className="text-[13px] text-muted leading-relaxed whitespace-pre-wrap">{item.content}</p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => approve.mutate(item.id)}
                    disabled={approve.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-900/30 text-green-400 rounded text-[12px] hover:bg-green-900/50"
                  >
                    <Check size={12} /> 승인
                  </button>
                  <button
                    onClick={() => reject.mutate(item.id)}
                    disabled={reject.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/30 text-red-400 rounded text-[12px] hover:bg-red-900/50"
                  >
                    <X size={12} /> 거절
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {processed.length > 0 && (
        <div>
          <h3 className="text-[12px] text-muted mb-3 uppercase tracking-wider">처리 완료</h3>
          <div className="space-y-2">
            {processed.slice(0, 10).map((item: FeedItem) => (
              <div key={item.id} className="bg-surface border border-border rounded-lg p-3 opacity-60">
                <div className="flex items-center gap-2">
                  <span>{BOT_EMOJI[item.agent_role ?? ''] ?? '🤖'}</span>
                  <span className="text-[12px] text-text flex-1 truncate">{item.content}</span>
                  {item.approved_at
                    ? <span className="text-[10px] text-green-400 shrink-0">✓ 승인됨</span>
                    : <span className="text-[10px] text-red-400 shrink-0">✗ 거절됨</span>
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
