/**
 * MissionBoard.tsx — Mission Board (앱의 심장)
 * v5.0.1
 *
 * 뷰: Kanban | List | Calendar (추후 Timeline)
 * 핵심: 태스크 중심, 3초 생성, DnD, 실행 버튼
 */
import { useEffect, useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DragDropContext, Droppable, type DropResult } from '@hello-pangea/dnd'
import {
  LayoutGrid, List, Calendar, Plus, Filter, Search, X, CheckSquare,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { tasksApi, type Task, type TaskStatus, type TaskLayer, type TaskEngine, type TaskPriority } from '../lib/tasksApi'
import { useAppStore } from '../store/app.store'
import { useBoardStore } from '../store/board.store'
import { TaskCard } from '../components/board/TaskCard'
import { QuickAddTask } from '../components/board/QuickAddTask'
import { TaskDetail } from '../components/board/TaskDetail'
import { ListView } from '../components/board/ListView'
import { CalendarView } from '../components/board/CalendarView'

// ── 컬럼 정의 ────────────────────────────────────────────────────────────────
const COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'todo',        label: 'TODO',        color: 'text-zinc-400' },
  { status: 'in_progress', label: '진행 중',     color: 'text-blue-400' },
  { status: 'review',      label: '검토',         color: 'text-yellow-400' },
  { status: 'done',        label: '완료',         color: 'text-green-400' },
]

const LAYER_OPTIONS: { value: TaskLayer | ''; label: string }[] = [
  { value: '', label: '모든 레이어' },
  { value: 'build',     label: '빌드' },
  { value: 'frontend',  label: '프론트엔드' },
  { value: 'backend',   label: '백엔드' },
  { value: 'infra',     label: '인프라' },
  { value: 'content',   label: '콘텐츠' },
  { value: 'research',  label: '리서치' },
  { value: 'design',    label: '디자인' },
  { value: 'marketing', label: '마케팅' },
  { value: 'ops',       label: '운영' },
]

const ENGINE_OPTIONS: { value: TaskEngine | ''; label: string }[] = [
  { value: '', label: '모든 엔진' },
  { value: 'claude_code',   label: 'Claude Code' },
  { value: 'codex',         label: 'Codex (o3)' },
  { value: 'claude_design', label: 'Claude Design' },
  { value: 'research',      label: 'Research' },
  { value: 'growth',        label: 'Growth' },
  { value: 'ops',           label: 'Ops' },
  { value: 'chat',          label: 'Chat' },
]

type ViewMode = 'kanban' | 'list' | 'calendar'

