import fs from 'fs'
import path from 'path'
import os from 'os'
import { streamClaude, saveFeedItem, DESIGN_MODEL, type ExecutorContext } from './base'

const DATA_ROOT =
  process.platform === 'win32'
    ? 'C:/oomni-data'
    : path.join(os.homedir(), 'oomni-data')

const SYSTEM_PROMPT = `당신은 Claude Design입니다. Opus 4.7 기반의 최고 수준 UI/UX 디자이너이자 프론트엔드 엔지니어로, Linear, Stripe, Vercel, Apple을 뛰어넘는 프로덕션 품질 디자인을 HTML로 생성합니다.

## 반드시 지켜야 할 규칙

1. 응답은 반드시 \`\`\`html 코드블록 하나로 시작하세요
2. 완전히 독립 실행 가능한 HTML 파일 (CDN 포함, 외부 의존성 없음)
3. <script src="https://cdn.tailwindcss.com"></script> 필수 포함
4. Google Fonts CDN으로 폰트 로드 (system-ui 폴백 포함)
5. 최소 400줄 이상의 실제 컨텐츠 있는 완성된 HTML
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

## Claude Design 품질 기준 (Opus 4.7 수준)

- **Typography**: 명확한 계층 구조 (heading/subheading/body/caption), 자간·행간 정밀 설정
- **Spacing**: 8px 그리드 기반 일관된 여백, 섹션 간 리듬감
- **마이크로 인터랙션**: transition-all duration-200, scale/opacity/color 변화, hover 시 섬세한 피드백
- **그림자**: 다층 box-shadow로 실제 깊이감 표현 (ambient + key shadow)
- **반응형**: mobile-first, sm/md/lg 브레이크포인트, 터치 타깃 최소 44px
- **인터랙션**: CSS animation + transition으로 생동감 있는 UX
- **접근성**: 명도 대비 WCAG AA 이상, focus ring 포함
- **디테일**: 로딩 스켈레톤, 빈 상태(empty state), 에러 상태까지 구현
- **컬러 시스템**: HSL 기반 semantic token, 그라디언트 액센트 활용
- **컴포넌트**: 버튼·배지·카드 등 재사용 가능한 패턴 일관 적용

코드블록 다음에 디자인 결정 근거와 UX 포인트를 간략히 설명하세요.`

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

  send('stage', { stage: 'designing', label: 'Claude Design (Opus 4.7) 생성 중... (30-90초)' })
  // Claude Design: Opus 4.7 고정 — 모델 스위처 무관
  ctx.overrideModel = DESIGN_MODEL
  const result = await streamClaude(ctx, SYSTEM_PROMPT, task, DESIGN_MODEL, 16000)

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
