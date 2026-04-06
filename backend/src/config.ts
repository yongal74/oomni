/**
 * OOMNI 설정 — 환경변수 기반, Zod 검증
 * 보안: 민감 정보(API 키 등)는 AES-256-GCM으로 암호화하여 저장
 */
import { z } from 'zod';
import { config as dotenvConfig } from 'dotenv';
import path from 'path';
import * as fs from 'fs';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import os from 'os';

// .env 파일 로드 (개발 환경)
dotenvConfig({ path: path.resolve(__dirname, '../../.env') });

// 설정 파일 경로 — 사용자별 AppData (C: 루트보다 안전)
const DATA_DIR = process.env.APPDATA
  ? path.join(process.env.APPDATA, 'OOMNI')
  : path.join(os.homedir(), '.oomni');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// 기존 경로 마이그레이션 (C:/oomni-data → AppData/OOMNI)
const LEGACY_SETTINGS_FILE = 'C:/oomni-data/settings.json';

interface Settings {
  anthropic_api_key?: string;
  google_client_id?: string;
  google_client_secret?: string;
  preferred_ide?: string;
  obsidian_vault_path?: string;
}

// ── 암호화 유틸 ────────────────────────────────────────────
const ENC_PREFIX = 'enc:v1:';

/**
 * 머신별 고유 암호화 키 유도
 * hostname + homedir 조합으로 기기마다 다른 키 생성
 * → 파일을 다른 PC로 복사해도 복호화 불가
 */
function getMachineKey(): Buffer {
  const seed = `oomni:${os.hostname()}:${os.homedir()}`;
  return scryptSync(seed, 'oomni-settings-salt-v1', 32);
}

function encryptField(value: string): string {
  const key = getMachineKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptField(value: string): string {
  // 평문인 경우 (구버전 마이그레이션) — 그냥 반환
  if (!value.startsWith(ENC_PREFIX)) return value;
  try {
    const parts = value.slice(ENC_PREFIX.length).split(':');
    if (parts.length !== 3) return value;
    const [ivHex, tagHex, encHex] = parts;
    const key = getMachineKey();
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([
      decipher.update(Buffer.from(encHex, 'hex')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return value; // 복호화 실패 시 원본 반환
  }
}

const SENSITIVE_FIELDS: (keyof Settings)[] = [
  'anthropic_api_key',
  'google_client_id',
  'google_client_secret',
];

// ── 설정 파일 읽기/쓰기 ─────────────────────────────────────

function readRawSettings(filePath: string): Settings {
  try {
    if (!fs.existsSync(filePath)) return {};
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Settings;
  } catch {
    return {};
  }
}

/**
 * settings.json에서 설정을 읽어 process.env에 주입
 * loadConfig() 호출 전에 실행해야 함
 */
export function loadSettings(): void {
  try {
    // 기존 경로(C:/oomni-data)에서 마이그레이션
    if (!fs.existsSync(SETTINGS_FILE) && fs.existsSync(LEGACY_SETTINGS_FILE)) {
      const legacy = readRawSettings(LEGACY_SETTINGS_FILE);
      if (Object.keys(legacy).length > 0) {
        saveSettings(legacy); // 암호화해서 새 경로에 저장
        // 기존 파일 내용 비움 (삭제 대신 덮어쓰기로 안전하게)
        fs.writeFileSync(LEGACY_SETTINGS_FILE, JSON.stringify({ migrated: true }, null, 2));
      }
    }

    const raw = readRawSettings(SETTINGS_FILE);

    // 평문 키 감지 시 즉시 암호화 재저장 (구버전 → 신버전 마이그레이션)
    let needsReEncrypt = false;
    for (const field of SENSITIVE_FIELDS) {
      if (raw[field] && !raw[field]!.startsWith(ENC_PREFIX)) {
        needsReEncrypt = true;
        break;
      }
    }
    if (needsReEncrypt) saveSettings(raw);

    // 복호화 후 환경변수 주입
    const anthropicKey = raw.anthropic_api_key ? decryptField(raw.anthropic_api_key) : '';
    if (anthropicKey && !process.env.ANTHROPIC_API_KEY) {
      process.env.ANTHROPIC_API_KEY = anthropicKey;
    }
    const googleClientId = raw.google_client_id ? decryptField(raw.google_client_id) : '';
    if (googleClientId && !process.env.GOOGLE_CLIENT_ID) {
      process.env.GOOGLE_CLIENT_ID = googleClientId;
    }
    const googleClientSecret = raw.google_client_secret ? decryptField(raw.google_client_secret) : '';
    if (googleClientSecret && !process.env.GOOGLE_CLIENT_SECRET) {
      process.env.GOOGLE_CLIENT_SECRET = googleClientSecret;
    }
  } catch {
    // settings.json 읽기 실패 시 무시 (첫 실행)
  }
}

/**
 * settings.json에 설정 저장 (민감 필드는 AES-256-GCM 암호화)
 */
export function saveSettings(updates: Partial<Settings>): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const existing = readRawSettings(SETTINGS_FILE);
  const merged = { ...existing, ...updates };

  // 민감 필드 암호화
  for (const field of SENSITIVE_FIELDS) {
    if (merged[field] && !merged[field]!.startsWith(ENC_PREFIX)) {
      merged[field] = encryptField(merged[field]!);
    }
  }

  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2), 'utf-8');
}

/**
 * settings.json 읽기 (민감 필드 복호화 후 반환)
 */
export function readSettings(): Settings {
  const raw = readRawSettings(SETTINGS_FILE);
  const result: Settings = {};
  for (const field of SENSITIVE_FIELDS) {
    if (raw[field]) result[field] = decryptField(raw[field]!);
  }
  // Non-sensitive fields — return as-is
  if (raw.preferred_ide) result.preferred_ide = raw.preferred_ide;
  if (raw.obsidian_vault_path) result.obsidian_vault_path = raw.obsidian_vault_path;
  return result;
}

// ── 앱 설정 스키마 ──────────────────────────────────────────

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().min(1024).max(65535).default(3001),
  ANTHROPIC_API_KEY: z.string().default(''),
  OOMNI_MASTER_KEY: z.string().min(32).default('oomni-default-key-change-in-production!!'),
  OOMNI_INTERNAL_API_KEY: z.string().min(16).default('oomni-internal-dev-key-change-me!'),
  AI_PROVIDER: z.enum(['claude', 'openrouter']).default('claude'),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default('anthropic/claude-3.5-sonnet'),
});

type Config = z.infer<typeof ConfigSchema>;

let _config: Config | null = null;

export function loadConfig(): Config {
  const result = ConfigSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`설정 오류:\n${missing}`);
  }
  _config = result.data;
  return _config;
}

export function getConfig(): Config {
  if (!_config) return loadConfig();
  return _config;
}
