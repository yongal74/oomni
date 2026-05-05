/**
 * klingService.ts — Kling AI 텍스트→영상 생성 서비스
 *
 * 단일 클립:  5초 / 10초
 * 체인 클립:  20초 (2클립) / 60초 (6클립)
 *   → Claude Haiku로 장면 분할 → Kling 순차 생성 → FFmpeg concat
 *
 * 인증: kling_api_key = "access_key_id:access_key_secret" → HS256 JWT
 */
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { spawn } from 'child_process';
import Anthropic from '@anthropic-ai/sdk';
import { readSettings } from '../config';
import { logger } from '../logger';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpegStatic: string = require('ffmpeg-static') as string;

const KLING_BASE  = 'https://api.klingai.com';
const KLING_MODEL = 'kling-v2-master';

export type KlingDuration = '5' | '10' | '20' | '60';
export type KlingAspect   = '16:9' | '9:16' | '1:1';

// 로컬 영상 저장 디렉토리 (Express static 서빙 대상)
export const VIDEOS_DIR = process.env.APPDATA
  ? path.join(process.env.APPDATA, 'OOMNI', 'videos')
  : path.join(os.homedir(), '.oomni', 'videos');

// ── JWT 생성 ───────────────────────────────────────────────────────────────────

function base64url(buf: Buffer | string): string {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function makeKlingJwt(keyId: string, secret: string): string {
  const now  = Math.floor(Date.now() / 1000);
  const head = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const pay  = base64url(JSON.stringify({ iss: keyId, exp: now + 1800, nbf: now - 5 }));
  const sig  = base64url(
    crypto.createHmac('sha256', secret).update(`${head}.${pay}`).digest(),
  );
  return `${head}.${pay}.${sig}`;
}

function getToken(): string | null {
  const settings = readSettings() as Record<string, string | undefined>;
  const raw = settings['kling_api_key'];
  if (!raw) return null;
  if (raw.includes(':')) {
    const [id, ...rest] = raw.split(':');
    const secret = rest.join(':');
    if (id && secret) return makeKlingJwt(id, secret);
  }
  if (raw.startsWith('eyJ')) return raw;
  return null;
}

// ── API 헬퍼 ───────────────────────────────────────────────────────────────────

async function klingFetch(p: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  if (!token) throw new Error('Kling API 키가 설정되지 않았습니다 (Settings → Kling API 키)');
  return fetch(`${KLING_BASE}${p}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string> ?? {}),
    },
  });
}

// ── 단일 10초 이하 클립 생성 ───────────────────────────────────────────────────

async function generateSingleClip(
  prompt: string,
  aspect: KlingAspect,
  duration: '5' | '10',
): Promise<string> {
  const createRes = await klingFetch('/v1/videos/text2video', {
    method: 'POST',
    body: JSON.stringify({
      model_name:   KLING_MODEL,
      prompt:       prompt.slice(0, 2500),
      aspect_ratio: aspect,
      duration,
      mode:         duration === '10' ? 'pro' : 'std',
      cfg_scale:    0.5,
    }),
  });

  if (!createRes.ok) {
    const txt = await createRes.text();
    throw new Error(`Kling 작업 생성 실패 (${createRes.status}): ${txt}`);
  }

  const createData = await createRes.json() as {
    code: number; message: string;
    data?: { task_id?: string }
  };
  if (createData.code !== 0 || !createData.data?.task_id) {
    throw new Error(`Kling 응답 오류: ${createData.message}`);
  }

  const taskId = createData.data.task_id;
  logger.info(`[klingService] 클립 생성 task_id=${taskId} duration=${duration}s`);

  // 완료 폴링 (최대 300초)
  const maxWait = 300;
  const pollMs  = 5000;
  const maxIter = Math.ceil(maxWait / (pollMs / 1000));

  for (let i = 0; i < maxIter; i++) {
    await new Promise(r => setTimeout(r, pollMs));

    const pollRes = await klingFetch(`/v1/videos/text2video/${taskId}`);
    if (!pollRes.ok) continue;

    const poll = await pollRes.json() as {
      data?: {
        task_status: string;
        task_status_msg?: string;
        task_result?: { videos?: Array<{ url: string }> }
      }
    };

    const status = poll.data?.task_status;
    if (status === 'succeed') {
      const url = poll.data?.task_result?.videos?.[0]?.url;
      if (!url) throw new Error('Kling: 영상 URL 없음');
      assertKlingUrl(url);
      logger.info(`[klingService] 클립 완료 task_id=${taskId}`);
      return url;
    }
    if (status === 'failed') {
      throw new Error(`Kling 클립 실패: ${poll.data?.task_status_msg ?? '원인 불명'}`);
    }
    logger.debug(`[klingService] 폴링 ${i + 1}/${maxIter} status=${status}`);
  }

  throw new Error(`Kling 클립 타임아웃`);
}

// ── Claude Haiku 장면 분할 ─────────────────────────────────────────────────────

async function splitScriptIntoScenes(script: string, sceneCount: number): Promise<string[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Array.from({ length: sceneCount }, (_, i) =>
      `Scene ${i + 1}/${sceneCount}: ${script.slice(0, 150)} - consistent visual style, cinematic continuity`,
    );
  }

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages: [{
        role: 'user',
        content: `Split this video concept into exactly ${sceneCount} sequential scenes (10 seconds each).
Output: JSON array of exactly ${sceneCount} strings. Each string is a Kling AI video prompt.
Rules:
- Scenes must flow as one continuous story
- Each scene: max 200 chars, English only
- End every scene with: ", consistent style, same color palette, cinematic"
- No extra text, output ONLY the JSON array

Concept: "${script}"`,
      }],
    });

    const text = ((msg.content[0] as { type: string; text?: string }).text ?? '').trim();
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      const scenes = JSON.parse(match[0]) as string[];
      if (Array.isArray(scenes) && scenes.length === sceneCount) return scenes;
    }
  } catch (e) {
    logger.warn(`[klingService] 장면 분할 실패 → 폴백: ${String(e)}`);
  }

  return Array.from({ length: sceneCount }, (_, i) =>
    `Scene ${i + 1}/${sceneCount}: ${script.slice(0, 150)} - consistent style, cinematic continuity`,
  );
}

// ── SSRF 방어 — 허용된 Kling 도메인만 허용 ─────────────────────────────────

const ALLOWED_KLING_HOSTS = ['.klingai.com', '.kling-cdn.com'];

function assertKlingUrl(url: string): void {
  const parsed = new URL(url);
  if (
    parsed.protocol !== 'https:' ||
    !ALLOWED_KLING_HOSTS.some(h => parsed.hostname.endsWith(h))
  ) {
    throw new Error(`허용되지 않는 다운로드 도메인: ${parsed.hostname}`);
  }
}

// ── 파일 다운로드 (스트리밍) ──────────────────────────────────────────────

async function downloadToFile(url: string, dest: string): Promise<void> {
  assertKlingUrl(url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`다운로드 실패 (${res.status}): ${url}`);
  if (!res.body) throw new Error('빈 응답 body');
  // 스트리밍 — 대용량 영상도 heap 최소화
  const writer = fs.createWriteStream(dest);
  const reader = res.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      writer.write(value);
    }
  } finally {
    writer.end();
    await new Promise<void>((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }
}

// ── FFmpeg 연결 ───────────────────────────────────────────────────────────────

async function concatVideos(clipPaths: string[]): Promise<string> {
  if (!fs.existsSync(VIDEOS_DIR)) fs.mkdirSync(VIDEOS_DIR, { recursive: true });

  const ts = Date.now();
  const listFile   = path.join(VIDEOS_DIR, `concat_${ts}.txt`);
  const outputFile = path.join(VIDEOS_DIR, `video_${ts}.mp4`);

  // ffmpeg concat list — Windows 경로의 \ → / 변환 필요
  const listContent = clipPaths
    .map(p => `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`)
    .join('\n');
  fs.writeFileSync(listFile, listContent, 'utf-8');

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(ffmpegStatic, [
      '-f', 'concat', '-safe', '0',
      '-i', listFile,
      '-c', 'copy',
      '-y', outputFile,
    ]);
    proc.stderr.on('data', (d: Buffer) => logger.debug(`[ffmpeg] ${d.toString().trim()}`));
    proc.on('close', (code) => {
      try { fs.unlinkSync(listFile); } catch {}
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg 종료 코드 ${code}`));
    });
    proc.on('error', reject);
  });

  // 개별 클립 파일 삭제
  for (const p of clipPaths) {
    try { fs.unlinkSync(p); } catch {}
  }

  return outputFile;
}

