# OOMNI 작업 히스토리

---

## 2026-05-08 — v5.8.0 보안 강화 (내부 API 키 랜덤화 + 포트 바인딩 + Electron 샌드박스)

### 배경
상용화 플랜 수립 과정에서 4가지 보안 이슈 식별 → 즉시 수정.

### 변경 파일
| 파일 | 변경 내용 |
|---|---|
| `electron/main.js` | 앱 시작 시 랜덤 UUID 내부 API 키 자동 생성 + sandbox: true |
| `frontend/src/pages/OpsCenter.tsx` | 'dev-key' 하드코딩 fallback 제거 |
| `backend/src/index.ts` | server.listen 127.0.0.1 명시 바인딩 |
| `package.json` | v5.7.0 → v5.8.0 |
| `docs/index.html` | 다운로드 링크 v5.8.0 업데이트 |

### 세부 변경 사항

#### [1] 내부 API 키 랜덤화 (main.js)
- 기존: `'oomni-internal-dev-key-change-me!'` 예측 가능한 기본값 사용
- 변경: 프로덕션 시작 시 `crypto.randomUUID()` 자동 생성 → 재시작마다 새 키

#### [2] OpsCenter.tsx dev-key fallback 제거
- 기존: `?? 'dev-key'` 하드코딩 fallback
- 변경: 키 획득 실패 시 명시적 에러 throw → 연결 오류 메시지 표시

#### [3] Backend 127.0.0.1 바인딩
- 기존: `server.listen(port)` — `0.0.0.0` 기본값 (외부 네트워크 접근 가능)
- 변경: `server.listen(port, '127.0.0.1')` — 로컬호스트 전용

#### [4] Electron sandbox: true
- 기존: `sandbox: false` (preload Node API 필요 주석)
- 변경: `sandbox: true` — preload가 contextBridge/ipcRenderer만 사용하므로 안전

### 변경 없는 항목 (이미 안전)
- API 키: AES-256-GCM 암호화 적용됨
- CORS: file:// + localhost만 허용
- contextIsolation: true, nodeIntegration: false

### 배포
- GitHub Release v5.8.0: https://github.com/yongal74/oomni/releases/tag/v5.8.0
- 랜딩페이지 다운로드 링크 v5.8.0 업데이트

### 참고
→ [docs/dev-log/v5.8.0-dev-log.md](../dev-log/v5.8.0-dev-log.md)
→ [docs/상용화플랜.md](../상용화플랜.md)

---

## 2026-05-08 — v5.7.0 온보딩 색상 통일 + 사이드바 재구조화 + Ops Bot 카드 파싱 fix

### 배경
v5.6.0 실사용 테스트에서 3가지 문제 발견:
1. 온보딩 화면이 indigo(파란) 계열 — 서비스 본화면(주황 primary, 다크 배경)과 색상 불일치
2. 사이드바 순서 오류 — agents DB 봇 아이콘(research/content)이 대시보드·미션보드 위에 렌더됨
3. Ops Bot — AI 응답 후 왼쪽 프로세스 카드와 중앙 상세 패널이 채워지지 않음

### 변경 파일
| 파일 | 변경 내용 |
|---|---|
| `frontend/src/pages/OnboardingPage.tsx` | indigo 계열 → `primary(#D4763B)` + 서비스 다크 배경으로 전면 교체 |
| `frontend/src/components/layout/AppLayout.tsx` | NAV 3그룹 분리, 사이드바 순서 재구조화, Growth Bot·Ops Bot 이름 변경 |
| `frontend/src/pages/OpsCenter.tsx` | done 이벤트 조건 완화 + while 루프 후 fallback 파싱 추가 |
| `package.json` | v5.6.0 → v5.7.0 |
| `docs/index.html` | 다운로드 링크 v5.7.0으로 업데이트 |

### 세부 변경 사항

