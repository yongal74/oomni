import { v4 as uuidv4 } from 'uuid'
import { streamClaude, saveFeedItem, HAIKU_MODEL, type ExecutorContext } from './base'
import { readSettings } from '../../config'
import { fetchRealSources, parseDaysFromTask, type FetchedItem, type DbSource } from '../realSourceFetcher'
import { getRawDb } from '../../db/client'

function loadActiveSources(): DbSource[] {
  try {
    const rows = getRawDb()
      .prepare(`SELECT id, name, url, type, category, is_active FROM research_sources WHERE is_active = 1`)
      .all() as DbSource[]
    return rows
  } catch { return [] }
}

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

// ── task 문자열에서 트랙 파싱 ─────────────────────────────
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

// ── 트랙별 시스템 프롬프트 ────────────────────────────────

const SYSTEM_PROMPT_BUSINESS = `당신은 사업 기회와 시장 동향을 분석하는 비즈니스 리서치 전문가입니다.
아래에 실제 수집된 기사/트렌드 목록이 주어집니다. 이 중에서 비즈니스 임팩트가 높은 항목을 골라 분석하세요.

사전 필터링 조건 (하나 이상 충족 시만 포함):
- ROI/수익화 가능성이 명확한 신호
- 경쟁사 움직임 또는 시장 구조 변화
- 투자·M&A 관련 정보
- 신규 비즈니스 모델 또는 수익 구조
- SaaS/플랫폼/마켓플레이스 성장 지표

신호강도 채점 (0-100) — 비즈니스 트랙:
비즈니스 임팩트 (70점): 시장규모/성장성(25) + 수익화명확성(20) + 경쟁우위(15) + 실행가능성(10)
SEO 신호 (30점): CPC카테고리(15) + 검색의도(10) + 경쟁도(5)

응답 형식 (반드시 준수):
ITEM_START
title: [제목]
signal_score: [0-100]
summary: [2-3문장 한국어 요약]
tags: [태그1, 태그2, 태그3]
seo_volume: [low/medium/high]
seo_kd: [low/medium/high]
seo_cpc: [low/medium/high]
first_mover: [true/false]
source_url: [원본 URL]
ITEM_END`

const SYSTEM_PROMPT_INFORMATIONAL = `당신은 기술 트렌드와 학술·연구 동향을 분석하는 정보성 리서치 전문가입니다.
아래에 실제 수집된 기사/논문/트렌드 목록이 주어집니다. 교육적 가치와 확산성이 높은 항목을 골라 분석하세요.

사전 필터링 조건:
- 교육적 가치가 높고 독자에게 즉각 유용한 정보
- 최신 기술·연구 논문·오픈소스 발표
- 커뮤니티에서 활발히 논의되는 주제
- 개념·방법론·도구 사용법에 대한 명확한 설명 가치

신호강도 채점 (0-100) — 정보성 트랙:
정보 가치 (60점): 교육적가치(20) + 시의성(20) + 정확성(10) + 이해접근성(10)
확산성 (40점): 소셜공유가능성(20) + 검색의도일치(10) + 퍼스트무버(10)

응답 형식 (반드시 준수):
ITEM_START
title: [제목]
signal_score: [0-100]
summary: [2-3문장 한국어 요약]
tags: [태그1, 태그2, 태그3]
seo_volume: [low/medium/high]
seo_kd: [low/medium/high]
seo_cpc: [low/medium/high]
first_mover: [true/false]
source_url: [원본 URL]
ITEM_END`

