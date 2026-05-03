/**
 * OpsCenter.tsx — 솔로프리너 자동화 지원 센터
 * v5.1.0
 *
 * Tab 1: 자동화 유형 (T1~T7) — 도메인별 대표 사례 카드
 * Tab 2: AI 워크플로우 설계 — 3-panel (AX Clinic 동일 형태)
 *   Left:   n8n 워크플로우 다이어그램 (Canvas)
 *   Center: 노드 설정 가이드 (스트리밍)
 *   Right:  AI 채팅 (→ n8n JSON 생성)
 */
import React, {
  useState, useRef, useEffect, useCallback,
} from 'react'
import {
  Workflow, Zap, ShieldCheck,
  MessageSquare, Send, RefreshCw,
  ChevronRight, X, Copy, CheckCheck, Play, Download,
  Layers, GitBranch, Settings, AlertTriangle,
  Clock, Database,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useAppStore } from '../store/app.store'

// ─── T1~T7 자동화 유형 정의 ───────────────────────────────────────────────────

const AUTO_TYPES = [
  {
    code: 'T1', label: 'Manual Bridge',
    icon: GitBranch, color: '#f59e0b', bgColor: 'bg-amber-500/10 border-amber-500/20',
    desc: '수동 데이터 이동 자동화',
    signal: "'엑셀에 옮겨서', '직접 입력', '복사해서'",
    domains: {
      '세무/재무': 'ERP → 엑셀 → 회계 자동 연결',
      '마케팅':   '광고 데이터 → 스프레드시트 자동 싱크',
      'CS':       '고객 문의 → CRM 자동 입력',
      'HR':       '출퇴근 앱 → 급여 시스템 자동 연동',
    },
  },
  {
    code: 'T2', label: 'Silo Accumulation',
    icon: Database, color: '#6366f1', bgColor: 'bg-indigo-500/10 border-indigo-500/20',
    desc: '분산 데이터 사일로 통합',
    signal: "'각 팀마다', '부서별로 따로'",
    domains: {
      '세무/재무': '3개 카드사 정산 데이터 통합 대시보드',
      '재고':     '매장·온라인·창고 재고 단일화',
      'HR':       '인사 데이터 멀티 시스템 동기화',
      '보고서':   '팀별 KPI → 통합 CEO 대시보드',
    },
  },
  {
    code: 'T3', label: 'Latency Gap',
    icon: Clock, color: '#10b981', bgColor: 'bg-emerald-500/10 border-emerald-500/20',
    desc: '실시간 데이터 지연 제거',
    signal: "'월말에', '주 1회 집계', '어제 기준'",
    domains: {
      '세무/재무': '일일 매출 → 실시간 손익 집계',
      '재고':     '판매 즉시 재고 차감 알림',
      '마케팅':   '캠페인 성과 실시간 Slack 보고',
      '보고서':   '일일 자동 경영 보고서 발송',
    },
  },
  {
    code: 'T4', label: 'Format Mismatch',
    icon: Layers, color: '#3b82f6', bgColor: 'bg-blue-500/10 border-blue-500/20',
    desc: '시스템 간 포맷 불일치 해소',
    signal: "'코드가 달라서', '시스템이 달라서'",
    domains: {
      '세무/재무': 'SCM↔ERP 코드 매핑 자동화',
      '재고':     '공급사 SKU → 내부 코드 자동 변환',
      '마케팅':   '플랫폼별 리포트 형식 통합',
      'CS':       '다채널 문의 포맷 CRM 통합',
    },
  },
  {
    code: 'T5', label: 'Unstructured Trap',
    icon: MessageSquare, color: '#a855f7', bgColor: 'bg-purple-500/10 border-purple-500/20',
    desc: '비정형 데이터 자동 구조화',
    signal: "'카카오로', '이메일로 오면', '전화로'",
    domains: {
      'CS':       '카카오 주문 → 주문시스템 자동 입력',
      '세무/재무': '영수증 사진 → 경비 처리 자동화',
      '마케팅':   '인스타 DM → CRM 리드 자동 등록',
      'HR':       '이메일 이력서 → ATS 자동 파싱',
    },
  },
  {
    code: 'T6', label: 'Approval Deadlock',
    icon: AlertTriangle, color: '#f97316', bgColor: 'bg-orange-500/10 border-orange-500/20',
    desc: '결재 병목 자동화',
    signal: "'결재 대기', '팀장 확인 후'",
    domains: {
      '세무/재무': '지출 결의 → Slack 승인 → 자동 처리',
      'HR':       '휴가 신청 → 자동 승인 → 캘린더 반영',
      '마케팅':   '광고 소재 승인 → 자동 게시',
      '보고서':   '보고서 검토 → 자동 이메일 발송',
    },
  },
  {
    code: 'T7', label: 'Shadow Data',
    icon: ShieldCheck, color: '#64748b', bgColor: 'bg-slate-500/10 border-slate-500/20',
    desc: '개인 기기 데이터 시스템화',
    signal: "'개인 폰에', '퇴사하면 사라져'",
    domains: {
      '마케팅':   '영업 연락처 → CRM 자동 백업',
      'CS':       '상담원 메모 → 공유 DB 자동 저장',
      'HR':       '면접 메모 → ATS 연동',
      '세무/재무': '개인 경비 앱 → 회계 시스템 연동',
    },
  },
]

