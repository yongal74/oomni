# OOMNI v3 — Feature ID 레지스트리

> 모든 커밋, WBS 항목, 코드 주석에 이 ID 사용

---

## DASH — 대시보드

| ID | 기능 | Phase | 상태 |
|---|---|---|---|
| DASH-01 | 대시보드 (봇 현황 + 피드 + TODO/DONE) | 1 | 🔲 |
| DASH-02 | 미션 생성/선택 | 1 | 🔲 |
| DASH-03 | 봇 추가 모달 (템플릿 선택) | 1 | 🔲 |
| DASH-04 | 승인 인박스 (피드 카드 내 승인/거절) | 1 | 🔲 |
| DASH-05 | 비용 탭 (월별 집계) | 1 | 🔲 |
| DASH-06 | 자동화 스케줄 탭 | 1 | 🔲 |
| DASH-07 | 리포트 탭 | 1 | 🔲 |
| DASH-08 | CEO Bot 통합 (대시보드 내 브리핑) | 1 | 🔲 |

---

## BOT — 봇

| ID | 기능 | Phase | 상태 |
|---|---|---|---|
| BOT-01 | Research Bot (웹 리서치, 경쟁사 분석, 트렌드) | 1 | 🔲 |
| BOT-02 | Build Bot (코딩, 버그수정, PTY 터미널) | 1 | 🔲 |
| BOT-03 | Design Bot (UI/UX, Pencil MCP) | 1 | 🔲 |
| BOT-04 | Content Bot (블로그, 뉴스레터, SNS) | 1 | 🔲 |
| BOT-05 | Growth Bot (SEO, 광고 카피, 마케팅) | 1 | 🔲 |
| BOT-06 | Ops Bot (운영 자동화, n8n JSON 생성) | 1 | 🔲 |
| BOT-07 | CEO Bot (전체 종합 보고서, Dashboard 통합) | 1 | 🔲 |
| BOT-08 | ProjectSetup Bot (스캐폴딩, 보일러플레이트) | 2 | 🔲 |
| BOT-09 | Env Bot (.env 관리, 환경변수 검증) | 2 | 🔲 |
| BOT-10 | SecurityAudit Bot (OWASP, 취약점 스캔) | 2 | 🔲 |
| BOT-11 | Build Bot 세분화 (Frontend/Backend/Infra) | 2 | 🔲 |

---

## DB — 데이터베이스

| ID | 기능 | Phase | 상태 |
|---|---|---|---|
| DB-01 | SQLite 단일 파일 DB (SCHEMA_SQL 재작성) | 1 | 🔲 |
| DB-02 | v2.x 감지 → 백업 + 리셋 Electron dialog | 1 | 🔲 |

---

## INT — 연동

| ID | 기능 | Phase | 상태 |
|---|---|---|---|
| INT-01 | Obsidian 아카이브 연동 (선택사항) | 1 | 🔲 |
| INT-02 | n8n 연동 (선택적 워크플로우 트리거) | 2 | 🔲 |

---

## OPS — Ops Bot 확장

| ID | 기능 | Phase | 상태 |
|---|---|---|---|
| OPS-01 | Ops Bot n8n JSON 자동 생성 | 1 | 🔲 |
| OPS-02 | CS 자동화 (이탈감지 + 자동이메일 + MRR) | 2 | 🔲 |

---

## SET — 설정

| ID | 기능 | Phase | 상태 |
|---|---|---|---|
| SET-01 | 설정 페이지 (Claude API 키) | 1 | 🔲 |
| SET-02 | PIN 전용 인증 (Google OAuth 제거) | 1 | 🔲 |

---

## ONB — 온보딩

| ID | 기능 | Phase | 상태 |
|---|---|---|---|
| ONB-01 | 온보딩 (미션명 + API키 2단계) | 1 | 🔲 |

---

## DEL — 삭제 작업

| ID | 삭제 대상 | Phase | 상태 |
|---|---|---|---|
| DEL-01 | `api/routes/n8n.ts` | 1 | 🔲 |
| DEL-02 | `api/routes/video.ts` | 1 | 🔲 |
| DEL-03 | `api/routes/payments.ts` | 1 | 🔲 |
| DEL-04 | `api/routes/cdp.ts` | 1 | 🔲 |
| DEL-05 | `api/routes/devtools.ts` | 1 | 🔲 |
| DEL-06 | `api/swagger.ts` | 1 | 🔲 |
| DEL-07 | `services/videoService.ts` | 1 | 🔲 |
| DEL-08 | `bots/n8n.ts` | 1 | 🔲 |
| DEL-09 | `bots/integration.ts` | 1 | 🔲 |
| DEL-10 | `pages/BotDetailPage.tsx` | 1 | 🔲 |
| DEL-11 | `pages/CeoBotPage.tsx` | 1 | 🔲 |
| DEL-12 | `pages/DevToolsPage.tsx` | 1 | 🔲 |
| DEL-13 | `components/bot/LiveStreamDrawer.tsx` | 1 | 🔲 |
| DEL-14 | `lib/firebase.ts` | 1 | 🔲 |

---

## 상태 범례

| 아이콘 | 의미 |
|---|---|
| 🔲 | 미시작 |
| 🔄 | 진행 중 |
| ✅ | 완료 |
| ❌ | 취소/제외 |
