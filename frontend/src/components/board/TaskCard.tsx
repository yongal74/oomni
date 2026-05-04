/**
 * TaskCard.tsx — Kanban 태스크 카드
 * v5.0.1
 */
import { Draggable } from '@hello-pangea/dnd'
import {
  Code2, Palette, Telescope, Rocket, Workflow, MessageSquare, Cpu,
  Calendar, Clock, Zap, AlertCircle, ChevronRight,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import type { Task, TaskEngine, TaskLayer } from '../../lib/tasksApi'

// ── 레이어 배지 색상 ─────────────────────────────────────────────────────────
const LAYER_COLORS: Record<TaskLayer, string> = {
  build:     'bg-orange-500/10 text-orange-400 border-orange-500/20',
  frontend:  'bg-sky-500/10 text-sky-400 border-sky-500/20',
  backend:   'bg-violet-500/10 text-violet-400 border-violet-500/20',
  infra:     'bg-teal-500/10 text-teal-400 border-teal-500/20',
  content:   'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  research:  'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  design:    'bg-purple-500/10 text-purple-400 border-purple-500/20',
  marketing: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  ops:       'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
}

const LAYER_LABELS: Record<TaskLayer, string> = {
  build: '빌드', frontend: '프론트', backend: '백엔드', infra: '인프라',
  content: '콘텐츠', research: '리서치', design: '디자인',
  marketing: '마케팅', ops: '운영',
}

// ── 엔진 아이콘 ──────────────────────────────────────────────────────────────
const ENGINE_ICONS: Record<TaskEngine, LucideIcon> = {
  claude_code:    Code2,
  codex:          Cpu,
  claude_design:  Palette,
  research:       Telescope,
  growth:         Rocket,
  ops:            Workflow,
  chat:           MessageSquare,
}

const ENGINE_LABELS: Record<TaskEngine, string> = {
  claude_code: 'Claude Code', codex: 'Codex', claude_design: 'Design',
  research: 'Research', growth: 'Growth', ops: 'Ops', chat: 'Chat',
}

// ── 우선순위 스타일 ──────────────────────────────────────────────────────────
const PRIORITY_STYLES: Record<string, string> = {
  P0: 'text-red-400',
  P1: 'text-yellow-400',
  P2: 'text-zinc-500',
}

interface TaskCardProps {
  task: Task
  index: number
  onClick: (task: Task) => void
  onExecute: (task: Task) => void
}

export function TaskCard({ task, index, onClick, onExecute }: TaskCardProps) {
  const EngineIcon = ENGINE_ICONS[task.engine]
  const isRunning  = task.status === 'in_progress' && !!task.checkout_lock
  const isReview   = task.status === 'review'
  const isDone     = task.status === 'done'

  return (
    <Draggable draggableId={task.id} index={index} isDragDisabled={isRunning}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onClick(task)}
          className={cn(
            'group relative bg-[#111113] rounded-xl border p-3 cursor-pointer select-none',
            'transition-all duration-150',
            snapshot.isDragging
              ? 'border-primary/50 shadow-lg shadow-primary/10 rotate-1 scale-105'
              : isDone
                ? 'border-[#1c1c20] opacity-60 hover:opacity-80 hover:border-[#27272a]'
                : isReview
                  ? 'border-yellow-500/30 hover:border-yellow-500/50'
                  : isRunning
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-[#1c1c20] hover:border-[#333] hover:bg-[#141416]',
          )}
        >
          {/* 실행 중 애니메이션 바 */}
          {isRunning && (
            <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl bg-primary/30 overflow-hidden">
              <div className="h-full bg-primary animate-[slide_1.5s_ease-in-out_infinite]" style={{ width: '40%' }} />
            </div>
          )}

          {/* 상단 행: 우선순위 + 레이어 + 상태 */}
          <div className="flex items-center gap-1.5 mb-2">
            <span className={cn('text-[10px] font-bold', PRIORITY_STYLES[task.priority])}>
              {task.priority}
            </span>
            <span className={cn(
              'text-[10px] px-1.5 py-0.5 rounded border font-medium',
              LAYER_COLORS[task.layer],
            )}>
              {LAYER_LABELS[task.layer]}
            </span>
            {isRunning && (
              <span className="ml-auto flex items-center gap-1 text-[10px] text-primary animate-pulse">
                <Zap size={9} />실행중
              </span>
            )}
            {isReview && (
              <span className="ml-auto flex items-center gap-1 text-[10px] text-yellow-400">
                <AlertCircle size={9} />검토필요
              </span>
            )}
          </div>

          {/* 제목 */}
          <p className={cn(
            'text-[13px] font-medium leading-snug mb-2',
            isDone ? 'line-through text-[#666]' : 'text-[#e4e4e7]',
          )}>
            {task.title}
          </p>

          {/* 하단 행: 엔진 + 마감일 + 실행 버튼 */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-[11px] text-[#52525b]">
              <EngineIcon size={10} />
              <span>{ENGINE_LABELS[task.engine]}</span>
            </div>

            {task.due_date && (
              <div className="flex items-center gap-1 text-[11px] text-[#52525b]">
                <Calendar size={9} />
                <span>{task.due_date.slice(5)}</span>
              </div>
            )}

            {task.estimated_hours && (
              <div className="flex items-center gap-1 text-[11px] text-[#52525b]">
                <Clock size={9} />
                <span>{task.estimated_hours}h</span>
              </div>
            )}

            {/* 실행 버튼 — hover 시 표시 */}
            {!isDone && !isRunning && (
              <button
                onClick={(e) => { e.stopPropagation(); onExecute(task) }}
                className={cn(
                  'ml-auto flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium',
                  'transition-all duration-150',
                  isReview
                    ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/20'
                    : 'bg-primary/10 text-primary border border-primary/20 opacity-0 group-hover:opacity-100 hover:bg-primary/20',
                )}
              >
                {isReview ? '승인' : '▶'}
                <ChevronRight size={8} />
              </button>
            )}
          </div>
        </div>
      )}
    </Draggable>
  )
}
