/**
 * TDD: Integration Bot — 외부 서비스 연결 관리
 * Slack, Notion, Google Sheets, Gmail, Stripe, GitHub 등
 * 연결된 자격증명은 암호화 볼트에 저장 → 다른 봇이 공유 사용
 */
import { IntegrationService, SUPPORTED_PROVIDERS } from '../../../src/bots/integration';
import { Vault } from '../../../src/crypto/vault';

const mockDb = { query: jest.fn() };
const vault = new Vault('test-master-key-32-chars-exactly!!');

describe('IntegrationService', () => {
  let service: IntegrationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new IntegrationService(mockDb as any, vault);
  });

  test('SUPPORTED_PROVIDERS에 주요 서비스가 포함된다', () => {
    const required = ['slack', 'notion', 'gmail', 'stripe', 'github', 'google_sheets', 'n8n', 'hubspot'];
    required.forEach(p => expect(SUPPORTED_PROVIDERS).toContain(p));
  });

  test('saveCredential()은 credentials를 암호화해서 DB에 저장한다', async () => {
    mockDb.query.mockResolvedValue({ rows: [{ id: 'int-1' }] });

    await service.saveCredential('mission-1', 'slack', {
      token: 'xoxb-slack-token',
      workspace: 'my-workspace',
    });

    const callArgs = mockDb.query.mock.calls[0];
    const sql = callArgs[0] as string;
    const params = callArgs[1] as any[];

    expect(sql).toContain('integrations');
    // credentials는 암호화된 값이어야 함 (원본이 그대로 저장되면 안됨)
    const storedCredentials = params.find((p: string) => typeof p === 'string' && p.includes(':'));
    expect(storedCredentials).toBeDefined();
    expect(storedCredentials).not.toContain('xoxb-slack-token'); // 평문 노출 안됨
  });

  test('getCredential()은 복호화된 credentials를 반환한다', async () => {
    const originalCreds = { token: 'xoxb-slack-token', workspace: 'my-workspace' };
    const encrypted = vault.encryptObject(originalCreds);

    mockDb.query.mockResolvedValue({
      rows: [{ id: 'int-1', provider: 'slack', credentials: encrypted, is_active: true }]
    });

    const result = await service.getCredential('mission-1', 'slack');
    expect(result).toEqual(originalCreds);
  });

  test('getCredential()이 없으면 null을 반환한다', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });
    const result = await service.getCredential('mission-1', 'nonexistent');
    expect(result).toBeNull();
  });

  test('listIntegrations()는 credentials 없이 메타데이터만 반환한다 (보안)', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        { id: 'int-1', provider: 'slack', is_active: true, created_at: new Date() },
        { id: 'int-2', provider: 'notion', is_active: false, created_at: new Date() },
      ]
    });

    const list = await service.listIntegrations('mission-1');
    expect(list).toHaveLength(2);
    // credentials 필드가 노출되지 않아야 함
    list.forEach((item: any) => {
      expect(item).not.toHaveProperty('credentials');
    });
  });

  test('deleteCredential()은 연결을 제거한다', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });
    await expect(service.deleteCredential('int-1')).resolves.not.toThrow();
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE'),
      expect.arrayContaining(['int-1'])
    );
  });

  test('지원하지 않는 provider는 saveCredential에서 에러를 던진다', async () => {
    await expect(
      service.saveCredential('mission-1', 'unknown-app', { token: 'xyz' })
    ).rejects.toThrow('지원하지 않는 provider');
  });
});
