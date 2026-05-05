/**
 * OpsCenter.tsx — 솔로프리너 자동화 지원 센터 v5.2.0
 * 3-panel: Left(T1~T7 + 도메인 + 프로세스카드) | Center(단계별 가이드) | Right(AI채팅 + n8n)
 */
import {
  useState, useRef, useEffect, useCallback,
} from 'react'
import {
  Workflow, Zap, ShieldCheck,
  MessageSquare, Send, RefreshCw,
  ChevronRight, X, Copy, CheckCheck, Download,
  Layers, GitBranch, Settings, AlertTriangle,
  Clock, Database, CheckSquare, Square,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useAppStore } from '../store/app.store'

// ─── 데이터 ───────────────────────────────────────────────────────────────────

const AUTO_TYPES = [
  {
    code: 'T1', label: 'Manual Bridge',
    icon: GitBranch, color: '#f59e0b',
    desc: '수동 데이터 이동 자동화',
    signal: "'엑셀에 옮겨서', '직접 입력', '복사해서'",
    domains: ['재무', '운영', '인사'],
    examples: {
      '재무': 'ERP → 엑셀 → 회계 자동 연결',
      '운영': '광고 데이터 → 스프레드시트 자동 싱크',
      '인사': '출퇴근 앱 → 급여 시스템 자동 연동',
    },
  },
  {
    code: 'T2', label: 'Silo Accumulation',
    icon: Database, color: '#6366f1',
    desc: '분산 데이터 사일로 통합',
    signal: "'각 팀마다', '부서별로 따로'",
    domains: ['재무', '운영', '인사'],
    examples: {
      '재무': '3개 카드사 정산 데이터 통합 대시보드',
      '운영': '팀별 KPI → 통합 CEO 대시보드',
      '인사': '인사 데이터 멀티 시스템 동기화',
    },
  },
  {
    code: 'T3', label: 'Latency Gap',
    icon: Clock, color: '#10b981',
    desc: '실시간 데이터 지연 제거',
    signal: "'월말에', '주 1회 집계', '어제 기준'",
    domains: ['재무', '운영'],
    examples: {
      '재무': '일일 매출 → 실시간 손익 집계',
      '운영': '캠페인 성과 실시간 Slack 보고',
    },
  },
  {
    code: 'T4', label: 'Format Mismatch',
    icon: Layers, color: '#3b82f6',
    desc: '시스템 간 포맷 불일치 해소',
    signal: "'코드가 달라서', '시스템이 달라서'",
    domains: ['세무', '운영', 'IT'],
    examples: {
      '세무': 'SCM↔ERP 코드 매핑 자동화',
      '운영': '플랫폼별 리포트 형식 통합',
      'IT':   '레거시↔신규 시스템 포맷 변환',
    },
  },
  {
    code: 'T5', label: 'Unstructured Trap',
    icon: MessageSquare, color: '#a855f7',
    desc: '비정형 데이터 자동 구조화',
    signal: "'카카오로', '이메일로 오면', '전화로'",
    domains: ['운영', '세무', '인사'],
    examples: {
      '운영': '카카오 주문 → 주문시스템 자동 입력',
      '세무': '영수증 사진 → 경비 처리 자동화',
      '인사': '이메일 이력서 → ATS 자동 파싱',
    },
  },
  {
    code: 'T6', label: 'Approval Deadlock',
    icon: AlertTriangle, color: '#f97316',
    desc: '결재 병목 자동화',
    signal: "'결재 대기', '팀장 확인 후'",
    domains: ['재무', '인사', '법률'],
    examples: {
      '재무': '지출 결의 → Slack 승인 → 자동 처리',
      '인사': '휴가 신청 → 자동 승인 → 캘린더 반영',
      '법률': '계약서 검토 → 자동 서명 요청',
    },
  },
  {
    code: 'T7', label: 'Shadow Data',
    icon: ShieldCheck, color: '#64748b',
    desc: '개인 기기 데이터 시스템화',
    signal: "'개인 폰에', '퇴사하면 사라져'",
    domains: ['운영', '인사', 'IT'],
    examples: {
      '운영': '영업 연락처 → CRM 자동 백업',
      '인사': '면접 메모 → ATS 연동',
      'IT':   '개인 PC 설정 → 중앙 저장소 백업',
    },
  },
]