#### [1] 온보딩 색상 통일
- 루트 배경: `bg-[#060b18]` → `bg-[#0d0d0f]`
- 좌측 패널 그라디언트/보더: 파란 계열 → `#111113`/`#1c1c20`
- 모든 `indigo-600/500/400` → `primary`(`#D4763B`) / `primary-hover`
- 입력 필드·카드 배경: `#0d1525`/`#1c2440` → `#111113`/`#1c1c20`
- 뮤티드 텍스트: `#4a5580`/`#303a55` → `#52525b`/`#3f3f46`

#### [2] 사이드바 재구조화
- `NAV_ITEMS` → `TOP_NAV_ITEMS` / `BOT_NAV_ITEMS` / `UTIL_NAV_ITEMS` 3분할
- 렌더 순서: 로고 → **대시보드·미션보드** → 봇패널·동적봇 → **Growth Bot·Studio Bot·Ops Bot** → 유틸
- 이름 변경: 'Growth Studio' → 'Growth Bot', 'Ops Center' → 'Ops Bot'

#### [3] Ops Bot 프로세스 카드 파싱 fix
- SSE `done` 이벤트 조건 `&& parsed.text` 제거 → `parsed.text` 없어도 누적 fullText 사용
- `cardsSet` 플래그로 이중 파싱 방지
- while 루프 종료 후 fallback 파싱 추가 — done 이벤트 누락 시에도 카드 생성 보장

### 배포
- `npm run package` → `OOMNI Setup 5.7.0.exe`
- GitHub Release v5.7.0: https://github.com/yongal74/oomni/releases/tag/v5.7.0
- 랜딩페이지 `docs/index.html` 다운로드 링크 v5.7.0으로 업데이트

### 상세 기록
→ [docs/dev-log/v5.7.0-dev-log.md](../dev-log/v5.7.0-dev-log.md)

---

## 2026-05-06 — v5.6.0 OpsCenter 완전 재설계 + Studio Bot 플로팅 채팅

### 배경
v5.5.0까지의 OpsCenter는 좌측에 프로세스 목록을 두는 구조였으나, 사용자 피드백으로 패널 역할을 완전히 재정의.
- 빠른 실행/도메인 목록 → 상단 바로 이동
- Left 패널 → 기본 빈 상태, AI 결과로만 채워지는 동적 카드 공간
- Center 패널 → 선택된 카드의 상세 정보 (FIELD/설정/가이드)
- Studio Bot 채팅창 위치/설정 개선 3건

### 변경 파일
| 파일 | 변경 내용 |
|---|---|
| `frontend/src/pages/OpsCenter.tsx` | 3패널 완전 재작성 — 상단 드롭다운 바 + 동적 카드 Left + 상세 Center |
| `frontend/src/pages/StudioBotPage.tsx` | 채팅 플로팅, 폰트 크기 S/M/L/XL, 배경색 5가지 |
| `package.json` | v5.5.0 → v5.6.0 |
| `docs/index.html` | 다운로드 링크 v5.6.0으로 업데이트 |

### 세부 변경 사항

#### [1] OpsCenter — 상단 바 (신규)
- 도메인 6개(재무/세무/인사/IT/운영/법률) 작은 버튼 → 클릭 시 드롭다운으로 프로세스 목록 표시
- 빠른 실행 프롬프트 4개 버튼
- 클릭 시 우측 AI 채팅 입력창에 프롬프트 자동 주입 + focus

#### [2] OpsCenter — Left 패널 역할 변경
- 기존: 도메인별 프로세스 카드 항상 표시
- 변경: **기본 빈 상태** ("오른쪽 채팅에서 자동화 요청하면 카드 생성")
- AI 응답 완료 후 `process-cards` JSON 블록 파싱 → 번호+제목+역할설명+단계수 카드 자동 표시
- 카드 클릭 → Center에 상세 표시

