# /funnel-analysis — 전환 퍼널 분석 및 병목 지점 개선

PostHog, DB, GA4 데이터를 결합하여 전체 사용자 여정의 퍼널을 분석하고, 이탈이 가장 높은 병목 단계를 찾아 구체적인 개선 방안을 생성한다.

## 실행 단계

1. **퍼널 단계 정의**
   `C:/oomni-data/config/funnel.json` 읽기. 없으면 기본 퍼널 사용:

   ```json
   {
     "acquisition_funnel": [
       "landing_page_view",
       "signup_page_view",
       "signup_completed",
       "email_verified",
       "onboarding_started",
       "onboarding_completed",
       "first_feature_used",
       "paid_conversion"
     ],
     "activation_funnel": [
       "signup_completed",
       "profile_completed",
       "first_project_created",
       "first_automation_run",
       "result_seen"
     ]
   }
   ```

2. **퍼널 데이터 수집**
   PostHog API 쿼리 (지난 30일):
   - 각 이벤트별 unique 사용자 수
   - 코호트별 분석 (가입일 기준)
   - 디바이스 유형별 (모바일 vs 데스크탑)
   - 유입 채널별

3. **단계별 전환율 계산**
   각 인접 단계 간:
   - 절대 전환율 (전체 중 해당 단계 도달 %)
   - 상대 전환율 (이전 단계 중 다음 단계 도달 %)
   - 이탈 수 = 이전 단계 사용자 - 현재 단계 사용자
   - 이탈 가치 = 이탈 수 × 예상 LTV

4. **병목 지점 식별**
   - 가장 높은 이탈률 단계 TOP 3
   - 가장 큰 가치 손실 단계 (이탈 수 × LTV)
   - 개선 가능성 (이탈률이 높지만 수정이 쉬운 단계)

5. **세그먼트별 비교**
   동일 퍼널을 다음 기준으로 비교:
   - 디바이스 (모바일 vs 데스크탑)
   - 유입 채널 (SEO vs 소셜 vs 직접)
   - 사용자 플랜 (무료 vs 유료)
   - 가입 날짜 코호트 (주차별)

6. **이탈 원인 가설 생성**
   각 병목 단계에 대해:
   - 가능한 이탈 원인 3가지
   - 빠른 검증 방법
   - 예상 개선 효과

7. **개선 실험 우선순위**
   ICE 스코어 계산:
   - Impact (영향도): 개선 시 전환율 변화 예상치
   - Confidence (확신도): 원인이 맞을 가능성
   - Ease (용이도): 구현 난이도의 역수

   ICE 스코어 = Impact × Confidence × Ease

8. **개선 액션 플랜 생성**
   순위별 실험 계획:
   - 실험 내용
   - 구현 시간 예상
   - 성공 지표
   - A/B 테스트 연동 (ab-test.md 스킬과 체이닝)

## 출력 형식

### 퍼널 분석 리포트 (`funnel-analysis_YYYY-MM-DD.md`)

```markdown
# 전환 퍼널 분석 — YYYY-MM-DD

**분석 기간**: 최근 30일
**총 진입자**: 8,400명

---

## 전체 퍼널 현황

```
랜딩 페이지 방문      8,400명 (100%)
         │ 전환율: 21.4%
         ▼
회원가입 페이지 조회   1,800명 (21.4%)
         │ 전환율: 58.3%  ← ⚠️ 업계 평균 70%
         ▼
회원가입 완료         1,050명 (12.5%)
         │ 전환율: 82.1%
         ▼
이메일 인증 완료       862명 (10.3%)
         │ 전환율: 54.7%  ← 🔴 병목 #1 (가장 높은 이탈)
         ▼
온보딩 완료           472명 (5.6%)
         │ 전환율: 73.9%
         ▼
첫 기능 사용          349명 (4.2%)
         │ 전환율: 28.4%  ← 🔴 병목 #2 (가치 손실 최대)
         ▼
