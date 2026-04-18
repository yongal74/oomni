import { useState } from 'react'
import { ChevronDown, ArrowRight } from 'lucide-react'
import { useAppStore } from '../../../store/app.store'
import { useNavigate } from 'react-router-dom'
import { cn } from '../../../lib/utils'

const BOT_EMOJI: Record<string, string> = {
  research: '🔬', build: '🔨', design: '🎨', content: '✍️',
  growth: '📈', ops: '⚙️', integration: '🔗', ceo: '👔',
  frontend: '⚛️', backend: '🖥️', project_setup: '📐',
  infra: '☁️', env: '🔑', security_audit: '🛡️',
}

// 봇 조합별 이어서 프롬프트 생성
function buildHandoffPrompt(fromRole: string, toRole: string, content: string): string {
  const preview = content.slice(0, 300) + (content.length > 300 ? '...' : '')

  const templates: Record<string, Record<string, string>> = {
    research: {
      content: `다음 리서치 결과를 바탕으로 2000자 이상의 내러티브 블로그 포스트를 작성해줘. 짧은 문장, 구체적 사례, 스토리텔링 방식으로:\n\n${preview}`,
      build: `다음 리서치 인사이트를 참고해서 기술 구현 계획을 세워줘:\n\n${preview}`,
      growth: `다음 리서치 결과로 성장 전략과 마케팅 캠페인을 제안해줘:\n\n${preview}`,
      ops: `다음 리서치 결과를 바탕으로 운영 자동화 워크플로우를 설계해줘:\n\n${preview}`,
      ceo: `다음 리서치 결과를 경영진 관점에서 요약하고 액션 아이템을 도출해줘:\n\n${preview}`,
      design: `다음 리서치 인사이트를 반영해서 디자인 방향을 제안해줘:\n\n${preview}`,
    },
    design: {
      build: `다음 Pencil 디자인 스펙을 React/TypeScript/Tailwind CSS로 구현해줘.\n디자인 시스템(색상, 폰트, 간격)을 유지하고 반응형으로 만들어줘:\n\n${preview}`,
      frontend: `다음 디자인을 React 컴포넌트로 구현해줘. shadcn/ui와 Tailwind CSS 사용:\n\n${preview}`,
      content: `다음 디자인 작업을 바탕으로 제품 소개 콘텐츠를 작성해줘:\n\n${preview}`,
      ceo: `다음 디자인 결과물을 경영진 보고서 형식으로 요약해줘:\n\n${preview}`,
    },
    content: {
      growth: `다음 콘텐츠를 배포하기 위한 성장 전략과 채널별 최적화 방안을 제안해줘:\n\n${preview}`,
      research: `다음 콘텐츠에서 추가 리서치가 필요한 부분을 찾아서 심층 분석해줘:\n\n${preview}`,
      ops: `다음 콘텐츠 제작 프로세스를 자동화하는 워크플로우를 만들어줘:\n\n${preview}`,
      ceo: `다음 콘텐츠 성과를 분석하고 경영 관점의 인사이트를 도출해줘:\n\n${preview}`,
      build: `다음 콘텐츠에서 기술 구현이 필요한 기능을 파악하고 개발 계획을 세워줘:\n\n${preview}`,
    },
    build: {
      ops: `다음 빌드 결과를 배포하고 운영하기 위한 자동화 워크플로우를 설계해줘:\n\n${preview}`,
      growth: `다음 기능 구현 내용을 바탕으로 사용자 증가 전략을 수립해줘:\n\n${preview}`,
      ceo: `다음 개발 진행 현황을 경영진 보고서 형식으로 요약해줘:\n\n${preview}`,
      design: `다음 기능 스펙을 참고해서 UI/UX 디자인 방향을 제안해줘:\n\n${preview}`,
      content: `다음 기능 업데이트를 사용자에게 알리는 릴리스 노트와 블로그 포스트를 작성해줘:\n\n${preview}`,
    },
    growth: {
      content: `다음 성장 분석 결과를 바탕으로 콘텐츠 마케팅 전략을 세워줘:\n\n${preview}`,
      ops: `다음 성장 전략을 실행하기 위한 자동화 워크플로우를 설계해줘:\n\n${preview}`,
      ceo: `다음 성장 지표와 캠페인 결과를 경영진 보고서로 요약해줘:\n\n${preview}`,
      build: `다음 성장 데이터에서 개선이 필요한 기능을 파악하고 개발 우선순위를 정해줘:\n\n${preview}`,
    },
    ops: {
      ceo: `다음 운영 자동화 현황을 경영진 보고서로 요약해줘:\n\n${preview}`,
      build: `다음 운영 문제를 해결하기 위한 기술 개발 계획을 세워줘:\n\n${preview}`,
      growth: `다음 운영 효율화 결과를 바탕으로 성장 기회를 분석해줘:\n\n${preview}`,
    },
    ceo: {
      build: `다음 CEO 브리핑에서 기술 개발이 필요한 부분을 파악하고 스프린트 계획을 세워줘:\n\n${preview}`,
      growth: `다음 CEO 브리핑을 바탕으로 성장 전략을 구체화해줘:\n\n${preview}`,
      ops: `다음 CEO 브리핑에서 운영 자동화가 필요한 부분을 찾아서 워크플로우를 설계해줘:\n\n${preview}`,
      content: `다음 CEO 브리핑을 투자자 업데이트 뉴스레터로 변환해줘:\n\n${preview}`,
    },
  }

  const fromMap = templates[fromRole]
  if (fromMap && fromMap[toRole]) return fromMap[toRole]

  // 기본 폴백
  return `이전 봇의 결과물을 이어받아 작업해줘:\n\n${preview}`
}

interface Props {
  currentAgentId: string
  currentRole?: string
  content?: string   // 현재 봇의 결과물 (다음 봇에 전달됨)
}

export function NextBotDropdown({ currentAgentId, currentRole = '', content = '' }: Props) {
  const [open, setOpen] = useState(false)
  const { agents } = useAppStore()
  const navigate = useNavigate()

  const others = agents.filter(a => a.id !== currentAgentId)
  if (others.length === 0) return null

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-primary/30 text-primary hover:bg-primary/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <ArrowRight size={14} />
          <span className="text-sm">다음 봇으로 이어서</span>
        </div>
        <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-surface border border-border rounded-lg shadow-lg z-10 overflow-hidden">
          {others.map(agent => (
            <button
              key={agent.id}
              onClick={() => {
                setOpen(false)
                const prefilledTask = content
                  ? buildHandoffPrompt(currentRole, agent.role, content)
                  : ''
                navigate(
                  prefilledTask
                    ? `/dashboard/bots/${agent.id}?autorun=${encodeURIComponent(prefilledTask)}`
                    : `/dashboard/bots/${agent.id}`
                )
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-dim hover:bg-primary/5 hover:text-text transition-colors text-left"
            >
              <span>{BOT_EMOJI[agent.role] ?? '🤖'}</span>
              <span>{agent.name}</span>
              {content && (
                <span className="ml-auto text-[10px] text-primary/50">결과 전달</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
