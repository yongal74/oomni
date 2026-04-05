import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { devtoolsApi } from '../lib/api'
import { RefreshCw, CheckCircle, XCircle, Terminal, Monitor, Zap, Rocket } from 'lucide-react'

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
                  : 'border-border hover:border-zinc-600'
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
                    <div className="bg-zinc-900 border border-border rounded-lg p-4 text-[12px] text-muted space-y-1.5">
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
                      <p>2. 설치 후 터미널에서: <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-[11px]">claude --version</code> 으로 확인</p>
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
                icon={<Rocket size={22} className="text-purple-400" />}
                title="Antigravity"
                description="차세대 AI 개발 환경. 에이전트 기반 코딩을 지원합니다."
                installUrl="https://antigravity.dev"
                installed={isInstalled('antigravity')}
                selected={selectedIde === 'antigravity'}
                onSelect={() => setSelectedIde('antigravity')}
              />
            </div>
          </div>

          {/* Section 3: 현재 설정 저장 */}
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
        selected ? 'border-primary' : 'border-border hover:border-zinc-600'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-[12px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-muted border border-border text-[10px]">
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
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
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
              : 'bg-zinc-800 text-muted border border-border hover:text-text'
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
