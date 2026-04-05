# /audit-costs — SaaS 운영 비용 전체 감사 및 최적화

모든 구독 서비스, API 비용, 클라우드 인프라 비용을 수집하고 분석하여 불필요한 지출을 찾아내고 절감 방안을 제시한다. AI API 토큰 비용 최적화까지 포함한다.

## 실행 단계

1. **비용 데이터 수집**
   `C:/oomni-data/ops/costs/` 디렉터리에서 기존 비용 기록 읽기.
   없으면 `$ARGUMENTS`에서 비용 항목 직접 입력 또는 다음 소스에서 자동 수집:
   - Stripe 청구 내역 API (구독 중인 서비스)
   - Vercel 대시보드 (인프라)
   - Supabase 대시보드 (DB)
   - Claude/OpenAI API 사용량

2. **비용 항목 분류**
   카테고리별 분류:

   **인프라 (Infrastructure)**:
   - 호스팅 (Vercel, Railway, Fly.io)
   - 데이터베이스 (Supabase, Neon, PlanetScale)
   - CDN/스토리지 (Cloudflare, AWS S3)
   - 이메일 (Resend, Postmark)

   **AI/API**:
   - Claude API (Anthropic)
   - OpenAI API
   - Perplexity API
   - 기타 AI 서비스

   **개발 도구**:
   - GitHub (Actions 포함)
   - 모니터링 (Sentry, LogRocket)
   - 분석 (PostHog, Mixpanel)
   - 기타 SaaS 도구

   **마케팅/콘텐츠**:
   - 뉴스레터 (Resend/Mailchimp)
   - Buffer/소셜 도구
   - SEO 도구

   **기타**:
   - 도메인/SSL
   - 법인 관련
   - 교육/구독

3. **각 항목별 분석**
   각 비용 항목에 대해:
   - 월 비용
   - 연 비용 (환산)
   - 실제 사용 여부 (마지막 사용일)
   - MRR 대비 비율
   - 필수/선택 여부
   - 대안 서비스 존재 여부

4. **AI API 토큰 비용 최적화**
   Claude API 사용량 분석:
   - 봇별 토큰 사용량 (input/output 분리)
   - 가장 비용이 높은 봇 TOP 5
   - 프롬프트 캐싱 적용 여부 확인
   - 모델 다운그레이드 가능 항목 (claude-3-5-sonnet → claude-3-haiku)
   - 배치 처리 가능 항목

   최적화 계산:
   - 현재 토큰 비용: $X/월
   - 최적화 후 예상 비용: $Y/월
   - 절감액: $(X-Y)/월 = $(X-Y)×12/년

5. **"좀비 구독" 감지**
   최근 30일간 미사용 서비스:
   - 로그인 기록 없음
   - API 호출 0회
   - 결과물 없음
   → 즉시 취소 권장 목록

6. **비용 최적화 우선순위**
   절감 가능액 기준 정렬:
   - 즉시 절감 가능 (이번 달 취소)
   - 단기 절감 (1개월 내 교체)
   - 중기 절감 (3개월 내 검토)

7. **예산 목표 설정**
   현재 MRR 대비 운영 비용 비율 분석:
   - 업계 권장: 인프라 < MRR의 5%
   - AI API < MRR의 3%
   - 전체 운영 비용 < MRR의 15%

8. **월별 비용 추적 파일 업데이트**
   `C:/oomni-data/ops/costs/costs_YYYY-MM.json` 생성

## 출력 형식

### 비용 감사 보고서 (`cost-audit_YYYY-MM-DD.md`)

