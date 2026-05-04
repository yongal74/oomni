/**
 * TaskDetail.tsx — 태스크 상세/생성 슬라이드 패널
 * v5.0.1
 *
 * taskId === null → 새 태스크 생성 모드
 * taskId !== null → 기존 태스크 보기/수정 모드
 */
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  X, Play, Check, XCircle, Trash2, ChevronDown, ChevronUp,
  Clock, Calendar, Zap, AlertCircle, FileText, Cpu,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { tasksApi, type Task, type TaskResult, type TaskLayer, type TaskEngine, type TaskPriority, type TaskStatus } from '../../lib/tasksApi'

// ── 레이블 ─────────────────────────────────────────────────────────────────
const LAYER_LABELS: Record<TaskLayer, string> = {
  build: '빌드', frontend: '프론트', backend: '백엔드', infra: '인프라',
  content: '콘텐츠', research: '리서치', design: '디자인',
  marketing: '마케팅', ops: '운영',
}
const ENGINE_LABELS: Record<TaskEngine, string> = {
  claude_code: 'Claude Code', codex: 'Codex (o3)', claude_design: 'Claude Design',
  research: 'Research', growth: 'Growth', ops: 'Ops', chat: 'Chat',
}
const PRIORITY_COLORS: Record<TaskPriority, string> = {
  P0: 'text-red-400 bg-red-500/10 border-red-500/30',
  P1: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  P2: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30',
}
const STATUS_COLORS: Record<TaskStatus, string> = {
  todo:        'text-zinc-400 bg-zinc-500/10',
  in_progress: 'text-blue-400 bg-blue-500/10',
  review:      'text-yellow-400 bg-yellow-500/10',
  done:        'text-green-400 bg-green-500/10',
}
const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'TODO', in_progress: '진행 중', review: '검토', done: '완료',
}

// ── 기본값 ─────────────────────────────────────────────────────────────────
const DEFAULT_FORM = {
  title: '',
  description: '',
  layer: 'build' as TaskLayer,
  engine: 'claude_code' as TaskEngine,
  priority: 'P1' as TaskPriority,
  status: 'todo' as TaskStatus,
  due_date: '',
  estimated_hours: '',
  requires_approval: false,
}

interface TaskDetailProps {
  taskId: string | null
  missionId: string
  onClose: () => void
  onCreate: (task: Task) => void
  onUpdate: (task: Task) => void
  onDelete: (id: string) => void
}

