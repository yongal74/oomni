/**
 * CalendarView.tsx — 태스크 캘린더 뷰
 * v5.0.1
 */
import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { Task } from '../../lib/tasksApi'

const PRIORITY_DOT: Record<string, string> = {
  P0: 'bg-red-400',
  P1: 'bg-yellow-400',
  P2: 'bg-zinc-500',
}

const STATUS_COLORS: Record<string, string> = {
  todo:        'text-zinc-400',
  in_progress: 'text-blue-400',
  review:      'text-yellow-400',
  done:        'text-green-400',
}

interface CalendarViewProps {
  tasks: Task[]
  onTaskClick: (task: Task) => void
}

export function CalendarView({ tasks, onTaskClick }: CalendarViewProps) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth()) // 0-indexed

  const firstDay = new Date(year, month, 1)
  const lastDay  = new Date(year, month + 1, 0)
  const startDow = firstDay.getDay() // 0=Sun
  const totalDays = lastDay.getDate()

  // tasks indexed by YYYY-MM-DD
  const tasksByDate = new Map<string, Task[]>()
  for (const t of tasks) {
    if (!t.due_date) continue
    const key = t.due_date.slice(0, 10)
    if (!tasksByDate.has(key)) tasksByDate.set(key, [])
    tasksByDate.get(key)!.push(t)
  }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ]
  // pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null)

  const monthLabel = new Date(year, month, 1).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })

  return (
    <div className="h-full overflow-y-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-1 rounded hover:bg-[#1c1c20] text-[#52525b] hover:text-[#e4e4e7]">
          <ChevronLeft size={16} />
        </button>
        <span className="text-[13px] font-medium text-[#e4e4e7]">{monthLabel}</span>
        <button onClick={nextMonth} className="p-1 rounded hover:bg-[#1c1c20] text-[#52525b] hover:text-[#e4e4e7]">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {['일', '월', '화', '수', '목', '금', '토'].map(d => (
          <div key={d} className="text-center text-[10px] text-[#52525b] py-1">{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-px bg-[#1c1c20] border border-[#1c1c20] rounded-lg overflow-hidden">
        {cells.map((day, i) => {
          if (!day) {
            return <div key={i} className="bg-[#0d0d0f] min-h-[80px]" />
          }
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const dayTasks = tasksByDate.get(dateStr) || []
          const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day

          return (
            <div key={i} className="bg-[#0d0d0f] min-h-[80px] p-1.5">
              <div className={cn(
                'text-[11px] w-5 h-5 flex items-center justify-center rounded-full mb-1',
                isToday ? 'bg-primary text-white font-bold' : 'text-[#666]',
              )}>
                {day}
              </div>
              <div className="space-y-0.5">
                {dayTasks.slice(0, 3).map(t => (
                  <div
                    key={t.id}
                    onClick={() => onTaskClick(t)}
                    className="flex items-center gap-1 cursor-pointer rounded px-1 py-0.5 hover:bg-[#141416] group"
                  >
                    <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', PRIORITY_DOT[t.priority])} />
                    <span className={cn(
                      'text-[10px] truncate',
                      STATUS_COLORS[t.status],
                      t.status === 'done' && 'line-through opacity-50',
                    )}>
                      {t.title}
                    </span>
                  </div>
                ))}
                {dayTasks.length > 3 && (
                  <div className="text-[9px] text-[#444] pl-1">+{dayTasks.length - 3}개</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
