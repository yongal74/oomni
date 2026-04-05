import { v4 as uuidv4 } from 'uuid'
import { streamClaude, saveFeedItem, type ExecutorContext } from './base'

const SYSTEM_PROMPT = `당신은 AI/스타트업 트렌드를 분석하는 리서치 전문가입니다.
주어진 키워드와 소스에서 수집된 정보를 분석하여:
1. 각 아이템의 신호 강도를 0-100으로 평가 (관련성, 최신성, 영향력 기준)
2. 핵심 인사이트를 한국어로 요약
3. 신호강도 70 이상: 즉시 주목해야 할 트렌드
4. 신호강도 40-69: 모니터링 필요
5. 신호강도 40 미만: 무시 가능

응답 형식 (반드시 준수):
각 아이템에 대해:
ITEM_START
title: [제목]
signal_score: [0-100 숫자]
summary: [2-3문장 한국어 요약]
tags: [태그1, 태그2, 태그3]
decision: [keep/watch/drop]
ITEM_END`

export async function researchExecutor(ctx: ExecutorContext): Promise<void> {
  const { agent, task, db, send } = ctx

  send('stage', { stage: 'collecting', label: '소스 수집 중...' })
  await saveFeedItem(db, agent.id, 'info', `🔬 Research Bot 시작: ${task}`)

  // Get existing research items that are pending for this mission
  const pendingItems = await db.query(
    `SELECT * FROM research_items WHERE mission_id = $1 AND filter_decision = 'pending' ORDER BY created_at DESC LIMIT 20`,
    [agent.mission_id]
  )
  const items = pendingItems.rows as Array<{ id: string; title: string; summary?: string; source_url?: string; tags: string }>

  let userMessage = `태스크: ${task}\n\n`

  if (items.length > 0) {
    send('stage', { stage: 'scoring', label: `${items.length}개 아이템 AI 채점 중...` })
    userMessage += `분석할 아이템 목록:\n`
    for (const item of items) {
      userMessage += `\n[${item.title}]\n${item.summary || item.source_url || '내용 없음'}\n`
    }
  } else {
    // No pending items - generate research based on task
    userMessage += `다음 주제로 최신 트렌드를 분석하고 인사이트를 제공해주세요. 실제 트렌드처럼 3-5개의 주목할 만한 아이템을 만들어주세요.`
  }

  send('stage', { stage: 'analyzing', label: 'Claude AI 분석 중...' })
  const fullOutput = await streamClaude(ctx, SYSTEM_PROMPT, userMessage)

  // Parse output and save to research_items
  const itemBlocks = fullOutput.split('ITEM_START').slice(1)
  let savedCount = 0

  for (const block of itemBlocks) {
    const endIdx = block.indexOf('ITEM_END')
    const content = endIdx > -1 ? block.slice(0, endIdx) : block

    const titleMatch = content.match(/title:\s*(.+)/)
    const scoreMatch = content.match(/signal_score:\s*(\d+)/)
    const summaryMatch = content.match(/summary:\s*(.+?)(?=tags:|decision:|ITEM|$)/s)
    const tagsMatch = content.match(/tags:\s*(.+)/)
    const decisionMatch = content.match(/decision:\s*(keep|watch|drop)/)

    if (titleMatch && scoreMatch) {
      const title = titleMatch[1].trim()
      const signal_score = parseInt(scoreMatch[1])
      const summary = summaryMatch ? summaryMatch[1].trim() : ''
      const tags = tagsMatch ? JSON.stringify(tagsMatch[1].split(',').map(t => t.trim())) : '[]'
      const filter_decision = decisionMatch ? decisionMatch[1] : (signal_score >= 70 ? 'keep' : signal_score >= 40 ? 'watch' : 'drop')

      // Check if this is an existing item to update
      const existingItem = items.find(i => i.title.toLowerCase().includes(title.toLowerCase().slice(0, 10)))

      if (existingItem) {
        await db.query(
          `UPDATE research_items SET signal_score=$1, summary=$2, tags=$3, filter_decision=$4 WHERE id=$5`,
          [signal_score, summary, tags, filter_decision, existingItem.id]
        )
      } else {
        const newId = uuidv4()
        await db.query(
          `INSERT INTO research_items (id, mission_id, source_type, title, summary, tags, signal_score, filter_decision) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [newId, agent.mission_id, 'keyword', title, summary, tags, signal_score, filter_decision]
        )
      }
      savedCount++
    }
  }

  send('stage', { stage: 'done', label: '완료' })
  await saveFeedItem(db, agent.id, 'result', `✅ 리서치 완료: ${savedCount}개 아이템 분석됨\n\n${fullOutput}`)
  send('research_done', { count: savedCount, mission_id: agent.mission_id })
}
