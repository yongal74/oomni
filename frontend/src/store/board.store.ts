/**
 * board.store.ts — Mission Board 상태 관리 (Zustand)
 * v5.0.1
 */
import { create } from 'zustand'
import type { Task, TaskStatus, TaskLayer, TaskEngine, TaskPriority } from '../lib/tasksApi'

type ViewMode = 'kanban' | 'list' | 'calendar' | 'timeline'

interface BoardFilters {
  layer?: TaskLayer
  engine?: TaskEngine
  priority?: TaskPriority
  search?: string
}

interface BoardState {
  tasks: Task[]
  viewMode: ViewMode
  filters: BoardFilters
  selectedTaskId: string | null
  isDetailOpen: boolean

  setTasks: (tasks: Task[]) => void
  addTask: (task: Task) => void
  updateTask: (id: string, patch: Partial<Task>) => void
  removeTask: (id: string) => void
  setViewMode: (mode: ViewMode) => void
  setFilters: (filters: Partial<BoardFilters>) => void
  clearFilters: () => void
  selectTask: (id: string | null) => void
  closeDetail: () => void

  // 태스크를 status 컬럼별로 정렬된 배열로 반환
  getByStatus: (status: TaskStatus) => Task[]
  getFiltered: () => Task[]
}

export const useBoardStore = create<BoardState>((set, get) => ({
  tasks: [],
  viewMode: 'kanban',
  filters: {},
  selectedTaskId: null,
  isDetailOpen: false,

  setTasks: (tasks) => set({ tasks }),

  addTask: (task) => set((s) => ({ tasks: [task, ...s.tasks] })),

  updateTask: (id, patch) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    })),

  removeTask: (id) =>
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

  setViewMode: (viewMode) => set({ viewMode }),

  setFilters: (filters) =>
    set((s) => ({ filters: { ...s.filters, ...filters } })),

  clearFilters: () => set({ filters: {} }),

  selectTask: (id) => set({ selectedTaskId: id, isDetailOpen: !!id }),

  closeDetail: () => set({ selectedTaskId: null, isDetailOpen: false }),

  getByStatus: (status) => {
    const { tasks, filters } = get()
    return tasks
      .filter((t) => {
        if (t.status !== status) return false
        if (filters.layer && t.layer !== filters.layer) return false
        if (filters.engine && t.engine !== filters.engine) return false
        if (filters.priority && t.priority !== filters.priority) return false
        if (filters.search) {
          const q = filters.search.toLowerCase()
          if (!t.title.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false
        }
        return true
      })
      .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
  },

  getFiltered: () => {
    const { tasks, filters } = get()
    return tasks
      .filter((t) => {
        if (filters.layer && t.layer !== filters.layer) return false
        if (filters.engine && t.engine !== filters.engine) return false
        if (filters.priority && t.priority !== filters.priority) return false
        if (filters.search) {
          const q = filters.search.toLowerCase()
          if (!t.title.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false
        }
        return true
      })
      .sort((a, b) => {
        const statusOrder = { todo: 0, in_progress: 1, review: 2, done: 3 }
        const priorityOrder = { P0: 0, P1: 1, P2: 2 }
        const sd = statusOrder[a.status] - statusOrder[b.status]
        if (sd !== 0) return sd
        return priorityOrder[a.priority] - priorityOrder[b.priority]
      })
  },
}))
