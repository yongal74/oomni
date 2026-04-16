import { streamClaude, saveFeedItem, DEFAULT_MODEL, type ExecutorContext } from './base'

// ── 태스크 분류 ───────────────────────────────────────────────────────────────
type OpsTrack = 'n8n' | 'report' | 'finance' | 'monitor' | 'general'

function classifyTask(task: string): OpsTrack {
  const t = task.toLowerCase()
  if (t.includes('워크플로우') || t.includes('n8n') || t.includes('자동화') || t.includes('트리거') || t.includes('webhook')) return 'n8n'
  if (t.includes('리포트') || t.includes('보고서') || t.includes('report') || t.includes('요약')) return 'report'
  if (t.includes('비용') || t.includes('재무') || t.includes('예산') || t.includes('cost') || t.includes('token') || t.includes('토큰')) return 'finance'
  if (t.includes('모니터링') || t.includes('상태') || t.includes('에러') || t.includes('오류') || t.includes('알림')) return 'monitor'
  return 'general'
}

// ── 트랙별 시스템 프롬프트 ─────────────────────────────────────────────────────

const SYSTEM_N8N = `당신은 n8n 워크플로우 전문가입니다.
요청된 자동화를 정확한 n8n JSON 형식으로 생성합니다.

n8n 워크플로우 JSON 형식:
\`\`\`json
{
  "name": "워크플로우 이름",
  "nodes": [
    {
      "parameters": {},
      "id": "node-id",
      "name": "노드명",
      "type": "n8n-nodes-base.노드타입",
      "typeVersion": 1,
      "position": [x, y]
    }
  ],
  "connections": {
    "노드명": {
      "main": [[{"node": "다음노드명", "type": "main", "index": 0}]]
    }
  },
  "active": false,
  "settings": {}
}
\`\`\`

사용 가능한 주요 노드 타입:
- n8n-nodes-base.scheduleTrigger (스케줄)
- n8n-nodes-base.webhook (웹훅)
- n8n-nodes-base.httpRequest (HTTP 요청)
- n8n-nodes-base.slack (Slack)
- n8n-nodes-base.gmail (Gmail)
- n8n-nodes-base.notion (Notion)
- n8n-nodes-base.airtable (Airtable)
- n8n-nodes-base.if (조건 분기)
- n8n-nodes-base.set (데이터 변환)
- n8n-nodes-base.code (JavaScript 실행)

항상 유효한 JSON을 생성하고, 각 노드의 parameters를 구체적으로 채우세요.
워크플로우 설명을 JSON 앞에 먼저 작성하세요.`

const SYSTEM_REPORT = `당신은 운영 리포트 작성 전문가입니다.
수집된 데이터를 바탕으로 명확하고 실행 가능한 운영 보고서를 작성합니다.

보고서 형식:
## 📊 운영 현황 요약
[핵심 지표 3-5개, 전주 대비 변화 포함]

## ✅ 이번 주 완료 사항
[봇별 주요 성과]

## ⚠️ 주목할 이슈
[리스크와 병목 포인트]

## 🤖 봇별 실행 현황
[각 봇의 실행 횟수, 성공률, 주요 결과]

## 💰 AI 비용 현황
[총 비용, 봇별 비용, 예산 대비 사용률]

## 📋 다음 주 액션 아이템
[우선순위 순, 담당 봇 명시]`

const SYSTEM_FINANCE = `당신은 AI 운영 비용 분석 전문가입니다.
토큰 사용량과 비용 데이터를 분석하여 비용 최적화 방안을 제시합니다.

분석 형식:
## 💰 현재 비용 현황
[총 비용, 모델별 비용, 봇별 비용 분석]

## 📈 비용 추세
[일/주/월별 트렌드, 이상 사용 감지]

## 🎯 비용 최적화 기회
[모델 변경, 프롬프트 최적화, 실행 빈도 조정]

## ⚡ 즉시 절약 가능한 방법
[구체적 액션과 예상 절감액]

## 📅 예산 계획
[현재 추세 기반 월간/연간 예상 비용]`

const SYSTEM_MONITOR = `당신은 시스템 운영 모니터링 전문가입니다.
봇 실행 상태와 오류를 분석하여 안정성 개선 방안을 제시합니다.

분석 형식:
## 🟢 시스템 상태
[정상/경고/오류 항목 목록]

## 🔴 감지된 문제
[오류 유형, 발생 빈도, 영향도]

## 🔧 즉시 조치 사항
[우선순위 순 수정 방법]

## 📊 실행 통계
[봇별 성공률, 평균 실행 시간, 오류 패턴]

## 🚨 알림 설정 권장사항
[모니터링해야 할 임계값]`

