# OOMNI — Product Requirements Document v1.0

**"딸깍 하나로 AI 팀이 일한다"**
*One-click Orchestration for Multi-agent Network Intelligence*

---

## 1. 제품 개요

### 배경
- **Solo Factory OS**: 사람이 스튜디오에서 직접 작업, AI가 보조 → 세팅 복잡, 수동 조작 많음
- **Paperclip**: 에이전트 자율 실행, 개발자 친화적 → 비기술자에겐 진입 장벽 높음
- **OOMNI**: 두 제품의 장점 결합 → 왕초보도 딸깍 하나로 AI 팀 운영

### 핵심 가치
> "AI 직원을 고용하고, 일 시키고, 보고 받는다. 코딩 없이."

### 타깃 유저
- 1인 창업자 / 솔로 프리랜서
- AI 툴 써본 적 있지만 자동화는 어려웠던 사람
- n8n, Zapier 세팅에 지쳐본 사람

---

## 2. 기술 아키텍처

### 핵심 원리 (Paperclip에서 검증된 방식)
```
에이전트 실행 = child_process.spawn("claude", ["--print", "-", "--output-format", "stream-json"])
세션 유지    = claude --resume <sessionId>  (컨텍스트 보존)
스케줄러     = setInterval 하트비트 (기본 60초)
봇 간 통신   = 공유 DB (embedded-postgres) + REST API
봇 신원 주입 = 환경변수 (OOMNI_API_URL, OOMNI_API_KEY, OOMNI_AGENT_ID)
```

### 스택
| 레이어 | 기술 | 이유 |
|---|---|---|
| Frontend | React + Vite + Tailwind | 빠른 개발, 다크 UI |
| Backend | Node.js + Express | 단일 프로세스, 심플 |
| DB | embedded-postgres | 설치 불필요, npx로 자동 초기화 |
| Auth | better-auth | 로컬 + 소셜 로그인 |
| AI 실행 | Claude Code CLI subprocess | Paperclip 검증 방식 |
| 패키징 | Electron (.exe) | 왕초보도 설치 가능 |
| 실시간 | WebSocket | 봇 활동 피드 |

### Solo Factory OS와 차이점
| | Solo Factory OS | OOMNI |
|---|---|---|
| DB | Firebase Firestore (클라우드) | embedded-postgres (로컬) |
| 실행 방식 | 사람이 직접 조작 | 봇이 자율 실행 |
| 세팅 | API키 여러 개, Firebase 설정 | API키 1개로 끝 |
| 스튜디오 | 탭 기반 수동 워크스페이스 | 봇이 역할별로 자동 처리 |

---

## 3. 봇 라인업

### 기본 제공 봇 6종
| 봇 | 역할 | 주요 기능 |
|---|---|---|
| 🔬 Research Bot | 정보 수집·분석 | 웹 크롤링, RSS, 경쟁사 분석, 트렌드 리서치 |
| 🔨 Build Bot | 코드 개발 | 코딩, PR 생성, 버그 수정, 테스트 실행 |
| 🎨 Design Bot | UI/디자인 | Pencil MCP로 .pen 생성, HTML/Tailwind 컴포넌트 |
| ✍️ Content Bot | 콘텐츠 제작 | 블로그, 뉴스레터, SNS, PPT 초안 |
| 📈 Growth Bot | 마케팅·성장 | SEO, 광고 카피, A/B 테스트, 이메일 캠페인 |
| ⚙️ Ops Bot | 운영·재무·모니터링 | 결제 추적(Stripe), 세무 정리(부가세/소득세 집계), 손익 리포트, 배포, 에러 모니터링, 일일 리포트 |

### 봇 간 협업 방식
```
Research Bot 완료
  → DB에 결과 저장
  → Content Bot 자동 wake ("리서치 결과로 블로그 작성해줘")
  → Content Bot 완료 → 사람에게 승인 요청
  → 승인 → Growth Bot이 발행/배포
```

### Ops Bot 세부 기능 (재무/세무 포함)
| 카테고리 | 기능 |
|---|---|
| **결제·수익** | Stripe 매출 집계, 구독 현황, MRR/ARR 자동 계산 |
| **세무·재무** | 부가세 과세표준 정리, 월별 손익계산서 자동 생성, 경비 분류 |
| **운영** | 서버 헬스 체크, 에러 모니터링(Sentry API), 배포 자동화 |
| **리포트** | 일일/주간/월간 운영 리포트 자동 생성 → 승인 후 이메일/슬랙 발송 |

> Ops Bot이 세무사 역할까지 — "이번 달 부가세 신고 기준 금액은 얼마입니다" 자동 정리

### n8n 연동 (Phase 2)
- **기본**: Claude Code만으로 모든 자동화 동작 (n8n 없어도 됨)
- **확장**: n8n 연결 시 더 다양한 트리거/액션 지원
  - 웹훅 수신 (Stripe 결제 완료 → 즉시 봇 wake)
  - 외부 앱 연동 (Gmail, Slack, Notion, Google Sheets)
  - 복잡한 멀티스텝 워크플로우 시각적 편집
