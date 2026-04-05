# /weekly-brief — CEO 주간 브리핑 자동 생성 및 발송

모든 봇이 생성한 지난 주 결과물을 집계하여 경영자가 5분 안에 전체 상황을 파악할 수 있는 주간 브리핑을 생성한다. 수익 지표, 콘텐츠 성과, 코드 배포, 성장 통계를 하나의 문서로 통합하고 Telegram/Slack으로 발송한다.

## 실행 단계

1. **지난 주 파일 전체 수집**
   날짜 범위: 지난 월요일 ~ 일요일

   **Research Bot 결과물**:
   - `C:/oomni-data/research/digest/weekly-digest_YYYY-WW.json`
   - `C:/oomni-data/research/reports/report_*.json` (지난 주 파일)

   **Growth Bot 결과물**:
   - `C:/oomni-data/growth/weekly-report_YYYY-WW.json`
   - `C:/oomni-data/growth/segments/segment-data_*.json` (최신)

   **Content Bot 결과물**:
   - `C:/oomni-data/content/blog/blog-draft_*.md` (지난 주 발행)
   - `C:/oomni-data/content/twitter/thread_*.md` (지난 주)
   - `C:/oomni-data/content/newsletter/newsletter-config_*.json` (지난 주)

   **Build Bot 결과물**:
   - `C:/oomni-data/build/components/component-log_*.json` (지난 주)
   - `C:/Users/장우경/oomni/backend/` git log (지난 주 커밋 수, 주요 메시지)

   **Ops Bot 결과물**:
   - `C:/oomni-data/ops/costs/cost-audit_*.md` (최신)
   - `C:/oomni-data/ops/incidents/index.json` (지난 주 장애)
   - `C:/oomni-data/ops/n8n-workflows/` (지난 주 생성된 워크플로우)

2. **수익/성장 지표 추출**
   `growth/weekly-report_YYYY-WW.json`에서:
   - MRR, MRR 변화율
   - 신규 가입자, 누적 가입자
   - DAU, WAU
   - D7 리텐션
   - 유료 전환율, 이탈률

3. **콘텐츠 성과 집계**
   - 게시된 블로그 포스트 수 및 제목
   - 발행된 트위터 스레드 수
   - 발송된 뉴스레터 호수
   - 숏폼 영상 업로드 수

4. **코드/제품 진행 상황**
   ```bash
   git -C "C:/Users/장우경/oomni/backend" log --oneline --since="7 days ago"
   ```
   - 커밋 수 및 주요 메시지 파싱
   - 생성된 새 컴포넌트/API 라우트 수

5. **운영 현황 집계**
   - 발생한 장애 수 및 MTTR
   - 생성된 n8n 워크플로우 수
   - 비용 감사 결과 (절감 가능액)

6. **이번 주 성과 하이라이트 TOP 3**
   모든 데이터에서 가장 인상적인 성과 선택

7. **이번 주 문제/리스크 목록**
   주의가 필요한 지표 및 상황

8. **다음 주 우선순위 TOP 5**
   모든 봇의 데이터를 종합한 집중 사항

9. **브리핑 문서 저장 및 발송**
   - Telegram: 요약 메시지 (4096자 이내 마크다운)
   - Slack: 구조화된 블록 메시지

## 출력 형식

### CEO 주간 브리핑 (`weekly-brief_YYYY-WW.md`)

```markdown
# CEO 주간 브리핑 — YYYY년 MM월 DD일 주차

> 생성: YYYY-MM-DD HH:mm KST | 봇 기여: Research ✅ Growth ✅ Content ✅ Build ✅ Ops ✅

---

## 이번 주 한 줄 요약

MRR ₩2,480,000 (+12.2%), 신규 가입 47명 (+23.7%), 콘텐츠 12건 발행, 코드 38커밋. 전반적으로 강한 한 주.

---

## 수익 & 성장

| 지표 | 이번 주 | 전주 | 변화 |
|------|---------|------|------|
| MRR | ₩2,480,000 | ₩2,210,000 | ▲12.2% 🟢 |
| 신규 가입 | 47명 | 38명 | ▲23.7% 🟢 |
| 누적 사용자 | 1,240명 | 1,193명 | +47명 |
| DAU | 124명 | 118명 | ▲5.1% |
| D7 리텐션 | 41% | 38% | ▲3%p 🟢 |
| 유료 전환율 | 8.5% | 7.2% | ▲1.3%p 🟢 |
| 이탈률 | 4.6% | 5.1% | ▼0.5%p 🟢 |

---

## 콘텐츠 & 마케팅

| 타입 | 건수 | 하이라이트 |
|------|------|-----------|
| 블로그 | 2건 | "AI 자동화 완벽 가이드" 발행 |
| 트위터 스레드 | 3건 | RT 214회 달성 |
| 뉴스레터 | 42호 | 발송 완료 |
| 숏폼 | 2개 | 업로드 완료 |

---

## 코드 & 제품

**커밋**: 38개 | **주요 완료**: 결제 시스템, 이메일 인증, 대시보드 성능(LCP 1.8s)

---

## 운영

장애: 1건 (SEV-2, 84분, 해결) | 비용: ₩487,000 (MRR 19.6%, ⚠️)

---

## 하이라이트 🏆
1. MRR 12.2% 성장 — 역대 최고 주간 성장률
2. 트위터 스레드 바이럴 — RT 214회
3. 결제 시스템 런치 완료

## 주의 ⚠️
1. 운영비 MRR 19.6% (목표 15%) → 비용 최적화 필요
2. 온보딩 이탈 71% → 개선 시작 필요
3. INC-2026-042 재발 방지 → 환경변수 체크리스트 구축

## 다음 주 TOP 5
1. 온보딩 7→3단계 축소
2. AI API 비용 최적화 (절감 ₩77,000/월)
3. 환경변수 배포 체크리스트 작성
4. Product Hunt 런치 준비 시작
5. 모바일 온보딩 UI 개선
```

### Telegram 메시지 (`weekly-brief-telegram_YYYY-WW.txt`)

```
📊 *OOMNI 주간 브리핑* — YYYY-MM-DD 주차

💰 *수익*: MRR ₩2,480,000 ▲12.2%
👥 *신규 가입*: 47명 ▲23.7%
📉 *이탈률*: 4.6% ▼0.5%p

📝 *콘텐츠*: 블로그 2 | 스레드 3(RT 214) | 뉴스 1 | 숏폼 2
💻 *코드*: 커밋 38 | 결제 런치 ✅

⚠️ *주의*: 운영비 과다(19.6%) | 온보딩 이탈(71%)
🎯 *다음주 #1*: 온보딩 7→3단계 축소

📄 전체: C:/oomni-data/ceo/weekly-brief_YYYY-WW.md
```

## 저장 위치

- `C:/oomni-data/ceo/weekly-brief_YYYY-WW.md`
- `C:/oomni-data/ceo/weekly-brief_YYYY-WW.json`
- `C:/oomni-data/ceo/weekly-brief-telegram_YYYY-WW.txt`

## 추가 인자

`$ARGUMENTS` — 선택적으로 다음을 지정할 수 있다:
- `--week YYYY-WW` : 특정 주차 (기본값: 지난 주)
- `--send telegram` : Telegram 발송
- `--send slack` : Slack 발송
- `--send all` : 모든 채널 발송
- `--include research,growth,content,build,ops` : 포함할 봇 지정
- 예시: `/weekly-brief --send all`
