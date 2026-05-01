import { v4 as uuidv4 } from 'uuid'
import { streamClaude, saveFeedItem, HAIKU_MODEL, type ExecutorContext } from './base'
import { readSettings } from '../../config'

async function sendCdpEvent(eventName: string, properties: Record<string, unknown>): Promise<void> {
  const settings = readSettings()
  const tenantId = settings.cdp_api_key
  if (!tenantId) return
  try {
    await fetch('https://oomni-cdp.vercel.app/api/collect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, source: 'oomni', event_type: 'track', event_name: eventName, properties }),
    })
  } catch { /* fire-and-forget */ }
}

// ── 트랙별 시스템 프롬프트 ────────────────────────────────────────────────

const SYSTEM_PROMPT_BUSINESS = `당신은 사업 기회와 시장 동향을 분석하는 비즈니스 리서치 전문가입니다.
주어진 주제로 시장 기회·경쟁사·투자/M&A·수익성 신호를 분석하여 아래 형식으로 3-7개의 아이템을 작성하세요.

사전 필터링 조건 (아래 조건 중 하나 이상 충족 시에만 포함):
- ROI/수익화 가능성이 명확한 신호
- 경쟁사 움직임 또는 시장 구조 변화
- 투자·인수합병(M&A) 관련 정보
- 신규 비즈니스 모델 또는 수익 구조 등장
- SaaS/플랫폼/마켓플레이스 성장 지표

응답 형식 (반드시 준수):
각 아이템에 대해 아래 블록을 사용하세요:
ITEM_START
title: [아이템 제목 (100자 이내)]
signal_score: [0-100 숫자만]
summary: [2-3문장 한국어 요약]
tags: [태그1, 태그2, 태그3]
seo_volume: [low/medium/high]
seo_kd: [low/medium/high]
seo_cpc: [low/medium/high]
first_mover: [true/false]
ITEM_END

신호강도 채점 기준 (0-100) — 사업성 트랙:
비즈니스 임팩트 (70점):
- 시장 규모/성장성(25): 실제 TAM·SAM 규모와 성장률
- 수익화 명확성(20): ROI·수익 구조의 구체성
- 경쟁 우위(15): 퍼스트무버·진입장벽·차별화 가능성
- 실행 가능성(10): 자원·타임라인·기술 실현 가능성

SEO 신호 (30점):
- CPC 카테고리(15): 금융/SaaS/AI/B2B→15, 일반→5
- 검색 의도(10): 구매·비교 의도 높을수록 고점
- 경쟁도(5): KD 낮을수록 높은 점수

비즈니스 임팩트가 높은 아이템을 상위에 배치하세요.`

const SYSTEM_PROMPT_INFORMATIONAL = `당신은 기술 트렌드와 학술·연구 동향을 분석하는 정보성 리서치 전문가입니다.
주어진 주제로 기술 트렌드·학술/연구 동향·일반 정보를 분석하여 아래 형식으로 3-7개의 아이템을 작성하세요.

사전 필터링 조건 (아래 조건 중 하나 이상 충족 시에만 포함):
- 교육적 가치가 높고 독자에게 즉각 유용한 정보
- 최신 기술·연구 논문·오픈소스 발표
- 커뮤니티에서 활발히 논의되는 정보성 주제
- 개념·방법론·도구 사용법에 대한 명확한 설명 가치
- 일반인도 이해할 수 있는 쉬운 해설이 가능한 주제

응답 형식 (반드시 준수):
각 아이템에 대해 아래 블록을 사용하세요:
ITEM_START
title: [아이템 제목 (100자 이내)]
signal_score: [0-100 숫자만]
summary: [2-3문장 한국어 요약]
tags: [태그1, 태그2, 태그3]
seo_volume: [low/medium/high]
seo_kd: [low/medium/high]
seo_cpc: [low/medium/high]
first_mover: [true/false]
ITEM_END

신호강도 채점 기준 (0-100) — 정보성 트랙:
정보 가치 (60점):
- 교육적 가치(20): 독자 이해도·실용성 향상 기여도
- 시의성(20): 최신 정보 여부 (24h→20, 48h→15, 1주→10)
- 정확성·신뢰성(10): 출처의 권위·검증 가능성
- 이해 접근성(10): 다양한 독자층이 이해 가능한 수준

확산성 (40점):
- 소셜 공유 가능성(20): SNS·커뮤니티 확산 잠재력
- 검색 의도 일치(10): 정보 탐색 의도와의 부합도
- 퍼스트무버 가능성(10): 0-6h→10, 6-24h→7, 24-48h→4, 48h+→1

정보 가치와 확산성이 모두 높은 아이템을 상위에 배치하세요.`

