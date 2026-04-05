# /segment-users — 사용자 세그멘테이션 분석 및 액션 플랜 생성

DB와 PostHog 데이터를 기반으로 사용자를 행동, 가치, 참여도 기준으로 세분화하고, 각 세그먼트별 맞춤 전략과 이메일 캠페인 템플릿을 생성한다.

## 실행 단계

1. **데이터 수집**
   - Supabase에서 전체 사용자 데이터 로드 (최근 90일)
   - PostHog에서 이벤트 데이터 로드
   - 결합: 사용자 ID 기준으로 프로필 + 행동 데이터 조인

2. **RFM 분석 실행**
   각 사용자에 대해:
   - **R (Recency)**: 마지막 활동 후 경과 일수
   - **F (Frequency)**: 최근 30일 로그인 횟수
   - **M (Monetary)**: 누적 결제 금액

   각 지표를 1-5점으로 스코어링 후 세그먼트 분류

3. **참여도 기반 세그먼트 정의**

   **Champions (RFM: 555)**
   - 최근 7일 이내 활동
   - 주 5회 이상 로그인
   - 유료 플랜 사용
   - 인원: N명
   - 전략: 레퍼럴 프로그램 참여 유도, 케이스 스터디 인터뷰 요청

   **Loyal Users (RFM: 4xx)**
   - 최근 14일 이내 활동
   - 핵심 기능 3개 이상 사용
   - 전략: 업셀 캠페인, 얼리 액세스 제공

   **At Risk (R: 1-2, F/M: 높음)**
   - 예전엔 활발했지만 최근 2-4주 활동 없음
   - 전략: 재활성화 이메일, 새 기능 알림

   **New Users (가입 14일 이내)**
   - 온보딩 완료 여부 확인
   - 전략: 온보딩 완료 유도, 가이드 제공

   **Hibernating (30일 이상 비활성)**
   - 가입했지만 활동 없음
   - 전략: Win-back 캠페인 또는 삭제 고려

   **Free to Paid 후보**
   - 무료 플랜 사용 중
   - 핵심 기능 한도에 근접한 사용자
   - 전략: 업그레이드 제안 + 할인 쿠폰

4. **세그먼트별 이메일 캠페인 템플릿 생성**
   각 세그먼트에 대해:
   - 이메일 제목 3개 후보
   - 이메일 본문 초안
   - 발송 타이밍
   - 성공 지표

5. **세그먼트별 CSV 내보내기**
   - 각 세그먼트 사용자 목록 CSV
   - Resend, Mailchimp 임포트 가능 형식

6. **집중 세그먼트 추천**
   현재 비즈니스 상황에서 가장 높은 ROI를 기대할 수 있는 세그먼트 1-2개 추천 및 그 이유

## 출력 형식

### 세그멘테이션 리포트 (`segment-report_YYYY-MM-DD.md`)

```markdown
# 사용자 세그멘테이션 분석 — YYYY-MM-DD

**분석 기간**: 최근 90일
**전체 분석 사용자**: 1,240명

---

## 세그먼트 현황

| 세그먼트 | 인원 | 비율 | 평균 LTV | 권장 액션 |
|---------|------|------|---------|----------|
| Champions | 87 | 7% | ₩142,000 | 레퍼럴 요청 |
| Loyal Users | 156 | 13% | ₩89,000 | 업셀 캠페인 |
| Promising | 234 | 19% | ₩32,000 | 기능 안내 |
| At Risk | 198 | 16% | ₩71,000 | 재활성화 |
| New Users | 89 | 7% | ₩12,000 | 온보딩 완료 |
| Free to Paid | 312 | 25% | ₩0 | 업그레이드 유도 |
| Hibernating | 164 | 13% | ₩8,000 | Win-back |

---

## 집중 세그먼트 추천

### 1순위: At Risk (198명) — 잠재 수익 ₩14,058,000
**이유**: 과거 높은 가치를 보였지만 최근 이탈 위험. 재활성화 성공률 20%만 돼도 ₩2.8M MRR 방어.

**즉시 실행**:
1. "무슨 일이 있었나요?" 개인화 이메일 발송
2. 최근 새 기능 3가지 알림
3. 1:1 지원 세션 제안

### 2순위: Free to Paid (312명) — 전환 시 ₩26,520,000 MRR
**이유**: 이미 제품 가치를 경험한 사용자. 전환율 15% 목표 시 47명 유료 전환.

---

## At Risk 이메일 캠페인

**제목 후보**:
1. "[이름]님, 요즘 어떠세요? 도움이 필요하시면 연락주세요"
2. "OOMNI에서 놓치고 있는 새 기능들 📬"
3. "잠깐, 계정 삭제하기 전에 이것만 확인해보세요"

**이메일 초안**:
[이름]님, 안녕하세요.

지난 [N일] 동안 OOMNI를 사용하지 않으셨네요.

혹시 어려운 점이 있으셨나요? 아니면 바쁘셨나요?

저희가 그동안 추가한 기능들을 못 보셨을 수도 있을 것 같아 알려드립니다:
→ [새 기능 1]
→ [새 기능 2]
→ [새 기능 3]

궁금한 점이 있으시면 이 이메일에 바로 답장해 주세요.

장우경 드림
```

### 세그먼트 JSON (`segment-data_YYYY-MM-DD.json`)

```json
{
  "generated_at": "YYYY-MM-DDTHH:mm:ssZ",
  "total_users": 1240,
  "segments": {
    "champions": { "count": 87, "user_ids": [], "avg_ltv": 142000 },
    "at_risk": { "count": 198, "user_ids": [], "avg_ltv": 71000 },
    "free_to_paid": { "count": 312, "user_ids": [], "avg_ltv": 0 }
  },
  "priority_segments": ["at_risk", "free_to_paid"],
  "estimated_revenue_opportunity": 40578000
}
```

## 저장 위치

- `C:/oomni-data/growth/segments/segment-report_YYYY-MM-DD.md`
- `C:/oomni-data/growth/segments/segment-data_YYYY-MM-DD.json`
- `C:/oomni-data/growth/segments/csv/segment-champions_YYYY-MM-DD.csv`
- `C:/oomni-data/growth/segments/csv/segment-at-risk_YYYY-MM-DD.csv`
- `C:/oomni-data/growth/segments/csv/segment-free-to-paid_YYYY-MM-DD.csv`

## 추가 인자

`$ARGUMENTS` — 선택적으로 다음을 지정할 수 있다:
- `--segment all|champions|at-risk|new|hibernating` : 특정 세그먼트만 분석
- `--period 30|60|90` : 분석 기간 (일, 기본값: 90)
- `--export csv` : CSV 내보내기
- `--email-draft` : 각 세그먼트별 이메일 초안 생성
- `--send-campaign at-risk` : 지정 세그먼트에 즉시 이메일 발송
- 예시: `/segment-users --segment at-risk,free-to-paid --email-draft --export csv`
