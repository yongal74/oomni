/**
 * roleExecutors/growth.ts — Growth Bot (AI Lead Generation) executor
 * v5.2.0
 *
 * 입력: URL 또는 키워드 + 선택적 세그먼트/채널 파라미터
 * 출력: 채널별 콘텐츠 패키지 (텍스트 + 이미지 + 영상) SSE 스트리밍
 *
 * 플로우:
 *   1. 태스크 텍스트에서 URL / 채널 / 세그먼트 파싱
 *   2. URL 있으면 인제스션 → 상품 정보 추출
 *   3. CDP 세그먼트 조회
 *   4. 채널별 텍스트 생성 (Claude)
 *   5. 이미지 생성 (Gemini Imagen 4)
 *   6. 영상 스크립트 → 영상 생성 (Gemini Veo 3.1)
 *   7. growth_content DB 저장
 */
import { saveFeedItem, type ExecutorContext } from './base'
import { ingestUrl } from '../growthIngestionService'
import { generateImage, generateVideo } from '../geminiService'
import { generateGrowthContent } from '../growthService'
import { scoreLead } from '../leadScoringService'
import { logger } from '../../logger'

const URL_REGEX = /https?:\/\/[^\s]+/i
const CHANNEL_REGEX = /channel[:\s]+(\w+)/i
const SEGMENT_REGEX = /segment[:\s]+(new_visitor|re_purchase|churn_risk|vip)/i
const TONE_REGEX = /tone[:\s]+(\w+)/i

type GrowthChannel = 'x' | 'instagram' | 'youtube' | 'linkedin' | 'blog' | 'tiktok' | 'naver_blog'
type Segment = 'new_visitor' | 're_purchase' | 'churn_risk' | 'vip'

export async function growthExecutor(ctx: ExecutorContext): Promise<void> {
  const { db, agent, task, send } = ctx

  await saveFeedItem(db, agent.id, 'info', `🚀 Growth Bot 시작: ${task}`)
  send('stage', { stage: '분석 중' })

  // ── 1. 태스크에서 파라미터 파싱 ────────────────────────────────────────
  const urlMatch     = task.match(URL_REGEX)
  const channelMatch = task.match(CHANNEL_REGEX)
  const segmentMatch = task.match(SEGMENT_REGEX)
  const toneMatch    = task.match(TONE_REGEX)

  const inputUrl  = urlMatch?.[0] ?? null
  const channel   = (channelMatch?.[1]?.toLowerCase() as GrowthChannel) ?? 'instagram'
  const segment   = (segmentMatch?.[1] as Segment) ?? 'new_visitor'
  const tone      = toneMatch?.[1] ?? undefined

  // ── 2. URL 인제스션 ──────────────────────────────────────────────────────
  let seedContent = task
  let productInfo: Record<string, unknown> = {}

  if (inputUrl) {
    send('stage', { stage: 'URL 분석 중' })
    await saveFeedItem(db, agent.id, 'info', `🔗 URL 분석: ${inputUrl}`)
    try {
      productInfo = await ingestUrl(inputUrl) as unknown as Record<string, unknown>
      seedContent = [
        productInfo.name,
        productInfo.description,
        productInfo.price ? `가격: ${productInfo.price}` : '',
        productInfo.keywords ? `키워드: ${(productInfo.keywords as string[]).join(', ')}` : '',
      ].filter(Boolean).join('\n')
      await saveFeedItem(db, agent.id, 'info', `✅ 상품 분석 완료: ${productInfo.name}`)
    } catch (e) {
      logger.warn('[growthExecutor] URL 인제스션 실패, 원문 사용:', e)
      await saveFeedItem(db, agent.id, 'info', `⚠️ URL 분석 실패 — 키워드로 진행`)
    }
  }

  // ── 3. 텍스트 콘텐츠 생성 ────────────────────────────────────────────────
  send('stage', { stage: '텍스트 생성 중' })
  const textResult = await generateGrowthContent(
    db,
    agent.mission_id,
    channel as Parameters<typeof generateGrowthContent>[2],
    seedContent,
    tone as Parameters<typeof generateGrowthContent>[4],
  )
  await saveFeedItem(db, agent.id, 'info', `✍️ ${channel.toUpperCase()} 텍스트 생성 완료`)

  // ── 4. 이미지 생성 ────────────────────────────────────────────────────────
  send('stage', { stage: '이미지 생성 중' })
  let imageUrl: string | null = null
  try {
    const imagePrompt = buildImagePrompt(channel, segment, seedContent, productInfo)
    imageUrl = await generateImage(imagePrompt, channel)
    await saveFeedItem(db, agent.id, 'info', `🖼️ 이미지 생성 완료`)
  } catch (e) {
    logger.warn('[growthExecutor] 이미지 생성 실패:', e)
    await saveFeedItem(db, agent.id, 'info', `⚠️ 이미지 생성 실패 (API 키 확인 필요)`)
  }

  // ── 5. 영상 생성 ─────────────────────────────────────────────────────────
  send('stage', { stage: '영상 생성 중' })
  let videoUrl: string | null = null
  try {
    const videoScript = buildVideoScript(channel, segment, seedContent)
    const aspect = (channel === 'youtube') ? '16:9' : '9:16'
    videoUrl = await generateVideo(videoScript, aspect)
    await saveFeedItem(db, agent.id, 'info', `🎬 영상 생성 완료`)
  } catch (e) {
    logger.warn('[growthExecutor] 영상 생성 실패:', e)
    await saveFeedItem(db, agent.id, 'info', `⚠️ 영상 생성 실패 (API 키 확인 필요)`)
  }

  // ── 6. growth_content 업데이트 (segment, video_url, publish_channels) ───
  try {
    await db.query(
      `UPDATE growth_content
       SET segment = $1, video_url = $2, publish_channels = $3
       WHERE id = $4`,
      [segment, videoUrl, JSON.stringify([channel]), textResult.id],
    )
  } catch (e) {
    logger.warn('[growthExecutor] growth_content 업데이트 실패:', e)
  }

  // ── 7. 리드 시그널 기록 (미션 레벨) ─────────────────────────────────────
  try {
    await scoreLead(db, agent.mission_id, null, 'content_generated', 10)
  } catch { /* non-fatal */ }

  // ── 8. 결과 조합 + 완료 ──────────────────────────────────────────────────
  const summary = buildResultSummary(channel, segment, textResult.content, imageUrl, videoUrl)
  await saveFeedItem(db, agent.id, 'result', summary)

  send('done', {
    contentId: textResult.id,
    channel,
    segment,
    imageUrl,
    videoUrl,
    preview: summary.slice(0, 300),
  })
}

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