export function MissionBoard() {
  const { currentMission } = useAppStore()
  const { setTasks, addTask, updateTask, removeTask,
          selectedTaskId, isDetailOpen, selectTask, closeDetail,
          filters, setFilters, clearFilters,
          getByStatus, getFiltered } = useBoardStore()
  const queryClient = useQueryClient()

  const [localView, setLocalView] = useState<ViewMode>('kanban')
  const [searchValue, setSearchValue] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const missionId = currentMission?.id

  // ── 데이터 로드 ────────────────────────────────────────────────────────────
  const { isLoading, data: queryData } = useQuery({
    queryKey: ['tasks', missionId],
    queryFn: () => tasksApi.list({ mission_id: missionId! }),
    enabled: !!missionId,
    staleTime: 10000,
    refetchInterval: 15000,
  })

  useEffect(() => {
    if (queryData) setTasks(queryData)
  }, [queryData, setTasks])

  useEffect(() => {
    if (searchValue !== undefined) {
      setFilters({ search: searchValue || undefined })
    }
  }, [searchValue, setFilters])

  // ── 태스크 생성 ────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: Partial<Task> & { mission_id: string; title: string }) =>
      tasksApi.create(data),
    onSuccess: (newTask) => {
      addTask(newTask)
      queryClient.invalidateQueries({ queryKey: ['tasks', missionId] })
    },
  })

  const handleQuickAdd = useCallback((data: {
    title: string; layer: TaskLayer; engine: TaskEngine
    priority: TaskPriority; status: TaskStatus
  }) => {
    if (!missionId) return
    createMutation.mutate({ ...data, mission_id: missionId })
  }, [missionId, createMutation])

  // ── 태스크 실행 ────────────────────────────────────────────────────────────
  const executeMutation = useMutation({
    mutationFn: (task: Task) => tasksApi.execute(task.id),
    onMutate: (task) => {
      updateTask(task.id, { status: 'in_progress', checkout_lock: 'pending' })
    },
    onError: (_err, task) => {
      updateTask(task.id, { status: 'todo', checkout_lock: undefined })
    },
  })

  // ── Kanban DnD ─────────────────────────────────────────────────────────────
  const onDragEnd = useCallback(async (result: DropResult) => {
    if (!result.destination) return
    const srcStatus  = result.source.droppableId as TaskStatus
    const destStatus = result.destination.droppableId as TaskStatus
    const taskId     = result.draggableId

    if (srcStatus === destStatus && result.source.index === result.destination.index) return

    // 낙관적 업데이트
    updateTask(taskId, { status: destStatus, sort_order: result.destination.index })

    try {
      await tasksApi.reorder([{
        id: taskId,
        status: destStatus,
        sort_order: result.destination.index,
      }])
    } catch {
      // 롤백
      queryClient.invalidateQueries({ queryKey: ['tasks', missionId] })
    }
  }, [updateTask, queryClient, missionId])

  // ── 태스크 삭제 ────────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id: string) => tasksApi.delete(id),
    onSuccess: (_d, id) => {
      removeTask(id)
      if (selectedTaskId === id) closeDetail()
    },
  })

  if (!missionId) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <CheckSquare size={48} className="mx-auto mb-4 text-[#333]" />
          <p className="text-[#52525b] text-sm">미션을 선택하세요</p>
        </div>
      </div>
    )
  }

  const filteredTasks = getFiltered()
  const activeFiltersCount = Object.values(filters).filter(Boolean).length

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── 메인 보드 영역 ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* 헤더 */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1c1c20] shrink-0">
          <CheckSquare size={15} className="text-primary" />
          <span className="text-[13px] font-semibold text-[#e4e4e7]">Mission Board</span>
          <span className="text-[11px] text-[#52525b] ml-1">
            {filteredTasks.length}개 태스크
          </span>

          <div className="flex-1" />

          {/* 검색 */}
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#52525b]" />
            <input
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="검색..."
              className="bg-[#111113] border border-[#27272a] rounded-lg pl-7 pr-3 py-1.5 text-[11px] text-[#e4e4e7] placeholder-[#52525b] outline-none focus:border-primary/40 w-40"
            />
            {searchValue && (
              <button onClick={() => setSearchValue('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#52525b] hover:text-[#a1a1aa]">
                <X size={10} />
              </button>
            )}
          </div>

          {/* 필터 토글 */}
          <button
            onClick={() => setShowFilters(o => !o)}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] border transition-colors',
              showFilters || activeFiltersCount > 0
                ? 'bg-primary/10 text-primary border-primary/30'
                : 'text-[#52525b] border-[#27272a] hover:text-[#e4e4e7]',
            )}
          >
            <Filter size={11} />
            필터
            {activeFiltersCount > 0 && (
              <span className="bg-primary text-white text-[9px] px-1 rounded-full">{activeFiltersCount}</span>
            )}
          </button>

          {/* 새 태스크 버튼 */}
          <button
            onClick={() => selectTask('__new__')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] bg-primary text-white hover:bg-primary/90 transition-colors"
          >
            <Plus size={12} />
            태스크 추가
          </button>

          {/* 뷰 전환 */}
          <div className="flex border border-[#27272a] rounded-lg overflow-hidden">
            {([['kanban', LayoutGrid], ['list', List], ['calendar', Calendar]] as const).map(([mode, Icon]) => (
              <button
                key={mode}
                onClick={() => setLocalView(mode)}
                className={cn(
                  'p-1.5 transition-colors',
                  localView === mode
                    ? 'bg-primary/20 text-primary'
                    : 'text-[#52525b] hover:text-[#e4e4e7] hover:bg-[#141416]',
                )}
              >
                <Icon size={13} />
              </button>
            ))}
          </div>
        </div>

        {/* 필터 바 */}
        {showFilters && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-[#1c1c20] bg-[#0d0d0f] shrink-0">
            <select
              value={filters.layer ?? ''}
              onChange={(e) => setFilters({ layer: (e.target.value as TaskLayer) || undefined })}
              className="bg-[#111113] border border-[#27272a] text-[11px] text-[#e4e4e7] rounded-lg px-2 py-1 outline-none"
            >
              {LAYER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            <select
              value={filters.engine ?? ''}
              onChange={(e) => setFilters({ engine: (e.target.value as TaskEngine) || undefined })}
              className="bg-[#111113] border border-[#27272a] text-[11px] text-[#e4e4e7] rounded-lg px-2 py-1 outline-none"
            >
              {ENGINE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            <select
              value={filters.priority ?? ''}
              onChange={(e) => setFilters({ priority: (e.target.value as TaskPriority) || undefined })}
              className="bg-[#111113] border border-[#27272a] text-[11px] text-[#e4e4e7] rounded-lg px-2 py-1 outline-none"
            >
              <option value="">모든 우선순위</option>
              <option value="P0">P0 — 긴급</option>
              <option value="P1">P1 — 중요</option>
              <option value="P2">P2 — 나중에</option>
            </select>

            {activeFiltersCount > 0 && (
              <button
                onClick={clearFilters}
                className="text-[11px] text-[#52525b] hover:text-red-400 flex items-center gap-1"
              >
                <X size={10} />필터 초기화
              </button>
            )}
          </div>
        )}

        {/* 뷰 컨텐츠 */}
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-[#52525b] text-sm animate-pulse">태스크 로딩 중...</div>
            </div>
          ) : localView === 'kanban' ? (
            <KanbanView
              getByStatus={getByStatus}
              onCardClick={(t) => selectTask(t.id)}
              onExecute={(t) => executeMutation.mutate(t)}
              onQuickAdd={handleQuickAdd}
              onDragEnd={onDragEnd}
            />
          ) : localView === 'list' ? (
            <ListView
              tasks={filteredTasks}
              onRowClick={(t) => selectTask(t.id)}
              onExecute={(t) => executeMutation.mutate(t)}
            />
          ) : (
            <CalendarView
              tasks={filteredTasks}
              onTaskClick={(t) => selectTask(t.id)}
            />
          )}
        </div>
      </div>

      {/* ── Task Detail 슬라이드 패널 ───────────────────────────���─────────────── */}
      <div className={cn(
        'shrink-0 border-l border-[#1c1c20] transition-[width] duration-200 overflow-hidden',
        isDetailOpen ? 'w-[400px]' : 'w-0',
      )}>
        {isDetailOpen && selectedTaskId && (
          <TaskDetail
            taskId={selectedTaskId === '__new__' ? null : selectedTaskId}
            missionId={missionId}
            onClose={closeDetail}
            onCreate={(t) => { addTask(t); closeDetail() }}
            onUpdate={(t) => updateTask(t.id, t)}
            onDelete={(id) => deleteMutation.mutate(id)}
          />
        )}
      </div>
    </div>
  )
}

