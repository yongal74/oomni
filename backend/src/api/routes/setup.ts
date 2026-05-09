/**
 * setup.ts — 개발환경 세팅 도우미 (인증 없이 접근 가능)
 * GET  /api/setup/check-tools     — node/git/claude/code 설치 여부 확인
 * POST /api/setup/generate-files  — CLAUDE.md + .gitignore + .env.local 생성
 */
import { Router, type Request, type Response } from 'express';
import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';

function checkVersion(cmd: string): string | null {
  try {
    const out = execSync(`${cmd} --version`, { timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
      .split('\n')[0]
      .replace(/^v/, '')
    return out || null
  } catch {
    return null
  }
}

function checkWsl(): boolean {
  if (process.platform !== 'win32') return false
  try {
    const out = execSync('wsl --list --verbose', { timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] }).toString()
    return out.includes('Running') || out.includes('Stopped')
  } catch {
    return false
  }
}

export function setupRouter(): Router {
  const router = Router();

  // GET /api/setup/check-tools
  router.get('/check-tools', (_req: Request, res: Response) => {
    const platform = process.platform // 'win32' | 'darwin' | 'linux'

    const node    = checkVersion('node')
    const npm     = checkVersion('npm')
    const git     = checkVersion('git')
    const claude  = checkVersion('claude')
    const code    = checkVersion('code')
    const wsl     = checkWsl()

    res.json({
      platform,
      node,
      npm,
      git,
      claude,
      code,
      wsl,
      // 플랫폼별 설치 명령어 안내
      install_commands: {
        node_mac:     'curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash && nvm install --lts',
        node_windows: 'nvm-windows을 https://github.com/coreybutler/nvm-windows 에서 설치 후: nvm install lts',
        node_linux:   'curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash && nvm install --lts',
        git_mac:      'brew install git',
        git_windows:  'winget install Git.Git',
        git_linux:    'sudo apt-get install git',
        claude_all:   'curl -fsSL https://claude.ai/install.sh | sh',
        code_all:     'https://code.visualstudio.com 에서 다운로드',
        wsl_windows:  'wsl --install',
        brew_mac:     '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
      },
      vscode_extensions: [
        { id: 'esbenp.prettier-vscode',     name: 'Prettier',       cmd: 'code --install-extension esbenp.prettier-vscode' },
        { id: 'dbaeumer.vscode-eslint',     name: 'ESLint',         cmd: 'code --install-extension dbaeumer.vscode-eslint' },
        { id: 'eamodio.gitlens',            name: 'GitLens',        cmd: 'code --install-extension eamodio.gitlens' },
        { id: 'bradlc.vscode-tailwindcss',  name: 'Tailwind CSS',   cmd: 'code --install-extension bradlc.vscode-tailwindcss' },
        { id: 'rangav.vscode-thunder-client', name: 'Thunder Client', cmd: 'code --install-extension rangav.vscode-thunder-client' },
      ],
    })
  })

  // POST /api/setup/generate-files
  router.post('/generate-files', (req: Request, res: Response) => {
    const {
      project_path,
      project_name,
      supabase_url,
      supabase_anon_key,
      tech_stack = 'Next.js 14 + TypeScript + Tailwind CSS',
      target,
      goal,
    } = req.body as {
      project_path?: string
      project_name?: string
      supabase_url?: string
      supabase_anon_key?: string
      tech_stack?: string
      target?: string
      goal?: string
    }

    if (!project_path) {
      res.status(400).json({ error: 'project_path is required' })
      return
    }

    const absPath = path.resolve(project_path)

    try {
      if (!existsSync(absPath)) {
        mkdirSync(absPath, { recursive: true })
      }

      const generated: string[] = []

      // ── CLAUDE.md ─────────────────────────────────────────
      const claudeMd = `## 프로젝트 개요
서비스명: ${project_name ?? path.basename(absPath)}
목적: ${goal ?? ''}
타깃: ${target ?? ''}
목표: 3개월 내 MAU 1,000명

## 기술 스택
Frontend: ${tech_stack}
Backend: Supabase (DB + Auth + Storage)
배포: Vercel
결제: 토스페이먼츠 (국내) / Polar (해외)

## 코딩 규칙
- any 타입 절대 사용 금지
- 주석은 한국어로 작성
- 에러 처리: 반드시 try-catch 포함
- console.log 프로덕션 코드에 금지
- NEXT_PUBLIC_ 은 공개 가능한 값만 사용

## 현재 진행 상황 (매일 업데이트)
- [x] 초기 세팅 완료
- [ ] 로그인/회원가입 — 미착수
- [ ] 핵심 기능 CRUD — 미착수
- [ ] 결제 연동 — 미착수

## 자주 쓰는 명령어
\`\`\`bash
npm run dev        # 개발 서버 시작 → http://localhost:3000
npm run build      # 빌드
npm run lint       # ESLint 검사
git add . && git commit -m "feat: " && git push
\`\`\`
`
      writeFileSync(path.join(absPath, 'CLAUDE.md'), claudeMd, 'utf8')
      generated.push('CLAUDE.md')

      // ── .gitignore ─────────────────────────────────────────
      const gitignore = `# 환경변수 (절대 커밋 금지!)
.env
.env.local
.env.production
.env*.local

# 의존성
node_modules/

# 빌드 산출물
.next/
dist/
out/
build/

# 로그
*.log
npm-debug.log*
yarn-debug.log*

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/settings.json
.idea/

# Supabase
supabase/.branches
supabase/.temp
`
      writeFileSync(path.join(absPath, '.gitignore'), gitignore, 'utf8')
      generated.push('.gitignore')

      // ── .env.local ─────────────────────────────────────────
      const envLocal = `# ⚠️ 절대 GitHub에 올리면 안 됩니다!
# .gitignore에 .env.local 포함 확인 필수

# ── Supabase ──────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=${supabase_url ?? 'https://xxxxx.supabase.co'}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${supabase_anon_key ?? 'eyJhbGc...'}
SUPABASE_SERVICE_KEY=  # Settings > API > service_role (절대 비공개!)

# ── NextAuth ──────────────────────────────────────────
NEXTAUTH_SECRET=  # openssl rand -base64 32 로 생성
NEXTAUTH_URL=http://localhost:3000

# ── 결제 ──────────────────────────────────────────────
# 토스페이먼츠
TOSS_PAYMENTS_CLIENT_KEY=
TOSS_PAYMENTS_SECRET_KEY=

# Polar
POLAR_ACCESS_TOKEN=
`
      writeFileSync(path.join(absPath, '.env.local'), envLocal, 'utf8')
      generated.push('.env.local')

      res.json({
        success: true,
        path: absPath,
        generated,
        message: `${generated.join(', ')} 파일이 생성되었습니다`,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : '파일 생성 실패'
      res.status(500).json({ error: message })
    }
  })

  return router
}
