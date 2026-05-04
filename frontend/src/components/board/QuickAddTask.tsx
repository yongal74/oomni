/**
 * QuickAddTask.tsx — 빠른 태스크 생성 (3초 룰)
 * "/" 접두사로 layer/engine/priority 인라인 설정 가능
 * v5.0.1
 */
import { useState, useRef } from 'react'
import { Plus } from 'lucide-react'
import type { TaskLayer, TaskEngine, TaskPriority, TaskStatus } from '../../lib/tasksApi'

interface QuickAddTaskProps {
  status: TaskStatus
  onAdd: (data: {
    title: string
    layer: TaskLayer
    engine: TaskEngine
    priority: TaskPriority
    status: TaskStatus
  }) => void
}

// "/" 명령어 파싱
function parseQuickInput(raw: string): {
  title: string
  layer: TaskLayer
  engine: TaskEngine
  priority: TaskPriority
} {
  let layer: TaskLayer    = 'build'
  let engine: TaskEngine  = 'claude_code'
  let priority: TaskPriority = 'P1'

  // /p0, /p1, /p2
  const pMatch = raw.match(/\/p([012])/i)
  if (pMatch) priority = `P${pMatch[1]}` as TaskPriority

  // 레이어: /front /back /infra /content /research /design /marketing /ops /build
  if (/\/front/i.test(raw))     layer = 'frontend'
  else if (/\/back/i.test(raw)) layer = 'backend'
  else if (/\/infra/i.test(raw)) layer = 'infra'
  else if (/\/content/i.test(raw)) layer = 'content'
  else if (/\/research/i.test(raw)) layer = 'research'
  else if (/\/design/i.test(raw)) layer = 'design'
  else if (/\/marketing/i.test(raw)) layer = 'marketing'
  else if (/\/ops/i.test(raw)) layer = 'ops'

  // 엔진
  if (/\/codex/i.test(raw))       engine = 'codex'
  else if (/\/design/i.test(raw)) engine = 'claude_design'
  else if (/\/research/i.test(raw)) engine = 'research'
  else if (/\/growth/i.test(raw)) engine = 'growth'
  else if (/\/ops/i.test(raw))    engine = 'ops'
  else if (/\/chat/i.test(raw))   engine = 'chat'

  // "/" 명령어 제거 후 제목 추출
  const title = raw.replace(/\/\S+/g, '').trim()
  return { title, layer, engine, priority }
}

export function QuickAddTask({ status, onAdd }: QuickAddTaskProps) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function submit() {
    const trimmed = value.trim()
    if (!trimmed) { setOpen(false); return }
    const parsed = parseQuickInput(trimmed)
    if (!parsed.title) { setOpen(false); return }
    onAdd({ ...parsed, status })
    setValue('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50) }}
        className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded-lg text-[11px] text-[#52525b] hover:text-[#e4e4e7] hover:bg-[#141416] transition-colors"
      >
        <Plus size={12} />
        태스크 추가
      </button>
    )
  }

  return (
    <div className="bg-[#111113] rounded-xl border border-primary/30 p-2">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
          if (e.key === 'Escape') { setOpen(false); setValue('') }
        }}
        onBlur={() => { if (!value.trim()) setOpen(false) }}
        placeholder='제목 입력... /p0 /front /codex /2026-05-10'
        className="w-full bg-transparent text-[12px] text-[#e4e4e7] placeholder-[#444] outline-none"
      />
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[10px] text-[#444]">/p0 /front /back /codex /design — Enter</span>
        <div className="flex gap-1">
          <button
            onClick={() => { setOpen(false); setValue('') }}
            className="text-[10px] text-[#52525b] hover:text-[#a1a1aa] px-1.5"
          >취소</button>
          <button
            onClick={submit}
            className="text-[10px] bg-primary/20 text-primary hover:bg-primary/30 px-2 py-0.5 rounded"
          >추가</button>
        </div>
      </div>
    </div>
  )
}
