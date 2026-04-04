/**
 * Credential Vault — AES-256-GCM 암호화
 * 상업용 보안: API 키, OAuth 토큰 등 민감 정보를 암호화해서 DB 저장
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT ='oomni-vault-salt-v1'; // production에서는 unique salt per-install

export class Vault {
  private readonly key: Buffer;

  constructor(masterKey: string) {
    // PBKDF2-like: scrypt으로 마스터 키 → 256bit 키 유도
    this.key = scryptSync(masterKey, SALT, 32);
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    // 형식: iv(hex):tag(hex):encrypted(hex)
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decrypt(ciphertext: string): string {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
      throw new Error('잘못된 암호화 형식입니다');
    }

    const [ivHex, tagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');

    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  encryptObject<T extends object>(obj: T): string {
    return this.encrypt(JSON.stringify(obj));
  }

  decryptObject<T>(ciphertext: string): T {
    return JSON.parse(this.decrypt(ciphertext)) as T;
  }
}

/**
 * 싱글톤 Vault — 앱 시작 시 초기화
 * 마스터 키는 환경변수 또는 machine-id 기반으로 생성
 */
let _vault: Vault | null = null;

export function initVault(masterKey: string): void {
  _vault = new Vault(masterKey);
}

export function getVault(): Vault {
  if (!_vault) throw new Error('Vault가 초기화되지 않았습니다. initVault()를 먼저 호출하세요.');
  return _vault;
}