// 기존 범용 시스템 프롬프트 (track 미지정 시 사용)
const SYSTEM_PROMPT_DEFAULT = `당신은 AI/스타트업 트렌드를 분석하는 리서치 전문가 겸 SEO 전략가입니다.
주어진 주제로 최신 트렌드와 인사이트를 분석하여 아래 형식으로 3-7개의 아이템을 작성하세요.

응답 형식 (반드시 준수):
각 아이템에 대해 아래 블록을 사용하세요:
ITEM_START
title: [아이템 제목 (100자 이내)]
signal_score: [0-100 숫자만]
summary: [2-3문장 한국어 요약]
tags: [태그1, 태그2, 태그3]
seo_volume: [low/medium/high]
seo_kd: [low/medium/high]
seo_cpc: [low/medium/high]
first_mover: [true/false]
ITEM_END

신호강도 채점 기준 (0-100):
콘텐츠 신호 (60점):
- 시장성(20): 실제 수요와 비즈니스 가능성
- 시의성(20): 현재 트렌드 연관성 (24h 이내→20, 48h→15, 1주→10)
- 자동화가능성(15): AI/자동화 활용 가능성
- 콘텐츠확장성(15): 블로그/뉴스레터/SNS 확장 가능성

SEO 신호 (40점):
- 검색의도 명확성(10): 정보 검색 의도가 높을수록 높은 점수
- 퍼스트무버 가능성(10): 0-6h→10, 6-24h→7, 24-48h→4, 48h+→1
- CPC 카테고리(10): AI/금융/SaaS→10, 건강/교육→7, 일반→3
- 경쟁도(5): KD 낮을수록 높은 점수
- AIWX 적합도(5): AIWX 블로그(AI/비즈니스) 독자층 일치도

퍼스트 무버 SEO 관점에서 가장 시급한 아이템을 상위에 배치하세요.`

// ── 트랙별 유저 메시지 빌더 ───────────────────────────────────────────────

function buildUserMessage(task: string, track: 'business' | 'informational' | 'default'): string {
  if (track === 'business') {
    return `태스크: ${task}

다음 주제로 사업성 리서치를 수행하세요. 시장 기회, 경쟁사 분석, 투자/M&A 트렌드, 수익성 신호에 집중하세요.
신호강도(signal_score)는 비즈니스 임팩트(70%) + SEO(30%) 기준으로 채점하세요.

수집 소스:
🔴 실시간 비즈니스 신호: Crunchbase, TechCrunch M&A, Bloomberg Tech, CB Insights
🟡 시장 분석: Product Hunt 신제품, Hacker News (Show HN), AngelList 투자 현황
🟢 심층 인사이트: Substack 비즈니스 뉴스레터, VC 블로그, Seeking Alpha, LinkedIn 업계 리포트

ROI/수익/비즈니스 관련 신호만 포함하고, 순수 정보성 콘텐츠는 제외하세요.
각 아이템은 ITEM_START / ITEM_END 블록으로 작성하세요.`
  }

  if (track === 'informational') {
    return `태스크: ${task}

다음 주제로 정보성 리서치를 수행하세요. 기술 트렌드, 학술/연구 동향, 일반 정보에 집중하세요.
신호강도(signal_score)는 정보 가치(60%) + 확산성(40%) 기준으로 채점하세요.

수집 소스:
🔴 실시간 정보: arXiv 최신 논문, GitHub 트렌딩, Stack Overflow 인기 질문
🟡 커뮤니티 논의: Reddit r/MachineLearning, Hacker News, DEV.to, Medium
🟢 심층 학습: 기술 블로그(Anthropic/OpenAI/Google), YouTube 교육 채널, Quora 질문

🌐 해외 AI/테크 뉴스:
- TechCrunch AI (techcrunch.com/category/artificial-intelligence)
- The Verge (theverge.com/ai-artificial-intelligence)
- MIT Technology Review (technologyreview.com)

🇰🇷 국내 AI/테크 뉴스:
- 디지털데일리 (ddaily.co.kr)
- 전자신문 (etnews.com)
- AI타임스 (aitimes.com)

교육/정보 가치가 높은 신호만 포함하고, 순수 마케팅/광고성 콘텐츠는 제외하세요.
각 아이템은 ITEM_START / ITEM_END 블록으로 작성하세요.`
  }

  // default
  return `태스크: ${task}

다음 주제로 최신 AI/스타트업 트렌드를 분석하세요.
신호강도(signal_score)는 콘텐츠(60%) + SEO(40%) 기준으로 채점하세요.

소스 레이어별 분석:
🔴 실시간 (24-48h 선점): Google Trends 급상승, X/Twitter 트렌딩, YouTube 급상승, Reddit r/trending
🟡 중기 (1-4주): Product Hunt 신제품, Hacker News, TechCrunch, Reddit 커뮤니티
🟢 니치 롱테일: Quora 질문, Google 연관검색, 업계 뉴스레터, Reddit r/startups

퍼스트 무버 기회(first_mover: true)인 아이템을 상위에 배치하세요.
각 아이템은 ITEM_START / ITEM_END 블록으로 작성하세요.`
}

