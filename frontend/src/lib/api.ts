import axios from 'axios'

const BASE_URL = 'http://localhost:3001'

// getInternalApiKey()는 async IPC 호출 → interceptor로 lazy하게 처리
let _cachedKey: string | null = null
async function getInternalApiKey(): Promise<string> {
  if (_cachedKey) return _cachedKey
  try {
    const key = await (window as any).electronAPI?.getInternalApiKey?.()
    _cachedKey = key ?? 'dev-key'
  } catch {
    _cachedKey = 'dev-key'
  }
  return _cachedKey!
}

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
})

api.interceptors.request.use(async (config) => {
  const key = await getInternalApiKey()
  config.headers.Authorization = `Bearer ${key}`
  return config
})

// 인증용 axios (Bearer 인증 없음)
const authAxios = axios.create({ baseURL: BASE_URL, timeout: 10000 })

// 타입 헬퍼
export interface ApiResponse<T> { data: T }

// ── 워크스페이스 파일 타입 ──────────────────────────────────────────────────
export interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
  size?: number
  modified?: string
  language?: string
}

// 미션
export const missionsApi = {
  list: () => api.get<ApiResponse<Mission[]>>('/api/missions').then(r => r.data.data),
  create: (data: { name: string; description: string }) =>
    api.post<ApiResponse<Mission>>('/api/missions', data).then(r => r.data.data),
  get: (id: string) => api.get<ApiResponse<Mission>>(`/api/missions/${id}`).then(r => r.data.data),
}

// 에이전트
export const agentsApi = {
  list: (missionId?: string) =>
    api.get<ApiResponse<Agent[]>>('/api/agents', { params: { mission_id: missionId } }).then(r => r.data.data),
  create: (data: Partial<Agent>) =>
    api.post<ApiResponse<Agent>>('/api/agents', data).then(r => r.data.data),
  update: (id: string, data: Partial<Agent>) =>
    api.patch<ApiResponse<Agent>>(`/api/agents/${id}`, data).then(r => r.data.data),
  trigger: (id: string, task?: string) =>
    api.post(`/api/agents/${id}/trigger`, task ? { task } : {}).then(r => r.data),
  delete: (id: string) => api.delete(`/api/agents/${id}`),
  runs: (id: string) =>
    api.get<ApiResponse<FeedItem[]>>(`/api/agents/${id}/runs`).then(r => r.data.data),
  heartbeatRuns: (id: string, limit?: number) =>
    api.get<{ data: HeartbeatRun[] }>(`/api/agents/${id}/heartbeat-runs`, { params: { limit } }).then(r => r.data.data),
}

// 워크스페이스 파일
export const workspaceApi = {
  files: (agentId: string) =>
    api.get<{ data: FileNode[]; workspace: string; exists: boolean }>(
      `/api/agents/${agentId}/workspace-files`
    ).then(r => r.data),
  content: (agentId: string, filePath: string) =>
    api.get<{ data: string; path: string }>(
      `/api/agents/${agentId}/workspace-files/content`,
      { params: { path: filePath } }
    ).then(r => r.data),
}

// 피드
export const feedApi = {
  list: (params?: { mission_id?: string; approval_only?: boolean; limit?: number }) =>
    api.get<ApiResponse<FeedItem[]>>('/api/feed', { params }).then(r => r.data.data),
  approve: (id: string) => api.post(`/api/feed/${id}/approve`).then(r => r.data.data),
  reject: (id: string) => api.post(`/api/feed/${id}/reject`).then(r => r.data.data),
}

// 비용
export const costApi = {
  summary: (missionId?: string, period?: string) =>
    api.get('/api/cost/summary', { params: { mission_id: missionId, period } }).then(r => r.data),
}

// 연동
export const integrationsApi = {
  list: (missionId: string) =>
    api.get('/api/integrations', { params: { mission_id: missionId } }).then(r => r.data.data),
  providers: () => api.get('/api/integrations/providers').then(r => r.data.data),
  save: (data: { mission_id: string; provider: string; credentials: Record<string, string>; label?: string }) =>
    api.post('/api/integrations', data).then(r => r.data),
  delete: (id: string) => api.delete(`/api/integrations/${id}`),
}

