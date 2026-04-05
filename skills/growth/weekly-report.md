# /weekly-report — 주간 성장 지표 보고서 자동 생성

Supabase/PostgreSQL, PostHog, Stripe/Toss, Google Analytics 4에서 지난 주 데이터를 수집하여 성장 지표 대시보드 보고서를 생성한다. 전주 대비 변화, 이상 감지, 액션 아이템까지 포함한다.

## 실행 단계

1. **데이터 소스 연결 확인**
   `C:/oomni-data/config/analytics.json` 읽기:
   ```json
   {
     "supabase_url": "...",
     "supabase_key": "...",
     "posthog_api_key": "...",
     "posthog_project_id": "...",
     "ga4_property_id": "...",
     "stripe_key": "sk_live_...",
     "toss_key": "..."
   }
   ```

2. **사용자 지표 수집 (DB)**
   Supabase/Prisma 쿼리:
   - 신규 가입자 수 (일별, 채널별)
   - 총 사용자 수 (누적)
   - DAU, WAU, MAU
   - 리텐션: D1, D7, D30
   - 이탈 사용자 수

3. **수익 지표 수집**
   Stripe/Toss API:
   - MRR (Monthly Recurring Revenue)
   - 이번 주 신규 결제 건수 및 금액
   - 이번 주 취소/환불 건수 및 금액
   - ARR (Annual Recurring Revenue)
   - 플랜별 구독자 수
   - ARPU (Average Revenue Per User)

4. **제품 사용 지표 수집 (PostHog)**
   - 핵심 기능별 사용 횟수
   - 가장 많이 사용된 기능 TOP 5
   - 가장 적게 사용된 기능 (개선 필요)
   - 온보딩 완료율
   - 세션 길이 평균

5. **트래픽 지표 수집 (GA4)**
   - 총 방문자 수 (세션)
   - 신규 vs 재방문 비율
   - 유입 채널별 분석
   - 전환율 (방문 → 가입)
   - 이탈률

6. **전주 대비 비교 분석**
   모든 지표에 대해:
   - 절대값 변화 (+/-)
   - 퍼센트 변화 (%)
   - 트렌드 방향 (상승/하락/유지)
   - 이상 감지: ±20% 이상 변화 시 경고 플래그

7. **전환 퍼널 분석**
   각 단계별 전환율:
   ```
   방문 → 회원가입 → 온보딩 완료 → 첫 기능 사용 → 유료 전환
   ```

8. **액션 아이템 도출**
   - 하락한 지표 상위 3개 → 원인 가설 + 개선 방안
   - 상승한 지표 상위 3개 → 성공 요인 분석 + 확대 방안
   - 다음 주 집중 실험 1가지

9. **보고서 파일 저장 및 발송**

## 출력 형식

### 주간 보고서 (`weekly-report_YYYY-WW.md`)

```markdown
# 주간 성장 보고서 — YYYY년 MM월 DD일 주차

> **리포트 기간**: YYYY-MM-DD ~ YYYY-MM-DD

---

## 핵심 요약 (30초 버전)

| 지표 | 이번 주 | 전주 | 변화 |
|------|---------|------|------|
| 신규 가입 | 47명 | 38명 | ▲23.7% 🟢 |
| MRR | ₩2,480,000 | ₩2,210,000 | ▲12.2% 🟢 |
| DAU | 124명 | 118명 | ▲5.1% 🟢 |
| D7 리텐션 | 41% | 38% | ▲3%p 🟢 |
| 유료 전환율 | 8.5% | 7.2% | ▲1.3%p 🟢 |

---

## 수익 지표

### MRR 현황
- **MRR**: ₩2,480,000 (전주 대비 +₩270,000)
- **ARR**: ₩29,760,000
- **신규 MRR**: ₩420,000 (신규 구독 N건)
- **취소 MRR**: ₩150,000 (취소 N건)
- **순 MRR 증가**: +₩270,000

### 플랜별 현황
| 플랜 | 구독자 | 비율 |
|------|--------|------|
| Starter | 45명 | 52% |
| Pro | 32명 | 37% |
| Enterprise | 9명 | 11% |

---

## 사용자 지표

### 가입 채널별 신규 유입
| 채널 | 명 | 비율 |
|------|-----|------|
| 자연 검색 | 18 | 38% |
| 소셜(트위터) | 12 | 26% |
| 직접 유입 | 9 | 19% |
| 레퍼럴 | 8 | 17% |

---

## ⚠️ 이상 감지

- 🔴 **모바일 이탈률 급증** (+28%): 모바일 UI 이슈 가능성
- 🟡 **Pro 플랜 취소 증가** (+2건): 이탈 인터뷰 필요

---

## 다음 주 집중 실험

**가설**: 온보딩 체크리스트 추가 시 D7 리텐션 5%p 상승
**실험 방법**: A/B 테스트 (체크리스트 있음/없음)
**측정 기간**: 14일
**성공 기준**: D7 리텐션 44% 이상
```

### JSON 데이터 파일 (`weekly-report_YYYY-WW.json`)

```json
{
  "week": "YYYY-WW",
  "period": { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" },
  "revenue": {
    "mrr": 2480000,
    "mrr_change_pct": 12.2,
    "arr": 29760000,
    "new_mrr": 420000,
    "churned_mrr": 150000
  },
  "users": {
    "new_signups": 47,
    "new_signups_change_pct": 23.7,
    "total_users": 1240,
    "dau": 124,
    "wau": 312,
    "mau": 890
  },
  "retention": { "d1": 68, "d7": 41, "d30": 22 },
  "conversion": { "visit_to_signup": 4.2, "signup_to_paid": 8.5 },
  "alerts": [
    { "metric": "mobile_bounce_rate", "severity": "high", "change_pct": 28 }
  ]
}
```

## 저장 위치

- `C:/oomni-data/growth/weekly-report_YYYY-WW.md`
- `C:/oomni-data/growth/weekly-report_YYYY-WW.json`
- `C:/oomni-data/logs/weekly-report-fetch_YYYY-WW.log`

## 추가 인자

`$ARGUMENTS` — 선택적으로 다음을 지정할 수 있다:
- `--week YYYY-WW` : 특정 주차 (기본값: 지난 주)
- `--send telegram` : Telegram 발송
- `--send slack` : Slack 발송
- `--compare 4w` : 최근 4주 추세 포함
- `--kpis mrr,dau,retention` : 집중 지표 선택
- 예시: `/weekly-report --send telegram --compare 4w`