// ── task 문자열에서 트랙 파싱 ─────────────────────────────────────────────
// 형식: "__track:business__ 실제 태스크" 또는 "__track:informational__ 실제 태스크"

function parseTrack(task: string): { track: 'business' | 'informational' | 'default'; cleanTask: string } {
  const match = task.match(/^__track:(business|informational)__\s*/)
  if (match) {
    return {
      track: match[1] as 'business' | 'informational',
      cleanTask: task.slice(match[0].length).trim() || task,
    }
  }
  return { track: 'default', cleanTask: task }
}

// ── 공통 파싱·저장 로직 ───────────────────────────────────────────────────

async function parseAndSave(
  ctx: ExecutorContext,
  fullOutput: string,
  track: 'business' | 'informational' | 'default'
): Promise<number> {
  const { agent, db } = ctx
  const itemBlocks = fullOutput.split('ITEM_START').slice(1)
  let savedCount = 0

  for (const block of itemBlocks) {
    const endIdx = block.indexOf('ITEM_END')
    const content = endIdx > -1 ? block.slice(0, endIdx) : block

    const titleMatch      = content.match(/title:\s*(.+)/)
    const scoreMatch      = content.match(/signal_score:\s*(\d+)/)
    const summaryMatch    = content.match(/summary:\s*([\s\S]+?)(?=tags:|seo_|first_mover:|ITEM|$)/)
    const tagsMatch       = content.match(/tags:\s*(.+)/)
    const firstMoverMatch = content.match(/first_mover:\s*(true|false)/i)

    if (!titleMatch || !scoreMatch) continue

    const title        = titleMatch[1].trim()
    const signal_score = Math.min(100, Math.max(0, parseInt(scoreMatch[1])))
    const summary      = summaryMatch ? summaryMatch[1].trim() : ''
    const rawTags      = tagsMatch ? tagsMatch[1].split(',').map(t => t.trim()) : []
    const isFirstMover = firstMoverMatch?.[1]?.toLowerCase() === 'true'
    if (isFirstMover) rawTags.push('🔴퍼스트무버')
    if (track === 'business') rawTags.push('📊사업성')
    if (track === 'informational') rawTags.push('💡정보성')
    const tags = JSON.stringify(rawTags)

    // 중복 체크 (1시간 이내 동일 제목)
    const existing = await db.query(
      `SELECT id FROM research_items WHERE mission_id = $1 AND title = $2 AND created_at > datetime('now', '-1 hours')`,
      [agent.mission_id, title]
    )
    if ((existing.rows as unknown[]).length > 0) continue

    await db.query(
      `INSERT INTO research_items (id, mission_id, source_type, title, summary, tags, signal_score, filter_decision)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [uuidv4(), agent.mission_id, track === 'default' ? 'keyword' : track, title, summary, tags, signal_score, 'pending']
    )
    savedCount++
  }

  return savedCount
}

// ── 메인 executor ─────────────────────────────────────────────────────────

export async function researchExecutor(ctx: ExecutorContext): Promise<void> {
  const { agent, task, db, send } = ctx

  // task에서 트랙 파싱
  const { track, cleanTask } = parseTrack(task)

  const trackLabel =
    track === 'business' ? '사업성 리서치' :
    track === 'informational' ? '정보성 리서치' :
    'Research Bot'

  send('stage', { stage: 'collecting', label: '소스 수집 중...' })
  await saveFeedItem(db, agent.id, 'info', `🔬 ${trackLabel} 시작: ${cleanTask}`)

  send('stage', { stage: 'fetching', label: '트렌드 분석 중...' })

  const systemPrompt =
    track === 'business' ? SYSTEM_PROMPT_BUSINESS :
    track === 'informational' ? SYSTEM_PROMPT_INFORMATIONAL :
    SYSTEM_PROMPT_DEFAULT

  const userMessage = buildUserMessage(cleanTask, track)

  send('stage', { stage: 'scoring', label: 'AI 신호 채점 중...' })
  const fullOutput = await streamClaude(ctx, systemPrompt, userMessage, HAIKU_MODEL)

  const savedCount = await parseAndSave(ctx, fullOutput, track)

  await saveFeedItem(
    db, agent.id, 'result',
    `✅ ${trackLabel} 완료: ${savedCount}개 아이템 수집 (사람 소팅 필요)\n\n${fullOutput}`
  )

  // CDP 이벤트 전송 (fire-and-forget)
  sendCdpEvent('research_completed', {
    track,
    task_preview: cleanTask.slice(0, 200),
    items_saved: savedCount,
    agent_id: agent.id,
    mission_id: agent.mission_id,
  }).catch(() => {})
}