// 이슈/티켓
export const issuesApi = {
  list: (params?: { mission_id?: string; status?: string; priority?: string }) =>
    api.get<ApiResponse<Issue[]>>('/api/issues', { params }).then(r => r.data.data),
  create: (data: { mission_id: string; title: string; description?: string; priority?: string; agent_id?: string }) =>
    api.post<ApiResponse<Issue>>('/api/issues', data).then(r => r.data.data),
  update: (id: string, data: Partial<Issue>) =>
    api.patch<ApiResponse<Issue>>(`/api/issues/${id}`, data).then(r => r.data.data),
  delete: (id: string) => api.delete(`/api/issues/${id}`),
}

// 스케줄
export const schedulesApi = {
  list: (params?: { mission_id?: string; agent_id?: string }) =>
    api.get<ApiResponse<Schedule[]>>('/api/schedules', { params }).then(r => r.data.data),
  create: (data: { agent_id: string; mission_id: string; name: string; trigger_type: string; trigger_value: string }) =>
    api.post<ApiResponse<Schedule>>('/api/schedules', data).then(r => r.data.data),
  update: (id: string, data: Partial<Schedule>) =>
    api.patch<ApiResponse<Schedule>>(`/api/schedules/${id}`, data).then(r => r.data.data),
  delete: (id: string) => api.delete(`/api/schedules/${id}`),
}

// 리포트
export const reportsApi = {
  get: (missionId: string, period: 'daily' | 'weekly' | 'monthly') =>
    api.get('/api/reports', { params: { mission_id: missionId, period } }).then(r => r.data),
}

// 리서치 스튜디오
export const researchApi = {
  list: (missionId: string) =>
    api.get<ApiResponse<ResearchItem[]>>('/api/research', { params: { mission_id: missionId } }).then(r => r.data.data),
  collect: (data: { mission_id: string; source_type: string; source_url?: string; keyword?: string; content?: string }) =>
    api.post<ApiResponse<ResearchItem>>('/api/research/collect', data).then(r => r.data.data),
  create: (data: Partial<ResearchItem>) =>
    api.post<ApiResponse<ResearchItem>>('/api/research', data).then(r => r.data.data),
  filter: (id: string, decision: 'keep' | 'drop' | 'watch') =>
    api.post(`/api/research/${id}/filter`, { decision }).then(r => r.data),
  convert: (id: string, output_type: string) =>
    api.post<ApiResponse<{ content: string }>>(`/api/research/${id}/convert`, { output_type }).then(r => r.data.data),
  saveOutputs: (itemId: string, outputs: Record<string, string>) =>
    api.patch(`/api/research/items/${itemId}/outputs`, { outputs }).then(r => r.data),
  loadOutputs: (itemId: string) =>
    api.get<ApiResponse<Record<string, string>>>(`/api/research/items/${itemId}/outputs`).then(r => r.data.data),
  delete: (id: string) => api.delete(`/api/research/${id}`),
  aiwxPost: (data: { item_id?: string; book_num?: number; publish?: boolean }) =>
    api.post<{ content: string; file_path: string; publish_result?: { success: boolean; error?: string } }>(
      '/api/research/aiwx-post', data, { timeout: 120000 }
    ).then(r => r.data),
}

// 설정 (Bearer 없이 직접 호출, 온보딩용)
const settingsAxios = axios.create({ baseURL: BASE_URL, timeout: 10000 })

export const settingsApi = {
  setApiKey: (key: string): Promise<{ success: boolean; message: string }> =>
    settingsAxios.post('/api/settings/api-key', { key }).then(r => r.data),
  getStatus: (): Promise<{ api_key_set: boolean }> =>
    settingsAxios.get('/api/settings/api-key/status').then(r => r.data),
  get: (): Promise<{ anthropic_api_key: string | null; google_configured: boolean }> =>
    settingsAxios.get('/api/settings').then(r => r.data),
  setGoogleOAuth: (client_id: string, client_secret: string): Promise<{ success: boolean; message: string }> =>
    api.post('/api/settings/google-oauth', { client_id, client_secret }).then(r => r.data),
  getGoogleOAuth: (): Promise<{ configured: boolean; client_id_masked: string | null }> =>
    api.get('/api/settings/google-oauth').then(r => r.data),
}

