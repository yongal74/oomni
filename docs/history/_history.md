# OOMNI 작업 히스토리

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