유료 전환              99명 (1.2%)
```

---

## 병목 지점 분석

### 🔴 병목 #1: 온보딩 완료 (이탈율 45.3%)
**이탈 수**: 390명/월
**이탈 가치**: 390명 × ₩42,000 LTV = **₩16,380,000/월 손실**

**가설**:
1. 온보딩이 너무 길고 복잡함 (현재 7단계)
2. 첫 번째 성공 경험까지 너무 시간 걸림
3. 모바일에서 온보딩 UX 불량 (모바일 이탈 71%)

**빠른 검증**:
- PostHog Session Recording으로 온보딩 이탈 구간 파악
- 사용자 인터뷰 3명 진행

**예상 개선 효과**: 온보딩 단계 3단계로 압축 시 전환율 +10%p 예상

---

### 🔴 병목 #2: 첫 기능 사용 (이탈율 71.6%)
**이탈 수**: 823명/월
**이탈 가치**: 823명 × ₩8,000 (무료→유료 기대값) = **₩6,584,000/월 손실**

---

## 세그먼트별 비교

| 구분 | 가입→온보딩 완료 | 온보딩→유료 전환 |
|------|----------------|----------------|
| 데스크탑 | 62% | 14% |
| 모바일 | **29%** | 8% |
| 자연 검색 유입 | 67% | 18% |
| 소셜 유입 | 38% | 7% |

→ **모바일 온보딩이 핵심 문제**

---

## 개선 실험 우선순위 (ICE)

| 순위 | 실험 | Impact | Confidence | Ease | ICE |
|------|------|--------|-----------|------|-----|
| 1 | 온보딩 7→3단계 | 9 | 8 | 7 | **504** |
| 2 | 이메일 인증 생략 | 8 | 6 | 9 | **432** |
| 3 | 모바일 온보딩 UI 개선 | 7 | 9 | 5 | **315** |
| 4 | 인앱 가이드 투어 | 6 | 7 | 6 | **252** |

---

## 다음 단계

1. **즉시 (이번 주)**: PostHog Session Recording으로 온보딩 이탈 구간 정확히 파악
2. **2주 내**: 온보딩 7→3단계 축소 A/B 테스트 시작
3. **1개월 내**: 모바일 온보딩 UX 전면 재설계
```

### JSON 데이터 파일 (`funnel-data_YYYY-MM-DD.json`)

```json
{
  "period": "30d",
  "total_entries": 8400,
  "steps": [
    { "name": "landing_page_view", "users": 8400, "rate_from_total": 100.0 },
    { "name": "signup_page_view", "users": 1800, "rate_from_total": 21.4, "rate_from_prev": 21.4, "drop_off": 6600 },
    { "name": "signup_completed", "users": 1050, "rate_from_total": 12.5, "rate_from_prev": 58.3, "drop_off": 750 },
    { "name": "onboarding_completed", "users": 472, "rate_from_total": 5.6, "rate_from_prev": 54.7, "drop_off": 390 },
    { "name": "first_feature_used", "users": 349, "rate_from_total": 4.2, "rate_from_prev": 73.9, "drop_off": 123 },
    { "name": "paid_conversion", "users": 99, "rate_from_total": 1.2, "rate_from_prev": 28.4, "drop_off": 250 }
  ],
  "bottlenecks": [
    { "step": "onboarding_completed", "drop_off_rate": 45.3, "value_lost": 16380000 },
    { "step": "paid_conversion", "drop_off_rate": 71.6, "value_lost": 6584000 }
  ],
  "experiments": [
    { "name": "onboarding-simplify", "ice_score": 504, "ab_test_ready": true }
  ]
}
```

## 저장 위치

- `C:/oomni-data/growth/funnels/funnel-analysis_YYYY-MM-DD.md`
- `C:/oomni-data/growth/funnels/funnel-data_YYYY-MM-DD.json`

## 추가 인자

`$ARGUMENTS` — 선택적으로 다음을 지정할 수 있다:
- `--period 7|30|90` : 분석 기간 (일, 기본값: 30)
- `--funnel acquisition|activation|custom` : 분석할 퍼널 타입
- `--segment mobile|desktop|channel` : 세그먼트 비교 기준
- `--ice` : ICE 스코어 자동 계산
- `--chain-ab` : 최우선 실험에 대해 ab-test.md 스킬 자동 실행
- 예시: `/funnel-analysis --period 30 --segment mobile --ice --chain-ab`
