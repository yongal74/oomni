import { v4 as uuidv4 } from 'uuid'
import { streamClaude, saveFeedItem, type ExecutorContext } from './base'

const SYSTEM_PROMPT = `당신은 AI/스타트업 트렌드를 분석하는 리서치 전문가입니다.
주어진 주제로 최신 트렌드와 인사이트를 분석하여 아래 형식으로 3-7개의 아이템을 작성하세요.

응답 형식 (반드시 준수):
각 아이템에 대해 아래 블록을 사용하세요:
ITEM_START
title: [아이템 제목 (100자 이내)]
signal_score: [0-100 숫자만]
summary: [2-3문장 한국어 요약]
tags: [태그1, 태그2, 태그3]
ITEM_END

채점 기준 (0-100):
- 70 이상: 즉시 주목해야 할 트렌드
- 40-69: 모니터링 가치 있음
- 40 미만: 낮은 우선순위

블록 사이에 설명 텍스트를 추가해도 됩니다.`

export async function researchExecutor(ctx: ExecutorContext): Promise<void> {
  const { agent, task, db, send } = ctx

  send('stage', { stage: 'collecting', label: '소스 수집 중...' })
  await saveFeedItem(db, agent.id, 'info', `🔬 Research Bot 시작: ${task}`)

  send('stage', { stage: 'fetching', label: '콘텐츠 분석 중...' })

  const userMessage = `태스크: ${task}

다음 주제로 최신 AI/스타트업 트렌드를 분석하고 신호강도와 함께 아이템을 작성해주세요.
각 아이템은 ITEM_START / ITEM_END 블록으로 구분해주세요.`

  send('stage', { stage: 'scoring', label: 'AI 신호 채점 중...' })
  const fullOutput = await streamClaude(ctx, SYSTEM_PROMPT, userMessage)

  // Parse ITEM_START/ITEM_END blocks and save to DB as 'pending' (사람 소팅 필요)
  const itemBlocks = fullOutput.split('ITEM_START').slice(1)
  let savedCount = 0

  for (const block of itemBlocks) {
    const endIdx = block.indexOf('ITEM_END')
    const content = endIdx > -1 ? block.slice(0, endIdx) : block

    const titleMatch = content.match(/title:\s*(.+)/)
    const scoreMatch = content.match(/signal_score:\s*(\d+)/)
    const summaryMatch = content.match(/summary:\s*([\s\S]+?)(?=tags:|ITEM|$)/)
    const tagsMatch = content.match(/tags:\s*(.+)/)

    if (titleMatch && scoreMatch) {
      const title = titleMatch[1].trim()
      const signal_score = Math.min(100, Math.max(0, parseInt(scoreMatch[1])))
      const summary = summaryMatch ? summaryMatch[1].trim() : ''
      const tags = tagsMatch ? JSON.stringify(tagsMatch[1].split(',').map(t => t.trim())) : '[]'

      // Skip duplicates
      const existing = await db.query(
        'SELECT id FROM research_items WHERE mission_id = $1 AND title = $2',
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
  }

  await saveFeedItem(db, agent.id, 'result', `✅ 리서치 완료: ${savedCount}개 아이템 — 사람 소팅 필요\n\n${fullOutput}`)
}
