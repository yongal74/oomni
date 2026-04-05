# /code-review — 풀 리퀘스트 또는 파일 코드 리뷰

지정된 파일 또는 git diff를 분석하여 버그, 성능 이슈, 보안 취약점, 코드 스타일, 타입 안전성을 검토하고 개선 제안과 수정 코드를 포함한 상세 리뷰를 생성한다.

## 실행 단계

1. **리뷰 대상 파일 수집**
   - `$ARGUMENTS`에서 파일 경로 또는 커밋 해시 파싱
   - 파일 경로가 없으면 `git diff --name-only HEAD~1 HEAD` 실행하여 최근 변경 파일 가져오기
   - PR 번호가 있으면 `git diff main...HEAD` 실행
   - 파일 크기 확인: 500줄 이상은 섹션별로 분할 리뷰

2. **파일별 정적 분석**
   각 파일에 대해:

   **버그 탐지**:
   - 변수 초기화 전 사용
   - null/undefined 미처리 (optional chaining 누락)
   - 비동기 에러 미처리 (await 없는 Promise, try-catch 누락)
   - 무한 루프 가능성
   - 상태 업데이트 후 즉시 해당 상태 읽기 (React stale closure)
   - useEffect 의존성 배열 오류

   **보안 이슈**:
   - 사용자 입력 미검증
   - SQL 인젝션 패턴
   - XSS 취약점 (`dangerouslySetInnerHTML`)
   - 민감 정보 로그 출력

   **성능 이슈**:
   - 불필요한 re-render (memo/useCallback 누락)
   - N+1 쿼리 패턴
   - 대용량 데이터 메모리 로드
   - 이미지 최적화 누락
   - 무거운 연산의 useEffect 내 실행

   **타입 안전성**:
   - `any` 타입 사용
   - type assertion (`as Type`) 남용
   - 미정의 타입 반환 함수
   - `!` non-null assertion 남용

   **코드 품질**:
   - DRY 원칙 위반 (반복 코드)
   - 단일 책임 원칙 위반
   - 함수 길이 50줄 이상
   - 복잡한 조건문 (중첩 3단계 이상)
   - 매직 넘버/문자열 (상수화 필요)

3. **심각도 태깅**
   각 이슈에 심각도 태그:
   - `[MUST FIX]` — 머지 전 반드시 수정
   - `[SHOULD FIX]` — 가급적 수정 권장
   - `[SUGGESTION]` — 선택적 개선사항
   - `[PRAISE]` — 잘 작성된 코드 (긍정 피드백)

4. **수정 코드 제공**
   모든 `[MUST FIX]`와 `[SHOULD FIX]` 이슈에 대해 before/after 코드 제공

5. **요약 점수 산출**
   - 전체 코드 품질 점수 (0-100)
   - 카테고리별 점수 (버그, 보안, 성능, 타입, 스타일)
   - 머지 권장 여부: ✅ 머지 가능 / ⚠️ 수정 후 머지 / ❌ 재작성 필요

6. **리뷰 파일 저장**

## 출력 형식

### 코드 리뷰 마크다운 (`code-review_YYYY-MM-DD_HHmm.md`)

```markdown
# 코드 리뷰 — YYYY-MM-DD HH:mm

## 리뷰 요약

| 지표 | 점수 |
|------|------|
| 전체 품질 | 82/100 |
| 버그 리스크 | 90/100 |
| 보안 | 75/100 |
| 성능 | 85/100 |
| 타입 안전성 | 80/100 |

**머지 권장 여부**: ⚠️ 수정 후 머지 권장

**리뷰된 파일**: 3개
**발견된 이슈**: 8개 (MUST FIX: 2, SHOULD FIX: 4, SUGGESTION: 2)

---

## 파일별 리뷰

### `src/app/api/users/route.ts`

#### [MUST FIX] 비동기 에러 미처리
**라인**: 23

**문제**:
```typescript
// ❌ Promise 에러가 처리되지 않음
const data = prisma.user.findMany();
```

**수정**:
```typescript
// ✅ await + try-catch 또는 .catch() 필수
try {
  const data = await prisma.user.findMany();
} catch (error) {
  console.error('[GET /api/users]', error);
  return NextResponse.json({ error: 'DB 오류' }, { status: 500 });
}
```

---

#### [PRAISE] 잘 작성된 Zod 유효성 검사
**라인**: 10-18
> 입력 유효성 검사가 철저하게 구현되어 있고, 에러 메시지도 사용자 친화적으로 작성되었습니다.

---

## 권장 조치 순서

1. [MUST FIX] src/api/users/route.ts:23 — await 추가
2. [MUST FIX] src/components/Form.tsx:45 — XSS 취약점 수정
3. [SHOULD FIX] src/lib/utils.ts:78 — N+1 쿼리 개선
```

## 저장 위치

- `C:/oomni-data/build/reviews/code-review_YYYY-MM-DD_HHmm.md`
- `C:/oomni-data/build/reviews/code-review_YYYY-MM-DD_HHmm.json`

## 추가 인자

`$ARGUMENTS` — 다음 형식으로 입력:
- `[파일경로 또는 패턴]` : 리뷰할 파일 (예: `src/app/api/**/*.ts`)
- `--commit HEAD~3` : 특정 커밋 이후 변경사항 리뷰
- `--focus security` : 보안 이슈 집중 리뷰
- `--focus performance` : 성능 이슈 집중 리뷰
- `--strict` : 더 엄격한 기준 적용 (SUGGESTION도 SHOULD FIX 수준으로)
- `--no-suggestions` : MUST FIX, SHOULD FIX만 보고
- 예시: `/code-review src/app/api/ --focus security --strict`
