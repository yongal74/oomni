import { streamClaude, saveFeedItem, HAIKU_MODEL, type ExecutorContext } from './base'

// ── 태스크 분류 ───────────────────────────────────────────────────────────────
type GrowthTrack = 'seo' | 'ad_copy' | 'channel' | 'strategy' | 'general'

function classifyTask(task: string): GrowthTrack {
  const t = task.toLowerCase()
  if (t.includes('seo') || t.includes('키워드') || t.includes('검색') || t.includes('랭킹')) return 'seo'
  if (t.includes('광고') || t.includes('카피') || t.includes('copy') || t.includes('문구') || t.includes('헤드라인')) return 'ad_copy'
  if (t.includes('채널') || t.includes('sns') || t.includes('인스타') || t.includes('트위터') || t.includes('유튜브') || t.includes('블로그')) return 'channel'
  if (t.includes('전략') || t.includes('캠페인') || t.includes('마케팅') || t.includes('growth') || t.includes('그로스')) return 'strategy'
  return 'general'
}

// ── 트랙별 시스템 프롬프트 ─────────────────────────────────────────────────────

const SYSTEM_SEO = `당신은 SEO 전문 그로스 마케터입니다.
키워드 리서치, 온페이지 최적화, 콘텐츠 전략을 분석하여 구체적인 SEO 개선안을 제시합니다.

응답 형식:
## 타겟 키워드 분석
| 키워드 | 예상 검색량 | 경쟁도 | 난이도 | 우선순위 |
|---|---|---|---|---|

## 현재 SEO 문제점
[최대 5개, 구체적 수정 방안 포함]

## 즉시 적용 가능한 최적화
[우선순위 순, 예상 효과 포함]

## 콘텐츠 갭 분석
[경쟁사 대비 없는 콘텐츠 기회]

## 3개월 SEO 로드맵
[월별 목표와 액션 아이템]`

const SYSTEM_AD_COPY = `당신은 퍼포먼스 마케팅 카피라이터입니다.
전환율 최적화를 위한 광고 카피와 랜딩페이지 문구를 작성합니다.

응답 형식:
## 핵심 가치 제안 (UVP)
[1-2문장, 타겟 고객의 핵심 고통 해결 중심]

## 헤드라인 5가지 (A/B 테스트용)
1. [호기심 유발형]
2. [수치 강조형]
3. [문제 해결형]
4. [소셜 프루프형]
5. [긴급성 강조형]

## 서브헤드라인 + 본문
[각 헤드라인에 대응하는 서브카피]

## CTA 문구 5가지
[클릭 유도 버튼 텍스트]

## 광고 플랫폼별 최적화 문구
- Google Search Ad (30/90/90자 제한)
- Facebook/Instagram Ad
- 카카오 비즈보드`

const SYSTEM_CHANNEL = `당신은 멀티채널 그로스 마케터입니다.
각 채널의 특성과 알고리즘에 최적화된 콘텐츠 전략을 수립합니다.

응답 형식:
## 채널별 현황 분석
[각 채널의 성과 지표와 개선 기회]

## 채널 우선순위
[ROI 기반 투자 채널 순서]

## 채널별 콘텐츠 전략
각 채널:
- 최적 포스팅 빈도
- 콘텐츠 포맷 (이미지/영상/텍스트 비율)
- 베스트 타이밍
- 해시태그 전략
- 구체적 콘텐츠 아이디어 5개

## 크로스 채널 시너지
[채널 간 연계 방안]`

const SYSTEM_STRATEGY = `당신은 데이터 기반 그로스 전략가입니다.
AARRR 프레임워크(Acquisition-Activation-Retention-Revenue-Referral)로 성장 전략을 수립합니다.

응답 형식:
## 현황 진단 (AARRR)
| 단계 | 현재 상태 | 핵심 문제 | 개선 기회 |
|---|---|---|---|

## 성장 레버 (우선순위 순)
[즉시 실행 / 단기 / 중기로 분류]

## 캠페인 플랜
| 캠페인 | 목표 | 예산 배분 | 기간 | KPI |
|---|---|---|---|---|

## 즉시 실행 액션 (이번 주)
1. [구체적 액션 + 담당자 + 예상 임팩트]
2.
3.

## 90일 그로스 로드맵
[월별 핵심 목표와 실험 가설]`