// ─── n8n 노드 타입 ────────────────────────────────────────────────────────────

const N8N_NODE_COLORS: Record<string, string> = {
  trigger:    '#f59e0b',
  http:       '#3b82f6',
  transform:  '#10b981',
  condition:  '#a855f7',
  action:     '#6366f1',
  notify:     '#f97316',
  default:    '#64748b',
}

interface N8nNode {
  id: string; type: string; name: string; x: number; y: number
}

interface N8nEdge { from: string; to: string }

interface N8nWorkflow {
  name: string
  nodes: N8nNode[]
  edges: N8nEdge[]
  json?: string
}

// ─── Canvas workflow diagram ───────────────────────────────────────────────────

function WorkflowDiagram({ workflow }: { workflow: N8nWorkflow | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !workflow) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width, H = canvas.height
    ctx.clearRect(0, 0, W, H)

    if (workflow.nodes.length === 0) return

    const NW = 120, NH = 40
    const nodeMap = new Map<string, N8nNode>()
    for (const n of workflow.nodes) nodeMap.set(n.id, n)

    // draw edges
    for (const e of workflow.edges) {
      const from = nodeMap.get(e.from), to = nodeMap.get(e.to)
      if (!from || !to) continue
      const x1 = from.x + NW, y1 = from.y + NH / 2
      const x2 = to.x,        y2 = to.y  + NH / 2
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.bezierCurveTo(x1 + 30, y1, x2 - 30, y2, x2, y2)
      ctx.strokeStyle = 'rgba(148,163,184,0.5)'
      ctx.lineWidth = 1.5
      ctx.stroke()
      // arrowhead
      const dx = x2 - (x2 - 8), dy = y2 - y1
      ctx.beginPath()
      ctx.moveTo(x2, y2)
      ctx.lineTo(x2 - 8, y2 - 5)
      ctx.lineTo(x2 - 8, y2 + 5)
      ctx.closePath()
      ctx.fillStyle = 'rgba(148,163,184,0.7)'
      ctx.fill()
    }

    // draw nodes
    for (const n of workflow.nodes) {
      const color = N8N_NODE_COLORS[n.type] ?? N8N_NODE_COLORS.default

      // shadow
      ctx.shadowColor = color
      ctx.shadowBlur  = 8

      // rect
      ctx.beginPath()
      ctx.roundRect(n.x, n.y, NW, NH, 6)
      ctx.fillStyle = `${color}22`
      ctx.fill()
      ctx.strokeStyle = `${color}aa`
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.shadowBlur = 0

      // label
      ctx.font = 'bold 10px Inter, sans-serif'
      ctx.fillStyle = '#e2e8f0'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(n.name.length > 14 ? n.name.slice(0, 13) + '…' : n.name, n.x + NW / 2, n.y + NH / 2)
    }
  }, [workflow])

  // resize
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(() => {
      const rect = canvas.parentElement?.getBoundingClientRect()
      if (rect) { canvas.width = rect.width; canvas.height = rect.height }
    })
    ro.observe(canvas.parentElement!)
    return () => ro.disconnect()
  }, [])

  return (
    <div className="relative w-full h-full bg-[#0b1120]">
      {!workflow && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-600">
          <Workflow className="w-8 h-8" />
          <p className="text-xs">워크플로우를 생성하면<br />다이어그램이 표시됩니다</p>
        </div>
      )}
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  )
}

