/**
 * Integration Service
 * 외부 서비스 연결 관리: Slack, Notion, Gmail, Stripe, GitHub, etc.
 * credentials는 Vault(AES-256-GCM)로 암호화해서 DB 저장
 * 다른 봇들이 getCredential()로 공유 사용
 */
import type { Vault } from '../crypto/vault';
import type { Provider } from '../db/types';
import { logger } from '../logger';

export const SUPPORTED_PROVIDERS: Provider[] = [
  'slack', 'notion', 'gmail', 'stripe', 'github',
  'google_sheets', 'n8n', 'hubspot', 'linear', 'figma',
  'perplexity', 'openai', 'telegram', 'discord',
  'posthog', 'ga4', 'polar', 'toss',
  'google_ads', 'meta_ads', 'search_console', 'mailchimp',
  'supabase', 'vercel', 'make',
];

interface DbClient {
  query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
}

export class IntegrationService {
  constructor(
    private readonly db: DbClient,
    private readonly vault: Vault,
  ) {}

  async saveCredential(
    missionId: string,
    provider: string,
    credentials: Record<string, unknown>,
    label?: string,
  ): Promise<void> {
    if (!SUPPORTED_PROVIDERS.includes(provider as Provider)) {
      throw new Error(`지원하지 않는 provider: ${provider}`);
    }

    const encrypted = this.vault.encryptObject(credentials);

    await this.db.query(
      `INSERT INTO integrations (mission_id, provider, credentials, label, is_active)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (mission_id, provider)
       DO UPDATE SET credentials = $3, label = $4, is_active = true`,
      [missionId, provider, encrypted, label ?? provider],
    );

    logger.info(`[IntegrationService] 연동 저장: mission=${missionId} provider=${provider}`);
  }

  async getCredential<T = Record<string, unknown>>(
    missionId: string,
    provider: string,
  ): Promise<T | null> {
    const result = await this.db.query(
      `SELECT credentials FROM integrations
       WHERE mission_id = $1 AND provider = $2 AND is_active = true`,
      [missionId, provider],
    );

    const rows = result.rows as Array<{ credentials: string }>;
    if (rows.length === 0) return null;

    return this.vault.decryptObject<T>(rows[0].credentials);
  }

  async listIntegrations(missionId: string): Promise<Array<{
    id: string;
    provider: string;
    label: string;
    is_active: boolean;
    created_at: Date;
  }>> {
    const result = await this.db.query(
      `SELECT id, provider, label, is_active, created_at
       FROM integrations
       WHERE mission_id = $1
       ORDER BY created_at DESC`,
      [missionId],
    );

    // credentials는 노출하지 않음 (보안)
    return result.rows as Array<{
      id: string;
      provider: string;
      label: string;
      is_active: boolean;
      created_at: Date;
    }>;
  }

  async deleteCredential(integrationId: string): Promise<void> {
    await this.db.query(
      'DELETE FROM integrations WHERE id = $1',
      [integrationId],
    );
    logger.info(`[IntegrationService] 연동 삭제: id=${integrationId}`);
  }

  async deactivateCredential(integrationId: string): Promise<void> {
    await this.db.query(
      'UPDATE integrations SET is_active = false WHERE id = $1',
      [integrationId],
    );
  }

