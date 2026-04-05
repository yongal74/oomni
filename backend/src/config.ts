/**
 * OOMNI 설정 — 환경변수 기반, Zod 검증
 */
import { z } from 'zod';
import { config as dotenvConfig } from 'dotenv';
import path from 'path';
import * as fs from 'fs';

// .env 파일 로드 (개발 환경)
dotenvConfig({ path: path.resolve(__dirname, '../../.env') });

const SETTINGS_FILE = path.join('C:/oomni-data', 'settings.json');

interface Settings {
  anthropic_api_key?: string;
  google_client_id?: string;
  google_client_secret?: string;
}

/**
 * settings.json에서 설정을 읽어 process.env에 주입
 * loadConfig() 호출 전에 실행해야 함
 */
export function loadSettings(): void {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return;
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    const settings: Settings = JSON.parse(raw);

    if (settings.anthropic_api_key && !process.env.ANTHROPIC_API_KEY) {
      process.env.ANTHROPIC_API_KEY = settings.anthropic_api_key;
    }
    if (settings.google_client_id && !process.env.GOOGLE_CLIENT_ID) {
      process.env.GOOGLE_CLIENT_ID = settings.google_client_id;
    }
    if (settings.google_client_secret && !process.env.GOOGLE_CLIENT_SECRET) {
      process.env.GOOGLE_CLIENT_SECRET = settings.google_client_secret;
    }
  } catch {
    // settings.json 읽기 실패 시 무시 (첫 실행)
  }
}

/**
 * settings.json에 설정 저장
 */
export function saveSettings(updates: Partial<Settings>): void {
  const dir = path.dirname(SETTINGS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let existing: Settings = {};
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      existing = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')) as Settings;
    }
  } catch {
    // 무시
  }

  const merged = { ...existing, ...updates };
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2), 'utf-8');
}

/**
 * settings.json 읽기
 */
export function readSettings(): Settings {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return {};
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')) as Settings;
  } catch {
    return {};
  }
}

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().min(1024).max(65535).default(3001),
  // ANTHROPIC_API_KEY는 optional (온보딩에서 설정)
  ANTHROPIC_API_KEY: z.string().default(''),
  OOMNI_MASTER_KEY: z.string().min(32).default('oomni-default-key-change-in-production!!'),
  OOMNI_INTERNAL_API_KEY: z.string().min(16).default('oomni-internal-dev-key-change-me!'),
  // AI Provider — LLM 라우팅 (claude 기본, openrouter 선택)
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
