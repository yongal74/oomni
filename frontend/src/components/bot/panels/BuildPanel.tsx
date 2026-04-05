import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { workspaceApi, type FileNode } from '../../../lib/api'
import {
  ChevronRight, ChevronDown, File, Folder, FolderOpen,
  Copy, Check, Code2, ClipboardCheck, Layers
} from 'lucide-react'
import { cn } from '../../../lib/utils'

// ── Category tab definitions ─────────────────────────────────────────────────
type Category = 'all' | 'frontend' | 'backend' | 'payment' | 'db' | 'security' | 'marketing'

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'frontend', label: '프론트' },
  { id: 'backend', label: '백엔드' },
  { id: 'payment', label: '결제' },
  { id: 'db', label: 'DB' },
  { id: 'security', label: '보안' },
  { id: 'marketing', label: '마케팅' },
]

// Extensions that belong to each category
const CATEGORY_EXTENSIONS: Record<Exclude<Category, 'all'>, string[]> = {
  frontend: ['tsx', 'jsx', 'ts', 'js', 'css', 'scss', 'html', 'svg'],
  backend: ['ts', 'js', 'py', 'go', 'rs', 'java', 'sh'],
  payment: ['ts', 'js'],
  db: ['sql', 'json', 'yaml', 'yml', 'toml'],
  security: ['env', 'sh', 'json'],
  marketing: ['md', 'txt', 'html'],
}

const CATEGORY_KEYWORDS: Record<Exclude<Category, 'all'>, string[]> = {
  frontend: ['component', 'page', 'layout', 'ui', 'view', 'style', 'theme', 'hook'],
  backend: ['api', 'server', 'route', 'service', 'middleware', 'controller', 'handler'],
  payment: ['payment', 'stripe', 'billing', 'invoice', 'checkout', 'subscription'],
  db: ['schema', 'migration', 'model', 'database', 'seed', 'query'],
  security: ['auth', 'guard', 'token', 'secret', 'permission', 'policy', '.env'],
  marketing: ['landing', 'email', 'campaign', 'seo', 'blog', 'content'],
}

function fileMatchesCategory(node: FileNode, category: Category): boolean {
  if (category === 'all') return true
  const name = node.name.toLowerCase()
  const ext = name.split('.').pop() ?? ''
  const keywords = CATEGORY_KEYWORDS[category]
  const extensions = CATEGORY_EXTENSIONS[category]
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
  { command: '/new-component', label: '컴포넌트 생성' },
  { command: '/new-api', label: 'API 라우트' },
  { command: '/add-payment', label: '결제 연동' },
  { command: '/setup-db', label: 'DB 설정' },
  { command: '/security-audit', label: '보안 감사' },
  { command: '/write-tests', label: '테스트 작성' },
  { command: '/setup-auth', label: '인증 설정' },
  { command: '/deploy-prep', label: '배포 준비' },
]

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
}: {
  agentId: string
  selectedFilePath: string | null
  onFileSelect: (node: FileNode) => void
}) {
  const [category, setCategory] = useState<Category>('all')

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
              onClick={() => setCategory(cat.id)}
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

      {/* File tree */}
      <div className="flex-1 overflow-y-auto py-2">
        {tree.length === 0 ? (
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
  nextBotName,
  onNextBot,
  onSkillSelect,
}: {
  agentId: string
  nextBotName?: string
  onNextBot?: () => void
  onSkillSelect?: (skill: string) => void
}) {
  const { data: feedData } = useQuery({
    queryKey: ['bot-feed', agentId],
    queryFn: () => import('../../../lib/api').then(m => m.feedApi.list({ limit: 30 })),
    select: (items: import('../../../lib/api').FeedItem[]) =>
      items.filter(f => f.agent_id === agentId),
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
      <div>
        <p className="text-[10px] text-muted uppercase tracking-widest mb-2.5">Skills</p>
        <div className="flex flex-wrap gap-1.5">
          {BUILD_SKILLS.map(skill => (
            <button
              key={skill.command}
              onClick={() => onSkillSelect?.(skill.command)}
              title={skill.command}
              className="px-2.5 py-1 rounded-lg border border-border bg-bg text-xs text-dim hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-colors font-mono"
            >
              {skill.command}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {BUILD_SKILLS.map(skill => (
            <button
              key={skill.command + '-label'}
              onClick={() => onSkillSelect?.(skill.command)}
              className="px-2 py-0.5 rounded text-[10px] text-muted hover:text-primary transition-colors"
            >
              {skill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Next bot */}
      {nextBotName && (
        <div className="mt-auto pt-3 border-t border-border">
          <button
            onClick={onNextBot}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-primary/30 text-primary hover:bg-primary/5 transition-colors"
          >
            <span className="text-sm">{nextBotName}으로 이어서</span>
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
