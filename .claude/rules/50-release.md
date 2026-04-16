# 50 — 릴리즈 체크리스트

## v3.0.0 릴리즈 전 필수 확인

### 빌드 전
- [ ] `tsc --noEmit` (backend) 오류 0건
- [ ] `tsc --noEmit` (frontend) 오류 0건
- [ ] 삭제 대상 14개 파일 모두 제거 확인
- [ ] `lib/firebase.ts` import 없음 확인
- [ ] n8n/video/cdp/payments import 없음 확인

### DB 확인
- [ ] 신규 설치 시 migration 체인 없이 SCHEMA_SQL 단일 실행
- [ ] v2.x DB 감지 → Electron dialog 동작
- [ ] 자동 백업 후 리셋 동작

### 기능 확인
- [ ] 온보딩 완료 < 5분
- [ ] 첫 봇 실행 결과 < 10분
- [ ] Research/Content/Growth 우측 패널 AI 채팅 동작
- [ ] 중앙 패널 결과 표시 동작
- [ ] Build/Design/Ops PTY 터미널 동작
- [ ] Dashboard CEO Bot 통합 동작

### 빌드 & 패키지
```bash
cd backend && npm run build
cd frontend && npm run build
npm run rebuild-native
npx electron-builder
```

### 릴리즈
```bash
git commit && git push
gh release create v3.0.0 "dist-app/OOMNI Setup 3.0.0.exe"
# docs/index.html 다운로드 링크 버전 업데이트
git push
```
