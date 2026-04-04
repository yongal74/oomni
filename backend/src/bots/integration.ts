/**
 * Integration Bot Service
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
  getProviderMeta(): Array<{ id: Provider; name: string; icon: string; authType: 'apikey' | 'oauth2' }> {
    return [
      { id: 'slack',         name: 'Slack',          icon: '💬', authType: 'oauth2' },
      { id: 'notion',        name: 'Notion',          icon: '📝', authType: 'oauth2' },
      { id: 'gmail',         name: 'Gmail',           icon: '📧', authType: 'oauth2' },
      { id: 'stripe',        name: 'Stripe',          icon: '💳', authType: 'apikey' },
      { id: 'github',        name: 'GitHub',          icon: '🐙', authType: 'oauth2' },
      { id: 'google_sheets', name: 'Google Sheets',   icon: '📊', authType: 'oauth2' },
      { id: 'n8n',           name: 'n8n',             icon: '⚡', authType: 'apikey' },
      { id: 'hubspot',       name: 'HubSpot',         icon: '🎯', authType: 'oauth2' },
      { id: 'linear',        name: 'Linear',          icon: '📋', authType: 'apikey' },
      { id: 'figma',         name: 'Figma',           icon: '🎨', authType: 'oauth2' },
    ];
  }
}
