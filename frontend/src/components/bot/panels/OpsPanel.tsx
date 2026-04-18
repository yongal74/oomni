import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { agentsApi, schedulesApi, type FeedItem, type Schedule } from '../../../lib/api'
import { Zap, Download, ChevronDown, ChevronRight, Copy } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { ArchiveButton } from '../shared/ArchiveButton'
import { NextBotDropdown } from '../shared/NextBotDropdown'

// ── 5개 최상위 탭 ────────────────────────────────────────────────────────────
const OPS_MAIN_TABS = [
  { key: 'ops', label: '운영' },
  { key: 'infra', label: '인프라' },
  { key: 'integration', label: '연동' },
  { key: 'env', label: '환경변수' },
  { key: 'security', label: '보안' },
]

const OPS_TABS = [
  { key: 'automation', label: '자동화' },
  { key: 'finance', label: '재무' },
  { key: 'tax', label: '세무' },
  { key: 'hr', label: '인사' },
]

// ── 카테고리별 자동화 프리셋 정의 ────────────────────────────────────────────
interface AutomationPreset {
  name: string
  /** schedules API에 POST할 기본값 */
  triggerType: 'interval' | 'cron'
  triggerValue: string
}

interface AutomationCategory {
  id: string
  label: string
  presets: AutomationPreset[]
}

const AUTOMATION_CATEGORIES: AutomationCategory[] = [
  {
    id: 'general',
    label: '일반',
    presets: [
      { name: '이슈 자동생성', triggerType: 'cron', triggerValue: '0 9 * * 1-5' },
      { name: '일일 리포트 자동화', triggerType: 'cron', triggerValue: '0 18 * * 1-5' },
      { name: '주간 비용 정산', triggerType: 'cron', triggerValue: '0 10 * * 1' },
    ],
  },
  {
    id: 'finance',
    label: '재무',
    presets: [
      { name: '월별 손익계산서 자동생성', triggerType: 'cron', triggerValue: '0 9 1 * *' },
      { name: 'Stripe 매출 집계', triggerType: 'cron', triggerValue: '0 8 * * 1' },
      { name: '미수금 알림', triggerType: 'cron', triggerValue: '0 10 * * 3' },
    ],
  },
  {
    id: 'tax',
    label: '세무',
    presets: [
      { name: '분기별 부가세 정리', triggerType: 'cron', triggerValue: '0 9 1 1,4,7,10 *' },
      { name: '영수증 수집/분류', triggerType: 'cron', triggerValue: '0 9 * * 1' },
    ],
  },
  {
    id: 'hr',
    label: '인사',
    presets: [
      { name: '주간 업무일지', triggerType: 'cron', triggerValue: '0 17 * * 5' },
      { name: '월간 성과 정리', triggerType: 'cron', triggerValue: '0 9 28 * *' },
    ],
  },
]

// ── [인프라] 탭 — 카테고리별 스킬 ───────────────────────────────────────────
interface InfraSkill {
  label: string
  desc: string
  prompt: string
}

interface InfraCategory {
  id: string
  label: string
  emoji: string
  skills: InfraSkill[]
}

