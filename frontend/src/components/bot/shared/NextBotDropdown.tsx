import { useState } from 'react'
import { ChevronDown, ArrowRight } from 'lucide-react'
import { useAppStore } from '../../../store/app.store'
import { useNavigate } from 'react-router-dom'
import { cn } from '../../../lib/utils'

const BOT_EMOJI: Record<string, string> = {
  research: '🔬', build: '🔨', design: '🎨', content: '✍️',
  growth: '📈', ops: '⚙️', integration: '🔗', n8n: '⚡', ceo: '👔',
}

interface Props {
  currentAgentId: string
}

export function NextBotDropdown({ currentAgentId }: Props) {
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
                navigate(`/dashboard/bots/${agent.id}`)
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-dim hover:bg-primary/5 hover:text-text transition-colors text-left"
            >
              <span>{BOT_EMOJI[agent.role] ?? '🤖'}</span>
              <span>{agent.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
