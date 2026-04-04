/**
 * n8n Bot Service
 * 자연어 → n8n 워크플로우 생성/배포
 * "딸깍" UX: 사용자가 원하는 자동화를 말하면 → Claude가 워크플로우 JSON 생성 → n8n API로 배포
 */
import axios, { type AxiosInstance } from 'axios';
import { logger } from '../logger';

export interface N8nConfig {
  baseUrl: string;
  apiKey: string;
}

export interface N8nWorkflow {
  id?: string;
  name: string;
  nodes: N8nNode[];
  connections: Record<string, unknown>;
  settings?: Record<string, unknown>;
  active?: boolean;
}

interface N8nNode {
  id?: string;
  name: string;
  type: string;
  typeVersion?: number;
  position?: [number, number];
  parameters?: Record<string, unknown>;
}

// 사전 제공 템플릿 — 비개발자도 "딸깍"으로 활성화
const WORKFLOW_TEMPLATES: Record<string, (params: Record<string, unknown>) => N8nWorkflow> = {
  'slack-notify': (params) => ({
    name: `Slack 알림 — ${params.channel ?? '#general'}`,
    nodes: [
      {
        name: 'OOMNI Webhook',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 1,
        position: [240, 300],
        parameters: { path: 'oomni-trigger', httpMethod: 'POST' },
      },
      {
        name: 'Slack 메시지',
        type: 'n8n-nodes-base.slack',
        typeVersion: 2,
        position: [460, 300],
        parameters: {
          channel: params.channel ?? '#general',
          text: params.message ?? '{{ $json.content }}',
          authentication: 'oAuth2',
        },
      },
    ],
    connections: {
      'OOMNI Webhook': { main: [[{ node: 'Slack 메시지', type: 'main', index: 0 }]] },
    },
  }),

  'notion-save': (params) => ({
    name: `Notion 저장 — ${params.database ?? '기본 DB'}`,
    nodes: [
      {
        name: 'OOMNI Webhook',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 1,
        position: [240, 300],
        parameters: { path: 'oomni-notion', httpMethod: 'POST' },
      },
      {
        name: 'Notion 페이지 생성',
        type: 'n8n-nodes-base.notion',
        typeVersion: 2,
        position: [460, 300],
        parameters: {
          resource: 'page',
          operation: 'create',
          databaseId: params.database ?? '',
          title: '{{ $json.title }}',
        },
      },
    ],
    connections: {
      'OOMNI Webhook': { main: [[{ node: 'Notion 페이지 생성', type: 'main', index: 0 }]] },
    },
  }),

  'gmail-notify': (params) => ({
    name: `Gmail 알림 — ${params.to ?? ''}`,
    nodes: [
      {
        name: 'OOMNI Webhook',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 1,
        position: [240, 300],
        parameters: { path: 'oomni-email', httpMethod: 'POST' },
      },
      {
        name: 'Gmail 발송',
        type: 'n8n-nodes-base.gmail',
        typeVersion: 2,
        position: [460, 300],
        parameters: {
          sendTo: params.to ?? '',
          subject: params.subject ?? '{{ $json.title }}',
          message: '{{ $json.content }}',
        },
      },
    ],
    connections: {
      'OOMNI Webhook': { main: [[{ node: 'Gmail 발송', type: 'main', index: 0 }]] },
    },
  }),

  'google-sheets-append': (params) => ({
    name: `Google Sheets 기록 — ${params.sheet ?? ''}`,
    nodes: [
      {
        name: 'OOMNI Webhook',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 1,
        position: [240, 300],
        parameters: { path: 'oomni-sheets', httpMethod: 'POST' },
      },
      {
        name: 'Sheets 행 추가',
        type: 'n8n-nodes-base.googleSheets',
        typeVersion: 4,
        position: [460, 300],
        parameters: {
          operation: 'appendOrUpdate',
          documentId: { __rl: true, value: params.spreadsheetId ?? '', mode: 'id' },
          sheetName: { __rl: true, value: params.sheet ?? 'Sheet1', mode: 'name' },
          columns: { mappingMode: 'autoMapInputData' },
        },
      },
    ],
    connections: {
      'OOMNI Webhook': { main: [[{ node: 'Sheets 행 추가', type: 'main', index: 0 }]] },
    },
  }),

  'stripe-report': (_params) => ({
    name: 'Stripe 일일 수익 리포트',
    nodes: [
      {
        name: 'Schedule — 매일 오전 9시',
        type: 'n8n-nodes-base.scheduleTrigger',
        typeVersion: 1,
        position: [240, 300],
        parameters: { rule: { interval: [{ field: 'cronExpression', expression: '0 9 * * *' }] } },
      },
      {
        name: 'Stripe 결제 조회',
        type: 'n8n-nodes-base.stripe',
        typeVersion: 1,
        position: [460, 300],
        parameters: { resource: 'charge', operation: 'getAll', limit: 100 },
      },
      {
        name: 'OOMNI 보고',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4,
        position: [680, 300],
        parameters: {
          url: '={{ $env.OOMNI_API_URL }}/api/feed',
          method: 'POST',
          sendHeaders: true,
          headerParameters: { parameters: [{ name: 'Authorization', value: 'Bearer {{ $env.OOMNI_API_KEY }}' }] },
          sendBody: true,
          bodyParameters: {
            parameters: [
              { name: 'type', value: 'result' },
              { name: 'content', value: '오늘 Stripe 결제 {{ $items().length }}건' },
            ]
          },
        },
      },
    ],
    connections: {
      'Schedule — 매일 오전 9시': { main: [[{ node: 'Stripe 결제 조회', type: 'main', index: 0 }]] },
      'Stripe 결제 조회': { main: [[{ node: 'OOMNI 보고', type: 'main', index: 0 }]] },
    },
  }),
};