const INFRA_CATEGORIES: InfraCategory[] = [
  {
    id: 'vercel',
    label: 'Vercel 배포',
    emoji: '▲',
    skills: [
      {
        label: '신규 프로젝트 배포',
        desc: 'vercel.json + 환경변수 설정',
        prompt: `현재 프로젝트를 Vercel에 처음 배포하는 전체 과정을 진행해줘.

1. vercel.json 생성 (빌드 커맨드, 출력 디렉토리, 리전, 함수 메모리/타임아웃 최적화)
2. .vercelignore 생성 (node_modules, .env* 제외)
3. 필요한 환경변수 목록 정리 (로컬 .env 기반)
4. Vercel CLI: vercel --prod 배포 커맨드 안내
5. 배포 후 도메인 확인 및 헬스체크 방법

결과: 배포 완료 URL, 환경변수 설정 체크리스트, 주의사항`,
      },
      {
        label: 'Preview 배포 설정',
        desc: 'PR별 자동 프리뷰 URL',
        prompt: `GitHub PR마다 자동으로 Vercel Preview URL이 생성되도록 설정해줘.

1. Vercel GitHub 앱 연동 확인
2. .github/workflows/vercel-preview.yml 작성:
   - PR open/sync 시 vercel deploy (preview 모드)
   - PR 코멘트에 Preview URL 자동 게시 (actions/github-script)
   - PR close 시 preview 자동 삭제
3. vercel.json에 preview 전용 환경변수 분기 설정
4. PR 리뷰어에게 Preview URL 슬랙 알림 연동 (선택)

출력: GitHub Actions YAML 파일 완성본`,
      },
      {
        label: '커스텀 도메인 연결',
        desc: '도메인 DNS + SSL 자동화',
        prompt: `Vercel 프로젝트에 커스텀 도메인을 연결하는 전체 과정을 안내해줘.

1. vercel domains 추가 커맨드
2. DNS 설정:
   - A 레코드: 76.76.21.21 (Vercel IP)
   - CNAME: cname.vercel-dns.com (서브도메인용)
   - www 리다이렉트 설정
3. SSL 인증서 자동 발급 확인 (Let's Encrypt)
4. www → apex 리다이렉트 vercel.json 설정
5. 도메인 전파 확인 방법 (dig, nslookup)
6. HSTS 헤더 설정

출력: DNS 설정 체크리스트, vercel.json redirects 설정`,
      },
      {
        label: '빌드 최적화',
        desc: '캐싱·번들·Edge 튜닝',
        prompt: `Vercel 배포 빌드 성능을 최적화해줘.

1. vercel.json 캐시 헤더 설정:
   - 정적 자산: Cache-Control max-age=31536000, immutable
   - API 라우트: no-store
   - HTML: s-maxage=60, stale-while-revalidate
2. Vercel Edge Functions vs Serverless Functions 선택 기준 분석
3. ISR (Incremental Static Regeneration) 설정 (Next.js인 경우)
4. 번들 사이즈 분석: @next/bundle-analyzer 또는 rollup-plugin-visualizer 설정
5. 빌드 캐시 활용: vercel cache 전략
6. 함수 리전 최적화 (iad1 vs icn1)

출력: 최적화된 vercel.json, 번들 분석 리포트 커맨드`,
      },
    ],
  },
  {
    id: 'docker',
    label: 'Docker',
    emoji: '🐳',
    skills: [
      {
        label: '프로덕션 Dockerfile',
        desc: '멀티스테이지 빌드',
        prompt: `현재 프로젝트에 맞는 프로덕션용 Dockerfile을 작성해줘.

요구사항:
1. 멀티스테이지 빌드 (builder → runner):
   - builder: 전체 devDependencies 포함, 빌드 실행
   - runner: node:alpine, 프로덕션 의존성만, 최소 이미지
2. 레이어 캐시 최적화 (package.json COPY → npm install → 소스 COPY 순서)
3. non-root 유저 실행 (보안)
4. 환경변수 ARG/ENV 분리
5. HEALTHCHECK 설정
6. .dockerignore 생성 (node_modules, .git, .env*, dist 제외)

출력: Dockerfile 완성본 + .dockerignore + 빌드/실행 커맨드`,
      },
      {
        label: 'docker-compose 설정',
        desc: 'dev/prod 환경 분리',
        prompt: `docker-compose.yml을 dev/prod 환경별로 분리해서 작성해줘.

1. docker-compose.yml (공통 기반):
   - 서비스 정의 (app, db, redis 등)
   - 네트워크 설정
   - named volumes
2. docker-compose.dev.yml (개발 오버라이드):
   - 소스 코드 bind mount (hot reload)
   - 개발 포트 공개
   - 디버그 환경변수
3. docker-compose.prod.yml (프로덕션 오버라이드):
   - 빌드된 이미지 사용
   - 재시작 정책: unless-stopped
   - 리소스 제한 (cpus, memory)
   - 환경변수 파일 분리
4. Makefile 또는 npm scripts: up-dev, up-prod, down, logs, shell

출력: 3개 compose 파일 + Makefile`,
      },
      {
        label: 'Docker Hub 자동 푸시',
        desc: 'GitHub Actions → Registry',
        prompt: `GitHub Actions로 Docker 이미지를 자동 빌드해서 Docker Hub(또는 GitHub Container Registry)에 푸시하는 CI를 설정해줘.

.github/workflows/docker-publish.yml:
1. 트리거: main 브랜치 push + 태그(v*) push
2. 빌드 매트릭스: linux/amd64 + linux/arm64 (buildx 멀티플랫폼)
3. 이미지 태그 전략:
   - main 브랜치: :latest + :main-{sha 7자}
   - 태그 v1.2.3: :1.2.3 + :1.2 + :1 + :latest
4. 레이어 캐시: actions/cache + --cache-from/to
5. GitHub Secrets 설정 가이드 (DOCKERHUB_USERNAME, DOCKERHUB_TOKEN)
6. 빌드 완료 후 Slack 알림 (선택)

출력: GitHub Actions YAML + Secrets 설정 가이드`,
      },
      {
        label: '헬스체크 & 복구',
        desc: '헬스체크 + 재시작 정책',
        prompt: `Docker 컨테이너의 헬스체크와 자동 복구 전략을 설정해줘.

1. Dockerfile HEALTHCHECK:
   - HTTP 엔드포인트: curl -f http://localhost:3000/health
   - 간격: 30s, 타임아웃: 10s, 재시도: 3, 시작대기: 40s
2. Express/Fastify /health 엔드포인트 구현:
   - DB 연결 상태 확인
   - 외부 서비스 연결 확인
   - 응답: { status: 'ok', uptime, version, checks: {} }
3. docker-compose 헬스체크 depends_on 연동
4. 재시작 정책별 차이: no / always / on-failure:5 / unless-stopped
5. 장애 시 알림: Docker Events → 슬랙 웹훅

출력: Dockerfile HEALTHCHECK + /health 라우트 코드 + compose 설정`,
      },
    ],
  },
  {
    id: 'github',
    label: 'GitHub',
    emoji: '🐙',
    skills: [
      {
        label: 'Branch Protection',
        desc: 'main 브랜치 보호 규칙',
        prompt: `GitHub 리포지토리의 브랜치 보호 규칙을 설정하는 방법을 안내해줘.

1. main/master 브랜치 보호 설정:
   - PR 리뷰 최소 1명 필수
   - 상태 체크 통과 필수 (CI 완료)
   - 스테일 승인 무효화 (새 커밋 시)
   - 관리자도 규칙 적용
   - force push 금지
2. gh CLI로 설정하는 방법:
   gh api repos/{owner}/{repo}/branches/main/protection
3. .github/CODEOWNERS 파일 작성 (디렉토리별 리뷰어 자동 배정)
4. PR 템플릿: .github/pull_request_template.md (체크리스트)
5. Issue 템플릿: .github/ISSUE_TEMPLATE/ (버그/기능요청)

출력: gh CLI 커맨드 + CODEOWNERS + PR 템플릿 파일`,
      },
      {
        label: 'Release 자동화',
        desc: '태그 → 릴리즈노트 자동생성',
        prompt: `GitHub 태그 push 시 자동으로 Release를 생성하고 릴리즈 노트를 작성하는 자동화를 설정해줘.

.github/workflows/release.yml:
1. 트리거: tags/v* push
2. Changelog 자동 생성:
   - 이전 태그 이후 커밋을 feat/fix/chore 분류
   - Conventional Commits 파싱
3. GitHub Release 생성:
   - gh release create 활용
   - 자동 생성된 릴리즈 노트 + 수동 섹션
4. 빌드 산출물 자동 업로드 (exe, dmg, zip 등)
5. 릴리즈 완료 시 Slack #releases 채널 알림
6. .github/release-drafter.yml 설정 (PR merge 시 draft 릴리즈 자동 업데이트)

출력: GitHub Actions YAML + release-drafter.yml`,
      },
      {
        label: 'PR 자동화',
        desc: '라벨·리뷰어·코멘트 자동화',
        prompt: `GitHub PR 생성/업데이트 시 자동화를 설정해줘.

1. PR 라벨 자동 부여 (.github/labeler.yml):
   - frontend/ 변경 → "frontend" 라벨
   - backend/ 변경 → "backend" 라벨
   - docs/ 변경 → "documentation" 라벨
   - 파일 수에 따른 크기 라벨 (small/medium/large)
2. 자동 리뷰어 배정 (.github/CODEOWNERS)
3. PR 크기 코멘트 (변경 라인 수 기반 경고)
4. 스테일 PR 자동 닫기 (30일 미활동)
5. 머지 전 체크리스트 봇 코멘트
6. Dependabot 설정 (.github/dependabot.yml)

출력: labeler.yml + dependabot.yml + Actions YAML 파일들`,
      },
      {
        label: 'Webhook → Slack',
        desc: 'GitHub 이벤트 Slack 알림',
        prompt: `GitHub 이벤트(PR, Issue, 배포, 리뷰)를 Slack 채널에 자동 알림하는 설정을 구현해줘.

방법 1 — GitHub Actions (권장):
.github/workflows/slack-notify.yml
- PR opened/merged/closed → #dev 채널
- Issue opened → #issues 채널
- Release published → #releases 채널
- Deployment success/failure → #deploy 채널
- Slack 메시지 포맷: 제목/링크/담당자/상태 이모지

방법 2 — GitHub Slack 앱 (간단):
/github subscribe {owner}/{repo} pulls reviews comments deployments

방법 3 — 커스텀 Webhook → Express 엔드포인트:
- HMAC 서명 검증 (X-Hub-Signature-256)
- 이벤트별 Slack Block Kit 메시지 포맷

출력: GitHub Actions YAML + Slack Block Kit 메시지 템플릿`,
      },
    ],
  },
  {
    id: 'ci',
    label: 'CI 파이프라인',
    emoji: '🔄',
    skills: [
      {
        label: 'GitHub Actions CI',
        desc: 'PR 시 자동 검증 파이프라인',
        prompt: `GitHub Actions로 PR마다 실행되는 CI 파이프라인을 설정해줘.

.github/workflows/ci.yml:
1. 트리거: PR opened/synchronize + main push
2. 병렬 잡 구성:
   - [typecheck]: npx tsc --noEmit
   - [lint]: eslint + prettier --check
   - [test]: vitest run --coverage (coverage 80% 미만 실패)
   - [build]: npm run build (성공 여부 확인)
3. 캐시 전략: actions/setup-node + npm cache
4. 환경변수: GitHub Secrets 연결
5. PR 체크에 각 잡 결과 표시
6. main 머지 시 자동 배포 잡 트리거 (depends-on: [typecheck, lint, test, build])

출력: 완성된 .github/workflows/ci.yml`,
      },
      {
        label: '테스트 + 커버리지',
        desc: 'Vitest + 커버리지 리포트',
        prompt: `프로젝트에 Vitest 테스트 환경을 구축하고 커버리지 리포트를 설정해줘.

1. vitest.config.ts 작성:
   - coverage: v8 provider
   - thresholds: lines 80%, branches 70%, functions 80%
   - exclude: node_modules, dist, *.config.ts
2. 테스트 파일 구조 예시 (현재 코드 기반):
   - 유닛 테스트: utils, validators, pure functions
   - 통합 테스트: API 엔드포인트 (supertest)
3. GitHub Actions에서 커버리지 리포트:
   - vitest run --coverage
   - coverage-comment PR 코멘트 (davelosert/vitest-coverage-report-action)
4. 커버리지 배지 생성 (shields.io)
5. 테스트 작성 우선순위 가이드 (현재 코드 분석 후)

출력: vitest.config.ts + 샘플 테스트 파일 + Actions YAML`,
      },
      {
        label: '자동 배포 파이프라인',
        desc: 'main merge → 자동 배포',
        prompt: `main 브랜치 머지 시 자동으로 배포되는 CD(Continuous Deployment) 파이프라인을 설정해줘.

.github/workflows/deploy.yml:
1. 트리거: main push (CI 통과 후)
2. 배포 전략 선택 (현재 프로젝트에 맞게):
   - Vercel: vercel deploy --prod
   - Docker: 이미지 빌드 → Registry 푸시 → 서버 pull & restart
   - 직접 서버: SSH → git pull → pm2 reload
3. 배포 단계:
   - 빌드 아티팩트 생성
   - 헬스체크 URL 사전 확인
   - 배포 실행
   - 배포 후 헬스체크 (최대 5회 재시도)
   - 실패 시 자동 롤백
4. 배포 환경별 분기 (staging → production)
5. 배포 완료/실패 Slack 알림

출력: deploy.yml + 롤백 스크립트`,
      },
      {
        label: '롤백 전략',
        desc: '배포 실패 시 자동 롤백',
        prompt: `배포 실패 시 자동으로 이전 버전으로 롤백하는 전략을 구현해줘.

1. 롤백 트리거 조건:
   - 헬스체크 실패 (3회 이상)
   - 에러율 임계값 초과
   - 수동 롤백 요청 (workflow_dispatch)

2. 플랫폼별 롤백 방법:
   - Vercel: vercel rollback {deploymentId}
   - Docker: 이전 이미지 태그로 restart
   - GitHub Pages: 이전 커밋 revert + push
   - PM2: pm2 rollback

3. GitHub Actions workflow_dispatch로 수동 롤백:
   - 입력: 롤백 대상 커밋 SHA 또는 배포 ID
   - 실행: 해당 버전 재배포
   - 완료: Slack 알림 (누가, 언제, 어떤 버전으로)

4. 배포 이력 관리: GitHub Deployments API 활용

출력: 롤백 워크플로우 YAML + 배포 이력 추적 스크립트`,
      },
    ],
  },
]

