import fs from 'fs'
import path from 'path'
import os from 'os'
import { streamClaude, saveFeedItem, type ExecutorContext } from './base'

const DATA_ROOT =
  process.platform === 'win32'
    ? 'C:/oomni-data'
    : path.join(os.homedir(), 'oomni-data')

const SYSTEM_PROMPT = `당신은 세계 최고 수준의 UI/UX 디자이너이자 프론트엔드 엔지니어입니다.
Linear, Stripe, Vercel, Apple 수준의 프로덕션 품질 디자인을 HTML로 생성합니다.

## 반드시 지켜야 할 규칙

1. 응답은 반드시 \`\`\`html 코드블록 하나로 시작하세요
2. 완전히 독립 실행 가능한 HTML 파일 (CDN 포함, 외부 의존성 없음)
3. <script src="https://cdn.tailwindcss.com"></script> 필수 포함
4. Google Fonts CDN으로 폰트 로드 (system-ui 폴백 포함)
5. 최소 300줄 이상의 실제 컨텐츠 있는 완성된 HTML
6. Lorem ipsum 절대 금지 — 실제 맥락에 맞는 한국어 컨텐츠
7. 다크/라이트 모드 CSS 변수 사용: --color-bg, --color-surface, --color-primary, --color-text

## HTML 구조 (이 형식 정확히 따르기)

\`\`\`html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[페이지 제목]</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=[Font]:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --color-bg: [배경색];
      --color-surface: [서피스색];
      --color-primary: [주색상];
      --color-text: [텍스트색];
      --color-muted: [뮤트색];
      --radius: [보더반경];
      font-family: '[Font]', system-ui, sans-serif;
    }
    /* 추가 커스텀 CSS */
  </style>
</head>
<body style="background-color: var(--color-bg); color: var(--color-text);">
  <!-- 실제 풀페이지 컴포넌트 -->
</body>
</html>
\`\`\`

## 디자인 품질 기준

- **Typography**: 명확한 계층 구조 (heading/subheading/body/caption)
- **Spacing**: 8px 그리드 기반 일관된 여백
- **Hover 효과**: transition-all duration-200, scale/opacity/color 변화
- **그림자**: box-shadow로 깊이감 표현
- **반응형**: mobile-first, sm/md/lg 브레이크포인트
- **인터랙션**: CSS transition으로 자연스러운 애니메이션
- **접근성**: 명도 대비 WCAG AA 이상

코드블록 다음에 간략한 디자인 설명을 추가하세요.`

function saveDesignFile(agentId: string, html: string): string {
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 16).replace('T', '_').replace(':', '-')
  const dir = path.join(DATA_ROOT, 'design', `${dateStr}_${agentId.slice(0, 8)}`)
  fs.mkdirSync(dir, { recursive: true })
  const filePath = path.join(dir, 'preview.html')
  fs.writeFileSync(filePath, html, 'utf-8')
  return filePath
}

function extractHtml(text: string): string | null {
  // 완성된 코드블록 우선
  const complete = text.match(/```html([\s\S]*?)```/)
  if (complete) return complete[1].trim()
  // 닫히지 않은 블록도 추출 (모델이 중간에 끊긴 경우)
  const partial = text.match(/```html([\s\S]{100,})$/)
  if (partial) {
    const html = partial[1].trim()
    // </body>와 </html>이 없으면 보완
    if (!html.includes('</body>')) return html + '\n</body></html>'
    if (!html.includes('</html>')) return html + '\n</html>'
    return html
  }
  return null
}

export async function designExecutor(ctx: ExecutorContext): Promise<void> {
  const { agent, task, db, send } = ctx

  send('stage', { stage: 'planning', label: '디자인 컨셉 구상 중...' })
  await saveFeedItem(db, agent.id, 'info', `🎨 Design Bot 시작: ${task}`)

  send('stage', { stage: 'designing', label: '고품질 UI 생성 중... (30-60초)' })
  // 항상 HTML 생성 프롬프트 사용 (구버전 agent.system_prompt 무시), HTML 생성은 토큰 많이 필요
  const result = await streamClaude(ctx, SYSTEM_PROMPT, task, undefined, 16000)

  // HTML 추출 후 파일 저장
  const html = extractHtml(result)
  let savedPath: string | null = null
  if (html) {
    try {
      savedPath = saveDesignFile(agent.id, html)
      send('output', { chunk: `\n\n✅ 디자인 파일 저장됨: ${savedPath}` })
    } catch { /* 파일 저장 실패 무시 */ }
  }

  send('stage', { stage: 'done', label: '완료' })
  await saveFeedItem(db, agent.id, 'result', result)
  send('design_done', { preview: html?.slice(0, 500) ?? '', savedPath })
}
