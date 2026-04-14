import { streamClaude, saveFeedItem, type ExecutorContext } from './base'

// ── 시스템 프롬프트 ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT_BASE = `당신은 전문 콘텐츠 작가입니다.
리서치 데이터를 기반으로 고품질 콘텐츠를 한국어로 작성합니다.
타겟: B2B SaaS 스타트업 팀
톤: 전문적이지만 읽기 쉬운 스타일
항상 구체적인 인사이트와 실행 가능한 조언을 포함하세요.`

const SYSTEM_PROMPT_INFORMATIONAL = `당신은 전문 정보성 콘텐츠 작가입니다.
기술 트렌드, AI, 스타트업 생태계를 깊이 이해하고 독자에게 가치 있는 지식을 전달합니다.
타겟: 기술에 관심 있는 스타트업 팀, 개발자, 테크 리더
톤: 전문적이고 교육적이며 흥미롭게
항상 다음을 포함하세요:
- 핵심 인사이트 3-5개 (불릿 포인트)
- 실제 사례나 데이터 인용
- 독자 행동 권장사항 (Actionable Takeaways)
- 적절한 소제목으로 스캔 가능한 구조`

const SYSTEM_PROMPT_BUSINESS = `당신은 전략적 비즈니스 콘텐츠 전문가입니다.
시장 분석, 투자 인사이트, 사업 전략을 명확하고 설득력 있게 전달합니다.
타겟: 경영진, 투자자, 의사결정권자
톤: 권위 있고 데이터 기반이며 비즈니스 임팩트 중심
항상 다음을 포함하세요:
- 시장 현황 요약 (Executive Summary)
- 핵심 기회와 리스크 분석
- 재무/비즈니스 임팩트 예측
- 전략적 권고사항 (Strategic Recommendations)
- 명확한 다음 단계 (Next Steps)`

const SYSTEM_PROMPT_AIWX = `당신은 AIWX 블로그(https://aiwx2035.blogspot.com/)의 전문 에디터입니다.
AI와 기술 트렌드를 한국 독자에게 쉽고 흥미롭게 전달하는 블로그입니다.
스타일: 친근하면서도 전문적, SEO 최적화, 공유하고 싶은 콘텐츠
항상 다음 형식으로 완성된 포스팅 초안을 작성하세요:

[제목]
(클릭을 유도하는 SEO 최적화 제목)

[본문]
(서론 → 본론 → 결론 구조, 소제목 사용, 총 800-1200자)

[태그]
(쉼표로 구분된 5-10개 태그)

[발행 시간]
(YYYY-MM-DD HH:MM 형식, 현재 기준 최적 발행 시간 추천)

[신호 강도]
(HIGH / MEDIUM / LOW — 해당 콘텐츠의 바이럴 가능성 평가)`

// ── 파라미터 파싱 ─────────────────────────────────────────────────────────────

type OutputType = 'informational' | 'business' | 'default'
type Platform = 'aiwx_blog' | 'general' | 'sns'

function parseContentParams(task: string): { outputType: OutputType; platform: Platform; cleanTask: string } {
  let outputType: OutputType = 'default'
  let platform: Platform = 'general'
  let cleanTask = task

  // outputType 파싱
  const infoMatch = task.match(/\[outputType:(informational|business)\]/i)
  if (infoMatch) {
    outputType = infoMatch[1] as OutputType
    cleanTask = cleanTask.replace(infoMatch[0], '').trim()
  }

  // platform 파싱
  const platformMatch = task.match(/\[platform:(aiwx_blog|general|sns)\]/i)
  if (platformMatch) {
    platform = platformMatch[1] as Platform
    cleanTask = cleanTask.replace(platformMatch[0], '').trim()
  }

  // 자연어 힌트로도 파싱
  if (!infoMatch) {
    if (/정보성|기술|트렌드|뉴스레터|교육/i.test(task)) outputType = 'informational'
    else if (/사업성|비즈니스|투자|시장|리포트|브리핑|제안서/i.test(task)) outputType = 'business'
  }
  if (!platformMatch) {
    if (/aiwx|블로그|blogspot/i.test(task)) platform = 'aiwx_blog'
    else if (/sns|인스타|트위터|링크드인/i.test(task)) platform = 'sns'
  }

  return { outputType, platform, cleanTask }
}

function selectSystemPrompt(outputType: OutputType, platform: Platform, agentSystemPrompt: string): string {
  if (platform === 'aiwx_blog') return SYSTEM_PROMPT_AIWX
  if (outputType === 'informational') return SYSTEM_PROMPT_INFORMATIONAL
  if (outputType === 'business') return SYSTEM_PROMPT_BUSINESS
  return agentSystemPrompt || SYSTEM_PROMPT_BASE
}

// ── 정보성 산출물 프롬프트 빌더 ───────────────────────────────────────────────

function buildInformationalPrompt(cleanTask: string, researchContext: string): string {
  return `태스크: ${cleanTask}

산출물 유형: 정보성 콘텐츠
형식 요구사항:
- 기술 트렌드 블로그 포스트 OR 교육 콘텐츠 OR 뉴스레터 중 가장 적합한 형식 선택
- SEO를 고려한 제목 (H1)
- 핵심 인사이트 3-5개 (소제목 포함)
- 실제 사례/데이터 기반 근거
- 독자 액션 아이템 (Actionable Takeaways)
- 마무리 요약

${researchContext}`
}

// ── 사업성 산출물 프롬프트 빌더 ───────────────────────────────────────────────

function buildBusinessPrompt(cleanTask: string, researchContext: string): string {
  return `태스크: ${cleanTask}

산출물 유형: 사업성 콘텐츠
형식 요구사항:
- 시장 분석 리포트 OR 투자자 브리핑 OR 사업 제안서 중 가장 적합한 형식 선택
- Executive Summary (2-3문장)
- 시장 현황 및 기회 분석
- 경쟁 환경 분석
- 비즈니스 임팩트 및 재무 예측
- 전략적 권고사항 및 Next Steps
- 리스크 및 대응 방안

${researchContext}`
}

// ── AIWX 포스팅 프롬프트 빌더 ─────────────────────────────────────────────────

function buildAiwxPrompt(cleanTask: string, researchContext: string): string {
  return `태스크: ${cleanTask}

블로그: https://aiwx2035.blogspot.com/
요구사항:
- AIWX 블로그 스타일 (AI/기술 정보 중심, 한국 독자 최적화)
- 완성된 포스팅 초안 (제목/본문/태그/발행시간/신호강도 포함)
- 클릭률을 높이는 제목
- 공유하고 싶어지는 본문 구성
- 발행 최적 시간 추천 (한국 시간 기준, 트래픽 피크 고려)
- 신호 강도 평가 (HIGH/MEDIUM/LOW)

${researchContext}`
}

// ── 소팅 로직 ─────────────────────────────────────────────────────────────────

function buildSortingPrompt(items: Array<{ title: string; summary: string; tags: string; signal_score?: number }>): string {
  const itemsText = items.map((item, i) =>
    `${i + 1}. [신호강도: ${item.signal_score ?? 'N/A'}] ${item.title}: ${item.summary}`
  ).join('\n')

  return `다음 리서치 아이템들을 콘텐츠 제작 우선순위로 소팅하고, 각 아이템의 콘텐츠 포텐셜을 평가해주세요.

리서치 아이템:
${itemsText}

다음 형식으로 응답하세요:
## 콘텐츠 우선순위 소팅 결과

### 1순위 (HIGH — 즉시 제작 권장)
...

### 2순위 (MEDIUM — 이번 주 제작)
...

### 3순위 (LOW — 다음 주 이후)
...

## 추천 콘텐츠 방향성
(각 순위별 어떤 형식/각도로 콘텐츠를 만들면 좋을지 1-2문장)`
}

// ── 메인 익스큐터 ─────────────────────────────────────────────────────────────

export async function contentExecutor(ctx: ExecutorContext): Promise<void> {
  const { agent, task, db, send } = ctx

  send('stage', { stage: 'preparing', label: '리서치 데이터 로딩...' })
  await saveFeedItem(db, agent.id, 'info', `✍️ Content Bot 시작: ${task}`)

  // 파라미터 파싱
  const { outputType, platform, cleanTask } = parseContentParams(task)

  // Get kept research items (signal_score 포함)
  const researchItems = await db.query(
    `SELECT title, summary, tags, signal_score FROM research_items
     WHERE mission_id = $1 AND filter_decision = 'keep'
     ORDER BY signal_score DESC LIMIT 50`,
    [agent.mission_id]
  )
  const items = researchItems.rows as Array<{ title: string; summary: string; tags: string; signal_score?: number }>

  // 소팅 태스크 처리
  const isSortingTask = /소팅|정렬|우선순위|sort/i.test(cleanTask)
  if (isSortingTask && items.length > 0) {
    send('stage', { stage: 'writing', label: '콘텐츠 우선순위 분석 중...' })
    const sortingPrompt = buildSortingPrompt(items)
    const sortResult = await streamClaude(ctx, SYSTEM_PROMPT_BASE, sortingPrompt)
    send('stage', { stage: 'done', label: '완료' })
    await saveFeedItem(db, agent.id, 'result', sortResult)
    send('content_done', { preview: sortResult.slice(0, 200) })
    return
  }

  // 리서치 컨텍스트 빌드
  let researchContext = ''
  if (items.length > 0) {
    researchContext = `활용할 리서치 데이터 (신호강도 내림차순):\n`
    for (const item of items) {
      researchContext += `\n• [신호강도: ${item.signal_score ?? 'N/A'}] ${item.title}: ${item.summary}\n`
    }
  }

  // 시스템 프롬프트 선택
  const systemPrompt = selectSystemPrompt(outputType, platform, agent.system_prompt)

  // 유저 메시지 빌드
  let userMessage: string
  if (platform === 'aiwx_blog') {
    userMessage = buildAiwxPrompt(cleanTask, researchContext)
    send('stage', { stage: 'writing', label: 'AIWX 포스팅 초안 작성 중...' })
  } else if (outputType === 'informational') {
    userMessage = buildInformationalPrompt(cleanTask, researchContext)
    send('stage', { stage: 'writing', label: '정보성 콘텐츠 작성 중...' })
  } else if (outputType === 'business') {
    userMessage = buildBusinessPrompt(cleanTask, researchContext)
    send('stage', { stage: 'writing', label: '사업성 산출물 작성 중...' })
  } else {
    userMessage = `태스크: ${cleanTask}\n\n${researchContext}`
    send('stage', { stage: 'writing', label: 'AI 콘텐츠 생성 중...' })
  }

  const content = await streamClaude(ctx, systemPrompt, userMessage)

  send('stage', { stage: 'done', label: '완료' })
  await saveFeedItem(db, agent.id, 'result', content)
  send('content_done', {
    preview: content.slice(0, 200),
    outputType,
    platform,
  })
}