// ── [연동] 탭 외부 서비스 ────────────────────────────────────────────────────
const EXTERNAL_SKILLS = [
  { label: 'Slack 연동', emoji: '💬', prompt: '/integrate-slack Slack 워크스페이스에 봇을 연동하고 이벤트를 수신하는 설정을 알려줘.' },
  { label: 'Notion 연동', emoji: '📝', prompt: '/integrate-notion Notion API를 연동해서 데이터베이스를 읽고 쓰는 코드를 작성해줘.' },
  { label: 'GitHub 웹훅', emoji: '🐙', prompt: '/integrate-github-webhook GitHub 웹훅을 설정해서 PR, Issue, Push 이벤트를 처리하는 엔드포인트를 만들어줘.' },
  { label: '웹훅 허브', emoji: '🔗', prompt: '/integrate-webhook-hub 단일 웹훅 엔드포인트로 여러 서비스의 이벤트를 수신하고 라우팅하는 허브를 구축해줘.' },
]

// ── [환경변수] 탭 액션 ───────────────────────────────────────────────────────
const ENV_ACTIONS = [
  {
    label: 'NEXT_PUBLIC_ 스캔',
    desc: '누락된 환경변수 찾기',
    prompt: '/scan-env 프로젝트 전체에서 사용하는 환경변수를 스캔하고 .env.example과 비교해줘. 누락된 것을 찾아줘.',
  },
  {
    label: '로컬↔Vercel 동기화',
    desc: '.env.local과 Vercel env 비교',
    prompt: '/sync-env 로컬 .env.local 파일과 Vercel 환경변수를 비교하고 동기화 방법을 알려줘.',
  },
  {
    label: '.env 템플릿 생성',
    desc: '.env.example 자동 생성',
    prompt: '/gen-env-template 현재 코드베이스를 분석해서 .env.example 파일을 생성해줘. 각 변수 설명 포함.',
  },
]