const SYSTEM_PROMPT_DEFAULT = `당신은 AI/스타트업 트렌드를 분석하는 리서치 전문가 겸 SEO 전략가입니다.
아래에 실제 수집된 기사/트렌드 목록이 주어집니다. 퍼스트무버 SEO 관점에서 가장 시급한 항목을 골라 분석하세요.

신호강도 채점 (0-100):
콘텐츠 신호 (60점): 시장성(20) + 시의성(20) + 자동화가능성(15) + 콘텐츠확장성(5) — 내용(15)
SEO 신호 (40점): 검색의도(10) + 퍼스트무버(10) + CPC카테고리(10) + 경쟁도(5) + AIWX적합도(5)

응답 형식 (반드시 준수):
ITEM_START
title: [제목]
signal_score: [0-100]
summary: [2-3문장 한국어 요약]
tags: [태그1, 태그2, 태그3]
seo_volume: [low/medium/high]
seo_kd: [low/medium/high]
seo_cpc: [low/medium/high]
first_mover: [true/false]
source_url: [원본 URL]
ITEM_END`

// ── 수집된 기사 → Claude 입력 메시지 빌더 ────────────────

function buildUserMessage(task: string, items: FetchedItem[], track: string, days: number): string {
  const header = `태스크: ${task}\n기간: 최근 ${days}일\n수집된 기사 수: ${items.length}개\n\n`

  const itemList = items.slice(0, 60).map((item, i) => [
    `[${i + 1}] ${item.source}`,
    `제목: ${item.title}`,
    `날짜: ${item.published_at.slice(0, 10)}`,
    item.summary ? `요약: ${item.summary.slice(0, 200)}` : '',
    `URL: ${item.url}`,
  ].filter(Boolean).join('\n')).join('\n\n')

  const footer = `\n\n위 ${Math.min(items.length, 60)}개 기사 중 ${
    track === 'business' ? '비즈니스 임팩트' :
    track === 'informational' ? '교육적 가치와 확산성' :
    'SEO 퍼스트무버 기회'
  }가 높은 항목만 골라 ITEM_START/ITEM_END 형식으로 분석하세요. source_url은 반드시 원본 URL을 그대로 사용하세요.`

  return header + itemList + footer
}

// ── 파싱·저장 ─────────────────────────────────────────────

