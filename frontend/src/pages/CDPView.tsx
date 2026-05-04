/**
 * CDPView.tsx — CDP ID-Graphing 360° 뷰
 * v5.1.0 — Obsidian-style force-directed Canvas graph
 *
 * Layout:
 *   Left  (280px) — profile list, search, tier filter
 *   Center (flex)  — Canvas force-directed graph (physics simulation)
 *   Right  (320px) — profile detail panel on node click
 */
import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAppStore } from '../store/app.store'
import {
  identityApi, type CdpProfile, type IdentityGraph,
  type GraphNode, type GraphEdge,
} from '../lib/api'
import {
  Search, RefreshCw, X, Zap,
  Database, Activity, Clock, Mail,
  Globe, AlertCircle,
} from 'lucide-react'
import { cn } from '../lib/utils'

// ─── constants ────────────────────────────────────────────────────────────────

const NODE_COLORS: Record<string, string> = {
  profile_high:   '#f59e0b',   // gold  — high LTV
  profile_mid:    '#6366f1',   // indigo — mid LTV
  profile_low:    '#64748b',   // gray   — low LTV
  email_hash:     '#3b82f6',   // blue
  phone_hash:     '#22c55e',   // green
  user_id:        '#f59e0b',   // gold
  device_fingerprint: '#94a3b8', // slate
  anonymous_id:   '#a855f7',   // purple
  fbclid:         '#f97316',   // orange
  gclid:          '#f97316',
  ttclid:         '#f97316',
  default:        '#64748b',
}

const NODE_RADIUS: Record<string, number> = {
  profile: 22,
  email_hash: 12,
  phone_hash: 12,
  user_id: 14,
  device_fingerprint: 11,
  anonymous_id: 10,
  fbclid: 10,
  gclid: 10,
  ttclid: 10,
  default: 10,
}

const EDGE_DASH: Record<string, number[] | null> = {
  deterministic:  null,          // solid
  probabilistic:  [6, 4],        // dashed
  behavioral:     [3, 5],        // dotted dim
}

const EDGE_ALPHA: Record<string, number> = {
  deterministic:  0.85,
  probabilistic:  0.55,
  behavioral:     0.35,
}

// ─── types ────────────────────────────────────────────────────────────────────

interface SimNode extends GraphNode {
  x: number; y: number
  vx: number; vy: number
  fx: number | null; fy: number | null  // pinned position
}

interface SimEdge extends GraphEdge {
  sourceNode?: SimNode
  targetNode?: SimNode
}

// ─── utils ────────────────────────────────────────────────────────────────────

