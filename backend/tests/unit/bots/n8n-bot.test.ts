/**
 * TDD: n8n Bot — 자연어 → n8n 워크플로우 생성/배포
 * "딸깍" UX: 사용자가 원하는 자동화를 말하면 n8n 워크플로우가 자동 생성됨
 */
import { N8nBotService } from '../../../src/bots/n8n';

const mockAxios = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
};

jest.mock('axios', () => ({
  create: jest.fn(() => mockAxios),
}));

describe('N8nBotService', () => {
  let service: N8nBotService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new N8nBotService({
      baseUrl: 'http://localhost:5678',
      apiKey: 'n8n-api-key-test',
    });
  });

  test('testConnection()이 성공하면 true를 반환한다', async () => {
    mockAxios.get.mockResolvedValue({ data: { data: [{ id: '1', name: 'test' }] } });
    const result = await service.testConnection();
    expect(result).toBe(true);
  });

  test('testConnection()이 실패하면 false를 반환한다 (크래시 없음)', async () => {
    mockAxios.get.mockRejectedValue(new Error('Connection refused'));
    const result = await service.testConnection();
    expect(result).toBe(false);
  });

  test('listWorkflows()는 워크플로우 목록을 반환한다', async () => {
    mockAxios.get.mockResolvedValue({
      data: {
        data: [
          { id: '1', name: '이메일 알림', active: true },
          { id: '2', name: 'Slack 리포트', active: false },
        ]
      }
    });
    const workflows = await service.listWorkflows();
    expect(workflows).toHaveLength(2);
    expect(workflows[0].name).toBe('이메일 알림');
  });

  test('createWorkflow()는 워크플로우 JSON을 n8n API로 배포한다', async () => {
    const workflowJson = {
      name: '테스트 자동화',
      nodes: [],
      connections: {},
    };
    mockAxios.post.mockResolvedValue({ data: { id: 'new-wf-id', ...workflowJson } });

    const result = await service.createWorkflow(workflowJson);
    expect(mockAxios.post).toHaveBeenCalledWith(
      '/api/v1/workflows',
      expect.objectContaining({ name: '테스트 자동화' })
    );
    expect(result.id).toBe('new-wf-id');
  });

  test('activateWorkflow()는 워크플로우를 활성화한다', async () => {
    mockAxios.put.mockResolvedValue({ data: { id: 'wf-1', active: true } });
    const result = await service.activateWorkflow('wf-1');
    expect(result.active).toBe(true);
    expect(mockAxios.put).toHaveBeenCalledWith('/api/v1/workflows/wf-1/activate');
  });

  test('deactivateWorkflow()는 워크플로우를 비활성화한다', async () => {
    mockAxios.put.mockResolvedValue({ data: { id: 'wf-1', active: false } });
    const result = await service.deactivateWorkflow('wf-1');
    expect(result.active).toBe(false);
  });

  test('generateWebhookUrl()는 OOMNI webhook 엔드포인트 URL을 생성한다', () => {
    const url = service.generateWebhookUrl('wf-trigger-uuid');
    expect(url).toContain('localhost:5678');
    expect(url).toContain('webhook');
  });

  test('buildWorkflowFromTemplate()는 슬랙 알림 템플릿을 생성한다', () => {
    const wf = service.buildWorkflowFromTemplate('slack-notify', {
      channel: '#general',
      message: '리서치 완료!',
    });
    expect(wf.name).toBeTruthy();
    expect(wf.nodes.length).toBeGreaterThan(0);
    // Slack 노드가 포함되어 있는지
    const slackNode = wf.nodes.find((n: any) => n.type === 'n8n-nodes-base.slack');
    expect(slackNode).toBeDefined();
  });

  test('buildWorkflowFromTemplate()는 존재하지 않는 템플릿에서 에러를 던진다', () => {
    expect(() =>
      service.buildWorkflowFromTemplate('nonexistent-template', {})
    ).toThrow('템플릿을 찾을 수 없습니다');
  });

  test('deleteWorkflow()는 워크플로우를 삭제한다', async () => {
    mockAxios.delete.mockResolvedValue({ data: {} });
    await expect(service.deleteWorkflow('wf-1')).resolves.not.toThrow();
    expect(mockAxios.delete).toHaveBeenCalledWith('/api/v1/workflows/wf-1');
  });
});
