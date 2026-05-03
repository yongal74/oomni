/**
 * growthService.ts — Growth Bot 실행 서비스
 * v5.0.1
 *
 * klexi-content-factory 패턴 기반:
 *   Seeds → Claude (5 tone) → 채널별 콘텐츠 생성 → growth_content 저장
 *   + n8n 워크플로우 트리거 (설정된 경우)
 *
 * 워크플로우:
 *   #01 X 텍스트 — 매일 06:00
 *   #02 Instagram 이미지 — 매일 08:00
 *   #03 TikTok 영상 스크립트 — 월수금 07:00
 *   #04 지표 수집 — 매일 23:00
 *   #05 주간 최적화 + CDP — 매주 월 09:00
 *   #06 이메일 시퀀스 — Webhook 트리거
 *   #07 일일 리포트 — 매일 23:30
 */
import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import { readSettings } from '../config';
import { logger } from '../logger';
import { getProfileSegment } from './idGraph';

const GROWTH_MODEL = 'claude-sonnet-4-6';

// 5가지 콘텐츠 톤 (klexi 패턴)
const TONES = ['humor', 'authority', 'empathy', 'contrarian', 'proof'] as const;
type ContentTone = typeof TONES[number];

// 지원 채널
export type GrowthChannel = 'x' | 'instagram' | 'youtube' | 'linkedin' | 'blog' | 'tiktok';

type DbClient = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>
};

type Task = Record<string, unknown>;

// ── 채널별 시스템 프롬프트 ─────────────────────────────────────────────────────
const CHANNEL_PROMPTS: Record<GrowthChannel, string> = {
  x: `You are a viral X (Twitter) content strategist. Write concise, engaging tweets that drive engagement.
Rules:
- Max 280 characters
- Use hooks that create curiosity or strong emotion
- Include 1-2 relevant hashtags
- End with a subtle CTA
- Output strict JSON: {"tweet": "...", "hashtags": "..."}`,

  instagram: `You are an Instagram content strategist. Create captions that stop the scroll.
Rules:
- 150-300 character caption
- 25-30 hashtags in a separate block
- Strong first line (the hook before "more...")
- Include emoji sparingly
- Output JSON: {"caption": "...", "hashtags": "30 hashtags here"}`,

  youtube: `You are a YouTube Shorts scriptwriter. Write 60-second scripts that educate and entertain.
Structure: Hook(3s) > Problem(7s) > Solution(30s) > Proof(15s) > CTA(5s)
Output JSON array: [{"section":"hook","timestamp":"0-3s","spoken_text":"...","text_overlay":"..."}]`,

  linkedin: `You are a LinkedIn thought leadership writer. Write professional posts that add value.
Rules:
- 800-1200 characters
- Start with a bold statement or question
- 3-5 key insights with spacing
- End with a question to drive comments
- No more than 3 hashtags
- Output JSON: {"post": "...", "hashtags": "..."}`,

  blog: `You are an SEO-optimized blog content writer.
Output a complete blog post in Korean with:
- SEO title + meta description
- 5-7 sections with H2 headers
- 800-1200 words total
- Internal linking opportunities noted
Output JSON: {"title": "...", "meta_description": "...", "content": "..."}`,

  tiktok: `You are a TikTok script writer for short-form viral content.
Write a 45-second script: Hook(3s) > Problem(7s) > Solution(15s) > Proof(15s) > CTA(5s)
High energy, conversational, use trending audio cues
Output JSON: [{"section":"...","timestamp":"...","spoken_text":"...","text_overlay":"..."}]`,
};

// ── 태스크 기반 Growth 실행 (executionRouter에서 호출) ─────────────────────────
export async function executeGrowthForTask(
  db: DbClient,
  task: Task,
): Promise<string> {
  const description = String(task.description ?? task.title);
  const missionId   = String(task.mission_id ?? '');

  // 태스크 설명에서 채널 파싱 (예: "channel:x" 또는 "채널:instagram")
  const channelMatch = description.match(/channel[:\s]+(\w+)/i);
  const channel: GrowthChannel = (channelMatch?.[1]?.toLowerCase() as GrowthChannel) ?? 'x';

  // 톤 랜덤 선택 또는 태스크에서 파싱
  const toneMatch = description.match(/tone[:\s]+(\w+)/i);
  const tone: ContentTone = (toneMatch?.[1] as ContentTone) ?? TONES[Math.floor(Math.random() * TONES.length)];

  logger.info(`[growthService] channel=${channel} tone=${tone} task=${task.id}`);

  const content = await generateContent(channel, tone, description);

  // growth_content 저장
  const contentId = uuidv4();
  await db.query(
    `INSERT INTO growth_content (id, mission_id, task_id, channel, tone, content, status, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,'draft',datetime('now'))`,
    [contentId, missionId, task.id, channel, tone, JSON.stringify(content)],
  );

  // n8n 트리거 — 세그먼트 데이터 포함 (동적 마케팅)
  const segment = task.profile_id
    ? await getProfileSegment(db, missionId, String(task.profile_id))
    : null;
  await triggerN8nIfConfigured(db, channel, content, segment);

  return `[${channel.toUpperCase()}] [${tone}] 콘텐츠 생성 완료\n\n${formatContentForOutput(channel, content)}`;
}