// ── Kanban 뷰 ─────────────────────────────────────────────────────────────────
function KanbanView({
  getByStatus, onCardClick, onExecute, onQuickAdd, onDragEnd,
}: {
  getByStatus: (s: TaskStatus) => Task[]
  onCardClick: (t: Task) => void
  onExecute: (t: Task) => void
  onQuickAdd: (data: { title: string; layer: TaskLayer; engine: TaskEngine; priority: TaskPriority; status: TaskStatus }) => void
  onDragEnd: (r: DropResult) => void
}) {
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-3 h-full px-4 py-3 overflow-x-auto">
        {COLUMNS.map(({ status, label, color }) => {
          const colTasks = getByStatus(status)
          return (
            <div key={status} className="flex flex-col w-64 shrink-0">
              {/* 컬럼 헤더 */}
              <div className="flex items-center gap-2 mb-2 px-1">
                <span className={cn('text-[11px] font-semibold uppercase tracking-widest', color)}>
                  {label}
                </span>
                <span className="text-[10px] text-[#52525b] bg-[#111113] px-1.5 py-0.5 rounded-full border border-[#27272a]">
                  {colTasks.length}
                </span>
              </div>

              {/* 드롭 영역 */}
              <Droppable droppableId={status}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      'flex-1 flex flex-col gap-2 rounded-xl p-2 min-h-[100px] transition-colors',
                      snapshot.isDraggingOver
                        ? 'bg-primary/5 border border-dashed border-primary/30'
                        : 'border border-transparent',
                    )}
                  >
                    {colTasks.map((task, index) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        index={index}
                        onClick={onCardClick}
                        onExecute={onExecute}
                      />
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>

              {/* 빠른 추가 */}
              {status !== 'done' && (
                <div className="mt-1">
                  <QuickAddTask
                    status={status}
                    onAdd={onQuickAdd}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </DragDropContext>
  )
}