const SYSTEM_GENERAL = `당신은 DevOps/운영 자동화 전문가입니다.
운영 자동화 계획을 수립하고 실행 가능한 방안을 제시합니다.

분석 형식:
1. 현황 파악
2. 리스크 식별
3. 자동화 가능 항목
4. 즉시 조치 사항`

// ── 메인 executor ─────────────────────────────────────────────────────────────

export async function opsExecutor(ctx: ExecutorContext): Promise<void> {
  const { agent, task, db, send } = ctx

  const track = classifyTask(task)
  send('stage', { stage: 'analyzing', label: '운영 현황 분석 중...' })
  await saveFeedItem(db, agent.id, 'info', `⚙️ Ops Bot 시작: ${task}`)

  // ── 데이터 집계 ────────────────────────────────────────────────────────────
  const costSummary = await db.query(
    `SELECT SUM(cost_usd) as total_cost, SUM(input_tokens) as total_input,
            SUM(output_tokens) as total_output, COUNT(*) as total_calls, model
     FROM token_usage WHERE mission_id = $1
     GROUP BY model ORDER BY total_cost DESC`,
    [agent.mission_id]
  )

  const runStats = await db.query(
    `SELECT a.name, a.role, h.status, COUNT(*) as cnt,
            MAX(h.started_at) as last_run
     FROM heartbeat_runs h
     JOIN agents a ON h.agent_id = a.id
     WHERE a.mission_id = $1
     GROUP BY a.name, a.role, h.status
     ORDER BY a.name, h.status`,
    [agent.mission_id]
  )

  const errorItems = await db.query(
    `SELECT f.content, f.created_at, a.name as agent_name
     FROM feed_items f
     JOIN agents a ON f.agent_id = a.id
     WHERE a.mission_id = $1 AND f.type = 'error'
     ORDER BY f.created_at DESC LIMIT 10`,
    [agent.mission_id]
  )

  const schedules = await db.query(
    `SELECT a.name, a.role, s.trigger_type, s.trigger_value, s.is_active
     FROM schedules s
     JOIN agents a ON s.agent_id = a.id
     WHERE a.mission_id = $1`,
    [agent.mission_id]
  )

  const opsData = {
    비용현황: costSummary.rows,
    실행통계: runStats.rows,
    최근오류: errorItems.rows,
    스케줄현황: schedules.rows,
  }

  const systemPrompt = track === 'n8n' ? SYSTEM_N8N
    : track === 'report' ? SYSTEM_REPORT
    : track === 'finance' ? SYSTEM_FINANCE
    : track === 'monitor' ? SYSTEM_MONITOR
    : SYSTEM_GENERAL

  let userMessage: string

  if (track === 'n8n') {
    send('stage', { stage: 'generating_workflow', label: 'n8n 워크플로우 생성 중...' })
    userMessage = `다음 자동화 워크플로우를 n8n JSON 형식으로 생성해주세요:

${task}

현재 사용 중인 봇/서비스:
${JSON.stringify((runStats.rows as any[]).map((r: any) => r.role).filter((v: string, i: number, a: string[]) => a.indexOf(v) === i), null, 2)}`
  } else {
    const trackLabel = track === 'report' ? '운영 리포트'
      : track === 'finance' ? '비용 분석'
      : track === 'monitor' ? '모니터링 리포트'
      : '운영 분석'
    send('stage', { stage: 'planning', label: `${trackLabel} 생성 중...` })
    userMessage = `운영 태스크: ${task}

현재 운영 데이터:
${JSON.stringify(opsData, null, 2)}

위 데이터를 바탕으로 ${trackLabel}을 작성해주세요.`
  }

  const result = await streamClaude(ctx, systemPrompt, userMessage, DEFAULT_MODEL)

  // n8n JSON 추출 및 전송
  if (track === 'n8n') {
    const jsonMatch = result.match(/```json\n([\s\S]+?)\n```/)
    if (jsonMatch) {
      send('n8n_workflow', { json: jsonMatch[1] })
    }
  }

  send('stage', { stage: 'done', label: '완료' })
  await saveFeedItem(db, agent.id, 'result', result)
  send('ops_done', { track, isN8nWorkflow: track === 'n8n' })
}
