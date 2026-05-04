/**
 * tasksApi.ts — Mission Board Task API 클라이언트
 * v5.0.1
 */
import { api } from './api'
import type { ApiResponse } from './api'

export type TaskLayer   = 'build'|'frontend'|'backend'|'infra'|'content'|'research'|'design'|'marketing'|'ops'
export type TaskEngine  = 'claude_code'|'codex'|'claude_design'|'research'|'growth'|'ops'|'chat'
export type TaskStatus  = 'todo'|'in_progress'|'review'|'done'
export type TaskPriority = 'P0'|'P1'|'P2'

export interface Task {
  id: string
  mission_id: string
  project_id?: string
  title: string
  description: string
  layer: TaskLayer
  engine: TaskEngine
  priority: TaskPriority
  status: TaskStatus
  due_date?: string
  estimated_hours?: number
  recipe_id?: string
  requires_approval: boolean
  checkout_lock?: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface TaskResult {
  id: string
  task_id: string
  engine: string
  model?: string
  status: 'success'|'failed'|'cancelled'
  output?: string
  file_paths?: string
  tokens_used?: number
  cost_usd?: number
  started_at?: string
  completed_at?: string
  created_at: string
}

export type CreateTaskInput = Omit<Task, 'id'|'created_at'|'updated_at'|'checkout_lock'|'sort_order'>

export const tasksApi = {
  list: (params: {
    mission_id: string
    status?: TaskStatus
    layer?: TaskLayer
    engine?: TaskEngine
    priority?: TaskPriority
  }) =>
    api.get<ApiResponse<Task[]>>('/api/tasks', { params }).then(r => r.data.data),

  get: (id: string) =>
    api.get<ApiResponse<Task>>(`/api/tasks/${id}`).then(r => r.data.data),

  create: (data: Partial<Task> & { mission_id: string; title: string }) =>
    api.post<ApiResponse<Task>>('/api/tasks', data).then(r => r.data.data),

  update: (id: string, data: Partial<Task>) =>
    api.put<ApiResponse<Task>>(`/api/tasks/${id}`, data).then(r => r.data.data),

  delete: (id: string) =>
    api.delete(`/api/tasks/${id}`),

  execute: (id: string, model?: string) =>
    api.post(`/api/tasks/${id}/execute`, { model }),

  approve: (id: string) =>
    api.post(`/api/tasks/${id}/approve`),

  reject: (id: string, reason?: string) =>
    api.post(`/api/tasks/${id}/reject`, { reason }),

  reorder: (items: { id: string; status: TaskStatus; sort_order: number }[]) =>
    api.put('/api/tasks/reorder', { items }),

  results: (id: string) =>
    api.get<ApiResponse<TaskResult[]>>(`/api/tasks/${id}/results`).then(r => r.data.data),
}
