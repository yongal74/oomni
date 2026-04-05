import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { devtoolsApi } from '../lib/api'
import { RefreshCw, CheckCircle, XCircle, Terminal, Monitor, Zap, Rocket, Copy, Check } from 'lucide-react'

type IdeKey = 'claude_code' | 'vscode' | 'cursor' | 'antigravity'

// 외부 링크는 setWindowOpenHandler가 shell.openExternal로 처리함
function openLink(url: string) {
  window.open(url, '_blank')
}

export default function DevToolsPage() {
  const [selectedIde, setSelectedIde] = useState<IdeKey>('claude_code')
  const [saveSuccess, setSaveSuccess] = useState(false)

  const { data: status, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['devtools-status'],
    queryFn: devtoolsApi.status,
  })

  useQuery({
    queryKey: ['devtools-preference'],
    queryFn: devtoolsApi.getPreference,
    onSuccess: (data: { preferred_ide: string }) => {
      if (data.preferred_ide) setSelectedIde(data.preferred_ide as IdeKey)
    },
  } as any)

  const saveMutation = useMutation({
    mutationFn: () => devtoolsApi.savePreference(selectedIde),
    onSuccess: () => {
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    },
  })

  const isInstalled = (key: IdeKey) => status?.[key] ?? false

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text">개발 환경 연동</h1>
          <p className="text-muted text-[13px] mt-1">OOMNI 봇이 사용할 개발 도구를 설정하세요</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-3 py-1.5 border border-border rounded text-[12px] text-muted hover:text-text disabled:opacity-50"
        >
          <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
          새로고침
        </button>
      </div>

      {/* 로딩 스피너 */}
      {isLoading && (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!isLoading && (
        <>
          {/* Section 1: 기본 도구 (Claude Code) */}
          <div className="mb-6">
            <div className="text-[10px] text-muted uppercase tracking-widest mb-3">기본 도구</div>
            <div
              className={`bg-surface border rounded-xl p-5 cursor-pointer transition-colors ${
                selectedIde === 'claude_code'
                  ? 'border-primary'
                  : 'border-border hover:border-primary/50'
              }`}
              onClick={() => setSelectedIde('claude_code')}
            >
              <div className="flex items-start gap-4">
                <div className="text-2xl mt-0.5">
                  <Terminal size={28} className="text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[15px] font-semibold text-text">Claude Code CLI</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-900/40 text-green-400 border border-green-800/30">
                      필수
                    </span>
                    {selectedIde === 'claude_code' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 ml-auto">
                        기본 도구
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-muted mb-3">
                    OOMNI의 기본 AI 개발 도구입니다. 봇들이 코드 작성, 파일 수정, 명령 실행을 자동으로 수행합니다.
                  </p>

                  {/* 상태 표시 */}
                  <div className="flex items-center gap-1.5 mb-3">
                    {isInstalled('claude_code') ? (
                      <>
                        <CheckCircle size={13} className="text-green-400" />
                        <span className="text-[12px] text-green-400">설치됨</span>
                      </>
                    ) : (
                      <>
                        <XCircle size={13} className="text-red-400" />
                        <span className="text-[12px] text-red-400">미설치</span>
                      </>
                    )}
                  </div>

                  {/* 설치된 경우 */}
                  {isInstalled('claude_code') && (
                    <div className="flex items-center gap-2 text-[12px] text-green-400">
                      <CheckCircle size={13} />
                      <span>연동 완료 ✓ — 기본 도구로 설정됨</span>
                    </div>
                  )}

                  {/* 미설치인 경우: 설치 가이드 */}
                  {!isInstalled('claude_code') && (
                    <div className="bg-bg border border-border rounded-lg p-4 text-[12px] text-muted space-y-1.5">
                      <p className="text-text font-medium mb-2">설치 방법</p>
                      <p>
                        1.{' '}
                        <button
                          onClick={e => { e.stopPropagation(); openLink('https://claude.ai/download') }}
                          className="text-primary hover:underline"
                        >
                          https://claude.ai/download
                        </button>
                        {' '}에서 Claude Code 다운로드
                      </p>
                      <p>2. 설치 후 터미널에서: <code className="bg-surface border border-border px-1.5 py-0.5 rounded text-[11px]">claude --version</code> 으로 확인</p>
                      <p>3. 앱 재시작 후 자동 감지됩니다</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: 선택 도구 */}
          <div className="mb-6">
            <div className="text-[10px] text-muted uppercase tracking-widest mb-3">선택 도구</div>
            <div className="grid grid-cols-3 gap-3">
              {/* VS Code */}
              <OptionalToolCard
                ideKey="vscode"
                icon={<Monitor size={22} className="text-blue-400" />}
                title="Visual Studio Code"
                description="Microsoft의 무료 오픈소스 에디터. Claude Code와 함께 사용 가능합니다."
                installUrl="https://code.visualstudio.com"
                installed={isInstalled('vscode')}
                selected={selectedIde === 'vscode'}
                onSelect={() => setSelectedIde('vscode')}
              />

              {/* Cursor */}
              <OptionalToolCard
                ideKey="cursor"
                icon={<Zap size={22} className="text-yellow-400" />}
                title="Cursor"
                description="AI 코딩에 특화된 에디터. GPT-4 기반의 코드 자동완성을 제공합니다."
                installUrl="https://cursor.sh"
                installed={isInstalled('cursor')}
                selected={selectedIde === 'cursor'}
                onSelect={() => setSelectedIde('cursor')}
              />

              {/* Antigravity */}
              <OptionalToolCard
                ideKey="antigravity"
                icon={<Rocket size={22} className="text-primary" />}
                title="Antigravity"
                description="차세대 AI 개발 환경. 에이전트 기반 코딩을 지원합니다."
                installUrl="https://antigravity.dev"
                installed={isInstalled('antigravity')}
                selected={selectedIde === 'antigravity'}
                onSelect={() => setSelectedIde('antigravity')}
              />
            </div>
          </div>

          {/* Section 3: Design Bot — Pencil.dev MCP */}
          <DesignBotSection />

          {/* Section 4: 현재 설정 저장 */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="text-[10px] text-muted uppercase tracking-widest mb-3">현재 설정</div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] text-text">
                  기본 도구:{' '}
                  <span className="text-primary font-medium">
                    {IDE_LABELS[selectedIde]}
                  </span>
                </p>
                {!isInstalled(selectedIde) && selectedIde !== 'claude_code' && (
                  <p className="text-[11px] text-yellow-500 mt-1">
                    선택한 도구가 설치되지 않았습니다. 설치 후 사용 가능합니다.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {saveSuccess && (
                  <span className="text-[12px] text-green-400 flex items-center gap-1">
                    <CheckCircle size={12} />
                    저장됨
                  </span>
                )}
                <button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                  className="px-4 py-2 bg-primary text-white rounded text-[13px] hover:bg-[#C5664A] disabled:opacity-50 transition-colors"
                >
                  {saveMutation.isPending ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// CopyButton
// ──────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-surface border border-border text-muted hover:text-text transition-colors"
      title="복사"
    >
      {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
      {copied ? '복사됨' : '복사'}
    </button>
  )
}

// ──────────────────────────────────────────────────────────────
// DesignBotSection
// ──────────────────────────────────────────────────────────────
const MCP_COMMAND = 'claude mcp add pencil npx @pencilapp/mcp-server'

const MCP_CONFIG_JSON = `{
  "mcpServers": {
    "pencil": {
      "command": "npx",
      "args": ["@pencilapp/mcp-server"]
    }
  }
}`

function DesignBotSection() {
  const configPath = '~/.claude/claude_desktop_config.json'

  const openConfigFile = () => {
    // In Electron the setWindowOpenHandler will route this via shell.openExternal
    window.open(`file://${configPath}`, '_blank')
  }

  return (
    <div className="mb-6">
      {/* Section header */}
      <div className="text-[10px] text-muted uppercase tracking-widest mb-3">Design Bot</div>

      {/* Title card */}
      <div className="bg-surface border border-border rounded-xl p-5 mb-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">🎨</span>
          <h2 className="text-[15px] font-semibold text-text">Design Bot — Pencil.dev MCP</h2>
        </div>
        <p className="text-[12px] text-muted">
          Design Bot은 Claude Code + Pencil.dev MCP를 사용하여 UI/UX 디자인을 자동화합니다.
        </p>
      </div>

      {/* Pencil.dev MCP status card */}
      <div className="bg-surface border border-border rounded-xl p-5 mb-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[14px] font-semibold text-text">Pencil.dev MCP Server</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface text-muted border border-border">
            선택
          </span>
        </div>
        <p className="text-[12px] text-muted mb-4">
          클로드 코드가 Pencil.dev 디자인 파일을 직접 읽고 수정할 수 있게 합니다
        </p>

        {/* Installation steps */}
        <div className="bg-bg border border-border rounded-lg p-4 mb-3">
          <p className="text-[12px] font-medium text-text mb-3">설치 방법</p>
          <ol className="space-y-3 text-[12px] text-muted">
            <li>
              <span className="text-text font-medium">1. Claude Code MCP 설정에 Pencil.dev 추가:</span>
              <div className="flex items-center gap-2 mt-1.5">
                <code className="flex-1 bg-surface border border-border rounded px-3 py-1.5 text-[11px] text-green-300 font-mono overflow-x-auto">
                  {MCP_COMMAND}
                </code>
                <CopyButton text={MCP_COMMAND} />
              </div>
            </li>
            <li>
              <span className="text-text font-medium">2. Pencil.dev 앱 설치:</span>{' '}
              <button
                onClick={() => openLink('https://pencil.dev/download')}
                className="text-primary hover:underline"
              >
                pencil.dev/download
              </button>
            </li>
            <li>
              <span className="text-text font-medium">3. .pen 파일을 프로젝트에 생성 후 Claude Code로 디자인 자동화</span>
            </li>
          </ol>
        </div>
      </div>

      {/* Design Bot workflow card */}
      <div className="bg-surface border border-border rounded-xl p-5 mb-3">
        <p className="text-[13px] font-semibold text-text mb-4">Design Bot 워크플로우</p>
        <div className="flex flex-col items-center gap-1 text-[12px]">
          {/* Research Bot */}
          <div className="w-full bg-bg border border-border rounded-lg px-4 py-2.5 text-center">
            <span className="text-[11px] text-muted">1단계</span>
            <p className="text-text font-medium mt-0.5">Research Bot</p>
            <p className="text-[11px] text-muted mt-0.5">[리서치 결과 생성]</p>
          </div>

          <div className="text-muted text-lg leading-none py-0.5">↓</div>

          {/* Design Bot */}
          <div className="w-full bg-primary/10 border border-primary/30 rounded-lg px-4 py-3">
            <span className="text-[11px] text-primary">2단계</span>
            <p className="text-text font-medium mt-0.5">Design Bot</p>
            <p className="text-[11px] text-primary/80 mt-0.5">Claude Code + Pencil.dev MCP</p>
            <ul className="mt-2 space-y-0.5 text-[11px] text-muted list-disc list-inside">
              <li>리서치 기반 UI 컴포넌트 생성</li>
              <li>색상/타이포그래피 시스템 정의</li>
              <li>화면 흐름 자동 설계</li>
            </ul>
          </div>

          <div className="text-muted text-lg leading-none py-0.5">↓</div>

          {/* Build Bot */}
          <div className="w-full bg-bg border border-border rounded-lg px-4 py-2.5 text-center">
            <span className="text-[11px] text-muted">3단계</span>
            <p className="text-text font-medium mt-0.5">Build Bot</p>
            <p className="text-[11px] text-muted mt-0.5">[디자인 기반 코드 구현]</p>
          </div>
        </div>
      </div>

      {/* Claude Code MCP config helper card */}
      <div className="bg-surface border border-border rounded-xl p-5">
        <p className="text-[13px] font-semibold text-text mb-3">Claude Code MCP 설정 도우미</p>

        {/* Config file path */}
        <div className="flex items-center gap-2 mb-4">
          <code className="flex-1 bg-bg border border-border rounded px-3 py-1.5 text-[11px] text-muted font-mono">
            {configPath}
          </code>
          <button
            onClick={openConfigFile}
            className="px-3 py-1.5 bg-surface border border-border rounded text-[11px] text-text hover:border-primary/50 transition-colors whitespace-nowrap"
          >
            MCP 설정 열기
          </button>
        </div>

        {/* Example MCP config */}
        <p className="text-[11px] text-muted mb-2">예시 설정 (claude_desktop_config.json):</p>
        <div className="relative">
          <pre className="bg-bg border border-border rounded-lg px-4 py-3 text-[11px] text-green-300 font-mono overflow-x-auto">
            {MCP_CONFIG_JSON}
          </pre>
          <div className="absolute top-2 right-2">
            <CopyButton text={MCP_CONFIG_JSON} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
interface OptionalToolCardProps {
  ideKey: IdeKey
  icon: React.ReactNode
  title: string
  description: string
  installUrl: string
  installed: boolean
  selected: boolean
  onSelect: () => void
}

function OptionalToolCard({
  icon, title, description, installUrl, installed, selected, onSelect,
}: OptionalToolCardProps) {
  return (
    <div
      className={`bg-surface border rounded-xl p-4 cursor-pointer transition-colors flex flex-col ${
        selected ? 'border-primary' : 'border-border hover:border-primary/50'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-[12px] px-1.5 py-0.5 rounded-full bg-surface text-muted border border-border text-[10px]">
            선택
          </span>
        </div>
        {installed
          ? <CheckCircle size={13} className="text-green-400" />
          : <XCircle size={13} className="text-muted" />
        }
      </div>

      <p className="text-[13px] font-medium text-text mb-1">{title}</p>
      <p className="text-[11px] text-muted mb-3 flex-1">{description}</p>

      <div className="flex items-center gap-1.5 mb-3">
        {installed ? (
          <>
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span className="text-[11px] text-green-400">설치됨</span>
          </>
        ) : (
          <>
            <div className="w-1.5 h-1.5 rounded-full bg-border" />
            <span className="text-[11px] text-muted">미설치</span>
          </>
        )}
      </div>

      {!installed && (
        <button
          onClick={e => { e.stopPropagation(); openLink(installUrl) }}
          className="text-[11px] text-primary hover:underline text-left"
        >
          설치하기 →
        </button>
      )}

      {installed && (
        <div
          className={`text-[11px] py-1 px-2 rounded text-center transition-colors ${
            selected
              ? 'bg-primary/20 text-primary border border-primary/30'
              : 'bg-surface text-muted border border-border hover:text-text'
          }`}
        >
          {selected ? '기본 도구로 설정됨' : '기본 도구로 설정'}
        </div>
      )}
    </div>
  )
}

const IDE_LABELS: Record<IdeKey, string> = {
  claude_code: 'Claude Code CLI',
  vscode: 'Visual Studio Code',
  cursor: 'Cursor',
  antigravity: 'Antigravity',
}
