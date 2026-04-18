import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { workspaceApi, type FileNode } from '../../../lib/api'
import {
  ChevronRight, ChevronDown, File, Folder, FolderOpen,
  Copy, Check, Code2, ClipboardCheck, Layers
} from 'lucide-react'
import { cn } from '../../../lib/utils'
import { ArchiveButton } from '../shared/ArchiveButton'
import { NextBotDropdown } from '../shared/NextBotDropdown'

// ── Category tab definitions ─────────────────────────────────────────────────
type Category = 'all' | 'frontend' | 'backend' | 'setup'

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'frontend', label: '프론트엔드' },
  { id: 'backend', label: '백엔드' },
  { id: 'setup', label: '초기세팅' },
]

// Extensions that belong to each category
const CATEGORY_EXTENSIONS: Record<Exclude<Category, 'all' | 'setup'>, string[]> = {
  frontend: ['tsx', 'jsx', 'ts', 'js', 'css', 'scss', 'html', 'svg'],
  backend: ['ts', 'js', 'py', 'go', 'rs', 'java', 'sh'],
}

const CATEGORY_KEYWORDS: Record<Exclude<Category, 'all' | 'setup'>, string[]> = {
  frontend: ['component', 'page', 'layout', 'ui', 'view', 'style', 'theme', 'hook'],
  backend: ['api', 'server', 'route', 'service', 'middleware', 'controller', 'handler'],
}

function fileMatchesCategory(node: FileNode, category: Category): boolean {
  if (category === 'all' || category === 'setup') return true
  const name = node.name.toLowerCase()
  const ext = name.split('.').pop() ?? ''
  const keywords = CATEGORY_KEYWORDS[category as 'frontend' | 'backend']
  const extensions = CATEGORY_EXTENSIONS[category as 'frontend' | 'backend']
  return extensions.includes(ext) || keywords.some(k => name.includes(k))
}

// ── Language icon colors ──────────────────────────────────────────────────────
const LANG_COLORS: Record<string, string> = {
  tsx: 'text-blue-400', ts: 'text-blue-400', jsx: 'text-yellow-400', js: 'text-yellow-400',
  py: 'text-green-400', json: 'text-orange-400', md: 'text-gray-400',
  css: 'text-pink-400', scss: 'text-pink-500', html: 'text-orange-500',
  sql: 'text-purple-400', sh: 'text-green-500', yaml: 'text-red-400',
  yml: 'text-red-400', toml: 'text-red-300', env: 'text-yellow-500',
  rs: 'text-orange-600', go: 'text-cyan-400', java: 'text-red-500',
}

function getLangColor(node: FileNode): string {
  const ext = node.name.split('.').pop() ?? ''
  return LANG_COLORS[ext] ?? 'text-muted'
}

// ── Syntax highlighting (simple tokenizer) ───────────────────────────────────
const KW_GENERAL = [
  'import', 'export', 'default', 'from', 'const', 'let', 'var', 'function',
  'return', 'if', 'else', 'for', 'while', 'class', 'extends', 'interface',
  'type', 'async', 'await', 'new', 'this', 'true', 'false', 'null', 'undefined',
  'try', 'catch', 'throw', 'typeof', 'instanceof', 'void', 'in', 'of',
  'def', 'pass', 'print', 'and', 'or', 'not', 'is', 'with', 'as',
]

interface Token { type: 'keyword' | 'string' | 'comment' | 'number' | 'tag' | 'plain'; value: string }