export class N8nBotService {
  private readonly client: AxiosInstance;
  private readonly baseUrl: string;

  constructor(config: N8nConfig) {
    this.baseUrl = config.baseUrl;
    this.client = axios.create({
      baseURL: config.baseUrl,
      headers: {
        'X-N8N-API-KEY': config.apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.client.get('/api/v1/workflows');
      return true;
    } catch {
      return false;
    }
  }

  async listWorkflows(): Promise<N8nWorkflow[]> {
    const res = await this.client.get('/api/v1/workflows');
    return res.data.data as N8nWorkflow[];
  }

  async createWorkflow(workflow: N8nWorkflow): Promise<N8nWorkflow> {
    const res = await this.client.post('/api/v1/workflows', workflow);
    logger.info(`[N8nBot] 워크플로우 생성: ${workflow.name}`);
    return res.data as N8nWorkflow;
  }

  async activateWorkflow(workflowId: string): Promise<N8nWorkflow> {
    const res = await this.client.put(`/api/v1/workflows/${workflowId}/activate`);
    logger.info(`[N8nBot] 워크플로우 활성화: ${workflowId}`);
    return res.data as N8nWorkflow;
  }

  async deactivateWorkflow(workflowId: string): Promise<N8nWorkflow> {
    const res = await this.client.put(`/api/v1/workflows/${workflowId}/deactivate`);
    return res.data as N8nWorkflow;
  }

  async deleteWorkflow(workflowId: string): Promise<void> {
    await this.client.delete(`/api/v1/workflows/${workflowId}`);
    logger.info(`[N8nBot] 워크플로우 삭제: ${workflowId}`);
  }

  generateWebhookUrl(triggerId: string): string {
    return `${this.baseUrl}/webhook/${triggerId}`;
  }

  buildWorkflowFromTemplate(templateId: string, params: Record<string, unknown>): N8nWorkflow {
    const factory = WORKFLOW_TEMPLATES[templateId];
    if (!factory) {
      throw new Error(`템플릿을 찾을 수 없습니다: ${templateId}`);
    }
    return factory(params);
  }

  /** 사용 가능한 템플릿 목록 반환 (UI용) */
  getAvailableTemplates(): Array<{ id: string; name: string; description: string }> {
    return [
      { id: 'slack-notify', name: 'Slack 알림', description: 'OOMNI 봇 결과를 Slack 채널로 전송' },
      { id: 'notion-save', name: 'Notion 저장', description: '봇 결과물을 Notion 데이터베이스에 저장' },
      { id: 'gmail-notify', name: 'Gmail 알림', description: '완료 알림을 이메일로 발송' },
      { id: 'google-sheets-append', name: 'Google Sheets 기록', description: '데이터를 스프레드시트에 자동 기록' },
      { id: 'stripe-report', name: 'Stripe 일일 리포트', description: '매일 오전 9시 결제 현황 자동 집계' },
    ];
  }
}
