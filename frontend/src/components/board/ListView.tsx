/**
 * ListView.tsx — 태스크 리스트 뷰
 * v5.0.1
 */
import { Calendar, ChevronRight, Zap } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { Task, TaskLayer, TaskEngine } from '../../lib/tasksApi'

const PRIORITY_COLORS: Record<string, string> = {
  P0: 'text-red-400 bg-red-500/10 border-red-500/20',
  P1: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  P2: 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20',
}

const STATUS_COLORS: Record<string, string> = {
  todo:        'text-zinc-400',
  in_progress: 'text-blue-400',
  review:      'text-yellow-400',
  done:        'text-green-400',
}

const STATUS_LABELS: Record<string, string> = {
  todo: 'TODO', in_progress: '진행 중', review: '검토', done: '완료',
}

const LAYER_LABELS: Record<TaskLayer, string> = {
  build: '빌드', frontend: '프론트', backend: '백엔드', infra: '인프라',
  content: '콘텐츠', research: '리서치', design: '디자인',
  marketing: '마케팅', ops: '운영',
}

const ENGINE_LABELS: Record<TaskEngine, string> = {
  claude_code: 'Claude Code', codex: 'Codex', claude_design: 'Design',
  research: 'Research', growth: 'Growth', ops: 'Ops', chat: 'Chat',
}

interface ListViewProps {
  tasks: Task[]
  onRowClick: (task: Task) => void
  onExecute: (task: Task) => void
}

export function ListView({ tasks, onRowClick, onExecute }: ListViewProps) {
  if (tasks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-[#52525b] text-sm">태스크가 없습니다</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <table className="w-full text-[12px]">
        <thead className="sticky top-0 bg-[#0d0d0f] border-b border-[#1c1c20]">
          <tr>
            <th className="text-left px-4 py-2 text-[10px] text-[#52525b] uppercase tracking-widest font-medium w-14">우선순위</th>
            <th className="text-left px-2 py-2 text-[10px] text-[#52525b] uppercase tracking-widest font-medium">제목</th>
            <th className="text-left px-2 py-2 text-[10px] text-[#52525b] uppercase tracking-widest font-medium w-20">레이어</th>
            <th className="text-left px-2 py-2 text-[10px] text-[#52525b] uppercase tracking-widest font-medium w-24">엔진</th>
            <th className="text-left px-2 py-2 text-[10px] text-[#52525b] uppercase tracking-widest font-medium w-20">상태</th>
            <th className="text-left px-2 py-2 text-[10px] text-[#52525b] uppercase tracking-widest font-medium w-20">마감일</th>
            <th className="px-3 py-2 w-16" />
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr
              key={task.id}
              onClick={() => onRowClick(task)}
              className={cn(
                'border-b border-[#1c1c20] cursor-pointer transition-colors',
                task.status === 'done'
                  ? 'opacity-50 hover:opacity-70'
                  : 'hover:bg-[#141416]',
              )}
            >
              <td className="px-4 py-2.5">
                <span className={cn(
                  'text-[10px] font-bold px-1.5 py-0.5 rounded border',
                  PRIORITY_COLORS[task.priority],
                )}>
                  {task.priority}
                </span>
              </td>

              <td className="px-2 py-2.5">
                <div className="flex items-center gap-1.5">
                  {task.checkout_lock && <Zap size={10} className="text-primary shrink-0 animate-pulse" />}
                  <span className={cn(
                    'text-[#e4e4e7] line-clamp-1',
                    task.status === 'done' && 'line-through text-[#666]',
                  )}>
                    {task.title}
                  </span>
                </div>
              </td>

              <td className="px-2 py-2.5 text-[#666]">
                {LAYER_LABELS[task.layer]}
              </td>

              <td className="px-2 py-2.5 text-[#666]">
                {ENGINE_LABELS[task.engine]}
              </td>

              <td className="px-2 py-2.5">
                <span className={cn('text-[11px]', STATUS_COLORS[task.status])}>
                  {STATUS_LABELS[task.status]}
                </span>
              </td>

              <td className="px-2 py-2.5">
                {task.due_date && (
                  <div className="flex items-center gap-1 text-[11px] text-[#52525b]">
                    <Calendar size={9} />
                    {task.due_date.slice(5)}
                  </div>
                )}
              </td>

              <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                {task.status !== 'done' && !task.checkout_lock && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onExecute(task) }}
                    className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                  >
                    ▶<ChevronRight size={8} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