function buildImagePrompt(
  channel: GrowthChannel,
  segment: Segment,
  seed: string,
  product: Record<string, unknown>,
): string {
  const style: Record<Segment, string> = {
    new_visitor:  'clean, modern, eye-catching, first impression',
    re_purchase:  'warm, familiar, loyalty reward, premium',
    churn_risk:   'urgent, reminder, special offer, FOMO',
    vip:          'luxury, exclusive, gold accents, premium quality',
  }
  const format: Record<GrowthChannel, string> = {
    instagram:    'square 1:1, bold typography overlay, high contrast',
    x:            '16:9 banner, minimal text',
    youtube:      '16:9 thumbnail, bold face, bright colors',
    tiktok:       '9:16 vertical, dynamic, youth energy',
    linkedin:     'professional 1.91:1, corporate clean',
    blog:         '16:9 header image, editorial style',
    naver_blog:   '16:9 header image, Korean aesthetic',
  }
  const productName = String(product.name ?? seed.slice(0, 60))
  return `Product marketing image for: "${productName}". Style: ${style[segment]}. Format: ${format[channel]}. High quality, photorealistic.`
}

function buildVideoScript(channel: GrowthChannel, segment: Segment, seed: string): string {
  const ctaBySegment: Record<Segment, string> = {
    new_visitor:  '지금 확인해보세요!',
    re_purchase:  '다시 만나서 반가워요, 특별 혜택을 드려요!',
    churn_risk:   '잠깐! 돌아오시면 특별 할인이 기다립니다',
    vip:          'VIP 전용 혜택, 먼저 경험해보세요',
  }
  const duration = (channel === 'youtube') ? '60초' : '30초'
  return `Create a ${duration} ${channel} video script about: ${seed.slice(0, 200)}. CTA: "${ctaBySegment[segment]}". Structure: Hook(3s) → Problem(7s) → Solution(15s) → Proof(10s) → CTA(5s). Energetic, conversational tone.`
}

function buildResultSummary(
  channel: GrowthChannel,
  segment: Segment,
  textContent: Record<string, unknown>,
  imageUrl: string | null,
  videoUrl: string | null,
): string {
  const segmentLabel: Record<Segment, string> = {
    new_visitor: '신규 방문자',
    re_purchase: '재구매 가능',
    churn_risk: '이탈 위험',
    vip: 'VIP',
  }
  return [
    `## Growth Bot 결과 — [${channel.toUpperCase()}] [${segmentLabel[segment]}]`,
    '',
    '### 텍스트 콘텐츠',
    JSON.stringify(textContent, null, 2).slice(0, 600),
    '',
    imageUrl ? `### 이미지\n${imageUrl}` : '### 이미지\n⚠️ 생성 실패 (Gemini API 키 필요)',
    '',
    videoUrl ? `### 영상\n${videoUrl}` : '### 영상\n⚠️ 생성 실패 (Gemini API 키 필요)',
    '',
    '> SNS 업로드: Growth Studio → 발사 버튼',
  ].join('\n')
}