export function TaskDetail({ taskId, missionId, onClose, onCreate, onUpdate, onDelete }: TaskDetailProps) {
  const isNew = !taskId
  const queryClient = useQueryClient()

  const [form, setForm] = useState({ ...DEFAULT_FORM })
  const [showResults, setShowResults] = useState(false)
  const [dirty, setDirty] = useState(false)

  // ── 태스크 로드 ──────────────────────────────────────────────────────────
  const { data: task } = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => tasksApi.get(taskId!),
    enabled: !isNew,
    staleTime: 5000,
  })

  const { data: results = [] } = useQuery({
    queryKey: ['task-results', taskId],
    queryFn: () => tasksApi.results(taskId!),
    enabled: !isNew && showResults,
  })

  // 태스크 로드 시 form 동기화
  useEffect(() => {
    if (task) {
      setForm({
        title:             task.title,
        description:       task.description ?? '',
        layer:             task.layer,
        engine:            task.engine,
        priority:          task.priority,
        status:            task.status,
        due_date:          task.due_date ?? '',
        estimated_hours:   task.estimated_hours != null ? String(task.estimated_hours) : '',
        requires_approval: task.requires_approval ?? false,
      })
      setDirty(false)
    }
  }, [task])

  function setField<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm(f => ({ ...f, [key]: value }))
    setDirty(true)
  }

  // ── 뮤테이션 ────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: () => tasksApi.create({
      mission_id: missionId,
      title:      form.title.trim(),
      description: form.description.trim(),
      layer:       form.layer,
      engine:      form.engine,
      priority:    form.priority,
      status:      form.status,
      due_date:    form.due_date || undefined,
      estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : undefined,
      requires_approval: form.requires_approval,
    }),
    onSuccess: (t) => { onCreate(t); onClose() },
  })

  const updateMutation = useMutation({
    mutationFn: () => tasksApi.update(taskId!, {
      title:       form.title.trim(),
      description: form.description.trim(),
      layer:       form.layer,
      engine:      form.engine,
      priority:    form.priority,
      status:      form.status,
      due_date:    form.due_date || undefined,
      estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : undefined,
      requires_approval: form.requires_approval,
    }),
    onSuccess: (t) => { onUpdate(t); setDirty(false) },
  })

  const executeMutation = useMutation({
    mutationFn: () => tasksApi.execute(taskId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  const approveMutation = useMutation({
    mutationFn: () => tasksApi.approve(taskId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['task', taskId] }),
  })

  const rejectMutation = useMutation({
    mutationFn: () => tasksApi.reject(taskId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['task', taskId] }),
  })

  const deleteMutation = useMutation({
    mutationFn: () => tasksApi.delete(taskId!),
    onSuccess: () => { onDelete(taskId!); onClose() },
  })

  const isRunning = task?.checkout_lock && task?.status === 'in_progress'
  const isReview  = task?.status === 'review'
  const isDone    = task?.status === 'done'
  const isBusy    = executeMutation.isPending || approveMutation.isPending || rejectMutation.isPending

  return (
    <div className="h-full flex flex-col bg-[#0d0d0f]">
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1c1c20] shrink-0">
        <span className="text-[13px] font-semibold text-[#e4e4e7] flex-1">
          {isNew ? '새 태스크' : '태스크 상세'}
        </span>
        {!isNew && task && (
          <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', STATUS_COLORS[task.status])}>
            {STATUS_LABELS[task.status]}
          </span>
        )}
        {isRunning && <Zap size={12} className="text-primary animate-pulse" />}
        <button onClick={onClose} className="text-[#52525b] hover:text-[#e4e4e7]">
          <X size={15} />
        </button>
      </div>

      {/* 바디 (스크롤) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* 실행 중 배너 */}
        {isRunning && (
          <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
            <Zap size={11} className="text-primary animate-pulse" />
            <span className="text-[11px] text-primary">에이전트 실행 중...</span>
          </div>
        )}

        {/* 검토 배너 */}
        {isReview && (
          <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
            <AlertCircle size={11} className="text-yellow-400" />
            <span className="text-[11px] text-yellow-400 flex-1">결과 검토가 필요합니다</span>
          </div>
        )}

        {/* 제목 */}
        <div>
          <label className="block text-[10px] text-[#52525b] mb-1 uppercase tracking-widest">제목 *</label>
          <input
            value={form.title}
            onChange={(e) => setField('title', e.target.value)}
            placeholder="태스크 제목..."
            className="w-full bg-[#111113] border border-[#27272a] rounded-lg px-3 py-2 text-[13px] text-[#e4e4e7] placeholder-[#444] outline-none focus:border-primary/40"
          />
        </div>

        {/* 설명 */}
        <div>
          <label className="block text-[10px] text-[#52525b] mb-1 uppercase tracking-widest">설명</label>
          <textarea
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            placeholder="상세 설명, 목표, 컨텍스트..."
            rows={4}
            className="w-full bg-[#111113] border border-[#27272a] rounded-lg px-3 py-2 text-[12px] text-[#e4e4e7] placeholder-[#444] outline-none focus:border-primary/40 resize-none"
          />
        </div>

        {/* 메타 필드 그리드 */}
        <div className="grid grid-cols-2 gap-3">
          {/* 레이어 */}
          <div>
            <label className="block text-[10px] text-[#52525b] mb-1 uppercase tracking-widest">레이어</label>
            <select
              value={form.layer}
              onChange={(e) => setField('layer', e.target.value as TaskLayer)}
              className="w-full bg-[#111113] border border-[#27272a] rounded-lg px-2 py-1.5 text-[12px] text-[#e4e4e7] outline-none"
            >
              {(Object.keys(LAYER_LABELS) as TaskLayer[]).map(k => (
                <option key={k} value={k}>{LAYER_LABELS[k]}</option>
              ))}
            </select>
          </div>

          {/* 엔진 */}
          <div>
            <label className="block text-[10px] text-[#52525b] mb-1 uppercase tracking-widest">엔진</label>
            <select
              value={form.engine}
              onChange={(e) => setField('engine', e.target.value as TaskEngine)}
              className="w-full bg-[#111113] border border-[#27272a] rounded-lg px-2 py-1.5 text-[12px] text-[#e4e4e7] outline-none"
            >
              {(Object.keys(ENGINE_LABELS) as TaskEngine[]).map(k => (
                <option key={k} value={k}>{ENGINE_LABELS[k]}</option>
              ))}
            </select>
          </div>

          {/* 우선순위 */}
          <div>
            <label className="block text-[10px] text-[#52525b] mb-1 uppercase tracking-widest">우선순위</label>
            <div className="flex gap-1">
              {(['P0', 'P1', 'P2'] as TaskPriority[]).map(p => (
                <button
                  key={p}
                  onClick={() => setField('priority', p)}
                  className={cn(
                    'flex-1 text-[11px] font-bold py-1.5 rounded-lg border transition-colors',
                    form.priority === p ? PRIORITY_COLORS[p] : 'text-[#52525b] border-[#27272a] hover:border-[#444]',
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* 상태 */}
          <div>
            <label className="block text-[10px] text-[#52525b] mb-1 uppercase tracking-widest">상태</label>
            <select
              value={form.status}
              onChange={(e) => setField('status', e.target.value as TaskStatus)}
              className="w-full bg-[#111113] border border-[#27272a] rounded-lg px-2 py-1.5 text-[12px] text-[#e4e4e7] outline-none"
            >
              {(Object.keys(STATUS_LABELS) as TaskStatus[]).map(k => (
                <option key={k} value={k}>{STATUS_LABELS[k]}</option>
              ))}
            </select>
          </div>

          {/* 마감일 */}
          <div>
            <label className="block text-[10px] text-[#52525b] mb-1 uppercase tracking-widest flex items-center gap-1">
              <Calendar size={9} />마감일
            </label>
            <input
              type="date"
              value={form.due_date}
              onChange={(e) => setField('due_date', e.target.value)}
              className="w-full bg-[#111113] border border-[#27272a] rounded-lg px-2 py-1.5 text-[12px] text-[#e4e4e7] outline-none"
            />
          </div>

          {/* 예상 시간 */}
          <div>
            <label className="block text-[10px] text-[#52525b] mb-1 uppercase tracking-widest flex items-center gap-1">
              <Clock size={9} />예상 시간
            </label>
            <input
              type="number"
              value={form.estimated_hours}
              onChange={(e) => setField('estimated_hours', e.target.value)}
              placeholder="ex) 2.5"
              step="0.5"
              min="0"
              className="w-full bg-[#111113] border border-[#27272a] rounded-lg px-2 py-1.5 text-[12px] text-[#e4e4e7] placeholder-[#444] outline-none"
            />
          </div>
        </div>

        {/* 승인 필요 */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.requires_approval}
            onChange={(e) => setField('requires_approval', e.target.checked)}
            className="accent-primary"
          />
          <span className="text-[11px] text-[#a1a1aa]">실행 후 승인 필요</span>
        </label>

        {/* 결과 히스토리 (기존 태스크만) */}
        {!isNew && (
          <div>
            <button
              onClick={() => setShowResults(o => !o)}
              className="flex items-center gap-1.5 text-[11px] text-[#52525b] hover:text-[#a1a1aa] transition-colors"
            >
              <FileText size={11} />
              실행 결과 히스토리
              {showResults ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
            {showResults && (
              <div className="mt-2 space-y-2">
                {results.length === 0 ? (
                  <p className="text-[11px] text-[#444] pl-1">실행 결과 없음</p>
                ) : results.map(r => (
                  <ResultItem key={r.id} result={r} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 액션 바 */}
      <div className="border-t border-[#1c1c20] px-4 py-3 shrink-0 flex items-center gap-2">
        {isNew ? (
          <>
            <button
              onClick={() => onClose()}
              className="px-3 py-1.5 text-[11px] text-[#52525b] hover:text-[#a1a1aa] transition-colors"
            >
              취소
            </button>
            <button
              onClick={() => createMutation.mutate()}
              disabled={!form.title.trim() || createMutation.isPending}
              className="flex-1 py-1.5 rounded-lg text-[12px] bg-primary text-white hover:bg-primary/90 disabled:opacity-40 transition-colors"
            >
              {createMutation.isPending ? '생성 중...' : '태스크 생성'}
            </button>
          </>
        ) : (
          <>
            {/* 삭제 */}
            <button
              onClick={() => { if (window.confirm('태스크를 삭제하시겠습니까?')) deleteMutation.mutate() }}
              disabled={deleteMutation.isPending}
              className="p-1.5 text-[#52525b] hover:text-red-400 transition-colors"
              title="태스크 삭제"
            >
              <Trash2 size={13} />
            </button>

            <div className="flex-1" />

            {/* 검토 — 승인/거절 */}
            {isReview && (
              <>
                <button
                  onClick={() => rejectMutation.mutate()}
                  disabled={isBusy}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                >
                  <XCircle size={11} />거절
                </button>
                <button
                  onClick={() => approveMutation.mutate()}
                  disabled={isBusy}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors"
                >
                  <Check size={11} />승인
                </button>
              </>
            )}

            {/* 저장 */}
            {dirty && (
              <button
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending || !form.title.trim()}
                className="px-3 py-1.5 rounded-lg text-[11px] bg-zinc-600 text-white hover:bg-zinc-500 disabled:opacity-40 transition-colors"
              >
                {updateMutation.isPending ? '저장 중...' : '저장'}
              </button>
            )}

            {/* 실행 */}
            {!isDone && !isRunning && !isReview && (
              <button
                onClick={() => executeMutation.mutate()}
                disabled={isBusy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] bg-primary text-white hover:bg-primary/90 disabled:opacity-40 transition-colors"
              >
                <Play size={10} fill="currentColor" />
                실행
                <span className="text-[9px] opacity-60 ml-0.5">{ENGINE_LABELS[form.engine]}</span>
              </button>
            )}

            {isRunning && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] bg-primary/10 text-primary border border-primary/20">
                <Cpu size={10} className="animate-spin" />
                실행 중...
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── 결과 아이템 ──────────────────────────────────────────────────────────────
function ResultItem({ result }: { result: TaskResult }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={cn(
      'rounded-lg border p-2.5 text-[11px]',
      result.status === 'success' ? 'border-green-500/20 bg-green-500/5' :
      result.status === 'failed'  ? 'border-red-500/20 bg-red-500/5' :
                                    'border-zinc-500/20 bg-zinc-500/5',
    )}>
      <div className="flex items-center gap-2">
        <span className={cn(
          'font-medium',
          result.status === 'success' ? 'text-green-400' :
          result.status === 'failed'  ? 'text-red-400' : 'text-zinc-400',
        )}>
          {result.status === 'success' ? '성공' : result.status === 'failed' ? '실패' : '취소'}
        </span>
        <span className="text-[#52525b]">{result.engine}</span>
        {result.model && <span className="text-[#444]">{result.model}</span>}
        {result.tokens_used && (
          <span className="text-[#444] ml-auto">{result.tokens_used.toLocaleString()} tokens</span>
        )}
        {result.output && (
          <button
            onClick={() => setExpanded(o => !o)}
            className="text-[#52525b] hover:text-[#a1a1aa] ml-1"
          >
            {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
        )}
      </div>
      <div className="text-[#52525b] mt-0.5">
        {result.created_at.slice(0, 16).replace('T', ' ')}
      </div>
      {expanded && result.output && (
        <pre className="mt-2 text-[10px] text-[#a1a1aa] whitespace-pre-wrap bg-[#0d0d0f] rounded p-2 max-h-48 overflow-y-auto">
          {result.output}
        </pre>
      )}
    </div>
  )
}