- **UI**: Settings → 자동화 → "n8n 연결하기" 버튼 (선택사항으로 표시)
- **아키텍처**: OOMNI 서버에 `/webhooks` 엔드포인트 내장 → n8n이 이 엔드포인트를 트리거

### 추후 추가 (Phase 2)
- **CEO Bot**: 전체 봇 결과 종합, 일일/주간 보고서 자동 생성

---

## 4. 화면 구조

### 4-1. 온보딩 (2단계)
```
Step 1: 미션 입력
  "지금 만들고 있는 것을 한 줄로 설명해주세요"
  예: "AI 기반 영어 학습 앱을 만들고 있어요"

Step 2: API 키 입력
  Anthropic Claude API 키 (필수)
  → 완료! 첫 봇(Research Bot) 자동 생성 제안
```

### 4-2. 메인 대시보드
```
┌─────────────────────────────────────────────────────┐
│  OOMNI  [미션명]                  [+ 봇 추가] [설정]  │
├──────────────┬──────────────────────────────────────┤
│              │  KPI 카드 4개                         │
│  봇 목록     │  [실행중 3] [완료 12] [승인대기 2] [$4.2]│
│              ├──────────────────────────────────────┤
│  🔬 Research │                                      │
│  ● 실행중    │  실시간 피드                          │
│              │  ┌──────────────────────────────┐    │
│  🔨 Build    │  │ 🔬 Research Bot · 방금        │    │
│  ○ 대기      │  │ AI 트렌드 분석 완료            │    │
│              │  │ [블로그 변환] [저장] [무시]    │    │
│  🎨 Design   │  └──────────────────────────────┘    │
│  ○ 대기      │  ┌──────────────────────────────┐    │
│              │  │ ⚙️ Ops Bot · 3분 전           │    │
│  + 봇 추가   │  │ 이번주 비용 리포트 생성        │    │
│              │  │ [리포트 보기]                 │    │
│              │  └──────────────────────────────┘    │
└──────────────┴──────────────────────────────────────┘
탭: [피드] [티켓] [비용] [자동화 스케줄] [리포트]
```

### 4-3. 봇 설정 화면
- 봇 이름 / 역할 설명
- 실행 스케줄 (매시간 / 매일 9시 / 수동)
- 시스템 프롬프트 커스터마이징
- 연결된 트리거 (A 완료 시 자동 시작 등)
- 이번 달 사용 비용

### 4-4. 승인 인박스
- 봇이 혼자 결정 못하는 것들 모아서 표시
- 원클릭 승인 / 거절 / 수정 요청

---

## 5. 데이터 모델

```
missions        — 프로젝트 (미션명, 한줄 설명)
agents          — 봇 (role, schedule, systemPrompt, reportsTo, budgetCents)
heartbeat_runs  — 실행 기록 (agentId, status, cost, sessionId, output)
issues          — 태스크/티켓 (title, assigneeId, status, parentId)
feed_items      — 피드 항목 (type, content, requiresApproval)
cost_events     — 비용 추적 (agentId, tokens, costUsd)
schedules       — 자동화 스케줄 (agentId, cronExpr, trigger)
```

---

## 6. MVP 개발 범위 (Phase 1)

| 기능 | 우선순위 | 난이도 |
|---|---|---|
| 온보딩 2단계 | P0 | 낮음 |
| embedded-postgres 초기화 | P0 | 중간 |
| 봇 하트비트 엔진 | P0 | 높음 |
| 실시간 피드 (WebSocket) | P0 | 중간 |
| Research + Build 봇 기본 템플릿 | P0 | 중간 |
| 승인 인박스 | P1 | 중간 |
| 비용 추적 대시보드 | P1 | 낮음 |
| Content + Design + Growth + Ops 봇 | P1 | 중간 |
| 자동화 스케줄 UI | P2 | 중간 |
| Electron 패키징 | P2 | 낮음 |
| CEO Bot | P3 | 높음 |

---

## 7. UI 디자인 원칙

- 배경색: Solo Factory OS와 동일한 다크 테마 (`#0d0d0d` 기본, `#141414` 서피스)
- 액센트: 인디고/퍼플 계열 (기존 Solo Factory OS 톤 유지)
- 폰트: 기존 시스템 폰트 스택 유지
- 컴포넌트: 기존 Solo Factory OS의 카드/버튼/배지 스타일 계승

---

## 8. 성공 지표

- 온보딩 완료까지 **5분 이내**
- 첫 봇 실행 결과 확인까지 **10분 이내**
- 세팅 화면 수 **3개 이하**
- 코딩 없이 사용 가능 **100%**

---

*작성일: 2026-04-04*
*버전: 1.0*