// ─── helper: parse AI response → N8nWorkflow ─────────────────────────────────

function parseWorkflowFromText(text: string): N8nWorkflow | null {
  try {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (!jsonMatch) return null
    const raw = JSON.parse(jsonMatch[1])
    if (!raw.nodes || !Array.isArray(raw.nodes)) return null

    // layout nodes top→down in a chain
    const nodes: N8nNode[] = raw.nodes.map((n: {id?:string; name?:string; type?:string}, i: number) => ({
      id:   n.id ?? `node_${i}`,
      type: (n.type ?? 'default').toLowerCase(),
      name: n.name ?? `Node ${i + 1}`,
      x:    40 + (i % 3) * 160,
      y:    40 + Math.floor(i / 3) * 80,
    }))

    const edges: N8nEdge[] = (raw.connections ?? []).map((c: {from:string; to:string}) => ({
      from: c.from, to: c.to,
    }))

    // auto-connect if no connections provided
    if (edges.length === 0 && nodes.length > 1) {
      for (let i = 0; i < nodes.length - 1; i++) {
        edges.push({ from: nodes[i].id, to: nodes[i + 1].id })
      }
    }

    return { name: raw.name ?? '자동화 워크플로우', nodes, edges, json: jsonMatch[1] }
  } catch {
    return null
  }
}

// ─── streaming chat ───────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// ─── main OpsCenter ───────────────────────────────────────────────────────────

