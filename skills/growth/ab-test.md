# /ab-test — A/B 테스트 설계, 실행, 분석 완전 자동화

테스트 아이디어를 입력받아 통계적으로 유효한 A/B 테스트를 설계하고, PostHog Feature Flags 코드를 생성하며, 결과 분석 후 통계적 유의성을 계산하여 최종 의사결정 보고서를 생성한다.

## 실행 단계

1. **테스트 아이디어 파악**
   - `$ARGUMENTS`에서 테스트 요소, 변형, 목표 지표 파싱
   - 현재 베이스라인 지표 확인 (전환율, 클릭률 등)
   - 예상 효과 크기 설정 (최소 감지 효과)

2. **샘플 사이즈 계산**
   통계 공식 적용:
   - 신뢰수준: 95% (기본)
   - 검정력 (Power): 80%
   - 최소 효과 크기: `$ARGUMENTS`에서 설정 (기본: 5%p)

   공식:
   ```
   n = 2 × (Z_α/2 + Z_β)² × p(1-p) / d²
   ```
   - 필요 샘플 사이즈 계산
   - 현재 트래픽 기준 예상 테스트 기간 산출

3. **가설 문서 작성**
   - Null Hypothesis (H0)
   - Alternative Hypothesis (H1)
   - 예상 결과와 근거
   - 성공/실패 기준

4. **PostHog Feature Flag 설정 코드 생성**
   파일 위치: `src/lib/experiments/[test-name].ts`

   ```typescript
   // Feature Flag 설정
   export const AB_TEST_FLAG = 'onboarding-cta-v2';
   export const VARIANTS = { control: 'control', treatment: 'treatment' } as const;
   ```

5. **변형별 컴포넌트/코드 생성**
   - Control (A): 현재 버전
   - Treatment (B): 변경된 버전
   - Feature Flag로 동적 렌더링

6. **추적 이벤트 코드 생성**
   - 노출 이벤트 (impression)
   - 전환 이벤트 (conversion)
   - 각 변형에서 발생하는 이벤트 추적

7. **테스트 결과 분석** (결과 데이터 있을 때)
   - PostHog API에서 데이터 수집
   - 통계적 유의성 계산 (Z-test 또는 Chi-squared)
   - p-value 계산
   - 95% 신뢰구간 계산
   - 실질적 유의성 (Effect Size) 계산

8. **의사결정 보고서 생성**
   - 통계 결과 요약
   - 승자 변형 결정
   - 다음 단계 (배포 / 재테스트 / 폐기)
   - 학습 내용

## 출력 형식

### A/B 테스트 설계 문서 (`ab-test_[이름]_YYYY-MM-DD.md`)

```markdown
# A/B 테스트: [테스트 이름]

**상태**: 설계 / 진행 중 / 완료
**시작일**: YYYY-MM-DD
**예상 종료일**: YYYY-MM-DD
**담당자**: 장우경

---

## 가설

**H0 (귀무가설)**: 새 CTA 버튼 텍스트는 전환율에 영향을 미치지 않는다.
**H1 (대립가설)**: "지금 무료 시작" 버튼이 기존 "시작하기" 버튼보다 전환율이 높다.

**근거**: 혜택 중심 CTA가 행동 중심 CTA보다 전환율 높다는 연구 결과 존재.

---

## 테스트 설계

| 항목 | 내용 |
|------|------|
| 테스트 요소 | 랜딩 페이지 Hero CTA 버튼 텍스트 |
| A (Control) | "시작하기" |
| B (Treatment) | "지금 무료로 시작하기" |
| 목표 지표 | 방문 → 가입 전환율 |
| 보조 지표 | 버튼 클릭률 |
| 베이스라인 전환율 | 4.2% |
| 최소 감지 효과 | +1%p (4.2% → 5.2%) |

---

## 샘플 사이즈 계산

- **신뢰수준**: 95% (Z_α/2 = 1.96)
- **검정력**: 80% (Z_β = 0.842)
- **기준 전환율(p1)**: 4.2%
- **목표 전환율(p2)**: 5.2%
- **필요 샘플 사이즈 (그룹당)**: **2,847명**
- **현재 주간 랜딩 방문자**: 1,200명
- **예상 테스트 기간**: **약 5주**

---

## 구현

### Feature Flag 키
`onboarding-cta-text-v1`

### PostHog 설정
- Rollout: 50% / 50%
- Filter: 모든 신규 방문자

### 코드 위치
`src/components/landing/Hero.tsx`

---

## 결과 분석 (테스트 완료 후 작성)

| 지표 | Control (A) | Treatment (B) | 차이 |
|------|------------|--------------|------|
| 노출 수 | 2,890 | 2,912 | — |
| 전환 수 | 121 | 159 | +38 |
| 전환율 | 4.19% | 5.46% | +1.27%p |

**Z-score**: 2.34
**p-value**: 0.019
**통계적 유의성**: ✅ 95% 신뢰수준에서 유의미

**결론**: **B 변형 승리** → 전체 배포 권장

**예상 연간 임팩트**: +30명/월 유료 전환 × ₩39,000 = +₩1,170,000/월 MRR
```

### PostHog 코드 (`src/lib/experiments/cta-text-v1.ts`)

```typescript
import { useFeatureFlagVariantKey } from 'posthog-js/react';

export const CTA_TEST_FLAG = 'onboarding-cta-text-v1';

export type CTAVariant = 'control' | 'treatment';

export function useCTAVariant(): CTAVariant {
  const variant = useFeatureFlagVariantKey(CTA_TEST_FLAG);
  return (variant as CTAVariant) ?? 'control';
}

// 컴포넌트에서 사용
// const variant = useCTAVariant();
// const ctaText = variant === 'treatment' ? '지금 무료로 시작하기' : '시작하기';
```

## 저장 위치

- `C:/oomni-data/growth/ab-tests/ab-test_[이름]_YYYY-MM-DD.md`
- `C:/oomni-data/growth/ab-tests/ab-test_[이름]_results_YYYY-MM-DD.json`
- `C:/Users/장우경/oomni/backend/src/lib/experiments/[test-name].ts`

## 추가 인자

`$ARGUMENTS` — 다음 형식으로 입력:
- `[테스트 이름] [테스트 요소] [목표 지표]`
- `--baseline 4.2` : 현재 베이스라인 (%)
- `--effect 1.0` : 최소 감지 효과 크기 (%p)
- `--confidence 95` : 신뢰수준 (기본값: 95)
- `--analyze` : 결과 분석 모드 (데이터 수집 후 실행)
- `--traffic 1200` : 주간 트래픽 (샘플 사이즈 기간 계산용)
- 예시: `/ab-test "hero-cta-text" "버튼 텍스트" "가입 전환율" --baseline 4.2 --effect 1.0 --traffic 1200`
