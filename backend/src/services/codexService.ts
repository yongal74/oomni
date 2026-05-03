/**
 * codexService.ts — OpenAI Codex / o3 실행 서비스
 * v5.0.1
 *
 * - 모델: o3 (기본), gpt-4o (선택)
 * - 방식: OpenAI Chat Completions API 스트리밍
 * - Claude Code와 동일한 태스크 구조에서 실행
 */
import { logger } from '../logger';
import { readSettings } from '../config';

type DbClient = { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };
type Task = Record<string, unknown>;

export async function executeCodex(
  db: DbClient,
  task: Task,
  model?: string,
): Promise<string> {
  const settings = readSettings();
  const apiKey = settings.openai_api_key;
  if (!apiKey) throw new Error('OpenAI API Key가 설정되지 않았습니다 (Settings에서 입력)');

  // dynamic import — openai 패키지가 설치된 경우에만 실행
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let OpenAI: any;
  try {
    OpenAI = (await import('openai')).default;
  } catch {
    throw new Error('openai 패키지가 설치되지 않았습니다. npm install openai 를 실행하세요.');
  }
  const client = new OpenAI({ apiKey });
  const targetModel = model ?? 'o3';
  const title = task.title as string;
  const description = (task.description as string) || title;

  // 레시피 컨텍스트 로드 (있으면)
  let recipeContext = '';
  if (task.recipe_id) {
    const r = await db.query('SELECT content FROM recipes WHERE id = $1', [task.recipe_id]);
    if ((r.rows as unknown[]).length > 0) {
      recipeContext = `\n\n## 프로젝트 레시피\n${(r.rows[0] as Record<string, unknown>).content}`;
    }
  }

  const systemPrompt = `당신은 전문 소프트웨어 엔지니어입니다.
실행 가능하고 완전한 코드를 생성하세요.
코드 블록(fenced code block)으로 감싸서 언어를 명시하세요.${recipeContext}`;

  logger.info(`[codexService] START task=${task.id} model=${targetModel}`);

  let fullOutput = '';

  // o3는 stream 미지원 케이스 있음 — non-stream fallback
  try {
    const stream = await client.chat.completions.create({
      model: targetModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: `태스크: ${title}\n\n${description}` },
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      fullOutput += chunk.choices[0]?.delta?.content ?? '';
    }
  } catch {
    // stream 미지원 시 non-stream으로 재시도
    const response = await client.chat.completions.create({
      model: targetModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: `태스크: ${title}\n\n${description}` },
      ],
    });
    fullOutput = response.choices[0]?.message?.content ?? '';
  }

  logger.info(`[codexService] DONE task=${task.id} chars=${fullOutput.length}`);
  return fullOutput;
}