async function parseAndSave(
  ctx: ExecutorContext,
  fullOutput: string,
  track: 'business' | 'informational' | 'default',
  fetchedItems: FetchedItem[]
): Promise<number> {
  const { agent, db } = ctx
  const itemBlocks = fullOutput.split('ITEM_START').slice(1)
  let savedCount = 0

  // URL → FetchedItem 맵 (source_url 매칭용)
  const urlMap = new Map(fetchedItems.map(f => [f.url, f]))

  for (const block of itemBlocks) {
    const endIdx = block.indexOf('ITEM_END')
    const content = endIdx > -1 ? block.slice(0, endIdx) : block

    const titleMatch      = content.match(/title:\s*(.+)/)
    const scoreMatch      = content.match(/signal_score:\s*(\d+)/)
    const summaryMatch    = content.match(/summary:\s*([\s\S]+?)(?=tags:|seo_|first_mover:|source_url:|ITEM|$)/)
    const tagsMatch       = content.match(/tags:\s*(.+)/)
    const firstMoverMatch = content.match(/first_mover:\s*(true|false)/i)
    const sourceUrlMatch  = content.match(/source_url:\s*(https?:\/\/\S+)/)

    if (!titleMatch || !scoreMatch) continue

    const title        = titleMatch[1].trim()
    const signal_score = Math.min(100, Math.max(0, parseInt(scoreMatch[1])))
    const summary      = summaryMatch ? summaryMatch[1].trim() : ''
    const sourceUrl    = sourceUrlMatch?.[1]?.trim() ?? ''
    const isFirstMover = firstMoverMatch?.[1]?.toLowerCase() === 'true'

    // 원본 FetchedItem에서 source명 가져오기
    const fetchedItem  = urlMap.get(sourceUrl)
    const sourceName   = fetchedItem?.source ?? 'web'

    const rawTags = tagsMatch ? tagsMatch[1].split(',').map(t => t.trim()) : []
    if (isFirstMover) rawTags.push('🔴퍼스트무버')
    if (track === 'business') rawTags.push('📊사업성')
    if (track === 'informational') rawTags.push('💡정보성')
    const tags = JSON.stringify(rawTags)

    // 중복 체크 (1시간 이내 동일 제목 또는 URL)
    const existing = await db.query(
      `SELECT id FROM research_items WHERE mission_id = $1 AND (title = $2 OR source_url = $3) AND created_at > datetime('now', '-1 hours')`,
      [agent.mission_id, title, sourceUrl]
    )
    if ((existing.rows as unknown[]).length > 0) continue

    await db.query(
      `INSERT INTO research_items (id, mission_id, source_type, source_url, title, summary, tags, signal_score, filter_decision)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [uuidv4(), agent.mission_id, sourceName, sourceUrl, title, summary, tags, signal_score, 'pending']
    )
    savedCount++
  }

  return savedCount
}

// ── 메인 executor ─────────────────────────────────────────

export async function researchExecutor(ctx: ExecutorContext): Promise<void> {
  const { agent, task, db, send } = ctx

  const { track, cleanTask } = parseTrack(task)
  const days = parseDaysFromTask(cleanTask)

  const trackLabel =
    track === 'business'      ? '사업성 리서치' :
    track === 'informational' ? '정보성 리서치' :
    'Research Bot'

  const sourceCount =
    track === 'business'      ? '6개 소스 (TechCrunch, Product Hunt, Reddit...)' :
    track === 'informational' ? '9개 소스 (arXiv, MIT Tech Review, DEV.to, 국내 3곳...)' :
    '7개 소스 (TechCrunch, The Verge, Wired, HN, arXiv, GitHub...)'

  await saveFeedItem(db, agent.id, 'info', `🔬 ${trackLabel} 시작: ${cleanTask} (최근 ${days}일)`)
  send('stage', { stage: 'collecting', label: `${sourceCount} 실시간 수집 중...` })

  // 1단계: 활성 소스 읽기 + 실제 수집
  const activeSources = loadActiveSources()
  const fetchedItems = await fetchRealSources(track, cleanTask, days, activeSources.length > 0 ? activeSources : undefined)

  if (fetchedItems.length === 0) {
    await saveFeedItem(db, agent.id, 'info', `⚠️ 수집된 기사 없음 — 네트워크 또는 소스 점검 필요`)
    send('stage', { stage: 'done', label: '수집 결과 없음' })
    return
  }

  await saveFeedItem(db, agent.id, 'info', `📥 ${fetchedItems.length}개 기사 수집 완료 → AI 분석 시작`)
  send('stage', { stage: 'scoring', label: `${fetchedItems.length}개 기사 AI 분석 중...` })

  // 2단계: Claude로 분석 및 채점 (생성이 아닌 분석)
  const systemPrompt =
    track === 'business'      ? SYSTEM_PROMPT_BUSINESS :
    track === 'informational' ? SYSTEM_PROMPT_INFORMATIONAL :
    SYSTEM_PROMPT_DEFAULT

  const userMessage = buildUserMessage(cleanTask, fetchedItems, track, days)
  const fullOutput  = await streamClaude(ctx, systemPrompt, userMessage, HAIKU_MODEL)

  // 3단계: 파싱 및 DB 저장
  const savedCount = await parseAndSave(ctx, fullOutput, track, fetchedItems)

  await saveFeedItem(
    db, agent.id, 'result',
    `✅ ${trackLabel} 완료: ${fetchedItems.length}개 수집 → ${savedCount}개 선별 저장 (사람 2차 검토 필요)\n\n${fullOutput}`
  )

  sendCdpEvent('research_completed', {
    track,
    task_preview: cleanTask.slice(0, 200),
    fetched_count: fetchedItems.length,
    items_saved: savedCount,
    days,
    agent_id: agent.id,
    mission_id: agent.mission_id,
  }).catch(() => {})
}