function safeParse<T>(str: string | undefined | null, fallback: T): T {
  if (!str) return fallback
  try { return JSON.parse(str) as T } catch { return fallback }
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return '방금'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}일 전`
  return new Date(dateStr).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

function getLtvTier(profile: CdpProfile): 'high' | 'mid' | 'low' {
  const c = profile.event_count ?? 0
  return c >= 50 ? 'high' : c >= 10 ? 'mid' : 'low'
}

function getNodeColor(node: GraphNode): string {
  if (node.type === 'profile') {
    return NODE_COLORS[`profile_${node.ltvTier ?? 'low'}`]
  }
  return NODE_COLORS[node.type] ?? NODE_COLORS.default
}

function getNodeRadius(node: GraphNode): number {
  return NODE_RADIUS[node.type] ?? NODE_RADIUS.default
}

// ─── force simulation ─────────────────────────────────────────────────────────

const REPULSION   = 3500
const ATTRACTION  = 0.06
const DAMPING     = 0.82
const CENTER_PULL = 0.015

function tick(nodes: SimNode[], edges: SimEdge[], cx: number, cy: number) {
  // repulsion between all node pairs
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const dist2 = dx * dx + dy * dy || 1
      const dist  = Math.sqrt(dist2)
      const force = REPULSION / dist2
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force
      a.vx -= fx; a.vy -= fy
      b.vx += fx; b.vy += fy
    }
  }

  // spring attraction along edges
  for (const e of edges) {
    const s = e.sourceNode, t = e.targetNode
    if (!s || !t) continue
    const dx   = t.x - s.x
    const dy   = t.y - s.y
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    const restLen = 120
    const stretch = dist - restLen
    const fx = ATTRACTION * stretch * (dx / dist)
    const fy = ATTRACTION * stretch * (dy / dist)
    s.vx += fx; s.vy += fy
    t.vx -= fx; t.vy -= fy
  }

  // center pull
  for (const n of nodes) {
    n.vx += (cx - n.x) * CENTER_PULL
    n.vy += (cy - n.y) * CENTER_PULL
  }

  // integrate
  for (const n of nodes) {
    if (n.fx !== null) { n.x = n.fx; n.vy = 0; n.vx = 0; continue }
    n.vx *= DAMPING
    n.vy *= DAMPING
    n.x  += n.vx
    n.y  += n.vy
  }
}

// ─── Canvas graph component ───────────────────────────────────────────────────

interface CanvasGraphProps {
  graph: IdentityGraph | null
  loading: boolean
  onNodeClick: (nodeId: string) => void
  selectedNodeId: string | null
}

function CanvasGraph({ graph, loading, onNodeClick, selectedNodeId }: CanvasGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef   = useRef<number>(0)
  const nodesRef  = useRef<SimNode[]>([])
  const edgesRef  = useRef<SimEdge[]>([])

  // pan/zoom state
  const transformRef = useRef({ tx: 0, ty: 0, scale: 1 })
  const dragRef = useRef<{
    type: 'pan' | 'node'
    nodeId?: string
    startX: number; startY: number
    startTx?: number; startTy?: number
  } | null>(null)
  const hoveredNodeRef = useRef<string | null>(null)

  // initialise simulation nodes from graph data
  useEffect(() => {
    if (!graph) { nodesRef.current = []; edgesRef.current = []; return }

    const canvas = canvasRef.current
    const cx = canvas ? canvas.width / 2 : 400
    const cy = canvas ? canvas.height / 2 : 300

    const nodeMap = new Map<string, SimNode>()
    const nodes: SimNode[] = graph.nodes.map((n, i) => {
      const angle = (i / graph.nodes.length) * Math.PI * 2
      const r     = n.type === 'profile' ? 0 : 140 + Math.random() * 60
      const sn: SimNode = {
        ...n,
        x:  cx + r * Math.cos(angle) + (Math.random() - 0.5) * 20,
        y:  cy + r * Math.sin(angle) + (Math.random() - 0.5) * 20,
        vx: 0, vy: 0, fx: null, fy: null,
      }
      nodeMap.set(n.id, sn)
      return sn
    })

    const edges: SimEdge[] = graph.edges.map(e => ({
      ...e,
      sourceNode: nodeMap.get(e.source),
      targetNode: nodeMap.get(e.target),
    }))

    nodesRef.current = nodes
    edgesRef.current = edges
    transformRef.current = { tx: 0, ty: 0, scale: 1 }
  }, [graph])

  // draw loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx    = canvas.getContext('2d')
    if (!ctx) return

    const { tx, ty, scale } = transformRef.current
    const W = canvas.width, H = canvas.height
    const cx = W / 2, cy = H / 2

    // physics step (skip if paused)
    tick(nodesRef.current, edgesRef.current, cx, cy)

    // clear
    ctx.clearRect(0, 0, W, H)

    // background grid (subtle)
    ctx.save()
    ctx.translate(tx, ty)
    ctx.scale(scale, scale)

    // draw edges
    for (const edge of edgesRef.current) {
      const s = edge.sourceNode, t = edge.targetNode
      if (!s || !t) continue
      const alpha = EDGE_ALPHA[edge.idClass] ?? 0.5
      const dash  = EDGE_DASH[edge.idClass] ?? null
      ctx.beginPath()
      ctx.moveTo(s.x, s.y)
      ctx.lineTo(t.x, t.y)
      ctx.strokeStyle = `rgba(148,163,184,${alpha})`
      ctx.lineWidth   = edge.idClass === 'deterministic' ? 2 : 1.2
      if (dash) ctx.setLineDash(dash); else ctx.setLineDash([])
      ctx.stroke()
      ctx.setLineDash([])

      // confidence label on edge
      if (edge.confidence < 1.0) {
        const mx = (s.x + t.x) / 2
        const my = (s.y + t.y) / 2
        ctx.font = '9px Inter, sans-serif'
        ctx.fillStyle = `rgba(148,163,184,${alpha + 0.1})`
        ctx.textAlign = 'center'
        ctx.fillText(`${Math.round(edge.confidence * 100)}%`, mx, my - 4)
      }
    }

    // draw nodes
    for (const node of nodesRef.current) {
      const r       = getNodeRadius(node)
      const color   = getNodeColor(node)
      const isHover = hoveredNodeRef.current === node.id
      const isSel   = selectedNodeId === node.id

      // glow ring for selected/hovered
      if (isHover || isSel) {
        ctx.beginPath()
        ctx.arc(node.x, node.y, r + 6, 0, Math.PI * 2)
        ctx.fillStyle = isSel ? `${color}55` : `${color}33`
        ctx.fill()
      }

      // node circle
      ctx.beginPath()
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.shadowColor = color
      ctx.shadowBlur  = node.type === 'profile' ? 16 : 8
      ctx.fill()
      ctx.shadowBlur = 0

      // border
      ctx.beginPath()
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'
      ctx.lineWidth   = 1.5
      ctx.stroke()

      // label below node
      ctx.font        = node.type === 'profile' ? 'bold 11px Inter, sans-serif' : '10px Inter, sans-serif'
      ctx.fillStyle   = 'rgba(226,232,240,0.9)'
      ctx.textAlign   = 'center'
      ctx.shadowBlur  = 0
      ctx.fillText(node.label, node.x, node.y + r + 14)

      // event count badge for profile nodes
      if (node.type === 'profile' && node.eventCount !== undefined && node.eventCount > 0) {
        const badge = String(node.eventCount)
        ctx.font      = 'bold 9px Inter, sans-serif'
        ctx.fillStyle = '#0f172a'
        ctx.textAlign = 'center'
        ctx.fillText(badge, node.x, node.y + 4)
      }
    }

    ctx.restore()

    animRef.current = requestAnimationFrame(draw)
  }, [selectedNodeId])

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animRef.current)
  }, [draw])

  // resize canvas to container
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(() => {
      const rect = canvas.parentElement?.getBoundingClientRect()
      if (!rect) return
      canvas.width  = rect.width
      canvas.height = rect.height
    })
    ro.observe(canvas.parentElement!)
    return () => ro.disconnect()
  }, [])

  // mouse → canvas coords (accounting for transform)
  const toWorld = useCallback((ex: number, ey: number) => {
    const canvas = canvasRef.current!
    const rect   = canvas.getBoundingClientRect()
    const { tx, ty, scale } = transformRef.current
    return {
      wx: (ex - rect.left - tx) / scale,
      wy: (ey - rect.top  - ty) / scale,
    }
  }, [])

  const hitTest = useCallback((wx: number, wy: number): SimNode | null => {
    for (const n of [...nodesRef.current].reverse()) {
      const dx = wx - n.x, dy = wy - n.y
      const r  = getNodeRadius(n) + 4
      if (dx * dx + dy * dy <= r * r) return n
    }
    return null
  }, [])

  // ── mouse events ──────────────────────────────────────────────────────────

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const { wx, wy } = toWorld(e.clientX, e.clientY)
    const hit = hitTest(wx, wy)
    hoveredNodeRef.current = hit?.id ?? null
    const canvas = canvasRef.current
    if (canvas) canvas.style.cursor = hit ? 'pointer' : 'grab'

    if (!dragRef.current) return

    if (dragRef.current.type === 'pan') {
      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY
      transformRef.current.tx = (dragRef.current.startTx ?? 0) + dx
      transformRef.current.ty = (dragRef.current.startTy ?? 0) + dy
    } else if (dragRef.current.type === 'node') {
      const node = nodesRef.current.find(n => n.id === dragRef.current!.nodeId)
      if (node) { node.fx = wx; node.fy = wy }
    }
  }, [toWorld, hitTest])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const { wx, wy } = toWorld(e.clientX, e.clientY)
    const hit = hitTest(wx, wy)
    if (hit) {
      dragRef.current = {
        type: 'node', nodeId: hit.id,
        startX: e.clientX, startY: e.clientY,
      }
    } else {
      dragRef.current = {
        type: 'pan',
        startX: e.clientX, startY: e.clientY,
        startTx: transformRef.current.tx,
        startTy: transformRef.current.ty,
      }
    }
  }, [toWorld, hitTest])

  const onMouseUp = useCallback((e: React.MouseEvent) => {
    if (dragRef.current?.type === 'node') {
      const node = nodesRef.current.find(n => n.id === dragRef.current!.nodeId)
      const dx   = Math.abs(e.clientX - dragRef.current.startX)
      const dy   = Math.abs(e.clientY - dragRef.current.startY)
      if (node && dx < 5 && dy < 5) {
        // click (not drag) — toggle pin & fire callback
        node.fx = null; node.fy = null
        onNodeClick(node.id)
      }
      // keep pinned if dragged
    }
    dragRef.current = null
  }, [onNodeClick])

  const onMouseLeave = useCallback(() => {
    dragRef.current = null
    hoveredNodeRef.current = null
  }, [])

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.1 : 0.91
    const canvas = canvasRef.current!
    const rect   = canvas.getBoundingClientRect()
    const px     = e.clientX - rect.left
    const py     = e.clientY - rect.top
    const { tx, ty, scale } = transformRef.current
    const newScale = Math.min(3, Math.max(0.2, scale * factor))
    transformRef.current = {
      tx: px - (px - tx) * (newScale / scale),
      ty: py - (py - ty) * (newScale / scale),
      scale: newScale,
    }
  }, [])

  // double-click → reset view
  const onDblClick = useCallback(() => {
    transformRef.current = { tx: 0, ty: 0, scale: 1 }
  }, [])

  return (
    <div className="relative w-full h-full bg-[#0b1120] rounded-lg overflow-hidden">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <RefreshCw className="w-7 h-7 text-indigo-400 animate-spin" />
        </div>
      )}
      {!loading && !graph && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-500">
          <Database className="w-10 h-10" />
          <p className="text-sm">프로필을 선택하면 ID 그래프가 표시됩니다</p>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        onMouseMove={onMouseMove}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onWheel={onWheel}
        onDoubleClick={onDblClick}
      />
      {/* legend */}
      <div className="absolute bottom-3 left-3 flex flex-col gap-1 text-[10px] text-slate-400 pointer-events-none">
        <LegendItem color="#3b82f6" label="이메일" />
        <LegendItem color="#22c55e" label="전화번호" />
        <LegendItem color="#f59e0b" label="사용자 ID / 고LTV" />
        <LegendItem color="#a855f7" label="Anonymous ID" />
        <LegendItem color="#f97316" label="광고 Click ID" />
      </div>
      <div className="absolute bottom-3 right-3 flex flex-col gap-1 text-[10px] text-slate-400 pointer-events-none">
        <div className="flex items-center gap-1.5">
          <div className="w-5 border-t-2 border-slate-300" />
          <span>확정 (1.0)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-5 border-t-2 border-dashed border-slate-400" />
          <span>확률 (0.7~0.82)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-5 border-t-2 border-dotted border-slate-500" />
          <span>행동 (0.5)</span>
        </div>
      </div>
      {/* hint */}
      <div className="absolute top-3 right-3 text-[10px] text-slate-600 pointer-events-none">
        드래그=이동 • 스크롤=줌 • 더블클릭=초기화
      </div>
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-3 h-3 rounded-full" style={{ background: color }} />
      <span>{label}</span>
    </div>
  )
}

// ─── profile list item ────────────────────────────────────────────────────────

function ProfileListItem({
  profile, selected, onClick,
}: { profile: CdpProfile; selected: boolean; onClick: () => void }) {
  const tier  = getLtvTier(profile)
  const sources = safeParse<string[]>(profile.sources, [])
  const tierColor = tier === 'high' ? 'text-amber-400' : tier === 'mid' ? 'text-indigo-400' : 'text-slate-500'

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-2.5 rounded-lg border transition-all',
        selected
          ? 'bg-indigo-900/40 border-indigo-500/50 text-white'
          : 'bg-slate-900/40 border-slate-800 text-slate-300 hover:bg-slate-800/60 hover:border-slate-700',
      )}
    >
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-xs font-medium truncate max-w-[150px]">
          {profile.user_id
            ? `UID ${profile.user_id.slice(0, 10)}`
            : profile.anonymous_id
            ? `Anon ${profile.anonymous_id.slice(0, 10)}`
            : `Profile ${profile.id.slice(0, 8)}`}
        </span>
        <span className={cn('text-[10px] font-semibold uppercase', tierColor)}>
          {tier}
        </span>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-slate-500">
        <span>{profile.event_count ?? 0} 이벤트</span>
        <span>·</span>
        <span>{sources.length > 0 ? sources.slice(0, 2).join(', ') : '소스 없음'}</span>
      </div>
    </button>
  )
}

// ─── profile detail panel ─────────────────────────────────────────────────────

function ProfileDetailPanel({
  profile, graph, onClose,
}: { profile: CdpProfile | null; graph: IdentityGraph | null; onClose: () => void }) {
  if (!profile) return null
  const tier    = getLtvTier(profile)
  const sources = safeParse<string[]>(profile.sources, [])
  const traits  = safeParse<Record<string, unknown>>(profile.traits, {})
  const tierColor = tier === 'high' ? 'text-amber-400 bg-amber-400/10 border-amber-400/20'
    : tier === 'mid' ? 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20'
    : 'text-slate-400 bg-slate-400/10 border-slate-600'

  const deterministicCount = graph?.edges.filter(e => e.idClass === 'deterministic').length ?? 0
  const probabilisticCount = graph?.edges.filter(e => e.idClass === 'probabilistic').length ?? 0
  const behavioralCount    = graph?.edges.filter(e => e.idClass === 'behavioral').length ?? 0

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* header */}
      <div className="flex items-start justify-between p-4 border-b border-slate-800 shrink-0">
        <div>
          <div className="text-sm font-semibold text-white mb-1">프로필 상세</div>
          <div className="text-[10px] text-slate-500 font-mono">{profile.id}</div>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* tier badge */}
      <div className="p-4 border-b border-slate-800 shrink-0">
        <div className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold', tierColor)}>
          <Zap className="w-3 h-3" />
          {tier.toUpperCase()} LTV
        </div>
        <div className="mt-2 text-xs text-slate-400">
          이벤트 <span className="text-white font-medium">{profile.event_count ?? 0}</span>회
          &nbsp;·&nbsp;LTV <span className="text-white font-medium">₩{((profile.ltv ?? 0) / 100).toLocaleString()}</span>
        </div>
        <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          마지막 활동: {relativeTime(profile.last_seen_at)}
        </div>
      </div>

      {/* identifier breakdown */}
      <div className="p-4 border-b border-slate-800 shrink-0">
        <div className="text-[11px] font-medium text-slate-400 mb-2 uppercase tracking-wide">식별자 레이어</div>
        <div className="space-y-1.5">
          <IdentifierRow
            color="#3b82f6" icon={<Mail className="w-3 h-3" />}
            label="확정 (Deterministic)" count={deterministicCount}
          />
          <IdentifierRow
            color="#f97316" icon={<Activity className="w-3 h-3" />}
            label="확률 (Probabilistic)" count={probabilisticCount}
          />
          <IdentifierRow
            color="#a855f7" icon={<Globe className="w-3 h-3" />}
            label="행동 (Behavioral)" count={behavioralCount}
          />
        </div>
      </div>

      {/* identifiers list */}
      {graph && graph.nodes.length > 1 && (
        <div className="p-4 border-b border-slate-800 shrink-0">
          <div className="text-[11px] font-medium text-slate-400 mb-2 uppercase tracking-wide">식별자 목록</div>
          <div className="space-y-1">
            {graph.nodes.filter(n => n.type !== 'profile').map(n => (
              <div key={n.id} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: NODE_COLORS[n.type] ?? NODE_COLORS.default }}
                  />
                  <span className="text-slate-400">{n.type.replace('_', ' ')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-mono text-[10px]">{n.label}</span>
                  {n.confidence !== undefined && n.confidence < 1 && (
                    <span className="text-slate-600 text-[10px]">{Math.round(n.confidence * 100)}%</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* merge history */}
      {graph && graph.mergedFrom.length > 0 && (
        <div className="p-4 border-b border-slate-800 shrink-0">
          <div className="text-[11px] font-medium text-slate-400 mb-2 uppercase tracking-wide">
            병합 히스토리 ({graph.mergedFrom.length})
          </div>
          {graph.mergedFrom.map(id => (
            <div key={id} className="text-[10px] text-slate-500 font-mono truncate">
              ← {id}
            </div>
          ))}
        </div>
      )}

      {/* raw fields */}
      <div className="p-4 shrink-0">
        <div className="text-[11px] font-medium text-slate-400 mb-2 uppercase tracking-wide">필드</div>
        <div className="space-y-1">
          <RawField label="email" value={profile.email_hash ? '****' + profile.email_hash.slice(-4) : null} />
          <RawField label="phone" value={profile.phone_hash ? '****' + profile.phone_hash.slice(-4) : null} />
          <RawField label="user_id" value={profile.user_id} />
          <RawField label="channel" value={profile.channel} />
          <RawField label="sources" value={sources.join(', ') || null} />
          {Object.entries(traits).slice(0, 5).map(([k, v]) => (
            <RawField key={k} label={k} value={String(v)} />
          ))}
          <RawField label="first_seen" value={relativeTime(profile.first_seen_at)} />
        </div>
      </div>
    </div>
  )
}

function IdentifierRow({ color, icon, label, count }: {
  color: string; icon: React.ReactNode; label: string; count: number
}) {
  return (
    <div className="flex items-center justify-between text-[11px]">
      <div className="flex items-center gap-1.5" style={{ color }}>
        {icon}
        <span className="text-slate-400">{label}</span>
      </div>
      <span className="text-slate-300 font-medium">{count}</span>
    </div>
  )
}

function RawField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2 text-[11px]">
      <span className="text-slate-500 w-20 shrink-0">{label}</span>
      <span className="text-slate-300 truncate">{value}</span>
    </div>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function CDPView() {
  const { currentMission } = useAppStore()
  const currentMissionId = currentMission?.id
  const [search,      setSearch]      = useState('')
  const [tierFilter,  setTierFilter]  = useState<'all' | 'high' | 'mid' | 'low'>('all')
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  const [selectedNodeId,    setSelectedNodeId]    = useState<string | null>(null)

  // profiles list
  const { data: profilesData, isLoading: profilesLoading, refetch } = useQuery({
    queryKey: ['cdp-profiles', currentMissionId],
    queryFn:  () => identityApi.listProfiles(currentMissionId!, 100, 0),
    enabled:  !!currentMissionId,
    refetchInterval: 30_000,
  })

  // graph for selected profile
  const { data: graph, isLoading: graphLoading } = useQuery({
    queryKey: ['identity-graph', selectedProfileId, currentMissionId],
    queryFn:  () => identityApi.getGraph(selectedProfileId!, currentMissionId!),
    enabled:  !!selectedProfileId && !!currentMissionId,
  })

  const profiles = profilesData?.data ?? []

  const filtered = useMemo(() => {
    return profiles.filter(p => {
      if (tierFilter !== 'all' && getLtvTier(p) !== tierFilter) return false
      if (search) {
        const q = search.toLowerCase()
        const inId   = p.id.toLowerCase().includes(q)
        const inUser = (p.user_id ?? '').toLowerCase().includes(q)
        const inAnon = (p.anonymous_id ?? '').toLowerCase().includes(q)
        if (!inId && !inUser && !inAnon) return false
      }
      return true
    })
  }, [profiles, tierFilter, search])

  const selectedProfile = profiles.find(p => p.id === selectedProfileId) ?? null

  const highCount = profiles.filter(p => getLtvTier(p) === 'high').length
  const midCount  = profiles.filter(p => getLtvTier(p) === 'mid').length

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNodeId(prev => prev === nodeId ? null : nodeId)
  }, [])

  const handleProfileClick = useCallback((profileId: string) => {
    setSelectedProfileId(prev => prev === profileId ? null : profileId)
    setSelectedNodeId(null)
  }, [])

  if (!currentMissionId) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 text-sm">
        <AlertCircle className="w-5 h-5 mr-2" /> 미션을 먼저 선택해주세요
      </div>
    )
  }

  return (
    <div className="flex h-full bg-[#0a0f1e] text-white overflow-hidden">

      {/* ── Left: profile list ─────────────────────────────────────── */}
      <div className="w-[280px] shrink-0 border-r border-slate-800 flex flex-col">

        {/* header */}
        <div className="p-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-400" />
              CDP ID-Graph
            </h2>
            <button
              onClick={() => refetch()}
              className="text-slate-500 hover:text-white transition-colors"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', profilesLoading && 'animate-spin')} />
            </button>
          </div>

          {/* stats */}
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            <StatPill label="전체" value={profiles.length} color="text-white" />
            <StatPill label="High" value={highCount} color="text-amber-400" />
            <StatPill label="Mid"  value={midCount}  color="text-indigo-400" />
          </div>

          {/* search */}
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="프로필 검색..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded-md text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* tier filter */}
          <div className="flex gap-1">
            {(['all', 'high', 'mid', 'low'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTierFilter(t)}
                className={cn(
                  'flex-1 py-1 text-[10px] rounded transition-all border',
                  tierFilter === t
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-slate-800/60 border-slate-700 text-slate-500 hover:border-slate-600',
                )}
              >
                {t === 'all' ? '전체' : t.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {profilesLoading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-slate-600 text-xs">
              {profiles.length === 0 ? '아직 프로필이 없습니다' : '검색 결과 없음'}
            </div>
          ) : (
            filtered.map(p => (
              <ProfileListItem
                key={p.id}
                profile={p}
                selected={selectedProfileId === p.id}
                onClick={() => handleProfileClick(p.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Center: Canvas graph ───────────────────────────────────── */}
      <div className="flex-1 relative p-3">
        <CanvasGraph
          graph={graph ?? null}
          loading={graphLoading}
          onNodeClick={handleNodeClick}
          selectedNodeId={selectedNodeId}
        />
      </div>

      {/* ── Right: detail panel ────────────────────────────────────── */}
      <div
        className={cn(
          'border-l border-slate-800 transition-all duration-200 overflow-hidden',
          selectedProfile ? 'w-[320px]' : 'w-0',
        )}
      >
        {selectedProfile && (
          <ProfileDetailPanel
            profile={selectedProfile}
            graph={graph ?? null}
            onClose={() => { setSelectedProfileId(null); setSelectedNodeId(null) }}
          />
        )}
      </div>
    </div>
  )
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-slate-800/60 rounded-md px-2 py-1.5 text-center border border-slate-700/50">
      <div className={cn('text-sm font-bold', color)}>{value}</div>
      <div className="text-[9px] text-slate-500 uppercase">{label}</div>
    </div>
  )
}