#### [3] OpsCenter — Center 패널 역할 변경
- 기존: 빠른 시작 시나리오 아코디언 + STEP 체크리스트
- 변경: **기본 빈 상태**, Left 카드 선택 시 상세 표시
  - 실행 순서 체크리스트
  - FIELD / 설정값 테이블 (필드명 | 값 | 주의사항)
  - 주의사항 섹션 (amber 경고 박스)
  - 상세 가이드 (마크다운 렌더링)

#### [4] OpsCenter — AI 시스템 프롬프트 개선
- `process-cards` JSON 형식 응답 요청 추가
- AI 응답에서 n8n JSON + process-cards 동시 파싱

#### [5] Studio Bot — 채팅창 플로팅
- 기존: 결과 영역 하단 `shrink-0` 고정 패널
- 변경: `absolute bottom-6 left-1/2 -translate-x-1/2` 플로팅 (backdrop-blur, shadow-2xl)
- 좌측 패널 제외한 결과 영역 기준 좌우 중앙 위치

#### [6] Studio Bot — 폰트 크기 설정
- 좌측 패널 하단에 S/M/L/XL(11/13/15/17px) 버튼 추가
- 결과 영역 전체(`absolute inset-0`)에 `fontSize` 적용

#### [7] Studio Bot — 배경색 설정
- Dark/Navy/Slate/Carbon/Forest 5가지 색상 스와치
- 루트 div에 inline `background` style 적용

### 배포
- `npm run package` → `OOMNI Setup 5.6.0.exe`
- GitHub Release v5.6.0: https://github.com/yongal74/oomni/releases/tag/v5.6.0
- 랜딩페이지 `docs/index.html` 다운로드 링크 v5.6.0으로 업데이트

### 다음 할 일
- OpsCenter: AI 응답에서 `process-cards` JSON 실제 파싱 여부 실사용 테스트
- Studio Bot: 플로팅 채팅이 모든 모드(ui-proto/graphic/build)에서 자연스러운지 확인
- v5.2.0 빈 릴리즈 삭제: `gh release delete v5.2.0 --repo yongal74/oomni`

### 상세 기록
→ [docs/dev-log/v5.6.0-dev-log.md](../dev-log/v5.6.0-dev-log.md)

---

## 2026-05-05 — v5.5.0 5-Stage UI/UX 전면 개선

### 변경 파일
| 파일 | 변경 내용 |
|---|---|
| `frontend/src/pages/OpsCenter.tsx` | AX Clinic GuideClient 패턴 완성 (StepItem 토글, 3패널 재정비) |
| `frontend/src/pages/StudioBotPage.tsx` | 플로팅 챗 → 하단 고정 패널, VS Code 5개 테마 |
| `frontend/src/pages/GrowthStudio.tsx` | 4탭 (콘텐츠 생성/목록/리드/CDP ID-Graph), SettingsTab 삭제 |
| `frontend/src/components/bot/ResearchPanel.tsx` | 버튼 이모지 제거, highlight:false 통일, SerpAPI 소스 추가 |
| `frontend/src/components/bot/ContentPanel.tsx` | 문체/톤 5가지 버튼, 글자 수 슬라이더+조절 버튼 |
| `backend/src/services/realSourceFetcher.ts` | SerpAPI fetchSerpApi 추가 |
| `backend/src/db/seedResearchSources.ts` | SerpAPI 시드 (is_active:0 기본 비활성) |

### 세부 변경 사항

#### Stage 1 — OpsCenter AX Clinic 패턴 완성
- StepItem: emerald(완료)/indigo(미완료) 컬러 체계
- 3패널: 좌=도메인 섹션 헤더+카드(260px), 중=시나리오 아코디언+STEP카드(flex-1), 우=AI채팅+JSON(300px)

#### Stage 2 — Studio Bot 하단 고정 채팅 + VS Code 테마
- 플로팅(중앙 위치) → 하단 고정 shrink-0 패널 (h-160px/300px)
- VS Code 5개 테마: Dark+/One Dark/Dracula/Monokai/Light

