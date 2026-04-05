import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import { RefreshCw } from 'lucide-react'
import { api } from '../lib/api'

interface RunFeedItem {
  id: string
  type: string
  content: string
  created_at: string
  run_id: string | null
}

interface RunStats {
  total_runs: number
  success_count: number
  error_count: number
  last_run_at: string | null
}

function typeIcon(type: string): string {
  switch (type) {
    case 'result': return '✅'
    case 'error': return '❌'
    case 'approval': return '⏳'
    default: return 'ℹ️'
  }
}

function RunEntry({ item }: { item: RunFeedItem }) {
  const [expanded, setExpanded] = useState(false)
  const preview = item.content.slice(0, 100)
  const hasMore = item.content.length > 100

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-base leading-none">{typeIcon(item.type)}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
          item.type === 'error'
            ? 'bg-red-900/30 text-red-400'
            : item.type === 'result'
            ? 'bg-blue-900/30 text-blue-400'
            : item.type === 'approval'
            ? 'bg-yellow-900/30 text-yellow-400'
            : 'bg-zinc-800 text-zinc-400'
        }`}>
          {item.type}
        </span>
        <span className="text-[10px] text-zinc-500 ml-auto">
          {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ko })}
        </span>
      </div>

      {expanded ? (
        <pre className="text-[11px] text-green-400 font-mono bg-black rounded p-2 whitespace-pre-wrap break-all leading-relaxed mt-1">
          {item.content}
        </pre>
      ) : (
        <p className="text-[12px] text-zinc-400 leading-relaxed">
          {preview}{hasMore && !expanded ? '…' : ''}
        </p>
      )}

      {hasMore && (
        <button
          onClick={() => setExpanded(prev => !prev)}
          className="mt-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 underline"
        >
          {expanded ? '접기' : '전체 보기'}
        </button>
      )}
    </div>
  )
}

export function BotRunHistory({ agentId }: { agentId: string }) {
  const {
    data: items = [],
    isLoading: itemsLoading,
    refetch,
    isFetching,
  } = useQuery<RunFeedItem[]>({
    queryKey: ['bot-runs', agentId],
    queryFn: () =>
      api.get<{ data: RunFeedItem[] }>(`/api/agents/${agentId}/runs`).then(r => r.data.data),
    enabled: !!agentId,
  })

  const { data: stats } = useQuery<RunStats>({
    queryKey: ['bot-runs-stats', agentId],
    queryFn: () =>
      api.get<{ data: RunStats }>(`/api/agents/${agentId}/runs/stats`).then(r => r.data.data),
    enabled: !!agentId,
  })

  return (
    <div className="space-y-3">
      {/* Stats row */}
      {stats && (
        <div className="flex items-center gap-4 text-[12px] text-zinc-400 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5">
          <span>총 실행 <span className="text-white font-medium">{stats.total_runs}회</span></span>
          <span className="text-zinc-600">|</span>
          <span>성공 <span className="text-green-400 font-medium">{stats.success_count}</span></span>
          <span className="text-zinc-600">|</span>
          <span>오류 <span className="text-red-400 font-medium">{stats.error_count}</span></span>
          {stats.last_run_at && (
            <>
              <span className="text-zinc-600">|</span>
              <span>
                마지막 실행{' '}
                <span className="text-zinc-300">
                  {formatDistanceToNow(new Date(stats.last_run_at), { addSuffix: true, locale: ko })}
                </span>
              </span>
            </>
          )}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="ml-auto flex items-center gap-1 text-zinc-500 hover:text-zinc-300 disabled:opacity-50"
          >
            <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
            새로고침
          </button>
        </div>
      )}

      {/* List */}
      {itemsLoading ? (
        <div className="flex justify-center py-8">
          <div className="w-5 h-5 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-zinc-500 text-[13px] bg-zinc-900 border border-zinc-700 rounded-lg">
          <p>아직 실행 기록이 없습니다</p>
          {!stats && (
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="mt-3 flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-zinc-400 hover:text-zinc-200 border border-zinc-700 rounded mx-auto"
            >
              <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
              새로고침
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <RunEntry key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