  /** 지원 provider 목록 + 연결 상태 반환 (UI용) */
  getProviderMeta(): Array<{
    id: Provider;
    name: string;
    icon: string;
    authType: 'apikey' | 'oauth2';
    category: string;
    description: string;
    fields: Array<{ key: string; label: string; type: string; placeholder?: string }>;
  }> {
    return [
      {
        id: 'slack', name: 'Slack', icon: '💬', authType: 'oauth2', category: 'communication',
        description: '채널 알림 및 메시지',
        fields: [{ key: 'webhook_url', label: 'Webhook URL', type: 'text', placeholder: 'https://hooks.slack.com/...' }],
      },
      {
        id: 'notion', name: 'Notion', icon: '📝', authType: 'oauth2', category: 'productivity',
        description: '문서 및 데이터베이스 연동',
        fields: [{ key: 'token', label: 'Integration Token', type: 'password', placeholder: 'secret_...' }],
      },
      {
        id: 'gmail', name: 'Gmail', icon: '📧', authType: 'oauth2', category: 'communication',
        description: '이메일 송수신 자동화',
        fields: [{ key: 'token', label: 'OAuth Token', type: 'password', placeholder: 'ya29...' }],
      },
      {
        id: 'stripe', name: 'Stripe', icon: '💳', authType: 'apikey', category: 'payments',
        description: '글로벌 결제 및 구독 관리',
        fields: [{ key: 'apiKey', label: 'Secret Key', type: 'password', placeholder: 'sk_live_...' }],
      },
      {
        id: 'github', name: 'GitHub', icon: '🐙', authType: 'oauth2', category: 'dev',
        description: '코드 저장소 연동',
        fields: [
          { key: 'token', label: 'Personal Access Token', type: 'password', placeholder: 'ghp_...' },
          { key: 'repo', label: 'Repository (optional)', type: 'text', placeholder: 'owner/repo' },
        ],
      },
      {
        id: 'google_sheets', name: 'Google Sheets', icon: '📊', authType: 'oauth2', category: 'productivity',
        description: '스프레드시트 데이터 연동',
        fields: [{ key: 'token', label: 'OAuth Token', type: 'password', placeholder: 'ya29...' }],
      },
      {
        id: 'n8n', name: 'n8n', icon: '⚡', authType: 'apikey', category: 'dev',
        description: '워크플로우 자동화',
        fields: [
          { key: 'baseUrl', label: 'n8n URL', type: 'text', placeholder: 'http://localhost:5678' },
          { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'n8n_api_...' },
        ],
      },
      {
        id: 'hubspot', name: 'HubSpot', icon: '🎯', authType: 'oauth2', category: 'productivity',
        description: 'CRM 및 마케팅 자동화',
        fields: [{ key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'pat-...' }],
      },
      {
        id: 'linear', name: 'Linear', icon: '📋', authType: 'apikey', category: 'dev',
        description: '이슈 트래킹 및 프로젝트 관리',
        fields: [{ key: 'api_key', label: 'API Key', type: 'password', placeholder: 'lin_api_...' }],
      },
      {
        id: 'figma', name: 'Figma', icon: '🎨', authType: 'oauth2', category: 'productivity',
        description: '디자인 파일 접근 및 연동',
        fields: [{ key: 'token', label: 'Personal Access Token', type: 'password', placeholder: 'figd_...' }],
      },
      {
        id: 'perplexity', name: 'Perplexity AI', icon: '🔍', authType: 'apikey', category: 'ai',
        description: '실시간 웹 검색 기반 AI 리서치',
        fields: [{ key: 'api_key', label: 'API Key', type: 'password', placeholder: 'pplx-...' }],
      },
      {
        id: 'openai', name: 'OpenAI', icon: '🤖', authType: 'apikey', category: 'ai',
        description: 'GPT-4o, DALL-E 이미지 생성',
        fields: [{ key: 'api_key', label: 'API Key', type: 'password', placeholder: 'sk-...' }],
      },
      {
        id: 'telegram', name: 'Telegram Bot', icon: '✈️', authType: 'apikey', category: 'communication',
        description: '봇 알림 및 메시지 전송',
        fields: [
          { key: 'bot_token', label: 'Bot Token', type: 'password', placeholder: '1234567890:ABC...' },
          { key: 'chat_id', label: 'Chat ID', type: 'text', placeholder: '-1001234567890' },
        ],
      },
      {
        id: 'discord', name: 'Discord', icon: '🎮', authType: 'apikey', category: 'communication',
        description: '서버 알림 및 메시지',
        fields: [{ key: 'webhook_url', label: 'Webhook URL', type: 'text', placeholder: 'https://discord.com/api/webhooks/...' }],
      },
      {
        id: 'posthog', name: 'PostHog', icon: '📊', authType: 'apikey', category: 'analytics',
        description: '제품 분석 및 이벤트 트래킹',
        fields: [
          { key: 'api_key', label: 'Project API Key', type: 'password', placeholder: 'phc_...' },
          { key: 'host', label: 'Host (optional)', type: 'text', placeholder: 'https://app.posthog.com' },
        ],
      },
      {
        id: 'ga4', name: 'Google Analytics 4', icon: '📈', authType: 'apikey', category: 'analytics',
        description: '웹사이트 트래픽 분석',
        fields: [
          { key: 'measurement_id', label: 'Measurement ID', type: 'text', placeholder: 'G-XXXXXXXXXX' },
          { key: 'api_secret', label: 'API Secret', type: 'password' },
        ],
      },
      {
        id: 'polar', name: 'Polar', icon: '⭐', authType: 'apikey', category: 'payments',
        description: '오픈소스 수익화 플랫폼',
        fields: [{ key: 'api_key', label: 'API Key', type: 'password', placeholder: 'polar_...' }],
      },
      {
        id: 'toss', name: 'Toss Payments', icon: '💳', authType: 'apikey', category: 'payments',
        description: '국내 결제 연동',
        fields: [
          { key: 'secret_key', label: 'Secret Key', type: 'password', placeholder: 'sk_test_...' },
          { key: 'client_key', label: 'Client Key', type: 'text', placeholder: 'ck_test_...' },
        ],
      },
      {
        id: 'google_ads', name: 'Google Ads', icon: '📢', authType: 'apikey', category: 'ads',
        description: '스마트 입찰, 반응형 광고, ROAS 목표 설정',
        fields: [
          { key: 'developer_token', label: 'Developer Token', type: 'password', placeholder: 'ABcdEFgh...' },
          { key: 'customer_id', label: 'Customer ID', type: 'text', placeholder: '123-456-7890' },
        ],
      },
      {
        id: 'meta_ads', name: 'Meta Ads', icon: '📘', authType: 'apikey', category: 'ads',
        description: '유사 타겟, 리타겟, Advantage+ 캠페인',
        fields: [
          { key: 'access_token', label: 'Access Token', type: 'password', placeholder: 'EAAxxxxx...' },
          { key: 'ad_account_id', label: 'Ad Account ID', type: 'text', placeholder: 'act_123456789' },
        ],
      },
      {
        id: 'search_console', name: 'Search Console', icon: '🔍', authType: 'apikey', category: 'analytics',
        description: 'CTR, 노출, 키워드 포지션 추적',
        fields: [
          { key: 'site_url', label: 'Site URL', type: 'text', placeholder: 'https://yoursite.com' },
          { key: 'service_account_json', label: 'Service Account JSON', type: 'password', placeholder: '{"type":"service_account",...}' },
        ],
      },
      {
        id: 'mailchimp', name: 'Mailchimp', icon: '✉️', authType: 'apikey', category: 'marketing',
        description: '자동화 플로우, 세그먼트, A/B 테스트',
        fields: [
          { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxx-us11' },
          { key: 'serverPrefix', label: 'Server Prefix', type: 'text', placeholder: 'us11' },
        ],
      },
      {
        id: 'supabase', name: 'Supabase', icon: '⚡', authType: 'apikey', category: 'dev',
        description: '실험 데이터 저장, 실시간 이벤트 추적',
        fields: [
          { key: 'url', label: 'Project URL', type: 'text', placeholder: 'https://xxxx.supabase.co' },
          { key: 'apiKey', label: 'Anon Key', type: 'password', placeholder: 'eyJhbGciOi...' },
        ],
      },
      {
        id: 'vercel', name: 'Vercel', icon: '▲', authType: 'apikey', category: 'dev',
        description: 'A/B 테스트 배포, Edge Functions, 피처 플래그',
        fields: [{ key: 'token', label: 'Access Token', type: 'password', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxx' }],
      },
      {
        id: 'make', name: 'Make.com', icon: '🔄', authType: 'apikey', category: 'dev',
        description: '앱 간 연결, 간단한 워크플로우 자동화',
        fields: [
          { key: 'apiKey', label: 'API Token', type: 'password', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
          { key: 'zone', label: 'Zone', type: 'text', placeholder: 'eu1 또는 us1' },
        ],
      },
    ];
  }

  /** 외부 서비스 연결 테스트 + 기본 데이터 조회 */
  async testConnection(missionId: string, provider: string): Promise<{
    connected: boolean;
    message: string;
    data?: Record<string, unknown>;
  }> {
    const creds = await this.getCredential<Record<string, string>>(missionId, provider);
    if (!creds) return { connected: false, message: '저장된 연동 정보가 없습니다' };

    const timeout = (ms: number) => new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms));
    const fetchWithTimeout = (url: string, opts: RequestInit) =>
      Promise.race([fetch(url, opts), timeout(8000)]) as Promise<Response>;

    try {
      switch (provider) {
        case 'n8n': {
          const baseUrl = (creds['baseUrl'] ?? 'http://localhost:5678').replace(/\/$/, '');
          const apiKey = creds['apiKey'] ?? '';
          const res = await fetchWithTimeout(`${baseUrl}/api/v1/workflows`, {
            headers: { 'X-N8N-API-KEY': apiKey },
          });
          if (!res.ok) return { connected: false, message: `n8n 응답 오류 (${res.status})` };
          const body = await res.json() as { data?: Array<{ active: boolean }> };
          const total = body.data?.length ?? 0;
          const active = body.data?.filter(w => w.active).length ?? 0;
          return { connected: true, message: `n8n 연결 완료`, data: { workflowTotal: total, workflowActive: active } };
        }
        case 'hubspot': {
          const res = await fetchWithTimeout('https://api.hubapi.com/crm/v3/objects/contacts?limit=0', {
            headers: { Authorization: `Bearer ${creds['apiKey'] ?? ''}` },
          });
          if (!res.ok) return { connected: false, message: `HubSpot API 키 오류 (${res.status})` };
          const body = await res.json() as { total?: number };
          return { connected: true, message: `HubSpot 연결 완료`, data: { contactsTotal: body.total ?? 0 } };
        }
        case 'posthog': {
          const host = (creds['host'] ?? 'https://app.posthog.com').replace(/\/$/, '');
          const res = await fetchWithTimeout(`${host}/api/users/@me/`, {
            headers: { Authorization: `Bearer ${creds['api_key'] ?? ''}` },
          });
          if (!res.ok) return { connected: false, message: `PostHog API 키 오류 (${res.status})` };
          const body = await res.json() as { email?: string; team?: { name?: string } };
          return { connected: true, message: `PostHog 연결 완료`, data: { email: body.email, team: body.team?.name } };
        }
        case 'notion': {
          const res = await fetchWithTimeout('https://api.notion.com/v1/users/me', {
            headers: {
              Authorization: `Bearer ${creds['token'] ?? ''}`,
              'Notion-Version': '2022-06-28',
            },
          });
          if (!res.ok) return { connected: false, message: `Notion 토큰 오류 (${res.status})` };
          const body = await res.json() as { name?: string; type?: string };
          return { connected: true, message: `Notion 연결 완료`, data: { name: body.name, type: body.type } };
        }
        case 'figma': {
          const res = await fetchWithTimeout('https://api.figma.com/v1/me', {
            headers: { 'X-Figma-Token': creds['token'] ?? '' },
          });
          if (!res.ok) return { connected: false, message: `Figma 토큰 오류 (${res.status})` };
          const body = await res.json() as { handle?: string; email?: string };
          return { connected: true, message: `Figma 연결 완료`, data: { handle: body.handle, email: body.email } };
        }
        case 'vercel': {
          const res = await fetchWithTimeout('https://api.vercel.com/v9/projects?limit=5', {
            headers: { Authorization: `Bearer ${creds['token'] ?? ''}` },
          });
          if (!res.ok) return { connected: false, message: `Vercel 토큰 오류 (${res.status})` };
          const body = await res.json() as { projects?: Array<{ name: string }> };
          return { connected: true, message: `Vercel 연결 완료`, data: { projectCount: body.projects?.length ?? 0 } };
        }
        case 'supabase': {
          const url = (creds['url'] ?? '').replace(/\/$/, '');
          const res = await fetchWithTimeout(`${url}/rest/v1/`, {
            headers: {
              apikey: creds['apiKey'] ?? '',
              Authorization: `Bearer ${creds['apiKey'] ?? ''}`,
            },
          });
          return { connected: res.ok, message: res.ok ? 'Supabase 연결 완료' : `Supabase 연결 오류 (${res.status})` };
        }
        default:
          return { connected: true, message: `${provider} 연동 정보 저장 완료 (API 연결 테스트 미지원)` };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { connected: false, message: `연결 실패: ${msg === 'timeout' ? '응답 시간 초과 (8초)' : msg}` };
    }
  }
}
