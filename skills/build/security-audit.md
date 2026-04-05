# /security-audit — 코드베이스 보안 취약점 감사 및 수정

프로젝트 전체를 스캔하여 OWASP Top 10 기반의 보안 취약점을 탐지하고, 발견된 문제를 심각도별로 분류하여 수정 코드와 함께 보고서를 생성한다. 한국 개인정보보호법(PIPA) 준수 여부도 함께 검토한다.

## 실행 단계

1. **환경 변수 노출 감사**
   - `.env*` 파일 목록 확인
   - `.gitignore`에 모든 `.env` 파일이 포함되어 있는지 확인
   - 소스 코드에서 하드코딩된 시크릿 탐지:
     ```
     패턴: (api_key|secret|password|token|private_key)\s*=\s*["'][^"']+["']
     ```
   - `git log --all --full-history -- "**/.env*"` 실행하여 과거 커밋 노출 확인

2. **의존성 취약점 스캔**
   ```bash
   npm audit --json
   ```
   - Critical/High 취약점 목록 추출
   - 각 취약점에 대한 수정 버전 확인
   - 자동 수정 가능한 것과 수동 처리 필요한 것 분류

3. **인증/인가 감사**
   - 모든 API 라우트에서 `getServerSession` 또는 인증 미들웨어 호출 여부 확인
   - 인증 없이 접근 가능한 API 목록 추출
   - JWT 토큰 만료 시간 설정 확인
   - `NEXTAUTH_SECRET` 설정 강도 확인 (32자 이상 랜덤 문자열)
   - 관리자 권한 확인 로직 검토

4. **SQL 인젝션 / Prisma 감사**
   - Raw SQL 쿼리 (`prisma.$queryRaw`) 사용 시 파라미터 바인딩 확인
   - 사용자 입력을 직접 쿼리에 삽입하는 패턴 탐지
   - Prisma의 Zod 유효성 검사 적용 여부 확인

5. **XSS 취약점 감사**
   - `dangerouslySetInnerHTML` 사용 위치 탐지
   - 사용자 입력 그대로 렌더링하는 패턴 탐지
   - Content Security Policy (CSP) 헤더 설정 확인 (`next.config.ts`)

6. **CORS 설정 감사**
   - API 라우트의 CORS 헤더 설정 확인
   - `Access-Control-Allow-Origin: *` 설정 탐지 (프로덕션 부적절)
   - 허용된 Origin 목록 검토

7. **Rate Limiting 감사**
   - 로그인, 회원가입, 비밀번호 재설정 API에 Rate Limit 적용 여부 확인
   - Brute force 공격 방어 로직 존재 여부 확인

8. **CSRF 보호 감사**
   - POST/PUT/DELETE 요청에 CSRF 토큰 또는 SameSite 쿠키 설정 확인
   - NextAuth의 CSRF 보호 활성화 여부 확인

9. **민감 데이터 처리 감사 (PIPA)**
   - 개인정보(이름, 이메일, 전화번호, 주소) 저장 위치 목록화
   - 암호화 없이 저장된 민감 데이터 탐지
   - 비밀번호 bcrypt 해싱 여부 확인 (cost factor 12 이상)
   - 로그에 개인정보 출력 여부 확인

10. **보안 헤더 감사**
    `next.config.ts`의 HTTP 헤더 설정 확인:
    - `X-Frame-Options: DENY`
    - `X-Content-Type-Options: nosniff`
    - `Referrer-Policy: strict-origin-when-cross-origin`
    - `Permissions-Policy`
    - `Strict-Transport-Security`

11. **보안 보고서 생성**
    심각도별 분류 (Critical > High > Medium > Low > Info) 후 각 항목에 수정 코드 첨부

## 출력 형식

### 보안 감사 보고서 (`security-audit_YYYY-MM-DD.md`)

```markdown
# 보안 감사 보고서 — YYYY-MM-DD

## 요약
- 총 발견 이슈: N개
- 🔴 Critical: N개
- 🟠 High: N개
- 🟡 Medium: N개
- 🟢 Low: N개
- ℹ️ Info: N개

---

## 🔴 Critical 이슈

### [CRIT-001] 하드코딩된 API 키 발견
**파일**: `src/lib/something.ts:42`
**설명**: Stripe API 키가 소스 코드에 하드코딩되어 있음

**현재 코드**:
```typescript
const stripe = new Stripe('sk_live_xxxxx');
```

**수정 코드**:
```typescript
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
```

**즉시 조치**:
1. 현재 키 즉시 무효화 (Stripe 대시보드에서)
2. 새 키 발급 후 환경 변수 설정
3. `git filter-branch` 또는 BFG로 git 히스토리에서 제거

---

## 🟠 High 이슈

### [HIGH-001] 인증 미적용 API 엔드포인트
**파일**: `src/app/api/users/route.ts`
**설명**: 사용자 목록 조회 API에 인증이 없어 누구나 접근 가능

**수정 코드**:
```typescript
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: '인증 필요' }, { status: 401 });
  // ...
}
```
```

### JSON 보고서 (`security-audit_YYYY-MM-DD.json`)

```json
{
  "audit_date": "YYYY-MM-DD",
  "project": "oomni-backend",
  "summary": { "critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0 },
  "npm_vulnerabilities": { "critical": 0, "high": 0, "moderate": 0 },
  "pipa_compliance": { "status": "partial", "issues": [] },
  "issues": [
    {
      "id": "CRIT-001",
      "severity": "critical",
      "category": "secrets_exposure",
      "file": "src/lib/something.ts",
      "line": 42,
      "description": "",
      "fix_provided": true,
      "auto_fixable": false
    }
  ]
}
```

## 저장 위치

- `C:/oomni-data/security/security-audit_YYYY-MM-DD.md`
- `C:/oomni-data/security/security-audit_YYYY-MM-DD.json`
- `C:/oomni-data/security/npm-audit_YYYY-MM-DD.json`

## 추가 인자

`$ARGUMENTS` — 선택적으로 다음을 지정할 수 있다:
- `--fix` : 자동 수정 가능한 이슈 즉시 수정 (주의: 코드 변경 발생)
- `--severity critical|high|medium` : 지정 심각도 이상만 보고
- `--pipa` : 한국 개인정보보호법 준수 항목 강화
- `--deps-only` : npm 의존성 취약점만 검사
- `--send-report` : Telegram으로 요약 발송
- 예시: `/security-audit --severity high --pipa --send-report`