// 통합 연동 설정
export const integrationsSettingsApi = {
  get: (): Promise<{ cdp_configured: boolean; cdp_key_masked: string | null; video_configured: boolean; video_key_masked: string | null }> =>
    api.get('/api/settings/integrations').then(r => r.data),
  setCdpKey: (key: string): Promise<{ success: boolean; message: string }> =>
    api.post('/api/settings/cdp-key', { key }).then(r => r.data),
  deleteCdpKey: (): Promise<{ success: boolean }> =>
    api.delete('/api/settings/cdp-key').then(r => r.data),
  setVideoKey: (key: string): Promise<{ success: boolean; message: string }> =>
    api.post('/api/settings/video-key', { key }).then(r => r.data),
  deleteVideoKey: (): Promise<{ success: boolean }> =>
    api.delete('/api/settings/video-key').then(r => r.data),
}

// Obsidian vault 경로 설정
export const obsidianSettingsApi = {
  get: (): Promise<{ vault_path: string }> =>
    api.get('/api/settings/obsidian').then(r => r.data),
  save: (vault_path: string): Promise<{ success: boolean }> =>
    api.post('/api/settings/obsidian', { vault_path }).then(r => r.data),
}

// Obsidian 아카이브
export const obsidianApi = {
  status: (): Promise<{ configured: boolean; vault_path: string }> =>
    api.get('/api/obsidian/status').then(r => r.data),
  archive: (data: { title: string; content: string; bot_role: string; tags?: string[] }) =>
    api.post<{ success: boolean; file_path: string; file_name: string }>('/api/obsidian/archive', data).then(r => r.data),
}