const BIZ_DOMAINS = ['재무', '세무', '인사', 'IT', '법률', '운영']

const T_STEPS: Record<string, Array<{ title: string; desc: string }>> = {
  T1: [
    { title: '데이터 소스 파악', desc: '수동 이동 중인 데이터의 출발지·목적지를 확인합니다' },
    { title: '트리거 설정', desc: '스케줄/웹훅/파일 감지 등 자동화 시작 이벤트를 정의합니다' },
    { title: '필드 매핑', desc: '출발지 필드를 목적지 필드에 1:1 매핑합니다' },
    { title: 'n8n 워크플로우 구성', desc: 'AI 채팅에서 JSON을 생성하고 n8n에 임포트합니다' },
    { title: '테스트 & 배포', desc: '샘플 데이터로 검증 후 실 운영 환경에 배포합니다' },
  ],
  T2: [
    { title: '사일로 목록 파악', desc: '분산된 데이터 저장소의 위치와 형식을 정리합니다' },
    { title: '통합 스키마 설계', desc: '단일화할 통합 데이터 구조(공통 필드)를 설계합니다' },
    { title: '각 소스 커넥터 설정', desc: '시스템별 n8n 커넥터(API키/OAuth)를 설정합니다' },
    { title: '동기화 스케줄 구성', desc: '실시간/주기적 동기화 스케줄을 설정합니다' },
    { title: '통합 대시보드 연결', desc: '통합 데이터를 시각화할 대시보드/리포트를 연결합니다' },
  ],
  T3: [
    { title: '현재 집계 주기 파악', desc: '월말/주간 집계로 인한 지연 구간을 확인합니다' },
    { title: '실시간 소스 연결', desc: '실시간 데이터 소스의 API/웹훅 엔드포인트를 확인합니다' },
    { title: '스트리밍 파이프라인', desc: 'n8n 웹훅으로 실시간 데이터 수신 파이프라인을 구성합니다' },
    { title: '알림 채널 설정', desc: 'Slack/이메일/카카오 알림 채널을 연결합니다' },
    { title: '임계값 모니터링', desc: '이상 감지 조건과 자동 알림 임계값을 설정합니다' },
  ],
  T4: [
    { title: '포맷 불일치 항목 파악', desc: '시스템 간 코드·형식 차이 항목을 목록화합니다' },
    { title: '매핑 테이블 작성', desc: '소스 코드→목적지 코드 변환 규칙을 정의합니다' },
    { title: '변환 노드 구성', desc: 'n8n Set/Code 노드로 데이터 변환 로직을 구현합니다' },
    { title: '예외 처리 설정', desc: '매핑 불가 데이터 처리 규칙(스킵/경고)을 설정합니다' },
    { title: '정합성 자동 검증', desc: '변환 후 데이터 정합성 자동 검증 로직을 추가합니다' },
  ],
  T5: [
    { title: '비정형 채널 파악', desc: '카카오/이메일/전화 등 입력 채널과 형식을 분석합니다' },
    { title: 'AI 파싱 설계', desc: 'Claude/GPT API로 비정형 텍스트 구조화 프롬프트를 설계합니다' },
    { title: '수신 트리거 설정', desc: '카카오봇/이메일 웹훅으로 메시지 수신을 설정합니다' },
    { title: '구조화 → DB 저장', desc: 'AI 파싱 결과를 CRM/DB에 자동 저장합니다' },
    { title: '검토 & 예외 알림', desc: '파싱 실패/불확실 케이스를 담당자에게 알림합니다' },
  ],
  T6: [
    { title: '결재 병목 단계 파악', desc: '현재 승인 플로우 중 대기 시간이 가장 긴 단계를 찾습니다' },
    { title: '자동 승인 조건 정의', desc: '금액/유형 기준 자동 승인 규칙을 정의합니다' },
    { title: 'Slack 승인 봇 설정', desc: '버튼 클릭으로 원클릭 승인/거부 인터페이스를 구성합니다' },
    { title: '자동 후처리 연결', desc: '승인 후 결제/캘린더/메일 자동 실행 액션을 연결합니다' },
    { title: '감사 로그 설정', desc: '모든 승인 이력을 자동으로 기록합니다' },
  ],
  T7: [
    { title: '개인 기기 데이터 파악', desc: '퇴사·이직 위험이 있는 개인 보관 데이터를 목록화합니다' },
    { title: '중앙화 저장소 설계', desc: 'Google Drive/노션/S3 등 중앙 저장소 구조를 설계합니다' },
    { title: '자동 백업 트리거', desc: '스마트폰 사진·메모를 중앙 저장소에 자동 백업합니다' },
    { title: '접근 권한 설정', desc: '역할별 데이터 접근 권한을 설정합니다' },
    { title: '데이터 연속성 검증', desc: '담당자 부재 시에도 데이터 접근 가능한지 검증합니다' },
  ],
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function parseWorkflowFromText(text: string): { name: string; json: string } | null {
  try {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (!jsonMatch) return null
    const raw = JSON.parse(jsonMatch[1])
    if (!raw.nodes && !raw.name) return null
    return { name: raw.name ?? '자동화 워크플로우', json: jsonMatch[1] }
  } catch {
    return null
  }
}

// ─── sub-components ────────────────────────────────────────────────────────────

interface ChatMessage { role: 'user' | 'assistant'; content: string }

function GuideMd({ text, compact = false }: { text: string; compact?: boolean }) {
  const lines = text.split('\n')
  return (
    <div className={compact ? 'space-y-0.5' : 'space-y-1.5'}>
      {lines.map((line, i) => {
        if (line.startsWith('### ')) return <div key={i} className="font-semibold text-[#e4e4e7] text-[11px] mt-2">{line.slice(4)}</div>
        if (line.startsWith('## '))  return <div key={i} className="font-bold text-[#e4e4e7] text-xs mt-3">{line.slice(3)}</div>
        if (line.startsWith('# '))   return <div key={i} className="font-bold text-white text-sm mt-3">{line.slice(2)}</div>
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return <div key={i} className="flex gap-1.5"><span className="text-indigo-400 shrink-0">·</span><span>{line.slice(2)}</span></div>
        }
        if (/^\d+\./.test(line)) {
          const num = line.match(/^(\d+)\./)?.[1]
          return <div key={i} className="flex gap-1.5"><span className="text-indigo-400 shrink-0 w-4">{num}.</span><span>{line.replace(/^\d+\.\s*/, '')}</span></div>
        }
        if (line.startsWith('```')) return null
        if (!line.trim()) return compact ? null : <div key={i} className="h-1" />
        return <div key={i}>{line}</div>
      })}
    </div>
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
        'max-w-[82%] rounded-xl px-3 py-2 text-xs leading-relaxed',
        isUser
          ? 'bg-indigo-600/20 border border-indigo-500/30 text-[#c7d2fe]'
          : 'bg-[#111113] border border-[#1c1c20] text-[#e4e4e7]',
      )}>
        <GuideMd text={message.content} compact />
      </div>
    </div>
  )
}

