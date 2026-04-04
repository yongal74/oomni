/**
 * OOMNI 설정 — 환경변수 기반, Zod 검증
 */
import { z } from 'zod';
import { config as dotenvConfig } from 'dotenv';
import path from 'path';

// .env 파일 로드 (개발 환경)
dotenvConfig({ path: path.resolve(__dirname, '../../.env') });

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().min(1024).max(65535).default(3001),
  ANTHROPIC_API_KEY: z.string().min(10),
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