// ── 멀티클립 체인 ─────────────────────────────────────────────────────────────

async function generateVideoChain(
  prompt: string,
  aspect: KlingAspect,
  totalSeconds: number,
): Promise<string> {
  const clipCount = Math.ceil(totalSeconds / 10);
  logger.info(`[klingService] 체인 생성 시작 ${clipCount}클립 × 10초 = ${totalSeconds}초`);

  const scenes = await splitScriptIntoScenes(prompt, clipCount);

  if (!fs.existsSync(VIDEOS_DIR)) fs.mkdirSync(VIDEOS_DIR, { recursive: true });

  const clipPaths: string[] = [];
  try {
    for (let i = 0; i < clipCount; i++) {
      logger.info(`[klingService] 클립 ${i + 1}/${clipCount} 생성 중...`);
      const clipUrl  = await generateSingleClip(scenes[i], aspect, '10');
      const clipPath = path.join(VIDEOS_DIR, `clip_${Date.now()}_${i}.mp4`);
      await downloadToFile(clipUrl, clipPath);
      clipPaths.push(clipPath);
    }
  } catch (e) {
    // 부분 실패 시 다운로드된 임시 파일 즉시 정리
    for (const p of clipPaths) { try { fs.unlinkSync(p); } catch {} }
    throw e;
  }

  const outputPath = await concatVideos(clipPaths);
  const filename   = path.basename(outputPath);
  // Express static 서빙 URL (포트 3001 고정)
  return `http://localhost:3001/api/video/local/${filename}`;
}

// ── 공개 API ─────────────────────────────────────────────────────────────────

/**
 * Kling AI 영상 생성
 * duration: '5' | '10' → 단일 클립 (Kling CDN URL 반환)
 * duration: '20' | '60' → 멀티클립 체인 (로컬 URL 반환)
 */
export async function generateVideoKling(
  prompt: string,
  aspect: KlingAspect = '9:16',
  duration: KlingDuration = '5',
): Promise<string> {
  const settings = readSettings() as Record<string, string | undefined>;
  if (!settings['kling_api_key']) {
    logger.warn('[klingService] kling_api_key 미설정 — stub 반환');
    return `__STUB_VIDEO_KLING__:${Buffer.from(prompt.slice(0, 40)).toString('base64')}`;
  }

  const totalSeconds = parseInt(duration, 10);

  if (totalSeconds <= 10) {
    return generateSingleClip(prompt, aspect, duration as '5' | '10');
  }

  return generateVideoChain(prompt, aspect, totalSeconds);
}

export function isKlingConfigured(): boolean {
  const s = readSettings() as Record<string, string | undefined>;
  return !!(s['kling_api_key']);
}
