import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { feedApi, type FeedItem } from '../lib/api'
import { useAppStore } from '../store/app.store'
import { Check, X, ChevronDown, ChevronUp, Edit2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'

const BOT_EMOJI: Record<string, string> = {
  research: '🔬', build: '🔨', design: '🎨', content: '✍️',
  growth: '📈', ops: '⚙️', integration: '🔗', n8n: '⚡',
}

const ROLE_BADGE_COLOR: Record<string, string> = {
  research: 'bg-blue-900/40 text-blue-300',
  build: 'bg-orange-900/40 text-orange-300',
  design: 'bg-purple-900/40 text-purple-300',
  content: 'bg-teal-900/40 text-teal-300',
  growth: 'bg-green-900/40 text-green-300',
  ops: 'bg-gray-700/60 text-gray-300',
  integration: 'bg-yellow-900/40 text-yellow-300',
  n8n: 'bg-pink-900/40 text-pink-300',
}

function looksLikeCode(text: string): boolean {
  return /```|^\s{4}|\bfunction\b|\bconst\b|\blet\b|\bvar\b|=>|\bimport\b|\bexport\b/.test(text)
}

type FilterTab = 'all' | 'pending' | 'done' | 'rejected'

interface CardState {
  expanded: boolean
  editing: boolean
  editedContent: string
  approving: boolean
  rejecting: boolean
}

function ApprovalCard({
  item,
  onApprove,
  onReject,
}: {
  key?: string
  item: FeedItem
  onApprove: (id: string, content?: string) => Promise<void>
  onReject: (id: string) => Promise<void>
}) {
  const isProcessed = !!(item.approved_at || item.rejected_at)
  const preview = item.content?.slice(0, 200) ?? ''
  const hasMore = (item.content?.length ?? 0) > 200
  const isCode = looksLikeCode(item.content ?? '')

  const [state, setState] = useState<CardState>({
    expanded: false,
    editing: false,
    editedContent: item.content ?? '',
    approving: false,
    rejecting: false,
  })

  const set = (patch: Partial<CardState>) => setState((prev: CardState) => ({ ...prev, ...patch }))

  const handleApprove = async () => {
    set({ approving: true })
    try {
      await onApprove(item.id, state.editing ? state.editedContent : undefined)
    } finally {
      set({ approving: false })
    }
  }

  const handleReject = async () => {
    set({ rejecting: true })
    try {
      await onReject(item.id)
    } finally {
      set({ rejecting: false })
    }
  }

  const role = item.agent_role ?? ''
  const badgeColor = ROLE_BADGE_COLOR[role] ?? 'bg-gray-700/60 text-gray-300'
  const displayContent = state.expanded ? (item.content ?? '') : preview

  return (
    <div
      className={`bg-surface border rounded-xl p-4 transition-opacity ${
        isProcessed
          ? 'border-border opacity-50'
          : 'border-yellow-800/40'
      }`}
    >
      {/* Top row: bot info + timestamp */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg shrink-0">{BOT_EMOJI[role] ?? '🤖'}</span>
          <span className="text-[13px] font-medium text-text truncate">{item.agent_name}</span>
          {role && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${badgeColor}`}>
              {role}
            </span>
          )}
        </div>
        <span className="text-[11px] text-muted shrink-0">
          {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ko })}
        </span>
      </div>

      {/* Action label as card title */}
      {item.action_label && (
        <p className="text-[13px] font-semibold text-text mb-2">{item.action_label}</p>
      )}

      {/* Content preview */}
      {item.content && (
        <div className="mb-3">
          {isCode ? (
            <pre className="bg-gray-900 rounded-lg p-3 text-[11px] text-green-300 font-mono whitespace-pre-wrap overflow-x-auto leading-relaxed">
              {displayContent}{hasMore && !state.expanded ? '…' : ''}
            </pre>
          ) : (
            <p className="text-[12px] text-muted leading-relaxed whitespace-pre-wrap bg-surface-2 rounded-lg p-3">
              {displayContent}{hasMore && !state.expanded ? '…' : ''}
            </p>
          )}
          {hasMore && (
            <button
              onClick={() => set({ expanded: !state.expanded })}
              className="flex items-center gap-1 mt-1 text-[11px] text-primary hover:text-primary/80 transition-colors"
            >
              {state.expanded ? (
                <><ChevronUp size={12} /> 접기</>
              ) : (
                <><ChevronDown size={12} /> 전체 보기</>
              )}
            </button>
          )}
        </div>
      )}

      {/* Edit before approve */}
      {!isProcessed && (
        <>
          {state.editing && (
            <textarea
              value={state.editedContent}
              onChange={(e: { target: { value: string } }) => set({ editedContent: e.target.value })}
              rows={6}
              className="w-full mb-3 bg-gray-900 border border-border rounded-lg p-3 text-[12px] text-text font-mono resize-y focus:outline-none focus:border-primary"
            />
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleApprove}
              disabled={state.approving || state.rejecting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-900/30 text-green-400 rounded text-[12px] hover:bg-green-900/50 disabled:opacity-50 transition-colors"
            >
              {state.approving ? (
                <span className="w-3 h-3 border border-green-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Check size={12} />
              )}
              {state.editing ? '수정 후 승인' : '✓ 승인'}
            </button>
            <button
              onClick={handleReject}
              disabled={state.approving || state.rejecting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/30 text-red-400 rounded text-[12px] hover:bg-red-900/50 disabled:opacity-50 transition-colors"
            >
              {state.rejecting ? (
                <span className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <X size={12} />
              )}
              ✗ 거절
            </button>
            <button
              onClick={() => set({ editing: !state.editing, editedContent: item.content ?? '' })}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700/40 text-gray-300 rounded text-[12px] hover:bg-gray-700/60 transition-colors ml-auto"
            >
              <Edit2 size={12} />
              {state.editing ? '취소' : '✏️ 수정하기'}
            </button>
          </div>
        </>
      )}

      {/* Processed badge */}
      {isProcessed && (
        <div className="mt-2">
          {item.approved_at
            ? <span className="text-[11px] text-green-400">✓ 승인됨</span>
            : <span className="text-[11px] text-red-400">✗ 거절됨</span>
          }
        </div>
      )}
    </div>
  )
}

export default function ApprovalPage() {
  const qc = useQueryClient()
  const missionId = useAppStore(s => s.currentMission?.id)
  const [activeTab, setActiveTab] = useState<FilterTab>('pending')

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['approvals', missionId],
    queryFn: () => feedApi.list({ mission_id: missionId, approval_only: true }),
    enabled: !!missionId,
    refetchInterval: 30000,
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => feedApi.approve(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approvals'] }),
  })
  const rejectMutation = useMutation({
    mutationFn: (id: string) => feedApi.reject(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approvals'] }),
  })

  const pending = items.filter((i: FeedItem) => !i.approved_at && !i.rejected_at)
  const approved = items.filter((i: FeedItem) => !!i.approved_at)
  const rejected = items.filter((i: FeedItem) => !!i.rejected_at)

  const tabItems: Record<FilterTab, FeedItem[]> = {
    all: items,
    pending,
    done: approved,
    rejected,
  }

  const displayed = tabItems[activeTab as FilterTab]

  const handleApprove = async (id: string, _content?: string) => {
    // Optimistic: remove from local list instantly
    qc.setQueryData(['approvals', missionId], (old: FeedItem[] | undefined) =>
      (old ?? []).map(i => i.id === id ? { ...i, approved_at: new Date().toISOString() } : i)
    )
    await approveMutation.mutateAsync(id)
  }

  const handleReject = async (id: string) => {
    qc.setQueryData(['approvals', missionId], (old: FeedItem[] | undefined) =>
      (old ?? []).map(i => i.id === id ? { ...i, rejected_at: new Date().toISOString() } : i)
    )
    await rejectMutation.mutateAsync(id)
  }

  const handleBulkApprove = () => {
    if (pending.length === 0) return
    if (!window.confirm(`대기 중인 ${pending.length}건을 모두 승인하시겠습니까?`)) return
    pending.forEach((item: FeedItem) => {
      approveMutation.mutate(item.id)
    })
  }

  const handleBulkReject = () => {
    if (pending.length === 0) return
    if (!window.confirm(`대기 중인 ${pending.length}건을 모두 거절하시겠습니까?`)) return
    pending.forEach((item: FeedItem) => {
      rejectMutation.mutate(item.id)
    })
  }

  const TABS: { key: FilterTab; label: string; count?: number }[] = [
    { key: 'all', label: '전체', count: items.length },
    { key: 'pending', label: '승인 대기', count: pending.length },
    { key: 'done', label: '완료', count: approved.length },
    { key: 'rejected', label: '거절됨', count: rejected.length },
  ]

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <h1 className="text-xl font-semibold text-text">승인 인박스</h1>
        {pending.length > 0 && (
          <span className="bg-primary text-white text-[11px] px-2 py-0.5 rounded-full">
            {pending.length}
          </span>
        )}
        <div className="flex gap-2 ml-auto">
          <button
            onClick={handleBulkApprove}
            disabled={pending.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-900/30 text-green-400 rounded-lg text-[12px] hover:bg-green-900/50 disabled:opacity-30 transition-colors"
          >
            <Check size={12} /> 전체 승인
          </button>
          <button
            onClick={handleBulkReject}
            disabled={pending.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/30 text-red-400 rounded-lg text-[12px] hover:bg-red-900/50 disabled:opacity-30 transition-colors"
          >
            <X size={12} /> 전체 거절
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 bg-surface border border-border rounded-lg p-1">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-[12px] transition-colors ${
              activeTab === tab.key
                ? 'bg-primary/20 text-primary font-medium'
                : 'text-muted hover:text-text'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                activeTab === tab.key ? 'bg-primary/30 text-primary' : 'bg-border text-muted'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-12 text-center">
          <Check size={32} className="text-green-400 mx-auto mb-3" />
          {activeTab === 'pending' ? (
            <>
              <p className="text-text font-medium">✅ 모든 승인 처리 완료!</p>
              <p className="text-muted text-sm mt-1">현재 대기 중인 승인 요청이 없습니다</p>
            </>
          ) : (
            <>
              <p className="text-text font-medium">항목 없음</p>
              <p className="text-muted text-sm mt-1">해당 상태의 항목이 없습니다</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map((item: FeedItem) => (
            <ApprovalCard
              key={item.id}
              item={item}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          ))}
        </div>
      )}
    </div>
  )
}