#### Stage 3 — Growth Bot CDP ID-Graph 탭
- 4탭 구조, CDP 통합 프로파일 + 식별자(email/instagram/phone/cookie) 연결 뷰
- 더미 데이터 5건 (mission 없을 때 자동 표시)

#### Stage 4 — Research Bot SerpAPI + 버튼 정리
- 경쟁사동향·논문 버튼 이모지 제거, highlight:false 통일
- SerpAPI Google 검색 소스 추가 (SERP_API_KEY 환경변수 설정 후 활성화)

#### Stage 5 — Content Bot 문체/글자수 조절
- 문체 5가지: 캐주얼/격식체/권위형/공감형/유머
- 글자 수 슬라이더 + ±100 조절 버튼

### 배포
- `npm run package` → `OOMNI Setup 5.5.0.exe`
- GitHub Release v5.5.0: https://github.com/yongal74/oomni/releases/tag/v5.5.0
- 랜딩페이지 `docs/index.html` 다운로드 링크 v5.5.0으로 업데이트

### 상세 기록
→ [docs/dev-log/v5.5.0-dev-log.md](../dev-log/v5.5.0-dev-log.md)

---

## 2026-05-05 — v5.4.0 UI/UX 전면 개선 (8개 항목)

### 배경
v5.3.0 실사용 테스트 결과 5가지 UI/UX 문제 발견. 사용자 피드백을 기반으로 전면 정리.

### 변경 파일
| 파일 | 변경 내용 |
|---|---|
| `frontend/src/components/layout/AppLayout.tsx` | "Design Studio" → "Studio Bot" 명칭 변경 / 사이드바에서 구버전 design·build·ceo 봇 필터링 제거 |
| `frontend/src/router.tsx` | 구버전 design/build 봇 클릭 시 StudioBot으로 리다이렉트, ops → OpsCenter, ceo → 대시보드 |
| `frontend/src/pages/UnifiedBotPage.tsx` | Research Bot `noTerminal` 조건 추가 (터미널 패널 숨김) |
| `frontend/src/pages/StudioBotPage.tsx` | 플로팅 챗 개선, 그래픽 모드 Canva 통합 |
| `frontend/src/pages/OpsCenter.tsx` | AX Clinic 스타일 전면 재설계 |

### 세부 변경 사항

#### [1] Research Bot — 터미널 제거
- `UnifiedBotPage.tsx` 의 `noTerminal` 조건에 `role === 'research'` 추가
- 기존: Research 봇이 하단 XTerminal 패널을 노출
- 변경: Research 봇은 터미널 없이 순수 패널 UI만 표시

#### [2] 사이드바 정리 — 구버전 봇 제거
- `AppLayout.tsx`: `agents.filter(a => !['ceo', 'design', 'build'].includes(a.role))` 처리
- 사이드바 아이콘 바, 서브패널 BotSubPanel 양쪽 모두 적용
- CEO 봇은 완전 제거, 구버전 Design/Build 봇은 StudioBot으로 통합

#### [3] 명칭 변경 — "Design Studio" → "Studio Bot"
- `AppLayout.tsx` NAV_ITEMS의 label 변경
- 툴팁, 사이드바 네비게이션 모두 "Studio Bot"으로 표시

#### [4] 구버전 봇 라우팅 처리
- `router.tsx`에서 `BotPageRouter` 수정
- `design` / `build` 역할 봇 클릭 → `/dashboard/design-studio` 리다이렉트
- `ops` 역할 봇 클릭 → `/dashboard/ops` 리다이렉트
- `ceo` 역할 봇 클릭 → `/dashboard` 리다이렉트
- 더 이상 필요 없는 `PtyBotPage` import 제거

#### [5][6] StudioBotPage 플로팅 챗 개선
- 위치: `bottom-4 left-1/2` → **`top-1/2 left-1/2 -translate-y-1/2`** (작업영역 중앙)
- 높이: `h-[280px]` → **`h-[200px]`** (상하 크기 축소), 확장 시 `h-[500px]` → `h-[380px]`
- 너비: `w-[600px]` → `w-[560px]`, 확장 시 `w-[700px]` → `w-[640px]`
- "무엇을 만들고 싶으신가요?" 빈 상태 플레이스홀더 제거