```markdown
# 비용 감사 보고서 — YYYY-MM-DD

**MRR**: ₩2,480,000
**이번 달 총 운영 비용**: ₩487,000 (MRR의 19.6% — ⚠️ 목표 15% 초과)

---

## 카테고리별 현황

| 카테고리 | 월 비용 | MRR 비율 | 상태 |
|---------|--------|---------|------|
| 인프라 | ₩89,000 | 3.6% | 🟢 양호 |
| AI API | ₩156,000 | 6.3% | 🔴 과다 |
| 개발 도구 | ₩142,000 | 5.7% | 🟡 검토 |
| 마케팅 | ₩67,000 | 2.7% | 🟢 양호 |
| 기타 | ₩33,000 | 1.3% | 🟢 양호 |

---

## 즉시 취소 권장 (좀비 구독)

| 서비스 | 월 비용 | 마지막 사용 | 이유 |
|--------|--------|----------|------|
| Linear | ₩35,000 | 45일 전 | GitHub Issues로 대체 가능 |
| Loom | ₩28,000 | 31일 전 | 무료 플랜으로 충분 |

**즉시 취소 시 절감**: ₩63,000/월 = ₩756,000/년

---

## AI API 최적화

### 현재 사용량 (이번 달)
| 봇 | 모델 | Input 토큰 | Output 토큰 | 비용 |
|----|------|-----------|------------|------|
| research-bot | claude-3-5-sonnet | 2.1M | 340K | ₩87,000 |
| content-bot | claude-3-5-sonnet | 890K | 210K | ₩42,000 |

### 최적화 방안
1. **research-bot**: claude-3-haiku로 1차 처리 후 중요 항목만 sonnet 사용
   → 예상 절감: ₩52,000/월 (60%)
2. **프롬프트 캐싱 적용**: 시스템 프롬프트 캐싱으로 input 토큰 70% 절감
   → 예상 절감: ₩25,000/월

**AI 비용 최적화 후**: ₩156,000 → ₩79,000 (-₩77,000/월)

---

## 대안 서비스 추천

| 현재 | 현재 비용 | 대안 | 대안 비용 | 절감 |
|------|---------|------|---------|------|
| Sentry Pro | ₩45,000 | Sentry Free | ₩0 | ₩45,000 |
| Mixpanel | ₩89,000 | PostHog OSS | ₩0 | ₩89,000 |

---

## 총 절감 가능액

- 즉시 취소: ₩63,000/월
- AI 최적화: ₩77,000/월
- 대안 서비스: ₩134,000/월
- **합계: ₩274,000/월 = ₩3,288,000/년**

최적화 후 운영 비용: ₩213,000/월 (MRR의 8.6%) ✅
```

### 비용 JSON (`costs_YYYY-MM.json`)

```json
{
  "month": "YYYY-MM",
  "mrr": 2480000,
  "total_costs": 487000,
  "cost_to_mrr_ratio": 0.196,
  "items": [
    {
      "name": "Vercel Pro",
      "category": "infrastructure",
      "monthly_cost_krw": 45000,
      "is_essential": true,
      "last_used": "YYYY-MM-DD",
      "cancel_recommendation": false
    },
    {
      "name": "Linear",
      "category": "dev_tools",
      "monthly_cost_krw": 35000,
      "is_essential": false,
      "last_used": "YYYY-MM-DD (45 days ago)",
      "cancel_recommendation": true,
      "alternative": "GitHub Issues"
    }
  ],
  "optimization_potential": {
    "immediate": 63000,
    "short_term": 77000,
    "mid_term": 134000,
    "total": 274000
  }
}
```

## 저장 위치

- `C:/oomni-data/ops/costs/cost-audit_YYYY-MM-DD.md`
- `C:/oomni-data/ops/costs/costs_YYYY-MM.json`

## 추가 인자

`$ARGUMENTS` — 선택적으로 다음을 지정할 수 있다:
- `--month YYYY-MM` : 특정 월 분석 (기본값: 이번 달)
- `--focus ai` : AI API 비용 집중 분석
- `--focus infra` : 인프라 비용 집중 분석
- `--auto-cancel` : 좀비 구독 자동 취소 (주의: 실제 취소 발생)
- `--export csv` : CSV로 내보내기
- `--send-report` : Telegram으로 보고서 발송
- 예시: `/audit-costs --focus ai --send-report`