// ── [보안] 탭 액션 ───────────────────────────────────────────────────────────
const SECURITY_ACTIONS = [
  {
    label: 'OWASP 스캔',
    desc: 'OWASP Top 10 취약점 점검',
    prompt: '/security-audit 현재 코드베이스의 OWASP Top 10 기준 보안 취약점을 점검해줘. 결과를 🔴CRITICAL/🟠HIGH/🟡MEDIUM/🟢LOW 심각도로 분류해서 보고해줘.',
  },
  {
    label: 'npm audit',
    desc: '의존성 취약점 검사',
    prompt: '/npm-audit npm audit를 실행하고 발견된 취약점을 심각도별로 정리해서 수정 방법을 알려줘.',
  },
  {
    label: 'RLS 검증',
    desc: 'Supabase Row Level Security',
    prompt: '/check-rls Supabase 데이터베이스의 RLS 정책을 검증하고 취약한 부분을 찾아줘.',
  },
]

// ── 공식 n8n 템플릿 카테고리 프리셋 ──────────────────────────────────────────
const N8N_CATEGORIES = [
  {
    label: 'Slack 알림',
    emoji: '💬',
    prompt: 'n8n.io/workflows, community.n8n.io, blog.n8n.io에서 Slack 연동 공식 템플릿과 커뮤니티 사례를 조회한 뒤, 다음을 구현해줘: 특정 이벤트 발생 시 Slack 채널에 포맷된 메시지 자동 전송. 스레드 답글(thread_ts 보존), 에러 처리와 재시도 로직 포함.',
  },
  {
    label: 'Gmail 자동화',
    emoji: '📧',
    prompt: 'n8n.io/workflows, docs.n8n.io/integrations, blog.n8n.io에서 Gmail 자동화 템플릿과 베스트 프랙티스를 조회한 뒤, 다음을 구현해줘: 이메일 수신 시 내용 분석 후 자동 분류/응답. OAuth2 설정, 첨부파일 Binary Data 처리, HTML 템플릿 변수 포함.',
  },
  {
    label: 'GitHub 연동',
    emoji: '🐙',
    prompt: 'n8n.io/workflows, github.com/n8n-io/n8n/discussions에서 GitHub 연동 공식 템플릿과 커뮤니티 사례를 조회한 뒤, 다음을 구현해줘: Webhook으로 PR/Issue/Push 이벤트별 분기 처리 → Slack 알림 + 자동 라벨링. Switch 노드로 이벤트 타입 분기.',
  },
  {
    label: '데이터 파이프라인',
    emoji: '🔄',
    prompt: 'n8n.io/workflows, docs.n8n.io/integrations, community.n8n.io/c/show-and-tell에서 데이터 파이프라인 패턴을 조회한 뒤, 다음을 구현해줘: 외부 API 페이지네이션 수집 → Loop Over Items → Code 노드 변환 → DB/Google Sheet upsert. Rate limit 처리 포함.',
  },
  {
    label: 'CRM 연동',
    emoji: '👥',
    prompt: 'n8n.io/workflows, blog.n8n.io에서 CRM 자동화 템플릿(HubSpot/Salesforce)을 조회한 뒤, 다음을 구현해줘: 리드 생성 → 중복 제거(Merge 노드) → CRM Upsert + 담당자 Slack 알림 + 팔로업 스케줄 자동 등록.',
  },
  {
    label: '스케줄 리포트',
    emoji: '📊',
    prompt: 'n8n.io/workflows, community.n8n.io에서 자동 리포트 공식 템플릿을 조회한 뒤, 다음을 구현해줘: Schedule Trigger → DB/API 쿼리 → Code 노드 집계/포맷 → Slack 메시지 + 이메일 발송 → 결과 파일 저장.',
  },
  {
    label: 'AI 자동화',
    emoji: '🤖',
    prompt: 'n8n.io/workflows?categories=25, blog.n8n.io에서 AI 자동화 공식 템플릿을 조회한 뒤, 다음을 구현해줘: Webhook → OpenAI/Anthropic API 호출 → JSON 파싱 → 후속 액션(DB저장/슬랙알림). 토큰 비용 최적화와 에러 핸들링 포함.',
  },
  {
    label: 'Notion 연동',
    emoji: '📝',
    prompt: 'n8n.io/workflows, docs.n8n.io/integrations/builtin에서 Notion 연동 패턴을 조회한 뒤, 다음을 구현해줘: Webhook 또는 Schedule → Notion DB 쿼리/업데이트 → rich_text 타입 처리 → 관련 팀원 Slack 알림.',
  },
  {
    label: 'Google Sheet',
    emoji: '📋',
    prompt: 'n8n.io/workflows, community.n8n.io/c/show-and-tell에서 Google Sheets 자동화 패턴을 조회한 뒤, 다음을 구현해줘: 외부 데이터 → Google Sheets 행 추가/업데이트 + 중복 체크. Batch 처리와 API 할당량 관리 포함.',
  },
  {
    label: 'Webhook 허브',
    emoji: '🔗',
    prompt: 'n8n.io/workflows, docs.n8n.io/integrations/builtin, community.n8n.io에서 Webhook 허브 패턴을 조회한 뒤, 다음을 구현해줘: 단일 Webhook 엔드포인트로 여러 서비스 이벤트 수신 → Switch 노드로 분기 → 각 서비스별 처리 플로우. HMAC 서명 검증 포함.',
  },
]