#### [7] StudioBotPage — 그래픽 디자인 → Canva 통합
- 기존: Ideogram AI 이미지 생성이 주 기능
- 변경: **Canva가 주 기능**, Ideogram은 보조 기능으로 전환
- Canva 카테고리별 템플릿 직접 링크 제공
  - 인스타 카드뉴스, YouTube 썸네일, TikTok 커버, 마케팅 배너, 피치덱 슬라이드, 브랜드 로고
- "Canva 열기" 버튼 (새 탭) + 카테고리별 딥링크 그리드

#### [8] OpsCenter — AX Clinic 스타일 전면 재설계
**기획 원안 복원**: 왼쪽 프로세스 목록 + 중앙 단계 카드 + 오른쪽 AI 채팅

| 영역 | 기존 (v5.3) | 변경 (v5.4) |
|---|---|---|
| 상단 필터바 | T1~T7 버튼 + 업무 도메인 6개 버튼 (헷갈림) | **제거** |
| Left 패널 | 추상적 T-타입 카드 | **도메인별 아코디언** (재무/세무/인사/IT/운영/법률) + 구체적 프로세스 목록 |
| Center 패널 | 5단계 제네릭 가이드 | **선택된 프로세스의 구체적 단계 카드** (AX Clinic 스타일, 클릭으로 완료 체크) |
| Right 패널 | AI 채팅 (하단에 빠른 시작) | AI 채팅 + **빠른 시작 프롬프트 상단 배치** |
| 분류 방식 | T1~T7 필터가 메인 내비게이션 | T1~T7 태그가 각 프로세스 카드에 표시 |

**프로세스 데이터 구조**: 도메인별 총 16개 구체적 자동화 프로세스 정의
- 재무: ERP→회계 연동, 카드사 정산 통합, 실시간 손익, 지출 결의 승인
- 세무: 영수증 OCR 경비 처리, SCM↔ERP 코드 매핑
- 인사: 출퇴근→급여 연동, 이력서 ATS 파싱, 휴가 승인 자동화
- IT: 개인 PC 중앙 백업, 레거시↔신규 포맷 변환
- 운영: 카카오 주문 처리, 캠페인 성과 Slack 보고, 팀별 KPI 통합
- 법률: 계약서 자동 서명 요청, 법적 문서 중앙화

### 배포
- `npm run package` → `OOMNI Setup 5.4.0.exe` (136MB)
- GitHub Release v5.4.0: https://github.com/yongal74/oomni/releases/tag/v5.4.0
- 랜딩페이지 `docs/index.html` 다운로드 링크 v5.4.0으로 업데이트

### 다음 할 일
- v5.4.0 실사용 테스트 후 피드백 수집
- OpsCenter: 프로세스 선택 시 AI 채팅에 컨텍스트 자동 반영 동작 검증
- StudioBotPage: Canva 실제 사용 흐름 검증 (템플릿 링크 → 편집 → 결과물 가져오기)
- 잔여 단위 테스트 수정 (cdpTrigger, build.test, research.test 5개 실패 케이스)

---

## 2026-05-05 — v5.3.0 Growth Video Chain · SNS · Attribution · CDP ID Graph

### 작업 범위
Phase 5-1 ~ 5-4 전체 구현 + 단위 테스트 18개 + 보안 강화 + 빌드/배포

### 신규 파일
| 파일 | 역할 |
|---|---|
| `backend/src/services/klingService.ts` | Kling AI 영상 생성 (단일 클립 + 멀티클립 체인) |
| `backend/src/services/attributionService.ts` | 시간 감쇠 MTA Attribution Engine |
| `backend/src/services/cdpIdGraphService.ts` | CDP ID Graph + 리타겟 루프 |
| `backend/src/api/routes/sns.ts` | SNS OAuth 2.0 연결 (7채널) |
| `backend/src/api/routes/studio.ts` | Studio Bot 라우터 |
| `frontend/src/pages/StudioBotPage.tsx` | 2패널 Studio Bot UI |
| `backend/src/services/__tests__/*.test.ts` | 단위 테스트 3개 파일 (18 테스트) |

