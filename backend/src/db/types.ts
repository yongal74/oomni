export type AgentRole =
  | 'research'
  | 'build'
  | 'design'
  | 'content'
  | 'growth'
  | 'ops'
  | 'integration'
  | 'n8n'
  | 'ceo';

export type AgentSchedule = 'manual' | 'hourly' | 'daily' | 'weekly';

export type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export type Provider =
  | 'slack'
  | 'notion'
  | 'gmail'
  | 'stripe'
  | 'github'
  | 'google_sheets'
  | 'n8n'
  | 'hubspot'
  | 'linear'
  | 'figma'
  | 'perplexity'
  | 'openai'
  | 'telegram'
  | 'discord'
  | 'posthog'
  | 'ga4'
  | 'polar'
  | 'toss';

export interface Mission {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

export interface Agent {
  id: string;
  mission_id: string;
  name: string;
  role: AgentRole;
  schedule: AgentSchedule;
  system_prompt: string;
  budget_cents: number;
  is_active: boolean;
  reports_to: string | null;
  created_at: string;
}

export interface HeartbeatRun {
  id: string;
  agent_id: string;
  status: RunStatus;
  session_id: string | null;
  output: string | null;
  error: string | null;
  tokens_input: number;
  tokens_output: number;
  cost_usd: number;
  started_at: string;
  finished_at: string | null;
}

export interface FeedItem {
  id: string;
  agent_id: string;
  run_id: string | null;
  type: 'info' | 'result' | 'approval' | 'error';
  content: string;
  action_label: string | null;
  action_data: Record<string, unknown> | null;
  requires_approval: boolean;
  approved_at: string | null;
  rejected_at: string | null;
  created_at: string;
}

export interface CostEvent {
  id: string;
  agent_id: string;
  run_id: string;
  tokens_input: number;
  tokens_output: number;
  cost_usd: number;
  created_at: string;
}

export interface Integration {
  id: string;
  mission_id: string;
  provider: Provider;
  label: string;
  is_active: boolean;
  created_at: string;
  // credentials는 암호화 상태로 DB 저장, 이 타입에는 노출 안 함
}

export interface Issue {
  id: string;
  mission_id: string;
  agent_id: string | null;
  title: string;
  description: string | null;
  status: 'open' | 'in_progress' | 'done' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  parent_id: string | null;
  created_at: string;
}

export interface Schedule {
  id: string;
  agent_id: string;
  mission_id: string;
  name: string;
  trigger_type: 'interval' | 'cron' | 'webhook' | 'bot_complete';
  trigger_value: string;
  is_active: boolean;
  last_run_at: string | null;
  created_at: string;
}
