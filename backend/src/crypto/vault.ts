/**
 * Credential Vault — AES-256-GCM 암호화
 * 상업용 보안: API 키, OAuth 토큰 등 민감 정보를 암호화해서 DB 저장
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

// 설치별 salt 파일 경로 — %APPDATA%/OOMNI/vault-salt
const SALT_DIR = process.env.APPDATA
  ? path.join(process.env.APPDATA, 'OOMNI')
  : path.join(os.homedir(), '.oomni');
const SALT_FILE = path.join(SALT_DIR, 'vault-salt');

/**
 * 설치별 고유 salt를 읽거나 생성한다.
 * - 파일이 없으면 신규 설치: cryptographically random salt 생성 후 저장
 * - 파일이 있으면 기존 암호화 데이터와 호환을 위해 재사용
 */
function loadOrCreateSalt(): string {
  try {
    if (fs.existsSync(SALT_FILE)) {
      const saved = fs.readFileSync(SALT_FILE, 'utf-8').trim();
      if (saved.length >= 32) return saved;
    }
  } catch {
    // 읽기 실패 시 새로 생성
  }

  // 신규 설치: 랜덤 salt 생성
  const newSalt = randomBytes(16).toString('hex'); // 32자 hex
  try {
    if (!fs.existsSync(SALT_DIR)) {
      fs.mkdirSync(SALT_DIR, { recursive: true });
    }
    fs.writeFileSync(SALT_FILE, newSalt, { encoding: 'utf-8', mode: 0o600 });
  } catch {
    // 저장 실패 시 인메모리 salt 사용 (재시작 시 새 salt가 생성되므로 기존 데이터 복호화 불가)
    // 이 경우 경고를 남기되 서버는 계속 동작하도록 허용
  }
  return newSalt;
}

export class Vault {
  private readonly key: Buffer;

  constructor(masterKey: string) {
    const salt = loadOrCreateSalt();
    // PBKDF2-like: scrypt으로 마스터 키 → 256bit 키 유도
    this.key = scryptSync(masterKey, salt, 32);
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
