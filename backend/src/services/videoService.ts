/**
 * videoService.ts — Short-Form Video Automation Service
 * Generates scripts via Claude API, saves Vrew .txt, converts to Remotion props
 */
import Anthropic from '@anthropic-ai/sdk'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs'
import path from 'path'

// ─── Constants ───────────────────────────────────────────────────────────────
export const VIDEO_DIR = 'C:/oomni-data/videos'
export const VREW_DIR = 'C:/oomni-data/videos/vrew'
const DEFAULT_MODEL = 'claude-sonnet-4-6'

// ─── Types ───────────────────────────────────────────────────────────────────
export interface ShortFormScript {
  id: string
  title: string
  topic: string
  type: 'content' | 'growth'
  variants: ScriptVariant[]
  created_at: string
}

export interface ScriptVariant {
  hook: string        // 0-3s: 충격적 사실/질문
  problem: string     // 3-8s: 공감 포인트
  solution: string[]  // 8-25s: 3단계 해결책
  proof: string       // 25-50s: 숫자/결과
  cta: string         // 50-60s: 행동 유도
  subtitles?: SubtitleLine[]
  remotion_props?: RemotionProps
  vrew_text?: string
}

export interface SubtitleLine {
  startMs: number
  endMs: number
  text: string
}

export interface RemotionProps {
  durationInFrames: number  // 30fps * 60s = 1800
  fps: number               // 30
  width: number             // 1080
  height: number            // 1920
  slides: Slide[]
}

export interface Slide {
  type: 'hook' | 'problem' | 'solution' | 'proof' | 'cta'
  startFrame: number
  durationInFrames: number
  content: string | string[]
  backgroundColor?: string
  textColor?: string
}

export interface VideoMeta {
  id: string
  filename: string
  path: string
  size_bytes: number
  created_at: string
}

// ─── Script System Prompt ─────────────────────────────────────────────────────
const SCRIPT_SYSTEM_PROMPT = `당신은 바이럴 숏폼 콘텐츠 전문가입니다.
한국 소셜미디어(TikTok, YouTube Shorts, Instagram Reels)에 최적화된 스크립트를 작성합니다.

규칙:
- Hook: 첫 1초에 멈추게 하는 충격/공감/궁금증 유발
- 구어체 사용, 짧은 문장
- 숫자와 구체적 사례 필수
- CTA는 팔로우/저장/공유 중 하나
- 총 60초 이내

반드시 아래 JSON 형식으로 응답하세요 (다른 텍스트 없이):
{
  "title": "스크립트 제목",
  "variants": [
    {
      "hook": "후크 문장 (1-2문장)",
      "problem": "공감 포인트 (1-2문장)",
      "solution": ["1단계 해결책", "2단계 해결책", "3단계 해결책"],
      "proof": "숫자와 결과 (1-2문장)",
      "cta": "행동 유도 (1문장)"
    },
    ... (총 3개 변형)
  ]
}`

// ─── generateScript ───────────────────────────────────────────────────────────
export async function generateScript(
  topic: string,
  type: 'content' | 'growth'
): Promise<ShortFormScript> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })

  const typeContext = type === 'growth'
    ? '성장 지표, MAU, 수익, 전환율 등 비즈니스 성과'
    : '콘텐츠 마케팅, 생산성, 솔로프리너 팁'

  const userMessage = `주제: ${topic}
타입: ${typeContext}

위 주제로 바이럴 숏폼 영상 스크립트 3개 변형을 작성해주세요.
각 변형은 같은 주제를 다른 각도로 접근해야 합니다.`

  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: userMessage,
      },
    ],
    system: SCRIPT_SYSTEM_PROMPT,
  })

  const rawText = response.content[0].type === 'text' ? response.content[0].text : ''

  let parsed: { title: string; variants: ScriptVariant[] }
  try {
    // Extract JSON from response (may have markdown code blocks)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found in response')
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    // Fallback structure if Claude returns unexpected format
    parsed = {
      title: `${topic} 숏폼 스크립트`,
      variants: [
        {
          hook: `${topic}에 대해 알고 계셨나요?`,
          problem: '많은 분들이 이 문제로 어려움을 겪고 있습니다',
          solution: ['첫째, 핵심 파악하기', '둘째, 실천하기', '셋째, 반복하기'],
          proof: '이 방법으로 수천 명이 성과를 달성했습니다',
          cta: '팔로우하고 다음 편도 놓치지 마세요',
        },
        {
          hook: `아직도 ${topic}을 모르나요?`,
          problem: '시간을 낭비하고 있을 수도 있습니다',
          solution: ['먼저 현황 파악', '전략 수립', '즉시 실행'],
          proof: '30일 만에 결과가 나옵니다',
          cta: '저장해두고 나중에 실천하세요',
        },
        {
          hook: `${topic}으로 월 1000만원 버는 법`,
          problem: '혼자서는 막막하죠',
          solution: ['시스템 구축', 'AI 도구 활용', '자동화 설정'],
          proof: '6개월 만에 달성 가능합니다',
          cta: '공유해서 주변에도 알려주세요',
        },
      ],
    }
  }

  // Ensure exactly 3 variants
  const variants = parsed.variants.slice(0, 3)
  while (variants.length < 3) {
    variants.push({ ...variants[0] })
  }

  // Add remotion_props and vrew_text to each variant
  const enrichedVariants: ScriptVariant[] = variants.map(variant => ({
    ...variant,
    remotion_props: scriptToRemotionProps(variant),
    vrew_text: buildVrewText(variant),
    subtitles: buildSubtitles(variant),
  }))

  const id = uuidv4()
  return {
    id,
    title: parsed.title,
    topic,
    type,
    variants: enrichedVariants,
    created_at: new Date().toISOString(),
  }
}

