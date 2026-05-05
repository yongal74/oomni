# OOMNI 작업 히스토리

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