### 주요 버그 수정
- `triggerLimiter` 등록 순서 — rate limiter를 라우터보다 뒤에 붙여서 무효화되던 문제
- `video_url = COALESCE($3, video_url)` — with_video=false 시 기존 URL을 null로 덮어쓰던 문제
- SSRF: `generateSingleClip` 반환 URL도 검증 (이전엔 `downloadToFile`에만 있었음)

### 테스트 이슈 해결
- better-sqlite3 네이티브 바인딩 → Jest 인메모리 mock DB로 교체
- Fake Timer + UnhandledPromiseRejection → `.catch()` 즉시 attach 패턴으로 수정

### 배포
- `npm run package` → `OOMNI Setup 5.3.0.exe` (142MB)
- GitHub Release v5.3.0: https://github.com/yongal74/oomni/releases/tag/v5.3.0
- 랜딩페이지 `docs/index.html` 다운로드 링크 v5.3.0으로 업데이트

### 상세 기록
→ [docs/dev-log/v5.3.0-dev-log.md](../dev-log/v5.3.0-dev-log.md)

---

## 2026-05-05 — 랜딩페이지 v5.1.0 다운로드 404 수정

### 문제
랜딩페이지에서 Windows 다운로드 버튼 클릭 시 404 에러 발생.

### 근본 원인
1. `docs/index.html` — 다운로드 링크가 `v5.1.0`을 가리키고 있었으나 GitHub에 v5.1.0 릴리즈 자체가 없었음
2. `landing/index.html` — 아직 구버전 `v2.9.5` 링크를 가리키고 있었음
3. GitHub release 파일명 규칙: GitHub CLI(`gh`)로 업로드 시 공백이 점으로 자동 변환됨 (`OOMNI Setup 5.1.0.exe` → `OOMNI.Setup.5.1.0.exe`)

### 수정 내용

#### `docs/index.html`
- 다운로드 링크: `v5.1.0/OOMNI.Setup.5.1.0.exe`로 수정
- 버전 표시: `v5.1.0`
- 히어로 뱃지: `v5.1.0 출시 · Windows / macOS`

#### `landing/index.html`
- 다운로드 링크: `v2.9.5` → `v5.1.0/OOMNI.Setup.5.1.0.exe`로 수정
- 버전 표시: `v5.1.0`
- 히어로 뱃지: `v5.1.0 출시 · Windows / macOS`

#### `.bashrc`
- `cmd.exe /c "chcp 65001"` 주석 처리 — Claude Code bash 환경에서 shell 초기화 시 blocking 원인이었음

### 작업 순서 (수동 실행)
```
1. npm run package                          → dist-app\OOMNI Setup 5.1.0.exe 생성 (약 120MB)
2. git add docs/index.html landing/index.html
3. git commit -m "fix: 다운로드 링크 v5.1.0 파일명 수정"
4. git push
5. gh release create v5.1.0 "dist-app\OOMNI Setup 5.1.0.exe" --title "v5.1.0" --repo yongal74/oomni
```

### 결과
- GitHub release v5.1.0 생성 완료
- `https://github.com/yongal74/oomni/releases/download/v5.1.0/OOMNI.Setup.5.1.0.exe` 정상 응답 확인 (302 → CDN)
- 랜딩페이지 다운로드 버튼 정상 동작

### 다음 할 일
- v5.2.0 빈 릴리즈(assets 없음) 정리 필요: `gh release delete v5.2.0 --repo yongal74/oomni`
- bash 정상화 확인: Claude Code 재시작 후 bash 명령 테스트