function tokenize(line: string): Token[] {
  const tokens: Token[] = []
  let remaining = line

  while (remaining.length > 0) {
    // Comment
    if (remaining.startsWith('//') || remaining.startsWith('#')) {
      tokens.push({ type: 'comment', value: remaining })
      break
    }
    // String (double or single quote)
    const strMatch = remaining.match(/^(['"`])(?:[^\\]|\\.)*?\1/)
    if (strMatch) {
      tokens.push({ type: 'string', value: strMatch[0] })
      remaining = remaining.slice(strMatch[0].length)
      continue
    }
    // JSX tag
    const tagMatch = remaining.match(/^<\/?[A-Za-z][A-Za-z0-9.]*/)
    if (tagMatch) {
      tokens.push({ type: 'tag', value: tagMatch[0] })
      remaining = remaining.slice(tagMatch[0].length)
      continue
    }
    // Number
    const numMatch = remaining.match(/^-?\d+(\.\d+)?/)
    if (numMatch) {
      tokens.push({ type: 'number', value: numMatch[0] })
      remaining = remaining.slice(numMatch[0].length)
      continue
    }
    // Word — keyword or plain
    const wordMatch = remaining.match(/^[A-Za-z_$][A-Za-z0-9_$]*/)
    if (wordMatch) {
      const word = wordMatch[0]
      const isKw = KW_GENERAL.includes(word)
      tokens.push({ type: isKw ? 'keyword' : 'plain', value: word })
      remaining = remaining.slice(word.length)
      continue
    }
    // Single char fallthrough
    tokens.push({ type: 'plain', value: remaining[0] })
    remaining = remaining.slice(1)
  }

  return tokens
}

const TOKEN_CLASS: Record<Token['type'], string> = {
  keyword: 'text-purple-400 font-medium',
  string: 'text-green-400',
  comment: 'text-gray-500 italic',
  number: 'text-orange-400',
  tag: 'text-blue-400',
  plain: 'text-dim',
}

function SyntaxLine({ line }: { line: string }) {
  const tokens = tokenize(line)
  return (
    <>
      {tokens.map((t, i) => (
        <span key={i} className={TOKEN_CLASS[t.type]}>{t.value}</span>
      ))}
    </>
  )
}

// ── SKILLS ────────────────────────────────────────────────────────────────────
const BUILD_SKILLS = [
  { label: '컴포넌트 생성', prompt: '/new-component 재사용 가능한 React 컴포넌트를 TypeScript + Tailwind CSS로 만들어줘. Props 타입 정의와 기본 스타일 포함.' },
  { label: 'API 라우트 추가', prompt: '/new-api-route 새로운 REST API 라우트를 Zod 검증과 에러 처리 포함해서 만들어줘.' },
  { label: '결제 연동', prompt: '/add-payment Toss Payments로 결제 기능을 구현해줘. 결제 요청, 성공/실패 처리, DB 저장까지 포함.' },
  { label: 'DB 스키마 설정', prompt: '/setup-db 새로운 데이터베이스 테이블 스키마를 설계하고 마이그레이션 파일을 만들어줘.' },
  { label: '보안 감사', prompt: '/security-audit 현재 코드베이스의 OWASP Top 10 기준 보안 취약점을 점검하고 수정 방법을 알려줘.' },
  { label: '코드 리뷰', prompt: '/code-review 현재 워크스페이스 코드를 리뷰하고 버그, 성능 문제, 개선 포인트를 알려줘.' },
  { label: '인증 설정', prompt: '/setup-auth Google OAuth + 세션 기반 인증을 구현해줘. 로그인/로그아웃/세션 유지 포함.' },
  { label: '애널리틱스 추가', prompt: '/add-analytics PostHog를 연동해서 주요 사용자 행동을 트래킹하는 코드를 추가해줘.' },
]

const FRONTEND_SKILLS = [
  { label: 'shadcn/ui 추가', prompt: '/add-shadcn shadcn/ui 컴포넌트를 설치하고 프로젝트에 적용해줘' },
  { label: 'Tailwind 스타일', prompt: '/tailwind-style 현재 컴포넌트에 Tailwind CSS 스타일을 적용해줘' },
  { label: '반응형 수정', prompt: '/responsive 현재 UI를 모바일/태블릿/데스크톱 반응형으로 수정해줘' },
  { label: '컴포넌트 생성', prompt: '/new-component 재사용 가능한 React 컴포넌트를 TypeScript + Tailwind CSS로 만들어줘' },
]

const BACKEND_SKILLS = [
  { label: 'API 라우트', prompt: '/new-api-route 새로운 REST API 라우트를 Zod 검증과 에러 처리 포함해서 만들어줘' },
  { label: 'DB 스키마', prompt: '/setup-db 새로운 데이터베이스 테이블 스키마를 설계하고 마이그레이션 파일을 만들어줘' },
  { label: 'RLS 정책', prompt: '/setup-rls Supabase Row Level Security 정책을 설정해줘' },
  { label: 'Edge Function', prompt: '/new-edge-function Supabase Edge Function을 만들어줘' },
]

// ── ProjectSetupWizard ────────────────────────────────────────────────────────
function ProjectSetupWizard({ onSkillSelect }: { onSkillSelect?: (prompt: string) => void }) {
  const [wizardStep, setWizardStep] = useState<'menu' | 'techstack'>('menu')
  const [techStack, setTechStack] = useState({
    name: '',
    stack: 'nextjs',
    db: 'supabase',
    auth: 'google',
    deploy: 'vercel',
  })

  const SETUP_ACTIONS = [
    {
      label: 'CLAUDE.md 생성',
      desc: '프로젝트 운영 원칙 + 표준 명령 정의',
      prompt: `현재 프로젝트 워크스페이스에 CLAUDE.md 파일을 생성해줘. 포함 내용:
## Mission - 프로젝트 목적
## Required workflow - before/after coding 절차
## Definition of done - lint+typecheck+test 통과 기준
## Standard commands - dev/lint/typecheck/test/e2e
## Guardrails - PRD 없는 기능 추가 금지, ADR 없는 아키텍처 변경 금지`,
    },
    {
      label: '.claude/rules/ 생성',
      desc: '영역별 AI 운영 규칙 파일 세트',
      prompt: `.claude/rules/ 디렉토리에 다음 파일들을 생성해줘:
- 00-global.md: 전역 코딩 원칙
- 10-frontend.md: React/TypeScript/Tailwind 규칙
- 20-backend.md: API/서비스/미들웨어 규칙
- 30-db.md: DB 스키마/마이그레이션/RLS 규칙
- 40-testing.md: 테스트 수준별 필수 기준
- 50-security.md: OWASP/인증/권한 규칙
- 60-doc-sync.md: 문서 동기화 규칙`,
    },
    {
      label: 'docs/ 구조 생성',
      desc: 'PRD · ADR · WBS · Architecture 템플릿',
      prompt: `docs/ 디렉토리 구조를 생성해줘:
docs/prd/README.md - 기능 ID 체계 (AUTH-01, BUILD-03 형식)
docs/adr/template.md - 아키텍처 결정 기록 템플릿
docs/wbs/template.md - WBS 티켓 템플릿 (목적/입력문서/완료조건/테스트조건)
docs/architecture/system-context.md - 시스템 경계
docs/architecture/module-map.md - 디렉토리 책임 분리`,
    },
  ]

  const STACK_OPTIONS = [
    { value: 'nextjs', label: 'Next.js (App Router)' },
    { value: 'vite-react', label: 'Vite + React' },
    { value: 'remix', label: 'Remix' },
    { value: 'nuxt', label: 'Nuxt.js (Vue)' },
  ]

  const DB_OPTIONS = [
    { value: 'supabase', label: 'Supabase (PostgreSQL)' },
    { value: 'planetscale', label: 'PlanetScale (MySQL)' },
    { value: 'neon', label: 'Neon (PostgreSQL)' },
    { value: 'mongodb', label: 'MongoDB Atlas' },
  ]

  const AUTH_OPTIONS = [
    { value: 'google', label: 'Google OAuth' },
    { value: 'github', label: 'GitHub OAuth' },
    { value: 'email', label: 'Email + Password' },
    { value: 'magic-link', label: 'Magic Link' },
  ]

  const DEPLOY_OPTIONS = [
    { value: 'vercel', label: 'Vercel' },
    { value: 'netlify', label: 'Netlify' },
    { value: 'fly', label: 'Fly.io' },
    { value: 'aws', label: 'AWS (ECS/Lambda)' },
  ]

  const handleTechStackSubmit = () => {
    const prompt = `다음 기술스택으로 새 프로젝트를 초기 설정해줘:
프로젝트명: ${techStack.name || '새 프로젝트'}
프레임워크: ${STACK_OPTIONS.find(o => o.value === techStack.stack)?.label ?? techStack.stack}
데이터베이스: ${DB_OPTIONS.find(o => o.value === techStack.db)?.label ?? techStack.db}
인증: ${AUTH_OPTIONS.find(o => o.value === techStack.auth)?.label ?? techStack.auth}
배포: ${DEPLOY_OPTIONS.find(o => o.value === techStack.deploy)?.label ?? techStack.deploy}

포함 내용:
1. 프로젝트 폴더 구조 생성
2. 필수 의존성 설치 (package.json)
3. 환경변수 템플릿 (.env.example)
4. DB 연결 설정
5. 인증 설정
6. 배포 설정 파일`
    onSkillSelect?.(prompt)
    setWizardStep('menu')
  }

  if (wizardStep === 'techstack') {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => setWizardStep('menu')}
            className="text-muted hover:text-text text-xs transition-colors"
          >
            ← 뒤로
          </button>
          <p className="text-xs font-medium text-dim">기술스택 결정 위자드</p>
        </div>

        {/* Project name */}
        <div>
          <label className="text-[10px] text-muted uppercase tracking-widest block mb-1">프로젝트명</label>
          <input
            type="text"
            placeholder="my-awesome-app"
            value={techStack.name}
            onChange={e => setTechStack(s => ({ ...s, name: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-dim placeholder:text-muted/40 focus:outline-none focus:border-primary/50"
          />
        </div>

        {/* Stack */}
        <div>
          <label className="text-[10px] text-muted uppercase tracking-widest block mb-1">프레임워크</label>
          <select
            value={techStack.stack}
            onChange={e => setTechStack(s => ({ ...s, stack: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-dim focus:outline-none focus:border-primary/50"
          >
            {STACK_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* DB */}
        <div>
          <label className="text-[10px] text-muted uppercase tracking-widest block mb-1">데이터베이스</label>
          <select
            value={techStack.db}
            onChange={e => setTechStack(s => ({ ...s, db: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-dim focus:outline-none focus:border-primary/50"
          >
            {DB_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Auth */}
        <div>
          <label className="text-[10px] text-muted uppercase tracking-widest block mb-1">인증</label>
          <select
            value={techStack.auth}
            onChange={e => setTechStack(s => ({ ...s, auth: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-dim focus:outline-none focus:border-primary/50"
          >
            {AUTH_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Deploy */}
        <div>
          <label className="text-[10px] text-muted uppercase tracking-widest block mb-1">배포 환경</label>
          <select
            value={techStack.deploy}
            onChange={e => setTechStack(s => ({ ...s, deploy: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-dim focus:outline-none focus:border-primary/50"
          >
            {DEPLOY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <button
          onClick={handleTechStackSubmit}
          className="w-full py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          프로젝트 생성
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-3">
      <p className="text-xs text-muted uppercase tracking-widest mb-3">프로젝트 초기 설계</p>
      {SETUP_ACTIONS.map(action => (
        <button
          key={action.label}
          onClick={() => onSkillSelect?.(action.prompt)}
          className="w-full text-left p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors"
        >
          <p className="text-sm font-medium text-dim">{action.label}</p>
          <p className="text-xs text-muted mt-0.5">{action.desc}</p>
        </button>
      ))}
      <button
        onClick={() => setWizardStep('techstack')}
        className="w-full text-left p-3 rounded-lg border border-primary/30 hover:border-primary/60 hover:bg-primary/5 transition-colors"
      >
        <p className="text-sm font-medium text-primary">기술스택 결정 위자드</p>
        <p className="text-xs text-muted mt-0.5">Next.js · DB · Auth · 배포 환경 선택 → 프로젝트 생성</p>
      </button>
    </div>
  )
}

// ── FileTreeNode (recursive) ──────────────────────────────────────────────────
function FileTreeNode({
  node, depth = 0, selectedPath, onSelect, category,
}: {
  node: FileNode
  depth?: number
  selectedPath: string | null
  onSelect: (node: FileNode) => void
  category: Category
}) {
  const [open, setOpen] = useState(depth === 0)

  if (!fileMatchesCategory(node, category) && node.type === 'file') return null

  if (node.type === 'directory') {
    const hasVisibleChildren = (node.children ?? []).some(
      c => c.type === 'directory' || fileMatchesCategory(c, category)
    )
    if (!hasVisibleChildren && category !== 'all') return null

    return (
      <div>
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1.5 w-full px-2 py-1 rounded hover:bg-surface text-left transition-colors"
          style={{ paddingLeft: `${8 + depth * 14}px` }}
        >
          {open
            ? <ChevronDown size={11} className="text-muted shrink-0" />
            : <ChevronRight size={11} className="text-muted shrink-0" />}
          {open
            ? <FolderOpen size={13} className="text-primary/70 shrink-0" />
            : <Folder size={13} className="text-primary/50 shrink-0" />}
          <span className="text-xs text-dim truncate">{node.name}</span>
        </button>
        {open && (
          <div>
            {(node.children ?? []).map(child => (
              <FileTreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                onSelect={onSelect}
                category={category}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  const isSelected = selectedPath === node.path
  return (
    <button
      onClick={() => onSelect(node)}
      className={cn(
        'flex items-center gap-1.5 w-full px-2 py-1 rounded text-left transition-colors',
        isSelected ? 'bg-primary/15 text-primary' : 'hover:bg-surface text-dim'
      )}
      style={{ paddingLeft: `${8 + depth * 14}px` }}
    >
      <File size={12} className={cn('shrink-0', getLangColor(node))} />
      <span className="text-xs truncate flex-1">{node.name}</span>
      {node.language && (
        <span className="text-[10px] text-muted/50 shrink-0">{node.language}</span>
      )}
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEFT: File Tree + Category Tabs
// ═══════════════════════════════════════════════════════════════════════════════
export function BuildLeftPanel({
  agentId,
  selectedFilePath,
  onFileSelect,
  onSkillSelect,
  onCategoryChange,
}: {
  agentId: string
  selectedFilePath: string | null
  onFileSelect: (node: FileNode) => void
  onSkillSelect?: (prompt: string) => void
  onCategoryChange?: (category: Category) => void
}) {
  const [category, setCategory] = useState<Category>('all')

  const handleCategoryChange = (cat: Category) => {
    setCategory(cat)
    onCategoryChange?.(cat)
  }

  const { data } = useQuery({
    queryKey: ['workspace-files', agentId],
    queryFn: () => workspaceApi.files(agentId),
    refetchInterval: 3000,
    staleTime: 2000,
  })

  const tree = data?.data ?? []

  return (
    <div className="flex flex-col h-full">
      {/* Category tabs */}
      <div className="px-2 pt-3 pb-2 border-b border-border">
        <div className="flex flex-wrap gap-1">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => handleCategoryChange(cat.id)}
              className={cn(
                'px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
                category === cat.id
                  ? 'bg-primary text-white'
                  : 'bg-border/40 text-muted hover:bg-border hover:text-dim'
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* File tree or Setup Wizard */}
      <div className="flex-1 overflow-y-auto py-2">
        {category === 'setup' ? (
          <ProjectSetupWizard onSkillSelect={onSkillSelect} />
        ) : tree.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <Layers size={24} className="text-muted/30 mx-auto mb-2" />
            <p className="text-xs text-muted/60">워크스페이스가 비어있습니다</p>
            <p className="text-[10px] text-muted/40 mt-1">태스크를 실행하면 파일이 생성됩니다</p>
          </div>
        ) : (
          tree.map(node => (
            <FileTreeNode
              key={node.path}
              node={node}
              selectedPath={selectedFilePath}
              onSelect={onFileSelect}
              category={category}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// CENTER: Code Editor View
// ═══════════════════════════════════════════════════════════════════════════════
export function BuildCenterPanel({
  agentId,
  selectedFile,
  isRunning,
  streamContent,
}: {
  agentId: string
  selectedFile: FileNode | null
  isRunning: boolean
  streamContent: string
}) {
  const [copied, setCopied] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const { data: fileData } = useQuery({
    queryKey: ['workspace-file-content', agentId, selectedFile?.path],
    queryFn: () => workspaceApi.content(agentId, selectedFile!.path),
    enabled: !!selectedFile && !isRunning,
    staleTime: 3000,
  })

  // While running, show stream; when file selected & idle, show file content
  const displayContent = isRunning
    ? streamContent
    : (fileData?.data ?? '')

  // Auto-scroll during streaming
  useEffect(() => {
    if (isRunning) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [streamContent, isRunning])

  const handleCopy = async () => {
    if (!displayContent) return
    await navigator.clipboard.writeText(displayContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!selectedFile && !isRunning) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
        <Code2 size={36} className="text-muted/30" />
        <p className="text-sm text-muted">파일을 선택하거나 태스크를 실행하세요</p>
        <p className="text-xs text-muted/60">왼쪽 파일 트리에서 파일을 클릭하면 코드를 볼 수 있습니다</p>
      </div>
    )
  }

  const lines = displayContent.split('\n')
  const filename = isRunning ? '실행 중...' : (selectedFile?.name ?? '')

  return (
    <div className="flex flex-col h-full bg-bg">
      {/* File header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-2">
          <File size={13} className={selectedFile ? getLangColor(selectedFile) : 'text-primary'} />
          <span className="text-sm font-medium text-dim truncate max-w-[200px]">{filename}</span>
          {isRunning && (
            <span className="flex items-center gap-1 text-[10px] text-primary">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              생성 중
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            disabled={!displayContent}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs text-muted hover:text-dim hover:bg-border/40 transition-colors disabled:opacity-40"
          >
            {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
            {copied ? '복사됨' : '복사'}
          </button>
        </div>
      </div>

      {/* Code content */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs font-mono leading-relaxed">
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="hover:bg-surface/50 transition-colors">
                <td className="select-none text-muted/40 text-right pr-3 pl-4 py-0 w-10 shrink-0 border-r border-border/30">
                  {i + 1}
                </td>
                <td className="pl-4 pr-4 py-0 whitespace-pre">
                  <SyntaxLine line={line} />
                </td>
              </tr>
            ))}
            {isRunning && (
              <tr>
                <td className="select-none text-muted/40 text-right pr-3 pl-4 py-0 w-10 shrink-0 border-r border-border/30">
                  {lines.length + 1}
                </td>
                <td className="pl-4 pr-4 py-0">
                  <span className="inline-block w-2 h-4 bg-primary animate-pulse rounded-sm" />
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// RIGHT: Task Checklist + Skills
// ═══════════════════════════════════════════════════════════════════════════════

// Parse task list from feed content
interface TaskItem { label: string; done: boolean }

function parseTasksFromContent(content: string): TaskItem[] {
  const lines = content.split('\n')
  const tasks: TaskItem[] = []
  for (const line of lines) {
    const doneMatch = line.match(/^[\-\*]?\s*\[x\]\s+(.+)/i)
    const todoMatch = line.match(/^[\-\*]?\s*\[\s\]\s+(.+)/i)
    if (doneMatch) tasks.push({ label: doneMatch[1].trim(), done: true })
    else if (todoMatch) tasks.push({ label: todoMatch[1].trim(), done: false })
  }
  return tasks
}

export function BuildRightPanel({
  agentId,
  onSkillSelect,
  currentRole = 'build',
  content = '',
  currentCategory,
}: {
  agentId: string
  nextBotName?: string
  onNextBot?: () => void
  onSkillSelect?: (skill: string) => void
  currentRole?: string
  content?: string
  currentCategory?: string
}) {
  const { data: feedData } = useQuery({
    queryKey: ['bot-feed', agentId],
    queryFn: () => import('../../../lib/api').then(m => m.agentsApi.runs(agentId)),
    select: (items: import('../../../lib/api').FeedItem[]) => items,
    refetchInterval: 3000,
  })

  const feed = feedData ?? []

  // Extract task-like items from feed content
  const allTasks: TaskItem[] = []
  for (const item of feed) {
    const parsed = parseTasksFromContent(item.content)
    allTasks.push(...parsed)
  }

  // Fallback: if no structured tasks, synthesize from result/error items
  const syntheticTasks: TaskItem[] =
    allTasks.length === 0
      ? feed
          .filter(f => f.type === 'result' || f.type === 'info')
          .slice(0, 8)
          .map(f => ({
            label: f.content.split('\n')[0].slice(0, 60),
            done: f.type === 'result',
          }))
      : allTasks

  // Tab-aware skills
  const skills = currentCategory === 'frontend' ? FRONTEND_SKILLS
    : currentCategory === 'backend' ? BACKEND_SKILLS
    : currentCategory === 'setup' ? [] // setup shows wizard in left panel
    : BUILD_SKILLS

  return (
    <div className="p-3 h-full flex flex-col gap-4 overflow-y-auto">
      {/* Task checklist */}
      <div>
        <p className="text-[10px] text-muted uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
          <ClipboardCheck size={11} />
          태스크 체크리스트
        </p>
        {syntheticTasks.length === 0 ? (
          <p className="text-xs text-muted/50 px-1">아직 태스크가 없습니다</p>
        ) : (
          <div className="space-y-1.5">
            {syntheticTasks.map((task, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-start gap-2 px-2.5 py-2 rounded-lg border text-xs transition-colors',
                  task.done
                    ? 'border-green-500/20 bg-green-500/5 text-dim'
                    : 'border-border bg-bg text-muted'
                )}
              >
                <span className={cn('shrink-0 mt-0.5 text-base leading-none', task.done ? 'text-green-400' : 'text-muted/40')}>
                  {task.done ? '✅' : '⬜'}
                </span>
                <span className="leading-snug">{task.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Skills */}
      {skills.length > 0 && (
        <div>
          <p className="text-[10px] text-muted uppercase tracking-widest mb-2.5">빠른 실행</p>
          <div className="flex flex-wrap gap-1.5">
            {skills.map(skill => (
              <button
                key={skill.label}
                onClick={() => onSkillSelect?.(skill.prompt)}
                title={skill.prompt}
                className="px-2.5 py-1.5 rounded-lg border border-border bg-bg text-[11px] text-dim hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-colors"
              >
                {skill.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {currentCategory === 'setup' && (
        <p className="text-xs text-muted/50 px-1">초기세팅 위자드는 왼쪽 패널을 사용하세요</p>
      )}

      {/* Obsidian archive */}
      <ArchiveButton
        content={feed.filter(f => f.type === 'result')[0]?.content ?? ''}
        title="Build 결과"
        botRole="build"
        tags={['OOMNI', 'build']}
      />

      {/* Next bot */}
      <NextBotDropdown currentAgentId={agentId} currentRole={currentRole} content={content} />
    </div>
  )
}