// 백업/복원
export const backupApi = {
  export: (): Promise<void> => {
    return api.get('/api/backup/export', { responseType: 'blob' }).then(r => {
      const url = window.URL.createObjectURL(new Blob([r.data], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = 'oomni-backup-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json'
      a.click()
      window.URL.revokeObjectURL(url)
    })
  },
  import: (data: unknown): Promise<{ success: boolean; message: string; imported: number }> =>
    api.post('/api/backup/import', data).then(r => r.data),
}

// 프로필
export const profileApi = {
  update: (data: { display_name: string }) =>
    api.patch('/api/auth/profile', data, {
      headers: { Authorization: `Bearer ${sessionStorage.getItem('session_token') || ''}` }
    }).then(r => r.data),
  activateLicense: (license_key: string) =>
    api.post('/api/auth/license/activate', { license_key }, {
      headers: { Authorization: `Bearer ${sessionStorage.getItem('session_token') || ''}` }
    }).then(r => r.data),
}

// 개발 환경
export const devtoolsApi = {
  status: (): Promise<{ claude_code: boolean; vscode: boolean; cursor: boolean; antigravity: boolean }> =>
    api.get('/api/devtools/status').then(r => r.data),
  savePreference: (preferred_ide: string) =>
    api.post('/api/devtools/save-preference', { preferred_ide }).then(r => r.data),
  getPreference: (): Promise<{ preferred_ide: string }> =>
    api.get('/api/devtools/preference').then(r => r.data),
}

// 인증 (Bearer 없이 직접 호출)
export const authApi = {
  status: (): Promise<{ pin_set: boolean }> =>
    authAxios.get('/api/auth/status').then(r => r.data),
  setPin: (pin: string): Promise<{ success: boolean; message: string }> =>
    authAxios.post('/api/auth/pin/set', { pin }).then(r => r.data),
  verifyPin: (pin: string): Promise<{ success: boolean; session_token: string }> =>
    authAxios.post('/api/auth/pin/verify', { pin }).then(r => r.data),
}

export interface Subscription {
  plan: string
  status: string
  display_name?: string
  email?: string
  license_valid_until?: string
  current_period_end?: string
}

export const paymentsApi = {
  subscription: (): Promise<Subscription> =>
    Promise.resolve({ plan: 'license', status: 'active' }),
  quota: (): Promise<{ plan: string; runCount: number; limit: number; exceeded: boolean; remaining: number }> =>
    Promise.resolve({ plan: 'license', runCount: 0, limit: 99999, exceeded: false, remaining: 99999 }),
  cancel: (): Promise<unknown> =>
    Promise.reject(new Error('paymentsApi 미지원 (v3)')),
}

// 타입들
export interface Mission { id: string; name: string; description: string; created_at: string }
export interface Agent {
  id: string; mission_id: string; name: string;
  role: 'research'|'build'|'design'|'content'|'ops'|'ceo'|'project_setup'|'env'|'security_audit'|'frontend'|'backend'|'infra';
  schedule: 'manual'|'hourly'|'daily'|'weekly';
  system_prompt: string; budget_cents: number;
  is_active: boolean; reports_to: string|null; created_at: string;
}
export interface FeedItem {
  id: string; agent_id: string; run_id: string|null;
  type: 'info'|'result'|'approval'|'error';
  content: string; action_label: string|null; action_data: Record<string,unknown>|null;
  requires_approval: boolean; approved_at: string|null; rejected_at: string|null;
  created_at: string; agent_name?: string; agent_role?: string;
}
export interface Issue {
  id: string; mission_id: string; agent_id: string | null;
  title: string; description: string | null;
  status: 'open' | 'in_progress' | 'done' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  parent_id: string | null; created_at: string;
}
export interface Schedule {
  id: string; agent_id: string; mission_id: string;
  name: string;
  trigger_type: 'interval' | 'cron' | 'webhook' | 'bot_complete';
  trigger_value: string;
  is_active: boolean; last_run_at: string | null; created_at: string;
}
export interface ResearchItem {
  id: string
  mission_id: string
  source_type: 'rss' | 'url' | 'keyword' | 'manual'
  source_url?: string
  title: string
  summary?: string
  content?: string
  tags: string[]
  signal_score: number
  filter_decision: 'pending' | 'keep' | 'drop' | 'watch'
  next_action?: string
  converted_output?: string
  created_at: string
}

export interface HeartbeatRun {
  id: string
  agent_id: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  task?: string
  output?: string
  error?: string
  tokens_input: number
  tokens_output: number
  cost_usd: number
  started_at: string
  finished_at?: string
}

// 디자인 시스템
export interface DesignSystem {
  mission_id: string
  preset: string
  primary_color: string
  bg_color: string
  surface_color: string
  text_color: string
  muted_color: string
  accent_color: string
  font_family: string
  border_radius: string
  style_voice: string
}

export const designSystemsApi = {
  get: (missionId: string) =>
    api.get<ApiResponse<DesignSystem>>(`/api/design-systems/${missionId}`).then(r => r.data.data),
  update: (missionId: string, data: Partial<DesignSystem>) =>
    api.put<ApiResponse<DesignSystem>>(`/api/design-systems/${missionId}`, data).then(r => r.data.data),
}

export interface DesignOutput {
  id: string
  agent_id: string
  mission_id: string | null
  title: string | null
  html_content?: string
  created_at: string
}

export const designOutputsApi = {
  list: (agentId: string) =>
    api.get<ApiResponse<DesignOutput[]>>(`/api/agents/${agentId}/design-outputs`).then(r => r.data.data),
  get: (agentId: string, outputId: string) =>
    api.get<ApiResponse<DesignOutput>>(`/api/agents/${agentId}/design-outputs/${outputId}`).then(r => r.data.data),
}

export interface BuildTodo {
  id: string
  agent_id: string
  title: string
  status: 'todo' | 'in_progress' | 'done'
  priority: 'low' | 'medium' | 'high'
  created_at: string
}

export const buildTodosApi = {
  list: (agentId: string) =>
    api.get<ApiResponse<BuildTodo[]>>(`/api/agents/${agentId}/todos`).then(r => r.data.data),
  create: (agentId: string, data: { title: string; priority?: BuildTodo['priority'] }) =>
    api.post<ApiResponse<BuildTodo>>(`/api/agents/${agentId}/todos`, data).then(r => r.data.data),
  update: (agentId: string, todoId: string, data: { status?: BuildTodo['status']; title?: string }) =>
    api.patch<ApiResponse<BuildTodo>>(`/api/agents/${agentId}/todos/${todoId}`, data).then(r => r.data.data),
  delete: (agentId: string, todoId: string) =>
    api.delete(`/api/agents/${agentId}/todos/${todoId}`).then(r => r.data),
}