export default function OpsCenter() {
  const { currentMissionId } = useAppStore()
  const [tab,        setTab]        = useState<'types' | 'builder'>('types')
  const [selectedType, setSelectedType] = useState<typeof AUTO_TYPES[0] | null>(null)

  // 3-panel state
  const [messages,  setMessages]  = useState<ChatMessage[]>([
    { role: 'assistant', content: '안녕하세요! 자동화하고 싶은 업무를 설명해주세요.\n예: "매일 아침 카카오로 오는 주문을 노션 DB에 자동 입력하고 싶어요."' },
  ])
  const [input,     setInput]     = useState('')
  const [streaming, setStreaming] = useState(false)
  const [workflow,  setWorkflow]  = useState<N8nWorkflow | null>(null)
  const [guide,     setGuide]     = useState<string>('')
  const [copied,    setCopied]    = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef       = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')

    const userMsg: ChatMessage = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setStreaming(true)

    const context = selectedType
      ? `자동화 유형: ${selectedType.code} ${selectedType.label}\n\n`
      : ''

    try {
      const systemPrompt = selectedType
        ? `당신은 n8n 자동화 전문가입니다. 솔로프리너의 업무 자동화를 도와주세요.
자동화 유형: ${selectedType.code} ${selectedType.label} — ${selectedType.desc}
신호어: ${selectedType.signal}

요청을 분석하고 반드시 n8n 워크플로우 JSON을 포함해주세요. 응답은 한국어로 작성하세요.`
        : undefined

      // SSE fetch (axios는 SSE에 적합하지 않으므로 fetch 사용)
      const BASE_URL = 'http://localhost:3001'
      let internalKey = 'dev-key'
      try {
        internalKey = await (window as any).electronAPI?.getInternalApiKey?.() ?? 'dev-key'
      } catch { /* noop */ }

      const resp = await fetch(`${BASE_URL}/api/ops/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${internalKey}`,
        },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          system: systemPrompt,
          mission_id: currentMissionId,
        }),
      })

      if (!resp.ok || !resp.body) {
        throw new Error(`HTTP ${resp.status}`)
      }

      const reader  = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer    = ''
      let fullText  = ''

      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // split into SSE messages (double newline separated)
        const messages2 = buffer.split('\n\n')
        buffer = messages2.pop() ?? ''

        for (const msg of messages2) {
          const lines = msg.split('\n')
          let eventName = ''
          let dataStr   = ''
          for (const line of lines) {
            if (line.startsWith('event: ')) eventName = line.slice(7).trim()
            if (line.startsWith('data: '))  dataStr   = line.slice(6).trim()
          }
          if (!dataStr) continue
          try {
            const parsed = JSON.parse(dataStr)
            if (eventName === 'delta' && parsed.text) {
              fullText += parsed.text
              setMessages(prev => {
                const copy = [...prev]
                copy[copy.length - 1] = { role: 'assistant', content: fullText }
                return copy
              })
            } else if (eventName === 'done' && parsed.text) {
              fullText = parsed.text
              setMessages(prev => {
                const copy = [...prev]
                copy[copy.length - 1] = { role: 'assistant', content: fullText }
                return copy
              })
            } else if (eventName === 'error') {
              throw new Error(parsed.message ?? 'Stream error')
            }
          } catch (parseErr) {
            if (parseErr instanceof SyntaxError) continue
            throw parseErr
          }
        }
      }

      // extract workflow & guide from final text
      if (fullText) {
        const wf = parseWorkflowFromText(fullText)
        if (wf) {
          setWorkflow(wf)
          const parts = fullText.split('```')
          const guideText = parts.length > 2 ? parts[parts.length - 1].trim() : ''
          setGuide(guideText)
        }
      }
    } catch (err) {
      const errMsg = '⚠️ 연결 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
      setMessages(prev => {
        const copy = [...prev]
        if (copy[copy.length - 1]?.content === '') {
          copy[copy.length - 1] = { role: 'assistant', content: errMsg }
        } else {
          copy.push({ role: 'assistant', content: errMsg })
        }
        return copy
      })
    } finally {
      setStreaming(false)
    }
  }, [input, messages, streaming, selectedType, currentMissionId])

  const copyJson = useCallback(() => {
    if (!workflow?.json) return
    navigator.clipboard.writeText(workflow.json)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [workflow])

  const downloadJson = useCallback(() => {
    if (!workflow?.json) return
    const blob = new Blob([workflow.json], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${workflow.name.replace(/\s+/g, '_')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [workflow])

  const handleTypeSelect = useCallback((t: typeof AUTO_TYPES[0]) => {
    setSelectedType(t)
    setTab('builder')
    setMessages([
      { role: 'assistant', content: `안녕하세요! **${t.code} ${t.label}** 유형의 자동화를 설계해드리겠습니다.\n\n신호: ${t.signal}\n\n어떤 업무를 자동화하고 싶으신가요? 구체적으로 설명해주세요.` },
    ])
  }, [])

  // ── render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-[#0d0d0f] text-white overflow-hidden">

      {/* header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-[#1c1c20] shrink-0">
        <Workflow size={16} className="text-yellow-400" />
        <span className="text-sm font-semibold text-[#e4e4e7]">Ops Center</span>
        <span className="text-[11px] text-[#52525b] bg-[#111113] border border-[#27272a] px-2 py-0.5 rounded-full">
          자동화 지원
        </span>
        <div className="ml-auto flex gap-1">
          <TabButton active={tab === 'types'}   onClick={() => setTab('types')}>
            자동화 유형
          </TabButton>
          <TabButton active={tab === 'builder'} onClick={() => setTab('builder')}>
            AI 워크플로우 설계
          </TabButton>
        </div>
      </div>

      {/* ── Tab: 자동화 유형 ─────────────────────────────────────────────────── */}
      {tab === 'types' && (
        <div className="flex-1 overflow-y-auto p-5">
          <p className="text-xs text-slate-500 mb-4">
            T1~T7 데이터 단절 유형 분류 기반 — 유형을 선택하면 AI 워크플로우 설계로 이동합니다
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            {AUTO_TYPES.map(t => {
              const Icon = t.icon
              return (
                <button
                  key={t.code}
                  onClick={() => handleTypeSelect(t)}
                  className={cn(
                    'text-left bg-[#111113] border rounded-xl p-4 hover:scale-[1.01] transition-all group',
                    t.bgColor,
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="text-[11px] font-bold px-1.5 py-0.5 rounded"
                      style={{ color: t.color, background: `${t.color}20` }}
                    >
                      {t.code}
                    </span>
                    <Icon size={14} style={{ color: t.color }} />
                    <span className="text-sm font-semibold text-[#e4e4e7]">{t.label}</span>
                    <ChevronRight size={12} className="ml-auto text-slate-600 group-hover:text-slate-400 transition-colors" />
                  </div>
                  <p className="text-xs text-slate-500 mb-3">{t.desc}</p>
                  <p className="text-[10px] text-slate-600 italic mb-3">신호어: {t.signal}</p>
                  <div className="space-y-1">
                    {Object.entries(t.domains).map(([domain, example]) => (
                      <div key={domain} className="flex items-start gap-2 text-[11px]">
                        <span className="text-slate-500 w-20 shrink-0">{domain}</span>
                        <span className="text-slate-400">{example}</span>
                      </div>
                    ))}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Tab: AI 워크플로우 설계 (3-panel) ───────────────────────────────── */}
      {tab === 'builder' && (
        <div className="flex flex-1 min-h-0">

          {/* ── Left: 워크플로우 다이어그램 ──────────────────────────────────── */}
          <div className="w-[280px] shrink-0 border-r border-[#1c1c20] flex flex-col">
            <div className="px-3 py-2.5 border-b border-[#1c1c20] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1.5 text-xs font-medium text-[#a1a1aa]">
                <GitBranch size={12} className="text-yellow-400" />
                워크플로우 다이어그램
              </div>
              {workflow && (
                <div className="flex gap-1">
                  <IconButton onClick={copyJson} title="JSON 복사">
                    {copied ? <CheckCheck size={12} className="text-green-400" /> : <Copy size={12} />}
                  </IconButton>
                  <IconButton onClick={downloadJson} title="JSON 다운로드">
                    <Download size={12} />
                  </IconButton>
                </div>
              )}
            </div>

            {/* selected type badge */}
            {selectedType && (
              <div className="px-3 py-2 border-b border-[#1c1c20] shrink-0">
                <div
                  className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full border"
                  style={{ color: selectedType.color, borderColor: `${selectedType.color}40`, background: `${selectedType.color}15` }}
                >
                  <span className="font-bold">{selectedType.code}</span>
                  <span>{selectedType.label}</span>
                  <button
                    onClick={() => setSelectedType(null)}
                    className="ml-1 opacity-60 hover:opacity-100"
                  >
                    <X size={10} />
                  </button>
                </div>
              </div>
            )}

            <div className="flex-1 relative overflow-hidden">
              <WorkflowDiagram workflow={workflow} />
            </div>

            {/* node legend */}
            {workflow && (
              <div className="p-2 border-t border-[#1c1c20] shrink-0">
                <div className="text-[9px] text-slate-600 mb-1.5 uppercase tracking-wide">노드 유형</div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                  {Object.entries(N8N_NODE_COLORS).filter(([k]) => k !== 'default').map(([type, color]) => (
                    <div key={type} className="flex items-center gap-1 text-[10px] text-slate-500">
                      <div className="w-2 h-2 rounded-sm" style={{ background: color }} />
                      {type}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Center: 노드 가이드 ──────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col border-r border-[#1c1c20] min-w-0">
            <div className="px-4 py-2.5 border-b border-[#1c1c20] flex items-center gap-1.5 text-xs font-medium text-[#a1a1aa] shrink-0">
              <Settings size={12} className="text-indigo-400" />
              노드 설정 가이드
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {!guide && !streaming && (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-600">
                  <Layers size={32} />
                  <p className="text-sm text-center">
                    오른쪽 채팅에서 자동화를 요청하면<br />
                    노드별 설정 가이드가 여기에 표시됩니다
                  </p>
                </div>
              )}

              {(guide || streaming) && (
                <div className="space-y-4">
                  {workflow && (
                    <div className="bg-[#111113] border border-[#1c1c20] rounded-lg p-3 mb-4">
                      <div className="text-xs font-semibold text-[#e4e4e7] mb-2 flex items-center gap-1.5">
                        <Play size={11} className="text-green-400" />
                        {workflow.name}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {workflow.nodes.map(n => (
                          <div
                            key={n.id}
                            className="text-[10px] px-2 py-0.5 rounded-full border"
                            style={{
                              color: N8N_NODE_COLORS[n.type] ?? N8N_NODE_COLORS.default,
                              borderColor: `${N8N_NODE_COLORS[n.type] ?? N8N_NODE_COLORS.default}40`,
                              background: `${N8N_NODE_COLORS[n.type] ?? N8N_NODE_COLORS.default}15`,
                            }}
                          >
                            {n.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="prose prose-invert prose-sm max-w-none">
                    <GuideMd text={guide} />
                    {streaming && (
                      <span className="inline-block w-1.5 h-3.5 bg-indigo-400 animate-pulse rounded-sm ml-0.5" />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Right: AI 채팅 ───────────────────────────────────────────────── */}
          <div className="w-[340px] shrink-0 flex flex-col">
            <div className="px-4 py-2.5 border-b border-[#1c1c20] flex items-center gap-1.5 text-xs font-medium text-[#a1a1aa] shrink-0">
              <MessageSquare size={12} className="text-purple-400" />
              AI 자동화 설계 채팅
              {workflow && (
                <span className="ml-auto text-[10px] text-green-500 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded-full">
                  JSON 생성됨
                </span>
              )}
            </div>

            {/* messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {messages.map((m, i) => (
                <ChatBubble key={i} message={m} />
              ))}
              {streaming && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-full bg-purple-600/30 shrink-0 flex items-center justify-center">
                    <Zap size={11} className="text-purple-400" />
                  </div>
                  <div className="bg-[#111113] border border-[#1c1c20] rounded-xl px-3 py-2 text-xs text-slate-400">
                    <span className="flex gap-1">
                      <span className="animate-bounce [animation-delay:0ms]">·</span>
                      <span className="animate-bounce [animation-delay:150ms]">·</span>
                      <span className="animate-bounce [animation-delay:300ms]">·</span>
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* quick prompts */}
            {messages.length <= 2 && (
              <div className="px-3 pb-2 shrink-0">
                <div className="text-[10px] text-slate-600 mb-1.5">빠른 시작</div>
                <div className="space-y-1">
                  {QUICK_PROMPTS.map(qp => (
                    <button
                      key={qp}
                      onClick={() => { setInput(qp); inputRef.current?.focus() }}
                      className="w-full text-left text-[10px] text-slate-500 bg-[#111113] border border-[#1c1c20] rounded px-2.5 py-1.5 hover:border-indigo-500/40 hover:text-slate-400 transition-colors"
                    >
                      {qp}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* input */}
            <div className="p-3 border-t border-[#1c1c20] shrink-0">
              <div className="flex gap-2 items-end">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
                  }}
                  placeholder="자동화하고 싶은 업무를 설명하세요..."
                  rows={3}
                  className="flex-1 resize-none bg-[#111113] border border-[#1c1c20] rounded-lg px-3 py-2 text-xs text-[#e4e4e7] placeholder:text-[#52525b] focus:outline-none focus:border-indigo-500/50 transition-colors"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || streaming}
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0',
                    input.trim() && !streaming
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      : 'bg-[#1c1c20] text-slate-600',
                  )}
                >
                  {streaming
                    ? <RefreshCw size={13} className="animate-spin" />
                    : <Send size={13} />
                  }
                </button>
              </div>
              <p className="mt-1.5 text-[10px] text-slate-700">Enter 전송 · Shift+Enter 줄바꿈</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── sub-components ────────────────────────────────────────────────────────────

function TabButton({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1 text-xs rounded-md transition-all',
        active
          ? 'bg-indigo-600 text-white'
          : 'text-[#71717a] hover:text-[#a1a1aa] hover:bg-[#111113]',
      )}
    >
      {children}
    </button>
  )
}

function IconButton({ onClick, title, children }: {
  onClick: () => void; title?: string; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-5 h-5 flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors"
    >
      {children}
    </button>
  )
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  return (
    <div className={cn('flex gap-2', isUser && 'flex-row-reverse')}>
      <div className={cn(
        'w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold',
        isUser ? 'bg-indigo-600/30 text-indigo-400' : 'bg-purple-600/30 text-purple-400',
      )}>
        {isUser ? 'U' : <Zap size={11} />}
      </div>
      <div className={cn(
        'max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed',
        isUser
          ? 'bg-indigo-600/20 border border-indigo-500/30 text-[#c7d2fe]'
          : 'bg-[#111113] border border-[#1c1c20] text-[#e4e4e7]',
      )}>
        <GuideMd text={message.content} compact />
      </div>
    </div>
  )
}

function GuideMd({ text, compact = false }: { text: string; compact?: boolean }) {
  // minimal markdown renderer
  const lines = text.split('\n')
  return (
    <div className={compact ? 'space-y-0.5' : 'space-y-1.5'}>
      {lines.map((line, i) => {
        if (line.startsWith('### ')) {
          return <div key={i} className="font-semibold text-[#e4e4e7] text-[11px] mt-2">{line.slice(4)}</div>
        }
        if (line.startsWith('## ')) {
          return <div key={i} className="font-bold text-[#e4e4e7] text-xs mt-3">{line.slice(3)}</div>
        }
        if (line.startsWith('# ')) {
          return <div key={i} className="font-bold text-white text-sm mt-3">{line.slice(2)}</div>
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return <div key={i} className="flex gap-1.5"><span className="text-indigo-400 shrink-0">·</span><span>{renderInline(line.slice(2))}</span></div>
        }
        if (/^\d+\./.test(line)) {
          const num = line.match(/^(\d+)\./)?.[1]
          return <div key={i} className="flex gap-1.5"><span className="text-indigo-400 shrink-0 w-4">{num}.</span><span>{renderInline(line.replace(/^\d+\.\s*/, ''))}</span></div>
        }
        if (line.startsWith('```')) return null
        if (!line.trim()) return compact ? null : <div key={i} className="h-1" />
        return <div key={i}>{renderInline(line)}</div>
      })}
    </div>
  )
}

function renderInline(text: string): React.ReactNode {
  // bold **...**
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i} className="text-[#e4e4e7] font-semibold">{p.slice(2, -2)}</strong>
      : p
  )
}

const QUICK_PROMPTS = [
  '카카오 주문을 구글 시트에 자동 기록하고 싶어요',
  '매일 아침 매출 현황을 Slack으로 받고 싶어요',
  '이메일 이력서를 노션 DB에 자동 정리하고 싶어요',
  '인스타 DM 주문을 CRM에 자동 입력하고 싶어요',
]