// ── 콘텐츠 생성 (Claude sonnet-4-6) ──────────────────────────────────────────
async function generateContent(
  channel: GrowthChannel,
  tone: ContentTone,
  seedContent: string,
): Promise<Record<string, unknown>> {
  const settings = readSettings();
  const apiKey = settings.anthropic_api_key;
  if (!apiKey) throw new Error('Anthropic API 키가 설정되지 않았습니다');

  const client = new Anthropic({ apiKey });

  const systemPrompt = CHANNEL_PROMPTS[channel];
  const userPrompt = `Create ${channel} content using tone: "${tone}"\n\nSeed/Topic:\n${seedContent}\n\nOutput strict JSON only. No markdown, no explanation.`;

  const response = await client.messages.create({
    model: GROWTH_MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  try {
    const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    return JSON.parse(jsonMatch?.[0] ?? '{}');
  } catch {
    return { raw: text };
  }
}

// ── n8n 트리거 ────────────────────────────────────────────────────────────────
async function triggerN8nIfConfigured(
  _db: DbClient,
  channel: GrowthChannel,
  content: Record<string, unknown>,
  segment?: { ltvTier: string; eventCount: number; sources: string[] } | null,
): Promise<void> {
  const settings = readSettings();
  const n8nUrl: string = (settings as Record<string, unknown>).n8n_webhook_url as string ?? '';

  if (!n8nUrl) return; // n8n 미설정 시 스킵

  const webhookMap: Partial<Record<GrowthChannel, string>> = {
    x:         `${n8nUrl}/oomni-x-post`,
    instagram: `${n8nUrl}/oomni-ig-post`,
    tiktok:    `${n8nUrl}/oomni-tiktok-post`,
    linkedin:  `${n8nUrl}/oomni-linkedin-post`,
    blog:      `${n8nUrl}/oomni-blog-post`,
    youtube:   `${n8nUrl}/oomni-youtube-post`,
  };

  const webhookEndpoint = webhookMap[channel];
  if (!webhookEndpoint) return;

  try {
    const res = await fetch(webhookEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel,
        content,
        segment: segment ?? null,   // CDP 세그먼트 데이터 → n8n 동적 마케팅 조정
        triggered_by: 'oomni_growth_bot',
      }),
    });
    logger.info(`[growthService] n8n trigger ${channel}: ${res.status}`);
  } catch (err) {
    logger.warn(`[growthService] n8n trigger failed (non-fatal): ${err}`);
  }
}

// ── 출력 포매터 ───────────────────────────────────────────────────────────────
function formatContentForOutput(channel: GrowthChannel, content: Record<string, unknown>): string {
  switch (channel) {
    case 'x':
      return `트윗:\n${content.tweet ?? content.raw}\n\n해시태그: ${content.hashtags ?? ''}`;
    case 'instagram':
      return `캡션:\n${content.caption ?? content.raw}\n\n해시태그:\n${content.hashtags ?? ''}`;
    case 'linkedin':
      return `포스트:\n${content.post ?? content.raw}`;
    case 'blog':
      return `제목: ${content.title}\n\n메타: ${content.meta_description}\n\n내용 (요약):\n${String(content.content ?? '').slice(0, 300)}...`;
    case 'youtube':
    case 'tiktok': {
      const sections = Array.isArray(content) ? content : [];
      return sections.map((s: Record<string, string>) => `[${s.section} ${s.timestamp}] ${s.spoken_text}`).join('\n');
    }
    default:
      return JSON.stringify(content, null, 2).slice(0, 500);
  }
}

// ── 채널별 콘텐츠 직접 생성 API (Growth Studio UI용) ─────────────────────────
export async function generateGrowthContent(
  db: DbClient,
  missionId: string,
  channel: GrowthChannel,
  seedContent: string,
  tone?: ContentTone,
): Promise<{ id: string; content: Record<string, unknown>; channel: GrowthChannel; tone: string }> {
  const selectedTone = tone ?? TONES[Math.floor(Math.random() * TONES.length)];
  const content = await generateContent(channel, selectedTone, seedContent);

  const contentId = uuidv4();
  await db.query(
    `INSERT INTO growth_content (id, mission_id, channel, tone, content, status, created_at)
     VALUES ($1,$2,$3,$4,$5,'draft',datetime('now'))`,
    [contentId, missionId, channel, selectedTone, JSON.stringify(content)],
  );

  return { id: contentId, content, channel, tone: selectedTone };
}
