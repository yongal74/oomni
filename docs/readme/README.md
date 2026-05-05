# OOMNI — 딸깍 하나로 AI 팀이 일한다

솔로 창업자를 위한 AI 에이전트 자동화 플랫폼. Research → Build → Design → Growth → Ops 봇이 파이프라인으로 연결되어 팀 없이 팀처럼 일합니다.

**현재 버전**: v5.1.0 | **플랫폼**: Windows 10/11 x64 | **다운로드**: [yongal74.github.io/oomni](https://yongal74.github.io/oomni/)

---

## 주요 기능

| 봇 | 역할 |
|----|------|
| 🔬 Research Bot | 웹 리서치, 경쟁사 분석, 트렌드 수집 |
| 🔨 Build Bot | Claude Code CLI 기반 코딩, 버그 수정, PR 생성 |
| 🎨 Design Bot | Pencil MCP 연동 UI 디자인 / SSE HTML 생성 |
| ✍️ Content Bot | 블로그, 뉴스레터, SNS 콘텐츠 |
| 📈 Growth Bot | SEO, 광고 카피, A/B 테스트 |
| ⚙️ Ops Bot | 운영 모니터링, 세무/재무 리포트 |
| 👔 CEO Bot | 전체 봇 현황 종합 브리핑 |

---

## 시작하기

### 요구사항
- Windows 10/11 x64
- [Anthropic API 키](https://console.anthropic.com) (Claude 사용)
- (선택) [Pencil](https://www.antigravity.dev/) — Design Bot PTY 모드 사용 시 (`~/.gemini/antigravity` 경로에 설치)

### 설치
1. [최신 릴리즈](https://github.com/yongal74/oomni/releases/latest)에서 `OOMNI Setup X.X.X.exe` 다운로드
2. 설치 후 실행
3. Google 소셜 로그인 또는 직접 진행
4. Settings → Claude API Key 입력 후 저장
5. 미션 생성 → 봇 추가 → 실행

---

## 개발 환경 설정

```bash
# 의존성 설치
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# 개발 서버 실행 (backend + vite + electron 동시)
npm run dev
```

### 환경변수 (backend/.env)
```
ANTHROPIC_API_KEY=sk-ant-...
PORT=3001
NODE_ENV=development
```

---

## 아키텍처

```
┌─────────────────────────────────────────────────┐
│                  Electron App                    │
│  ┌──────────────┐    ┌────────────────────────┐  │
│  │   Frontend   │    │    Backend (in-proc)   │  │
│  │  React+Vite  │◄──►│  Express + SQLite      │  │
│  │  :5173/:5174 │    │  :3001                 │  │
│  └──────────────┘    │  ┌──────────────────┐  │  │
│                      │  │ PTY WebSocket    │  │  │
│                      │  │ /api/agents/:id/ │  │  │
│                      │  │ terminal         │  │  │
│                      │  └──────────────────┘  │  │
│                      └────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### 핵심 구조
- **Electron**: `electron/main.js` → `require(backend/dist/index.js)` 인-프로세스 실행
- **Backend**: Express REST API + WebSocket (피드 `/ws`, PTY `/api/agents/:id/terminal`)
- **Frontend**: React + Zustand(상태) + React Query(서버 상태) + TailwindCSS
- **DB**: SQLite (`C:/oomni-data/oomni.db`) — PostgreSQL 호환 인터페이스

### Design Bot 실행 모드 (v2.9.5~)
```
기본값: LiveStreamDrawer (SSE) — HTML 생성 모드
   │
   └─ UI에서 "Pencil 모드로 전환" 버튼 클릭
         ▼
      XTerminal (PTY)
      Claude Code + Pencil MCP
```
> 자동 분기 방식은 v2.9.5에서 제거됨 (CLI 미숙 사용자 혼란 방지)

---

## 빌드 및 배포

```bash
# 백엔드 TypeScript 컴파일
cd backend && npm run build

# 프론트엔드 Vite 빌드
cd frontend && npm run build

# native 모듈 Electron ABI 재빌드 (better-sqlite3)
npm run rebuild-native

# Electron 패키지 빌드 → dist-app/OOMNI Setup X.X.X.exe
npx electron-builder

# GitHub Release 업로드
gh release create vX.X.X "dist-app/OOMNI Setup X.X.X.exe" --title "OOMNI vX.X.X"
```

---

## 프로젝트 구조

```
oomni/
├── electron/           # Electron main process
│   ├── main.js         # 앱 진입점, IPC 핸들러, 백엔드 in-process 실행
│   └── preload.js      # contextBridge (electronAPI 노출)
├── frontend/           # React 앱 (Vite)
│   └── src/
│       ├── pages/      # 페이지 컴포넌트
│       ├── components/ # 공통 컴포넌트 (bot/panels/...)
│       ├── lib/        # API 클라이언트, 유틸
│       └── store/      # Zustand 스토어
├── backend/            # Express 서버
│   └── src/
│       ├── api/routes/ # REST API 라우터
│       ├── services/   # ptyService, claudeCodeService, roleExecutors
│       ├── db/         # SQLite 클라이언트, 스키마, 마이그레이션
│       └── ws/         # WebSocket 서버 (피드 브로드캐스트)
├── skills/             # Claude Code 스킬 파일 (.md)
├── docs/               # GitHub Pages 랜딩페이지
└── dist-app/           # 빌드 출력 (gitignore)
```

---

## 데이터 위치

| 경로 | 내용 |
|------|------|
| `C:/oomni-data/oomni.db` | SQLite DB |
| `C:/oomni-data/workspaces/{agentId}/` | Build Bot 워크스페이스 |
| `C:/oomni-data/.claude/commands/` | Claude Code 스킬 |

---

## 릴리즈 히스토리

| 버전 | 주요 변경 |
|------|-----------|
| v5.1.0 | CDP ID-Graph Canvas (force-directed 그래프), OpsCenter T1~T7 자동화 카드 + AX Clinic 3-패널 워크플로우 디자이너, Onboarding 스플릿 스크린 재설계, POST /api/ops/chat SSE 엔드포인트, TS 수정 다수 |
| v4.2.0 | Build Bot 4-Track Harness (Architecture/Bootstrap/Review/Security), Security Gate 자동 스캔 |
| v4.0.1 | Design Bot 갤러리, CDP 통합, TaskBoard, 기술부채 제거 |
| v3.2.0 | 랜딩페이지 업데이트, 문서 동기화 |
| v3.0.2 | v3.0.0 안정화 패치 |
| v2.9.6 | CEO/Build bot role CHECK 제약 버그 수정, Reports mission_id 쿼리 수정, Schedules agent 존재 검증 추가, Pencil MCP 경로 수정 |
| v2.9.5 | CEO role DB 마이그레이션, Build Bot exit code 1 수정, 봇간 산출물 전달, Design Bot 수동 전환 |
| v2.9.3 | Build Bot WebSocket 오류 수정, CEO 봇 추가 실패 수정, Pencil 설치 버튼, Settings Claude API Key |

---

## 라이선스

Private — All rights reserved © 2025 OOMNI