// ── InfraCategoryAccordion ───────────────────────────────────────────────────
function InfraCategoryAccordion({
  category,
  onSkillSelect,
}: {
  category: InfraCategory
  onSkillSelect?: (prompt: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full px-3 py-2.5 bg-surface hover:bg-border/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">{category.emoji}</span>
          <span className="text-xs font-medium text-dim">{category.label}</span>
          <span className="text-[10px] text-muted/60">{category.skills.length}개</span>
        </div>
        {open
          ? <ChevronDown size={12} className="text-muted" />
          : <ChevronRight size={12} className="text-muted" />}
      </button>

      {open && (
        <div className="divide-y divide-border/50">
          {category.skills.map(skill => (
            <button
              key={skill.label}
              onClick={() => onSkillSelect?.(skill.prompt)}
              title={skill.desc}
              className="flex flex-col items-start gap-0.5 w-full px-3 py-2.5 bg-bg hover:bg-surface/60 transition-colors text-left"
            >
              <span className="text-sm text-dim font-medium">{skill.label}</span>
              <span className="text-[11px] text-muted">{skill.desc}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── CategoryAccordion ─────────────────────────────────────────────────────────
function CategoryAccordion({
  category,
  activeScheduleNames,
  onPresetClick,
}: {
  category: AutomationCategory
  activeScheduleNames: Set<string>
  onPresetClick: (preset: AutomationPreset) => void
}) {
  const [open, setOpen] = useState(true)

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full px-3 py-2 bg-surface hover:bg-border/30 transition-colors"
      >
        <span className="text-xs font-medium text-dim">{category.label}</span>
        {open
          ? <ChevronDown size={12} className="text-muted" />
          : <ChevronRight size={12} className="text-muted" />}
      </button>

      {/* Presets */}
      {open && (
        <div className="divide-y divide-border/50">
          {category.presets.map(preset => {
            const isActive = activeScheduleNames.has(preset.name)
            return (
              <button
                key={preset.name}
                onClick={() => onPresetClick(preset)}
                title={isActive ? '활성 자동화 스케줄 — 클릭하여 관리' : '클릭하여 자동화 스케줄 생성'}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 bg-bg hover:bg-surface/60 transition-colors text-left group"
              >
                {/* 파란 불 (활성 표시) */}
                <div
                  className={cn(
                    'w-2 h-2 rounded-full shrink-0 transition-colors',
                    isActive
                      ? 'bg-blue-500 shadow-[0_0_4px_1px_rgba(59,130,246,0.5)]'
                      : 'bg-border group-hover:bg-border/80'
                  )}
                />
                <span className="text-sm text-dim flex-1 leading-snug">{preset.name}</span>
                {isActive && (
                  <span className="text-[10px] text-blue-400 shrink-0">활성</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── SecurityResultCard ────────────────────────────────────────────────────────
function SecurityResultCard({ content }: { content: string }) {
  const severities = [
    { key: '🔴CRITICAL', label: 'CRITICAL', color: 'border-red-500/50 bg-red-500/10 text-red-400' },
    { key: '🟠HIGH', label: 'HIGH', color: 'border-orange-500/50 bg-orange-500/10 text-orange-400' },
    { key: '🟡MEDIUM', label: 'MEDIUM', color: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400' },
    { key: '🟢LOW', label: 'LOW', color: 'border-green-500/50 bg-green-500/10 text-green-400' },
  ]

  const found = severities.filter(s => content.includes(s.key))
  if (found.length === 0) return null

  return (
    <div className="space-y-1.5 mt-3">
      <p className="text-[10px] text-muted uppercase tracking-widest">보안 스캔 결과</p>
      <div className="flex flex-wrap gap-1.5">
        {found.map(s => (
          <div key={s.key} className={cn('px-2.5 py-1 rounded border text-xs font-medium', s.color)}>
            {s.key.slice(0, 2)} {s.label}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── LEFT: 5탭 최상위 레이아웃 ─────────────────────────────────────────────────
export function OpsLeftPanel({ agentId, onSkillSelect }: { agentId: string; onSkillSelect?: (task: string) => void }) {
  const [mainTab, setMainTab] = useState('ops')
  const [n8nLocal, setN8nLocal] = useState<'checking' | 'online' | 'offline'>('checking')
  const [creatingPreset, setCreatingPreset] = useState<string | null>(null)

  // 보안 탭: feed 에서 최신 결과
  const { data: securityFeed = [] } = useQuery({
    queryKey: ['bot-feed', agentId],
    queryFn: () => agentsApi.runs(agentId),
    select: (data: FeedItem[]) => data.filter(f => f.type === 'result'),
    refetchInterval: 3000,
  })
  const latestSecurityContent = securityFeed[0]?.content ?? ''

  useEffect(() => {
    const controller = new AbortController()
    fetch('http://localhost:5678', { mode: 'no-cors', signal: controller.signal })
      .then(() => setN8nLocal('online'))
      .catch(() => setN8nLocal('offline'))
    return () => controller.abort()
  }, [])

  // 현재 agentId에 연결된 스케줄 목록 조회
  const { data: schedulesData, refetch: refetchSchedules } = useQuery({
    queryKey: ['schedules', agentId],
    queryFn: () => schedulesApi.list({ agent_id: agentId }),
    refetchInterval: 10000,
    staleTime: 5000,
  })

  const activeScheduleNames = new Set<string>(
    ((schedulesData ?? []) as Schedule[])
      .filter(s => s.is_active)
      .map(s => s.name)
  )

  // 프리셋 클릭: AI로 n8n JSON 생성 + 스케줄 등록
  const handlePresetClick = async (preset: AutomationPreset) => {
    setCreatingPreset(preset.name)

    const n8nTask = `"${preset.name}" n8n 워크플로우를 생성해줘. Cron 스케줄: ${preset.triggerValue}. 실제로 n8n에 import할 수 있는 완전한 JSON을 만들어줘.`
    onSkillSelect?.(n8nTask)

    if (!activeScheduleNames.has(preset.name)) {
      try {
        await schedulesApi.create({
          agent_id: agentId,
          mission_id: agentId,
          name: preset.name,
          trigger_type: preset.triggerType,
          trigger_value: preset.triggerValue,
        })
        await refetchSchedules()
      } catch {
        // 스케줄 생성 실패는 조용히 무시
      }
    }

    setCreatingPreset(null)
  }

  return (
    <div className="h-full flex flex-col">
      {/* 최상위 5탭 */}
      <div className="shrink-0 flex border-b border-border overflow-x-auto">
        {OPS_MAIN_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setMainTab(tab.key)}
            className={cn(
              'px-3 py-2.5 text-xs whitespace-nowrap border-b-2 -mb-px transition-colors shrink-0',
              mainTab === tab.key
                ? 'border-primary text-text'
                : 'border-transparent text-muted hover:text-dim'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 탭별 콘텐츠 */}
      <div className="flex-1 overflow-y-auto">
        {/* ── [운영] 탭: 기존 OpsLeftPanel 콘텐츠 ── */}
        {mainTab === 'ops' && (
          <div className="p-4 space-y-4">
            {/* n8n 상태 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted uppercase tracking-widest">n8n 연동</p>
                <div className="flex items-center gap-1">
                  <div className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    n8nLocal === 'online' ? 'bg-green-500' :
                    n8nLocal === 'offline' ? 'bg-red-400' :
                    'bg-yellow-400 animate-pulse'
                  )} />
                  <span className="text-[10px] text-muted">
                    {n8nLocal === 'online' ? '로컬 실행 중' :
                     n8nLocal === 'offline' ? '미실행' : '확인 중'}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <a
                  href="http://localhost:5678"
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    'flex-1 text-center py-1.5 rounded text-xs border transition-colors',
                    n8nLocal === 'online'
                      ? 'border-green-500/40 text-green-400 hover:bg-green-500/10'
                      : 'border-border text-muted/40 pointer-events-none'
                  )}
                >
                  로컬 열기
                </a>
                <a
                  href="https://n8n.cloud"
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 text-center py-1.5 rounded text-xs border border-primary/30 text-primary hover:bg-primary/5 transition-colors"
                >
                  n8n.cloud ↗
                </a>
              </div>
            </div>

            {/* 범례 */}
            <div className="flex items-center gap-1.5 px-1">
              <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_4px_1px_rgba(59,130,246,0.5)]" />
              <span className="text-[10px] text-muted">활성화된 자동화 스케줄</span>
            </div>

            {/* 카테고리별 자동화 프리셋 */}
            <div className="space-y-2">
              {AUTOMATION_CATEGORIES.map(cat => (
                <CategoryAccordion
                  key={cat.id}
                  category={cat}
                  activeScheduleNames={activeScheduleNames}
                  onPresetClick={handlePresetClick}
                />
              ))}
            </div>

            {creatingPreset && (
              <p className="text-[10px] text-muted text-center animate-pulse">
                "{creatingPreset}" 스케줄 생성 중...
              </p>
            )}
          </div>
        )}

        {/* ── [인프라] 탭 ── */}
        {mainTab === 'infra' && (
          <div className="p-4 space-y-3">
            {INFRA_CATEGORIES.map(cat => (
              <InfraCategoryAccordion
                key={cat.id}
                category={cat}
                onSkillSelect={onSkillSelect}
              />
            ))}
          </div>
        )}

        {/* ── [연동] 탭 ── */}
        {mainTab === 'integration' && (
          <div className="p-4 space-y-4">
            {/* n8n 템플릿 */}
            <div>
              <p className="text-xs text-muted uppercase tracking-widest mb-2">📚 n8n 멀티소스 템플릿</p>
              <div className="flex flex-wrap gap-1.5">
                {N8N_CATEGORIES.map(cat => (
                  <button
                    key={cat.label}
                    onClick={() => onSkillSelect?.(cat.prompt)}
                    title={cat.prompt}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-bg text-xs text-dim hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-colors"
                  >
                    <span>{cat.emoji}</span>
                    <span>{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 외부 서비스 연동 */}
            <div>
              <p className="text-xs text-muted uppercase tracking-widest mb-2">외부 서비스 연동</p>
              <div className="flex flex-wrap gap-1.5">
                {EXTERNAL_SKILLS.map(skill => (
                  <button
                    key={skill.label}
                    onClick={() => onSkillSelect?.(skill.prompt)}
                    title={skill.prompt}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-bg text-xs text-dim hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-colors"
                  >
                    <span>{skill.emoji}</span>
                    <span>{skill.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── [환경변수] 탭 ── */}
        {mainTab === 'env' && (
          <div className="p-4 space-y-3">
            <p className="text-xs text-muted uppercase tracking-widest">환경변수 관리</p>
            <div className="space-y-2">
              {ENV_ACTIONS.map(action => (
                <button
                  key={action.label}
                  onClick={() => onSkillSelect?.(action.prompt)}
                  title={action.prompt}
                  className="w-full flex flex-col items-start gap-0.5 px-3 py-3 rounded-lg border border-border bg-bg hover:border-primary/40 hover:bg-primary/5 transition-colors text-left"
                >
                  <span className="text-sm text-dim font-medium">{action.label}</span>
                  <span className="text-[11px] text-muted">{action.desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── [보안] 탭 ── */}
        {mainTab === 'security' && (
          <div className="p-4 space-y-3">
            <p className="text-xs text-muted uppercase tracking-widest">보안 감사</p>
            <div className="space-y-2">
              {SECURITY_ACTIONS.map(action => (
                <button
                  key={action.label}
                  onClick={() => onSkillSelect?.(action.prompt)}
                  title={action.prompt}
                  className="w-full flex flex-col items-start gap-0.5 px-3 py-3 rounded-lg border border-border bg-bg hover:border-primary/40 hover:bg-primary/5 transition-colors text-left"
                >
                  <span className="text-sm text-dim font-medium">{action.label}</span>
                  <span className="text-[11px] text-muted">{action.desc}</span>
                </button>
              ))}
            </div>

            {/* 보안 스캔 결과 카드 */}
            {latestSecurityContent && (
              <SecurityResultCard content={latestSecurityContent} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// CENTER: 운영 탭
export function OpsCenterPanel({ agentId, streamOutput, isRunning }: { agentId: string; streamOutput?: string; isRunning?: boolean }) {
  const [activeTab, setActiveTab] = useState('automation')
  const { data: feed = [] } = useQuery({
    queryKey: ['bot-feed', agentId],
    queryFn: () => agentsApi.runs(agentId),
    select: (data: FeedItem[]) => data.filter(f => f.type === 'result'),
    refetchInterval: 3000,
  })

  const latest = feed[0]

  return (
    <div className="h-full flex flex-col">
      <div className="flex border-b border-border px-4 shrink-0">
        {OPS_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-3 text-sm border-b-2 -mb-px transition-colors',
              activeTab === tab.key
                ? 'border-primary text-text'
                : 'border-transparent text-muted hover:text-dim'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {isRunning ? (
          <pre className="text-base text-dim leading-relaxed whitespace-pre-wrap font-sans">{streamOutput || '자동화 구성 중...'}</pre>
        ) : !latest ? (
          streamOutput ? (
            <pre className="text-base text-dim leading-relaxed whitespace-pre-wrap font-sans">{streamOutput}</pre>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <Zap size={36} className="text-muted/30" />
              <p className="text-base text-muted">하단 입력창에서 자동화를 지시하세요</p>
              <p className="text-sm text-muted/60">"Slack 알림 자동화 워크플로우 만들어줘" 등</p>
            </div>
          )
        ) : (
          <div className="text-base text-dim leading-relaxed whitespace-pre-wrap">
            {latest.content}
          </div>
        )}
      </div>
    </div>
  )
}

const OPS_SKILLS = [
  { label: 'n8n 워크플로우', prompt: '/new-n8n-workflow Slack 메시지가 오면 자동으로 이슈를 생성하는 n8n 워크플로우를 만들어줘' },
  { label: '월간 재무', prompt: '/monthly-finance 이번 달 수입/지출 현황을 정리하고 MRR, 순이익, API 비용을 분석해줘' },
  { label: '비용 감사', prompt: '/audit-costs 현재 모든 구독 서비스와 API 비용을 감사하고 절감 방안을 제시해줘' },
  { label: '장애 보고서', prompt: '/incident-report 오늘 발생한 장애의 원인, 영향, 재발 방지 방안을 정리해줘' },
  { label: '세금 준비', prompt: '/tax-prep 이번 분기 세금 신고를 위한 수입/지출 데이터를 정리해줘' },
]

// RIGHT: n8n 워크플로우 관리 + import + 다음봇
export function OpsRightPanel({ agentId, onSkillSelect, currentRole = 'ops', content = '' }: {
  agentId: string
  nextBotName?: string
  onNextBot?: () => void
  onSkillSelect?: (prompt: string) => void
  currentRole?: string
  content?: string
}) {
  const [n8nStatus, setN8nStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    fetch('http://localhost:5678', { mode: 'no-cors', signal: ctrl.signal })
      .then(() => setN8nStatus('online'))
      .catch(() => setN8nStatus('offline'))
    return () => ctrl.abort()
  }, [])

  const { data: feed = [] } = useQuery({
    queryKey: ['bot-feed', agentId],
    queryFn: () => agentsApi.runs(agentId),
    select: (data: FeedItem[]) => data.filter(f => f.type === 'result'),
    refetchInterval: 3000,
  })

  const workflowResults = feed.filter(f => f.content.includes('"nodes"'))

  const extractJson = (wfContent: string): string => {
    const match = wfContent.match(/```json\n([\s\S]+?)\n```/)
    return match ? match[1] : wfContent
  }

  const handleDownloadWorkflow = (wfContent: string, idx: number) => {
    const json = extractJson(wfContent)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `oomni-workflow-${idx + 1}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleCopyWorkflow = (wfContent: string) => {
    navigator.clipboard.writeText(extractJson(wfContent))
    setImportMsg('클립보드에 복사됨!')
    setTimeout(() => setImportMsg(null), 2000)
  }

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const json = ev.target?.result as string
        JSON.parse(json) // validate
        const blob = new Blob([json], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = file.name
        a.click()
        URL.revokeObjectURL(url)
        setImportMsg('다운로드 완료! n8n에서 Import하세요')
      } catch {
        setImportMsg('유효하지 않은 JSON 파일입니다')
      }
      setTimeout(() => setImportMsg(null), 3000)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="p-4 h-full flex flex-col gap-4 overflow-y-auto">
      {/* n8n 연동 상태 */}
      <div>
        <p className="text-xs text-muted uppercase tracking-widest mb-2">n8n 연동</p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-bg border border-border">
            <div className="flex items-center gap-2">
              <div className={cn('w-2 h-2 rounded-full', n8nStatus === 'online' ? 'bg-green-500' : n8nStatus === 'offline' ? 'bg-red-400' : 'bg-yellow-400 animate-pulse')} />
              <span className="text-xs text-dim">로컬 n8n</span>
            </div>
            {n8nStatus === 'online' ? (
              <a href="http://localhost:5678" target="_blank" rel="noreferrer" className="text-[10px] text-primary hover:underline">열기 ↗</a>
            ) : (
              <span className="text-[10px] text-muted">미실행</span>
            )}
          </div>
          <a href="https://n8n.cloud" target="_blank" rel="noreferrer"
            className="flex items-center justify-between px-3 py-2 rounded-lg bg-bg border border-border hover:border-primary/40 transition-colors">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-400" />
              <span className="text-xs text-dim">n8n Cloud</span>
            </div>
            <span className="text-[10px] text-primary">접속 ↗</span>
          </a>
        </div>
      </div>

      <div className="flex-1">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted uppercase tracking-widest">워크플로우 관리</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-[10px] text-primary border border-primary/30 rounded px-1.5 py-0.5 hover:bg-primary/5 transition-colors"
          >
            JSON 불러오기
          </button>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
        </div>

        {importMsg && (
          <div className="mb-2 px-2 py-1.5 rounded bg-primary/10 border border-primary/20 text-[11px] text-primary">
            {importMsg}
          </div>
        )}

        {workflowResults.length === 0 ? (
          <div className="text-center py-3">
            <p className="text-xs text-muted/60 mb-1">AI가 생성한 워크플로우가 없습니다</p>
            <p className="text-[10px] text-muted/40">봇에게 n8n 워크플로우 생성을 요청하세요</p>
          </div>
        ) : (
          <div className="space-y-2">
            {workflowResults.map((wf, i) => (
              <div key={wf.id} className="px-3 py-3 rounded-lg bg-bg border border-border">
                <p className="text-xs text-dim mb-2 font-medium">워크플로우 #{i + 1}</p>
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    onClick={() => handleDownloadWorkflow(wf.content, i)}
                    className="flex items-center gap-1 text-[10px] text-primary border border-primary/30 rounded px-1.5 py-0.5 hover:bg-primary/5 transition-colors"
                  >
                    <Download size={9} /> 다운로드
                  </button>
                  <button
                    onClick={() => handleCopyWorkflow(wf.content)}
                    className="flex items-center gap-1 text-[10px] text-muted border border-border rounded px-1.5 py-0.5 hover:text-text transition-colors"
                  >
                    <Copy size={9} /> 복사
                  </button>
                  {n8nStatus === 'online' && (
                    <a
                      href="http://localhost:5678/workflow/new"
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => handleCopyWorkflow(wf.content)}
                      className="flex items-center gap-1 text-[10px] text-green-400 border border-green-500/30 rounded px-1.5 py-0.5 hover:bg-green-500/10 transition-colors"
                      title="JSON이 클립보드에 복사됩니다. n8n에서 붙여넣기 하세요."
                    >
                      n8n Import ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 빠른 실행 */}
      <div>
        <p className="text-xs text-muted uppercase tracking-widest mb-2.5">빠른 실행</p>
        <div className="flex flex-wrap gap-1.5">
          {OPS_SKILLS.map(skill => (
            <button
              key={skill.label}
              onClick={() => onSkillSelect?.(skill.prompt)}
              title={skill.prompt}
              className="px-2.5 py-1.5 rounded-lg border border-border bg-bg text-xs text-dim hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-colors"
            >
              {skill.label}
            </button>
          ))}
        </div>
      </div>

      <ArchiveButton
        content={feed[0]?.content ?? ''}
        title={feed[0]?.content?.slice(0, 50)}
        botRole="ops"
        tags={['OOMNI', 'ops']}
      />

      <NextBotDropdown currentAgentId={agentId} currentRole={currentRole} content={content} />
    </div>
  )
}
