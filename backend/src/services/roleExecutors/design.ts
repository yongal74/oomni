import { streamClaude, saveFeedItem, type ExecutorContext } from './base'

const SYSTEM_PROMPT = `당신은 전문 UI/UX 디자이너이자 프론트엔드 개발자입니다.
디자인 요청을 받으면 다음을 수행합니다:
1. 디자인 컨셉 및 구조 설명 (색상, 레이아웃, 타이포그래피)
2. Tailwind CSS 기반의 실제 구현 가능한 HTML/JSX 코드
3. 접근성(a11y) 및 반응형 고려사항

응답 형식:
## 디자인 컨셉
(색상 팔레트, 레이아웃 구조, 폰트 등 설명)

## 구현 코드
\`\`\`tsx
(실제 컴포넌트 코드)
\`\`\`

## 적용 방법
(설치 패키지, 설정 파일 변경사항 등)`

export async function designExecutor(ctx: ExecutorContext): Promise<void> {
  const { agent, task, db, send } = ctx

  send('stage', { stage: 'planning', label: '디자인 컨셉 구상 중...' })
  await saveFeedItem(db, agent.id, 'info', `🎨 Design Bot 시작: ${task}`)

  send('stage', { stage: 'designing', label: 'UI 디자인 생성 중...' })
  const result = await streamClaude(ctx, agent.system_prompt || SYSTEM_PROMPT, task)

  send('stage', { stage: 'done', label: '완료' })
  await saveFeedItem(db, agent.id, 'result', result)
  send('done_design', { preview: result.slice(0, 200) })
}