const QUICK_PROMPTS = [
  '카카오 주문을 구글 시트에 자동 기록하고 싶어요',
  '매일 아침 매출 현황을 Slack으로 받고 싶어요',
  '이메일 이력서를 노션 DB에 자동 정리하고 싶어요',
  '지출 결의 Slack 승인 자동화를 만들어주세요',
]

// ─── OpsCenter ────────────────────────────────────────────────────────────────

export default function OpsCenter() {
  const { currentMission } = useAppStore()
  const currentMissionId = currentMission?.id

  // filter state
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null)

  // step guide state
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set())

  // chat state
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: '안녕하세요! 자동화하고 싶은 업무를 설명해주세요.\n\n왼쪽에서 자동화 유형(T1~T7)과 업무 도메인을 선택하면 단계별 가이드가 표시됩니다.' },
  ])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [workflow, setWorkflow] = useState<{ name: string; json: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  const selectedType = AUTO_TYPES.find(t => t.code === selectedCode) ?? null

  // 현재 필터로 보여줄 T 유형 목록
  const visibleTypes = AUTO_TYPES.filter(t =>
    (!selectedCode || t.code === selectedCode) &&
    (!selectedDomain || t.domains.includes(selectedDomain))
  )

  const steps = selectedCode ? T_STEPS[selectedCode] ?? [] : []

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')

    const userMsg: ChatMessage = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setStreaming(true)

    try {
      const systemPrompt = selectedType
        ? `당신은 n8n 자동화 전문가입니다. 솔로프리너의 업무 자동화를 도와주세요.
자동화 유형: ${selectedType.code} ${selectedType.label} — ${selectedType.desc}
신호어: ${selectedType.signal}
${selectedDomain ? `업무 도메인: ${selectedDomain}` : ''}
요청을 분석하고 n8n 워크플로우 JSON을 포함해주세요. 응답은 한국어로 작성하세요.`
        : undefined

      const BASE_URL = 'http://localhost:3001'
      let internalKey = 'dev-key'
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        internalKey = await (window as any).electronAPI?.getInternalApiKey?.() ?? 'dev-key'
      } catch { /* noop */ }

      const resp = await fetch(`${BASE_URL}/api/ops/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${internalKey}` },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          system: systemPrompt,
          mission_id: currentMissionId,
        }),
      })

      if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`)

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''

      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''
        for (const msg of parts) {
          const lines = msg.split('\n')
          let eventName = '', dataStr = ''
          for (const line of lines) {
            if (line.startsWith('event: ')) eventName = line.slice(7).trim()
            if (line.startsWith('data: '))  dataStr   = line.slice(6).trim()
          }
          if (!dataStr) continue
          try {
            const parsed = JSON.parse(dataStr)
            if (eventName === 'delta' && parsed.text) {
              fullText += parsed.text
              setMessages(prev => { const c = [...prev]; c[c.length - 1] = { role: 'assistant', content: fullText }; return c })
            } else if (eventName === 'done' && parsed.text) {
              fullText = parsed.text
              setMessages(prev => { const c = [...prev]; c[c.length - 1] = { role: 'assistant', content: fullText }; return c })
            } else if (eventName === 'error') {
              throw new Error(parsed.message ?? 'Stream error')
            }
          } catch (e) { if (e instanceof SyntaxError) continue; throw e }
        }
      }

      if (fullText) {
        const wf = parseWorkflowFromText(fullText)
        if (wf) setWorkflow(wf)
      }
    } catch {
      const errMsg = '⚠️ 연결 오류. 잠시 후 다시 시도해주세요.'
      setMessages(prev => {
        const c = [...prev]
        if (c[c.length - 1]?.content === '') c[c.length - 1] = { role: 'assistant', content: errMsg }
        else c.push({ role: 'assistant', content: errMsg })
        return c
      })
    } finally {
      setStreaming(false)
    }
  }, [input, messages, streaming, selectedType, selectedDomain, currentMissionId])

  const copyJson = useCallback(() => {
    if (!workflow?.json) return
    navigator.clipboard.writeText(workflow.json)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [workflow])

  const downloadJson = useCallback(() => {
    if (!workflow?.json) return
    const blob = new Blob([workflow.json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(workflow.name ?? 'workflow').replace(/\s+/g, '_')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [workflow])

  const toggleStep = (idx: number) => {
    setCheckedSteps(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx); else next.add(idx)
      return next
    })
  }

  const resetFilters = () => {
    setSelectedCode(null)
    setSelectedDomain(null)
    setCheckedSteps(new Set())
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-[#0d0d0f] text-white overflow-hidden">

      {/* ── 헤더 + 필터 바 ────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-[#1c1c20]">
        {/* 제목 */}
        <div className="flex items-center gap-3 px-5 py-3">
          <Workflow size={16} className="text-yellow-400" />
          <span className="text-sm font-semibold text-[#e4e4e7]">Ops Center</span>
          <span className="text-[11px] text-[#52525b] bg-[#111113] border border-[#27272a] px-2 py-0.5 rounded-full">
            자동화 지원
          </span>
          {(selectedCode || selectedDomain) && (
            <button
              onClick={resetFilters}
              className="ml-auto flex items-center gap-1 text-[11px] text-muted hover:text-red-400 transition-colors"
            >
              <X size={10} /> 필터 초기화
            </button>
          )}
        </div>

        {/* T1~T7 필터 */}
        <div className="flex items-center gap-1.5 px-5 pb-2 overflow-x-auto scrollbar-none">
          <span className="text-[10px] text-[#52525b] shrink-0 mr-1">유형</span>
          {AUTO_TYPES.map(t => {
            const Icon = t.icon
            const active = selectedCode === t.code
            return (
              <button
                key={t.code}
                onClick={() => { setSelectedCode(prev => prev === t.code ? null : t.code); setCheckedSteps(new Set()) }}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium shrink-0 transition-all border',
                  active
                    ? 'text-white border-transparent'
                    : 'border-[#27272a] text-[#71717a] hover:text-[#a1a1aa] hover:border-[#3f3f46]'
                )}
                style={active ? { background: `${t.color}25`, borderColor: `${t.color}60`, color: t.color } : {}}
              >
                <Icon size={10} />
                <span>{t.code}</span>
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            )
          })}
        </div>

        {/* 업무 도메인 필터 */}
        <div className="flex items-center gap-1.5 px-5 pb-2.5 overflow-x-auto scrollbar-none">
          <span className="text-[10px] text-[#52525b] shrink-0 mr-1">업무</span>
          {BIZ_DOMAINS.map(domain => {
            const active = selectedDomain === domain
            // 현재 선택된 T type이 있으면 해당 type에 domain이 있는지 확인
            const available = !selectedCode || AUTO_TYPES.find(t => t.code === selectedCode)?.domains.includes(domain)
            return (
              <button
                key={domain}
                onClick={() => { if (available) setSelectedDomain(prev => prev === domain ? null : domain) }}
                disabled={!available}
                className={cn(
                  'px-2.5 py-1 rounded-full text-[11px] font-medium shrink-0 transition-all border',
                  active
                    ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                    : available
                      ? 'border-[#27272a] text-[#71717a] hover:text-[#a1a1aa] hover:border-[#3f3f46]'
                      : 'border-[#1c1c20] text-[#333] cursor-not-allowed'
                )}
              >
                {domain}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── 3-panel 본문 ──────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Left: 프로세스 카드 ──────────────────────────────────────── */}
        <div className="w-[240px] shrink-0 border-r border-[#1c1c20] flex flex-col overflow-y-auto">
          <div className="px-3 py-2.5 border-b border-[#1c1c20] shrink-0">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#52525b] uppercase tracking-widest">
              <GitBranch size={10} className="text-yellow-400" />
              자동화 프로세스
            </div>
          </div>

          <div className="flex-1 p-2 space-y-2 overflow-y-auto">
            {visibleTypes.length === 0 && (
              <p className="text-[11px] text-[#52525b] text-center py-8">
                선택한 필터 조합에<br />해당하는 자동화가 없습니다
              </p>
            )}
            {visibleTypes.map(t => {
              const Icon = t.icon
              const isSelected = selectedCode === t.code
              // 도메인 필터가 있으면 해당 도메인 예시만 표시
              const examples = selectedDomain && t.examples[selectedDomain as keyof typeof t.examples]
                ? { [selectedDomain]: t.examples[selectedDomain as keyof typeof t.examples] }
                : t.examples

              return (
                <button
                  key={t.code}
                  onClick={() => {
                    setSelectedCode(prev => prev === t.code ? null : t.code)
                    setCheckedSteps(new Set())
                  }}
                  className={cn(
                    'w-full text-left rounded-xl p-3 border transition-all group',
                    isSelected
                      ? 'border-yellow-500/40 bg-yellow-500/8'
                      : 'border-[#1c1c20] bg-[#111113] hover:border-[#27272a]'
                  )}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
                      style={{ color: t.color, background: `${t.color}20` }}
                    >
                      {t.code}
                    </span>
                    <Icon size={12} style={{ color: t.color }} className="shrink-0" />
                    <span className="text-[12px] font-semibold text-[#e4e4e7] truncate">{t.label}</span>
                    <ChevronRight size={11} className={cn('ml-auto shrink-0 transition-colors', isSelected ? 'text-yellow-400' : 'text-[#333] group-hover:text-[#555]')} />
                  </div>
                  <p className="text-[10px] text-[#52525b] mb-2">{t.desc}</p>
                  <div className="space-y-0.5">
                    {Object.entries(examples).map(([domain, ex]) => (
                      <div key={domain} className="flex items-start gap-1.5 text-[10px]">
                        <span className="text-[#3f3f46] w-10 shrink-0">{domain}</span>
                        <span className="text-[#71717a] leading-snug">{ex}</span>
                      </div>
                    ))}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Center: 단계별 가이드 ────────────────────────────────────── */}
        <div className="flex-1 flex flex-col border-r border-[#1c1c20] min-w-0">
          <div className="px-4 py-2.5 border-b border-[#1c1c20] flex items-center gap-1.5 text-[10px] font-semibold text-[#52525b] uppercase tracking-widest shrink-0">
            <Settings size={10} className="text-indigo-400" />
            구현 단계
            {selectedCode && (
              <span className="ml-auto text-[10px] text-[#52525b] normal-case tracking-normal">
                {checkedSteps.size}/{steps.length} 완료
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {!selectedCode ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-[#3f3f46]">
                <Layers size={36} />
                <p className="text-sm text-center leading-relaxed">
                  왼쪽에서 자동화 유형(T1~T7)을<br />
                  선택하면 단계별 구현 가이드가<br />
                  표시됩니다
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedType && (
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold mb-4"
                    style={{ color: selectedType.color, borderColor: `${selectedType.color}30`, background: `${selectedType.color}10` }}
                  >
                    <selectedType.icon size={14} />
                    {selectedType.code} {selectedType.label}
                    {selectedDomain && <span className="text-xs ml-1 opacity-70">· {selectedDomain}</span>}
                    <span className="text-[10px] font-normal ml-auto opacity-60">{selectedType.desc}</span>
                  </div>
                )}

                {steps.map((step, idx) => {
                  const done = checkedSteps.has(idx)
                  return (
                    <button
                      key={idx}
                      onClick={() => toggleStep(idx)}
                      className={cn(
                        'w-full flex items-start gap-3 p-4 rounded-xl border text-left transition-all group',
                        done
                          ? 'border-green-500/30 bg-green-500/5'
                          : 'border-[#1c1c20] bg-[#111113] hover:border-[#27272a]'
                      )}
                    >
                      <div className={cn(
                        'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 transition-colors',
                        done
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : 'bg-[#1c1c20] text-[#52525b] border border-[#27272a] group-hover:border-indigo-500/40 group-hover:text-indigo-400'
                      )}>
                        {done ? <CheckSquare size={13} /> : idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm font-semibold mb-0.5', done ? 'text-green-400 line-through' : 'text-[#e4e4e7]')}>
                          {step.title}
                        </p>
                        <p className="text-[11px] text-[#71717a] leading-relaxed">{step.desc}</p>
                      </div>
                      <div className={cn('text-[#3f3f46] shrink-0 mt-1', done ? 'text-green-500' : 'group-hover:text-indigo-400')}>
                        {done ? <CheckCheck size={13} /> : <Square size={13} />}
                      </div>
                    </button>
                  )
                })}

                {checkedSteps.size === steps.length && steps.length > 0 && (
                  <div className="text-center py-4 text-green-400 text-sm font-medium border border-green-500/20 rounded-xl bg-green-500/5">
                    ✓ 모든 단계 완료! AI 채팅에서 n8n JSON을 생성해보세요.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: AI 채팅 + n8n ─────────────────────────────────────── */}
        <div className="w-[300px] shrink-0 flex flex-col">
          <div className="px-4 py-2.5 border-b border-[#1c1c20] flex items-center gap-1.5 text-[10px] font-semibold text-[#52525b] uppercase tracking-widest shrink-0">
            <MessageSquare size={10} className="text-purple-400" />
            AI 자동화 설계 채팅
            {workflow && (
              <span className="ml-auto text-[10px] text-green-500 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded-full normal-case tracking-normal">
                JSON 생성됨
              </span>
            )}
          </div>

          {/* 채팅 메시지 */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.map((m, i) => <ChatBubble key={i} message={m} />)}
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

          {/* 빠른 시작 */}
          {messages.length <= 2 && (
            <div className="px-3 pb-2 shrink-0">
              <div className="text-[10px] text-[#52525b] mb-1.5">빠른 시작</div>
              <div className="space-y-1">
                {QUICK_PROMPTS.map(qp => (
                  <button
                    key={qp}
                    onClick={() => { setInput(qp); inputRef.current?.focus() }}
                    className="w-full text-left text-[10px] text-[#52525b] bg-[#111113] border border-[#1c1c20] rounded px-2.5 py-1.5 hover:border-indigo-500/40 hover:text-[#a1a1aa] transition-colors"
                  >
                    {qp}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* n8n JSON 섹션 */}
          {workflow && (
            <div className="px-3 pb-2 shrink-0 border-t border-[#1c1c20] pt-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-green-400 font-semibold">n8n JSON — {workflow.name}</span>
                <div className="flex gap-1">
                  <button onClick={copyJson} className="p-1 text-[#52525b] hover:text-slate-300 transition-colors" title="JSON 복사">
                    {copied ? <CheckCheck size={12} className="text-green-400" /> : <Copy size={12} />}
                  </button>
                  <button onClick={downloadJson} className="p-1 text-[#52525b] hover:text-slate-300 transition-colors" title="JSON 다운로드">
                    <Download size={12} />
                  </button>
                </div>
              </div>
              <div className="bg-[#111113] border border-green-500/20 rounded-lg px-2 py-1.5 max-h-24 overflow-y-auto">
                <pre className="text-[9px] text-green-400/70 leading-relaxed whitespace-pre-wrap break-all">{workflow.json.slice(0, 300)}…</pre>
              </div>
            </div>
          )}

          {/* 입력창 */}
          <div className="p-3 border-t border-[#1c1c20] shrink-0">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                placeholder="자동화하고 싶은 업무를 설명하세요..."
                rows={3}
                className="flex-1 resize-none bg-[#111113] border border-[#1c1c20] rounded-lg px-3 py-2 text-xs text-[#e4e4e7] placeholder:text-[#52525b] focus:outline-none focus:border-indigo-500/50 transition-colors"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || streaming}
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0',
                  input.trim() && !streaming ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-[#1c1c20] text-[#52525b]',
                )}
              >
                {streaming ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
              </button>
            </div>
            <p className="mt-1.5 text-[9px] text-[#3f3f46]">Enter 전송 · Shift+Enter 줄바꿈</p>
          </div>
        </div>
      </div>
    </div>
  )
}
