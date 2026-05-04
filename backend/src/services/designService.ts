/**
 * designService.ts — Claude Design 전용 실행 서비스
 * v5.0.1
 *
 * - 모델: claude-opus-4-7 고정 (Claude Design 기능 전용)
 * - 방식: Anthropic SDK 스트리밍 (XTerminal 없음)
 * - 출력: HTML 파일 + design_outputs DB + task_results DB
 */
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logger';

type DbClient = { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };
type Task = Record<string, unknown>;

// claude-opus-4-7만 Claude Design 기능을 지원합니다
const DESIGN_MODEL = 'claude-opus-4-7';

const DATA_ROOT = process.platform === 'win32' ? 'C:/oomni-data' : `${process.env.HOME}/oomni-data`;
const DESIGN_ROOT = path.join(DATA_ROOT, 'design');

const SYSTEM_PROMPT = `당신은 세계 최고 수준의 UI/UX 디자이너이자 프론트엔드 개발자입니다.
Claude Design의 시각적 생성 능력을 최대한 활용하여 완전한 HTML 파일을 생성하세요.

출력 규칙:
1. 반드시 완전한 HTML 파일 (<!DOCTYPE html> ~ </html>)
2. Tailwind CSS CDN 포함 (https://cdn.tailwindcss.com)
3. 인터랙션 포함 (hover, focus, transition, animation)
4. 모바일 반응형 필수
5. 실제 운영 가능한 완성도 (placeholder 사용 금지)
6. 다크 테마 기본

완전한 HTML만 출력하세요. 설명 없이 코드만.`;

export async function executeDesign(
  db: DbClient,
  task: Task,
): Promise<{ html: string; filePaths: string[] }> {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? '';
  const client = new Anthropic({ apiKey });

  const taskId   = task.id as string;
  const missionId = task.mission_id as string;
  const title    = task.title as string;
  const description = (task.description as string) || title;

  logger.info(`[designService] START task=${taskId} model=${DESIGN_MODEL}`);

  let fullOutput = '';

  const stream = client.messages.stream({
    model: DESIGN_MODEL,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: description }],
  });

  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
      fullOutput += chunk.delta.text;
    }
  }

  // HTML 추출
  const htmlMatch = fullOutput.match(/<!DOCTYPE html[\s\S]*<\/html>/i)
    ?? fullOutput.match(/<html[\s\S]*<\/html>/i);
  const html = htmlMatch ? htmlMatch[0] : fullOutput;

  // 파일 저장
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const dirName = `${dateStr}_${taskId.slice(0, 8)}`;
  const dir = path.join(DESIGN_ROOT, dirName);
  fs.mkdirSync(dir, { recursive: true });
  const htmlPath = path.join(dir, 'preview.html');
  fs.writeFileSync(htmlPath, html, 'utf8');

  // design_outputs DB 저장 (기존 테이블 재활용)
  // agent_id 자리에 taskId 사용 (호환성)
  await db.query(
    `INSERT INTO design_outputs (id, agent_id, mission_id, title, html_content)
     VALUES ($1,$2,$3,$4,$5)`,
    [uuidv4(), taskId, missionId, title, html],
  ).catch(err => logger.warn('[designService] design_outputs insert 실패:', err));

  logger.info(`[designService] DONE task=${taskId} file=${htmlPath}`);
  return { html, filePaths: [htmlPath] };
}