const SYSTEM_GENERAL = `당신은 그로스 마케팅 전문가입니다.
데이터를 분석하여 실행 가능한 그로스 전략을 제시합니다.

응답에 반드시 포함:
1. 현황 요약
2. 핵심 문제점 (최대 3개)
3. 즉시 실행 가능한 액션 (우선순위 순)
4. 예상 임팩트`

const SYSTEM_PROMPTS: Record<GrowthTrack, string> = {
  seo: SYSTEM_SEO,
  ad_copy: SYSTEM_AD_COPY,
  channel: SYSTEM_CHANNEL,
  strategy: SYSTEM_STRATEGY,
  general: SYSTEM_GENERAL,
}

const TRACK_LABELS: Record<GrowthTrack, string> = {
  seo: 'SEO 분석',
  ad_copy: '광고 카피 생성',
  channel: '채널 전략',
  strategy: '그로스 전략',
  general: '그로스 분석',
}

const TRACK_STAGES: Record<GrowthTrack, string[]> = {
  seo: ['키워드 리서치', 'SEO 분석 중', '최적화 전략 수립'],
  ad_copy: ['타겟 분석', '카피 생성 중', '최종 정리'],
  channel: ['채널 데이터 수집', '채널 분석 중', '전략 수립'],
  strategy: ['데이터 집계', 'AARRR 분석 중', '전략 수립'],
  general: ['데이터 수집', 'AI 분석 중', '전략 완성'],
}

// ── 메인 executor ─────────────────────────────────────────────────────────────

export async function growthExecutor(ctx: ExecutorContext): Promise<void> {
  const { agent, task, db, send } = ctx

  const track = classifyTask(task)
  const trackLabel = TRACK_LABELS[track]
  const stages = TRACK_STAGES[track]

  send('stage', { stage: 'collecting', label: stages[0] + '...' })
  await saveFeedItem(db, agent.id, 'info', `📈 Growth Bot 시작 [${trackLabel}]: ${task}`)

  // ── 운영 지표 수집 (비용/실행 이력) ────────────────────────────────────
  const costData = await db.query(
    `SELECT SUM(cost_usd) as total_cost, COUNT(*) as runs,
            SUM(input_tokens) as total_input, SUM(output_tokens) as total_output
     FROM token_usage WHERE mission_id = $1`,
    [agent.mission_id]
  )
  const feedData = await db.query(
    `SELECT COUNT(*) as total, type FROM feed_items
     WHERE agent_id IN (SELECT id FROM agents WHERE mission_id = $1)
     GROUP BY type`,
    [agent.mission_id]
  )
  const researchData = await db.query(
    `SELECT COUNT(*) as total, filter_decision FROM research_items
     WHERE mission_id = $1 GROUP BY filter_decision`,
    [agent.mission_id]
  )
  const recentRuns = await db.query(
    `SELECT h.status, COUNT(*) as cnt, a.role
     FROM heartbeat_runs h
     JOIN agents a ON h.agent_id = a.id
     WHERE a.mission_id = $1 AND h.started_at > datetime('now', '-7 days')
     GROUP BY h.status, a.role`,
    [agent.mission_id]
  )

  const metrics = {
    비용현황: {
      총비용_USD: (costData.rows as any[])[0]?.total_cost?.toFixed(4) ?? 0,
      총실행횟수: (costData.rows as any[])[0]?.runs ?? 0,
    },
    피드현황: feedData.rows,
    리서치현황: researchData.rows,
    최근7일_실행: recentRuns.rows,
  }

  send('stage', { stage: 'analyzing', label: stages[1] + '...' })

  const systemPrompt = SYSTEM_PROMPTS[track]
  const contextStr = JSON.stringify(metrics, null, 2)

  let userMessage: string
  if (track === 'general' || track === 'strategy') {
    userMessage = `태스크: ${task}

현재 운영 지표:
${contextStr}

위 데이터를 바탕으로 ${trackLabel}을 수행해주세요.`
  } else {
    userMessage = `태스크: ${task}

제품/서비스 운영 현황:
${contextStr}

${trackLabel}을 수행해주세요. 비개발자 1인 창업자도 바로 실행할 수 있도록 구체적으로 작성하세요.`
  }

  const result = await streamClaude(ctx, systemPrompt, userMessage, HAIKU_MODEL)

  send('stage', { stage: 'done', label: stages[2] + ' 완료' })
  await saveFeedItem(db, agent.id, 'result', result, track === 'strategy') // 전략은 승인 필요
  send('growth_done', { track, preview: result.slice(0, 200) })
}
