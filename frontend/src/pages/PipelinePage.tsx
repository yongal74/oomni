import { useCallback, useEffect, useMemo } from 'react'
import {
  ReactFlow,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  type Node,
  type Edge,
  type Connection,
  Handle,
  Position,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { GitBranch, Plus, RotateCcw } from 'lucide-react'
import { agentsApi, type Agent } from '../lib/api'
import { useAppStore } from '../store/app.store'

// Role icons
const ROLE_ICON: Record<string, string> = {
  research: '🔬',
  build: '⚙️',
  design: '🎨',
  content: '✍️',
  growth: '📈',
  ops: '🔧',
  integration: '🔌',
  n8n: '⚡',
  ceo: '👑',
}

// Default Solo Factory OS pipeline layout positions
const DEFAULT_POSITIONS: Record<string, { x: number; y: number }> = {
  research: { x: 80,  y: 60  },
  design:   { x: 320, y: 60  },
  build:    { x: 560, y: 60  },
  content:  { x: 800, y: 60  },
  ops:      { x: 1040, y: 60 },
  ceo:      { x: 560, y: 240 },
  growth:   { x: 320, y: 240 },
  integration: { x: 800, y: 240 },
  n8n:      { x: 1040, y: 240 },
}

// Default example agents shown when no mission bots exist
const EXAMPLE_AGENTS: Agent[] = [
  { id: 'ex-research', mission_id: '', name: 'Research Bot', role: 'research', schedule: 'daily', system_prompt: '', budget_cents: 0, is_active: true, reports_to: 'ex-ceo', created_at: '' },
  { id: 'ex-design',   mission_id: '', name: 'Design Bot',   role: 'design',   schedule: 'daily', system_prompt: '', budget_cents: 0, is_active: true, reports_to: 'ex-ceo', created_at: '' },
  { id: 'ex-build',    mission_id: '', name: 'Build Bot',    role: 'build',    schedule: 'daily', system_prompt: '', budget_cents: 0, is_active: true, reports_to: 'ex-ceo', created_at: '' },
  { id: 'ex-content',  mission_id: '', name: 'Content Bot',  role: 'content',  schedule: 'daily', system_prompt: '', budget_cents: 0, is_active: true, reports_to: 'ex-ceo', created_at: '' },
  { id: 'ex-ops',      mission_id: '', name: 'Ops Bot',      role: 'ops',      schedule: 'daily', system_prompt: '', budget_cents: 0, is_active: true, reports_to: 'ex-ceo', created_at: '' },
  { id: 'ex-ceo',      mission_id: '', name: 'CEO Bot',      role: 'ceo',      schedule: 'daily', system_prompt: '', budget_cents: 0, is_active: true, reports_to: null,     created_at: '' },
]

// Custom node component
interface BotNodeData {
  agent: Agent
  onClick: (id: string) => void
  isExample: boolean
  [key: string]: unknown
}

function BotNode({ data }: { data: BotNodeData }) {
  const { agent, onClick, isExample } = data
  const icon = ROLE_ICON[agent.role] ?? '🤖'
  const isActive = agent.is_active

  return (
    <div
      onClick={() => !isExample && onClick(agent.id)}
      style={{
        background: '#1C1C1E',
        border: isActive ? '1.5px solid #8B5CF6' : '1.5px solid #3F3F46',
        borderRadius: 10,
        padding: '10px 14px',
        minWidth: 160,
        cursor: isExample ? 'default' : 'pointer',
        boxShadow: isActive ? '0 0 0 1px rgba(139,92,246,0.2)' : 'none',
        transition: 'box-shadow 0.15s ease',
        userSelect: 'none',
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#8B5CF6', border: 'none', width: 8, height: 8 }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
        <div>
          <div style={{ color: '#fff', fontWeight: 600, fontSize: 13, lineHeight: 1.3 }}>
            {agent.name}
          </div>
          <div style={{ color: '#71717A', fontSize: 11, marginTop: 2, textTransform: 'capitalize' }}>
            {agent.role}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: isActive ? '#22C55E' : '#3F3F46',
            }}
          />
          <span style={{ color: isActive ? '#22C55E' : '#52525B', fontSize: 10 }}>
            {isActive ? 'active' : 'off'}
          </span>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#8B5CF6', border: 'none', width: 8, height: 8 }}
      />
    </div>
  )
}

const nodeTypes = { bot: BotNode }

function buildNodesAndEdges(
  agents: Agent[],
  isExample: boolean,
  onClickAgent: (id: string) => void
): { nodes: Node[]; edges: Edge[] } {
  // Track used positions to avoid overlap when role position is taken
  const usedPositions = new Set<string>()

  const nodes: Node[] = agents.map((agent, idx) => {
    let pos = DEFAULT_POSITIONS[agent.role]
    if (!pos || usedPositions.has(agent.role)) {
      // fallback: stack extras to the right
      pos = { x: 80 + (idx % 5) * 240, y: 420 + Math.floor(idx / 5) * 160 }
    } else {
      usedPositions.add(agent.role)
    }
    return {
      id: agent.id,
      type: 'bot',
      position: pos,
      data: { agent, onClick: onClickAgent, isExample },
    }
  })

  const edges: Edge[] = agents
    .filter(a => a.reports_to && agents.find(x => x.id === a.reports_to))
    .map(a => ({
      id: `${a.id}->${a.reports_to}`,
      source: a.id,
      target: a.reports_to!,
      animated: a.is_active,
      style: { stroke: '#8B5CF6', strokeWidth: 1.5 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#8B5CF6',
        width: 16,
        height: 16,
      },
    }))

  return { nodes, edges }
}

export default function PipelinePage() {
  const navigate = useNavigate()
  const { currentMission } = useAppStore()

  const { data: fetchedAgents, isLoading } = useQuery({
    queryKey: ['agents', currentMission?.id],
    queryFn: () => agentsApi.list(currentMission?.id),
    enabled: true,
  })

  const isExample = !fetchedAgents || fetchedAgents.length === 0
  const agents = isExample ? EXAMPLE_AGENTS : fetchedAgents!

  const handleClickAgent = useCallback(
    (id: string) => navigate(`/dashboard/bots/${id}`),
    [navigate]
  )

  const { nodes: defaultNodes, edges: defaultEdges } = useMemo(
    () => buildNodesAndEdges(agents, isExample, handleClickAgent),
    [agents, isExample, handleClickAgent]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(defaultNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(defaultEdges)

  // Re-sync when agents change
  useEffect(() => {
    const { nodes: n, edges: e } = buildNodesAndEdges(agents, isExample, handleClickAgent)
    setNodes(n)
    setEdges(e)
  }, [agents, isExample, handleClickAgent, setNodes, setEdges])

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds: Edge[]) => addEdge(params, eds)),
    [setEdges]
  )

  const handleAutoLayout = useCallback(() => {
    const { nodes: n, edges: e } = buildNodesAndEdges(agents, isExample, handleClickAgent)
    setNodes(n)
    setEdges(e)
  }, [agents, isExample, handleClickAgent, setNodes, setEdges])

  return (
    <div className="flex flex-col h-screen bg-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <GitBranch size={18} className="text-primary" />
          <h1 className="text-base font-semibold text-text">봇 파이프라인</h1>
          {currentMission && (
            <span className="text-xs text-muted ml-1">— {currentMission.name}</span>
          )}
          {isExample && (
            <span className="text-[11px] bg-[#2A2A2C] text-muted px-2 py-0.5 rounded ml-2">
              예시 레이아웃
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAutoLayout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs text-muted hover:text-text hover:bg-[#1E1E20] border border-border transition-colors"
          >
            <RotateCcw size={12} />
            자동 정렬
          </button>
          <button
            onClick={() => navigate('/dashboard?addBot=true')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs bg-primary text-white hover:bg-primary/90 transition-colors"
          >
            <Plus size={12} />
            봇 추가
          </button>
        </div>
      </div>

      {/* Flow canvas */}
      <div className="flex-1 relative">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            style={{ background: '#111113' }}
            proOptions={{ hideAttribution: true }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1}
              color="#2A2A2C"
            />
            <Controls
              style={{
                background: '#1C1C1E',
                border: '1px solid #3F3F46',
                borderRadius: 8,
              }}
            />
          </ReactFlow>
        )}
      </div>

      {/* Legend */}
      <div className="px-6 py-2 border-t border-border shrink-0 flex items-center gap-6 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-500" /> active
        </span>
        <span className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#3F3F46]" /> inactive
        </span>
        <span className="flex items-center gap-1.5">
          <div className="w-8 border-t border-[#8B5CF6]" /> reports_to 연결
        </span>
        <span className="ml-auto">노드를 드래그해서 위치를 조정하세요</span>
      </div>
    </div>
  )
}
