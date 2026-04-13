import { v4 as uuidv4 } from 'uuid'
import { streamClaude, saveFeedItem, HAIKU_MODEL, type ExecutorContext } from './base'

const SYSTEM_PROMPT = `당신은 AI/스타트업 트렌드를 분석하는 리서치 전문가 겸 SEO 전략가입니다.
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

export async function researchExecutor(ctx: ExecutorContext): Promise<void> {
  const { agent, task, db, send } = ctx

  send('stage', { stage: 'collecting', label: '소스 수집 중...' })
  await saveFeedItem(db, agent.id, 'info', `🔬 Research Bot 시작: ${task}`)

  send('stage', { stage: 'fetching', label: '트렌드 분석 중...' })

  const userMessage = `태스크: ${task}

다음 주제로 최신 AI/스타트업 트렌드를 분석하세요.
신호강도(signal_score)는 콘텐츠(60%) + SEO(40%) 기준으로 채점하세요.

소스 레이어별 분석:
🔴 실시간 (24-48h 선점): Google Trends 급상승, X/Twitter 트렌딩, YouTube 급상승, Reddit r/trending
🟡 중기 (1-4주): Product Hunt 신제품, Hacker News, TechCrunch, Reddit 커뮤니티
🟢 니치 롱테일: Quora 질문, Google 연관검색, 업계 뉴스레터, Reddit r/startups

퍼스트 무버 기회(first_mover: true)인 아이템을 상위에 배치하세요.
각 아이템은 ITEM_START / ITEM_END 블록으로 작성하세요.`

  send('stage', { stage: 'scoring', label: 'AI 신호 채점 중...' })
  const fullOutput = await streamClaude(ctx, SYSTEM_PROMPT, userMessage, HAIKU_MODEL)

  // ITEM_START/ITEM_END 블록 파싱 → DB 저장
  const itemBlocks = fullOutput.split('ITEM_START').slice(1)
  let savedCount = 0

  for (const block of itemBlocks) {
    const endIdx = block.indexOf('ITEM_END')
    const content = endIdx > -1 ? block.slice(0, endIdx) : block

    const titleMatch     = content.match(/title:\s*(.+)/)
    const scoreMatch     = content.match(/signal_score:\s*(\d+)/)
    const summaryMatch   = content.match(/summary:\s*([\s\S]+?)(?=tags:|seo_|first_mover:|ITEM|$)/)
    const tagsMatch      = content.match(/tags:\s*(.+)/)
    const firstMoverMatch = content.match(/first_mover:\s*(true|false)/i)

    if (!titleMatch || !scoreMatch) continue

    const title        = titleMatch[1].trim()
    const signal_score = Math.min(100, Math.max(0, parseInt(scoreMatch[1])))
    const summary      = summaryMatch ? summaryMatch[1].trim() : ''
    const rawTags      = tagsMatch ? tagsMatch[1].split(',').map(t => t.trim()) : []
    const isFirstMover = firstMoverMatch?.[1]?.toLowerCase() === 'true'
    if (isFirstMover) rawTags.push('🔴퍼스트무버')
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
      [uuidv4(), agent.mission_id, 'keyword', title, summary, tags, signal_score, 'pending']
    )
    savedCount++
  }

  await saveFeedItem(db, agent.id, 'result', `✅ 리서치 완료: ${savedCount}개 아이템 수집 (사람 소팅 필요)\n\n${fullOutput}`)
}