// ─── scriptToRemotionProps ────────────────────────────────────────────────────
export function scriptToRemotionProps(variant: ScriptVariant): RemotionProps {
  const FPS = 30
  const TOTAL_FRAMES = FPS * 60 // 1800 frames = 60s

  // Slide timing (frames at 30fps)
  // Hook: 0-90f (3s), Problem: 90-240f (5s), Solution: 240-750f (17s), Proof: 750-1500f (25s), CTA: 1500-1800f (10s)
  const slides: Slide[] = [
    {
      type: 'hook',
      startFrame: 0,
      durationInFrames: 90,
      content: variant.hook,
      backgroundColor: '#0A0A0F',
      textColor: '#A78BFA',
    },
    {
      type: 'problem',
      startFrame: 90,
      durationInFrames: 150,
      content: variant.problem,
      backgroundColor: '#0A0A0F',
      textColor: '#F87171',
    },
    {
      type: 'solution',
      startFrame: 240,
      durationInFrames: 510,
      content: variant.solution,
      backgroundColor: '#0A0A0F',
      textColor: '#34D399',
    },
    {
      type: 'proof',
      startFrame: 750,
      durationInFrames: 750,
      content: variant.proof,
      backgroundColor: '#0A0A0F',
      textColor: '#60A5FA',
    },
    {
      type: 'cta',
      startFrame: 1500,
      durationInFrames: 300,
      content: variant.cta,
      backgroundColor: '#4F46E5',
      textColor: '#FFFFFF',
    },
  ]

  return {
    durationInFrames: TOTAL_FRAMES,
    fps: FPS,
    width: 1080,
    height: 1920,
    slides,
  }
}

// ─── buildVrewText ─────────────────────────────────────────────────────────────
function buildVrewText(variant: ScriptVariant): string {
  const lines: string[] = [
    variant.hook,
    '',
    variant.problem,
    '',
    ...variant.solution.map((s, i) => `${i + 1}. ${s}`),
    '',
    variant.proof,
    '',
    variant.cta,
  ]
  return lines.join('\n')
}

// ─── buildSubtitles ────────────────────────────────────────────────────────────
function buildSubtitles(variant: ScriptVariant): SubtitleLine[] {
  const subtitles: SubtitleLine[] = []
  let currentMs = 0

  const segments = [
    { text: variant.hook, durationMs: 3000 },
    { text: variant.problem, durationMs: 5000 },
    ...variant.solution.map(s => ({ text: s, durationMs: 5667 })),
    { text: variant.proof, durationMs: 25000 },
    { text: variant.cta, durationMs: 10000 },
  ]

  for (const seg of segments) {
    subtitles.push({
      startMs: currentMs,
      endMs: currentMs + seg.durationMs,
      text: seg.text,
    })
    currentMs += seg.durationMs
  }

  return subtitles
}

// ─── saveVrewScript ───────────────────────────────────────────────────────────
export async function saveVrewScript(
  script: ShortFormScript,
  dirOverride?: string
): Promise<string> {
  const targetDir = dirOverride ?? VREW_DIR
  fs.mkdirSync(targetDir, { recursive: true })

  const filename = `${script.id}.txt`
  const filePath = path.join(targetDir, filename)

  // Build full Vrew-compatible text with all variants
  const lines: string[] = [
    `# ${script.title}`,
    `# 주제: ${script.topic}`,
    `# 생성일: ${script.created_at}`,
    '',
  ]

  script.variants.forEach((variant, index) => {
    lines.push(`## 변형 ${index + 1}`)
    lines.push('')
    lines.push(variant.vrew_text ?? buildVrewText(variant))
    lines.push('')
    lines.push('---')
    lines.push('')
  })

  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8')
  return filePath
}

// ─── getVideoList ─────────────────────────────────────────────────────────────
export async function getVideoList(dirOverride?: string): Promise<VideoMeta[]> {
  const targetDir = dirOverride ?? VIDEO_DIR

  if (!fs.existsSync(targetDir)) {
    return []
  }

  const files = fs.readdirSync(targetDir).filter(f => f.endsWith('.mp4'))

  return files.map(filename => {
    const filePath = path.join(targetDir, filename)
    const stat = fs.statSync(filePath)
    const id = filename.replace('.mp4', '')

    return {
      id,
      filename,
      path: filePath,
      size_bytes: stat.size,
      created_at: stat.birthtime.toISOString(),
    }
  })
}

// ─── renderVideo (headless Remotion) ─────────────────────────────────────────
export async function renderVideo(
  scriptId: string,
  variant: ScriptVariant,
  outputDirOverride?: string
): Promise<string> {
  const outputDir = outputDirOverride ?? VIDEO_DIR
  fs.mkdirSync(outputDir, { recursive: true })

  const outputPath = path.join(outputDir, `${scriptId}.mp4`)

  // Dynamic import for Remotion renderer (avoids bundling issues)
  try {
    const { bundle } = await import('@remotion/bundler')
    const { renderMedia, selectComposition } = await import('@remotion/renderer')

    const remotionProps = scriptToRemotionProps(variant)

    // Bundle the Remotion composition
    const entryPoint = path.resolve(
      __dirname,
      '../../frontend/src/components/video/remotion-entry.tsx'
    )

    const bundleLocation = await bundle({
      entryPoint,
      onProgress: () => {},
    })

    const propsRecord = remotionProps as unknown as Record<string, unknown>

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: 'ShortFormVideo',
      inputProps: propsRecord,
    })

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps: propsRecord,
    })

    return outputPath
  } catch (err) {
    throw new Error(`Video render failed: ${(err as Error).message}`)
  }
}
