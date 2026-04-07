import fs from 'fs'
import path from 'path'
import os from 'os'
import { streamClaude, saveFeedItem, type ExecutorContext } from './base'

const SYSTEM_PROMPT = `당신은 시니어 풀스택 개발자입니다.
요청된 기능을 TypeScript/React/Node.js로 구현합니다.
코드는 실제로 작동해야 하며, 주요 로직을 포함해야 합니다.
응답 형식:
1. 구현 계획 (bullet points)
2. 코드 (파일별로 구분)
3. 테스트 방법`

// 워크스페이스 루트: Windows → C:/oomni-data/workspaces, 기타 → ~/oomni-data/workspaces
const DATA_ROOT =
  process.platform === 'win32'
    ? 'C:/oomni-data'
    : path.join(os.homedir(), 'oomni-data')

/**
 * AI 응답에서 코드 블록을 파싱해 파일로 저장합니다.
 * ````typescript // src/foo.ts` 또는 `// filename: src/foo.ts` 패턴을 인식합니다.
 * 파일명을 특정할 수 없는 블록은 result-<n>.md 로 저장합니다.
 */
function saveResultFiles(agentId: string, code: string): string[] {
  const workspaceDir = path.join(DATA_ROOT, 'workspaces', agentId)
  fs.mkdirSync(workspaceDir, { recursive: true })

  const savedPaths: string[] = []

  // 코드 블록 추출: ```<lang> (optional filename comment)\n<body>```
  const codeBlockRegex = /```(?:[a-z]*)\n([\s\S]*?)```/g
  let match: RegExpExecArray | null
  let blockIndex = 0

  while ((match = codeBlockRegex.exec(code)) !== null) {
    const body = match[1]

    // 파일명 힌트: 첫 줄이 `// src/foo.ts` 또는 `# src/foo.ts` 형식
    const firstLine = body.split('\n')[0].trim()
    const filenameHint = firstLine.match(/^(?:\/\/|#)\s*(.+\.\w+)\s*$/)

    let relPath: string
    if (filenameHint) {
      relPath = filenameHint[1].replace(/^[/\\]/, '') // 선행 슬래시 제거
    } else {
      blockIndex++
      relPath = `result-${blockIndex}.md`
    }

    const absPath = path.join(workspaceDir, relPath)
    fs.mkdirSync(path.dirname(absPath), { recursive: true })
    fs.writeFileSync(absPath, body, 'utf-8')
    savedPaths.push(relPath)
  }

  // 코드 블록이 없으면 전체 응답을 단일 파일로 저장
  if (savedPaths.length === 0) {
    const absPath = path.join(workspaceDir, 'result.md')
    fs.writeFileSync(absPath, code, 'utf-8')
    savedPaths.push('result.md')
  }

  return savedPaths
}

export async function buildExecutor(ctx: ExecutorContext): Promise<void> {
  const { agent, task, db, send } = ctx

  send('stage', { stage: 'planning', label: '구현 계획 수립 중...' })
  await saveFeedItem(db, agent.id, 'info', `🔨 Build Bot 시작: ${task}`)

  // Create issue for tracking
  const { v4: uuidv4 } = require('uuid')
  const issueId = uuidv4()
  await db.query(
    `INSERT INTO issues (id, mission_id, agent_id, title, status, priority) VALUES ($1,$2,$3,$4,$5,$6)`,
    [issueId, agent.mission_id, agent.id, task, 'in_progress', 'high']
  )
  send('issue_created', { issueId, title: task })

  send('stage', { stage: 'coding', label: 'AI 코드 생성 중...' })
  const code = await streamClaude(ctx, agent.system_prompt || SYSTEM_PROMPT, task)

  // 결과물을 워크스페이스에 파일로 저장
  send('stage', { stage: 'saving', label: '파일 저장 중...' })
  let savedFiles: string[] = []
  try {
    savedFiles = saveResultFiles(agent.id, code)
    send('files_saved', { files: savedFiles, workspaceDir: path.join(DATA_ROOT, 'workspaces', agent.id) })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    await saveFeedItem(db, agent.id, 'error', `파일 저장 실패: ${errMsg}`)
  }

  // Update issue to done
  await db.query(`UPDATE issues SET status = 'done' WHERE id = $1`, [issueId])

  send('stage', { stage: 'done', label: '완료' })
  const savedSummary = savedFiles.length > 0
    ? `\n\n---\n**저장된 파일 (${savedFiles.length}개)**\n${savedFiles.map(f => `- \`${f}\``).join('\n')}`
    : ''
  await saveFeedItem(db, agent.id, 'result', code + savedSummary)
  send('build_done', { issueId, savedFiles })
}
