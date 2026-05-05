/**
 * OpsCenter.tsx — 자동화 지원 센터 v5.4.0
 * AX Clinic 스타일: Left(도메인별 프로세스) | Center(단계별 액션 카드) | Right(AI채팅 + n8n)
 * T1~T7 분류는 각 프로세스의 태그로 표시
 */
import {
  useState, useRef, useEffect, useCallback,
} from 'react'
import {
  Workflow, Zap,
  MessageSquare, Send, RefreshCw,
  ChevronRight, Copy, CheckCheck, Download,
  CheckSquare, Square, ChevronDown, ChevronUp,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useAppStore } from '../store/app.store'

// ─── 자동화 프로세스 데이터 ────────────────────────────────────────────────────

interface AutoProcess {
  id: string
  title: string
  desc: string
  tCode: string
  domain: string
  steps: Array<{ title: string; desc: string }>
}

const T_COLOR: Record<string, string> = {
  T1: '#f59e0b', T2: '#6366f1', T3: '#10b981',
  T4: '#3b82f6', T5: '#a855f7', T6: '#f97316', T7: '#64748b',
}

const PROCESSES: AutoProcess[] = [
  // ── 재무 ──────────────────────────────────────────────────────────────────
  {
    id: 'f1', domain: '재무', tCode: 'T1',
    title: 'ERP → 엑셀 → 회계 자동 연결',
    desc: '수동으로 옮기던 재무 데이터를 자동 연동',
    steps: [
      { title: 'ERP 데이터 소스 파악', desc: 'ERP에서 추출 가능한 데이터 항목과 API 엔드포인트를 확인합니다' },
      { title: '회계 시스템 연결 방식 확인', desc: '목적지 회계 시스템의 API 또는 파일 임포트 방식을 확인합니다' },
      { title: '필드 매핑 테이블 작성', desc: 'ERP 필드 → 회계 필드 변환 규칙을 1:1로 정의합니다' },
      { title: 'n8n 스케줄 워크플로우 구성', desc: 'AI 채팅에서 JSON을 생성하고 n8n에 임포트합니다' },
      { title: '테스트 데이터로 검증', desc: '샘플 데이터로 변환 정확도를 검증한 후 실 운영에 배포합니다' },
    ],
  },
  {
    id: 'f2', domain: '재무', tCode: 'T2',
    title: '3개 카드사 정산 통합 대시보드',
    desc: '분산된 카드사별 정산 데이터를 한 화면에',
    steps: [
      { title: '카드사별 API 연결 방식 파악', desc: '3개 카드사의 정산 데이터 수신 방식(API/FTP/이메일)을 확인합니다' },
      { title: '통합 스키마 설계', desc: '카드사별 상이한 필드를 통합할 공통 데이터 구조를 설계합니다' },
      { title: '각 카드사 n8n 커넥터 구성', desc: '카드사별 인증과 데이터 수신 워크플로우를 각각 구성합니다' },
      { title: '일일 정산 스케줄 설정', desc: '매일 자정 정산 데이터 수집 → 통합 DB 저장 스케줄을 구성합니다' },
      { title: '대시보드 연결 및 알림 설정', desc: 'Google Data Studio 또는 Notion 대시보드에 연결하고 이상 감지 알림을 추가합니다' },
    ],
  },
  {
    id: 'f3', domain: '재무', tCode: 'T3',
    title: '일일 매출 실시간 손익 집계',
    desc: '월말 집계를 실시간 매출 추적으로 전환',
    steps: [
      { title: '매출 발생 시점 데이터 소스 확인', desc: '결제 시스템/POS/쇼핑몰의 실시간 매출 웹훅 엔드포인트를 확인합니다' },
      { title: '실시간 수신 파이프라인 구성', desc: 'n8n Webhook 노드로 매출 발생 즉시 수신하는 파이프라인을 구성합니다' },
      { title: '손익 계산 로직 구현', desc: '매출 - 고정비 - 변동비 계산 로직을 n8n Code 노드에 구현합니다' },
      { title: 'Slack/카카오 실시간 리포트', desc: '목표 달성률과 손익을 Slack 또는 카카오 채널로 실시간 발송합니다' },
      { title: '임계값 초과 알림 설정', desc: '일 매출 목표 미달 시 즉시 담당자에게 경보를 발송합니다' },
    ],
  },
  {
    id: 'f4', domain: '재무', tCode: 'T6',
    title: '지출 결의 Slack 원클릭 승인',
    desc: '결재 대기 시간을 줄이는 Slack 승인 자동화',
    steps: [
      { title: '현재 결재 병목 단계 파악', desc: '지출 결의 프로세스에서 대기 시간이 가장 긴 단계를 분석합니다' },
      { title: '자동 승인 조건 정의', desc: '금액 기준(예: 50만원 이하 자동 승인) 규칙을 정의합니다' },
      { title: 'Slack 승인 봇 구성', desc: 'Slack 버튼(승인/거부)으로 원클릭 처리하는 인터페이스를 구성합니다' },
      { title: '승인 후 자동 처리 연결', desc: '승인 시 회계 시스템 자동 등록 → 담당자 이메일 발송 액션을 연결합니다' },
      { title: '감사 로그 자동 기록', desc: '모든 승인/거부 이력을 스프레드시트에 자동 기록합니다' },
    ],
  },
  // ── 세무 ──────────────────────────────────────────────────────────────────
  {
    id: 't1', domain: '세무', tCode: 'T5',
    title: '영수증 사진 → 경비 자동 처리',
    desc: '카카오/이메일로 영수증 전송 시 자동 경비 등록',
    steps: [
      { title: '영수증 수신 채널 파악', desc: '카카오 채널, 이메일, 앱 등 영수증이 수신되는 채널을 확인합니다' },
      { title: 'OCR/AI 파싱 설계', desc: 'Claude Vision API로 영수증 사진에서 금액/날짜/항목을 자동 추출합니다' },
      { title: '경비 분류 규칙 정의', desc: '항목별 경비 계정 자동 분류 규칙(식대/교통비/접대비 등)을 정의합니다' },
      { title: '회계 시스템 자동 등록', desc: '파싱된 경비 데이터를 회계 시스템에 자동 등록합니다' },
      { title: '예외 케이스 알림', desc: '인식 불가 영수증은 담당자에게 수동 처리 알림을 발송합니다' },
    ],
  },
  {
    id: 't2', domain: '세무', tCode: 'T4',
    title: 'SCM↔ERP 세금계산서 코드 매핑',
    desc: '시스템 간 코드 불일치로 인한 수동 작업 자동화',
    steps: [
      { title: '코드 불일치 항목 목록화', desc: 'SCM과 ERP 간 상이한 품목코드/거래처코드 항목을 전수 파악합니다' },
      { title: '매핑 테이블 작성', desc: 'SCM 코드 → ERP 코드 변환 규칙을 스프레드시트로 정리합니다' },
      { title: 'n8n 변환 노드 구현', desc: 'Set/Code 노드로 자동 변환 로직을 구현합니다' },
      { title: '정합성 검증 자동화', desc: '변환 후 ERP 등록 성공 여부를 자동 검증하고 실패 시 알림합니다' },
      { title: '매핑 테이블 주기적 업데이트', desc: '신규 품목 추가 시 매핑 테이블 자동 업데이트 워크플로우를 구성합니다' },
    ],
  },
  // ── 인사 ──────────────────────────────────────────────────────────────────
  {
    id: 'h1', domain: '인사', tCode: 'T1',
    title: '출퇴근 앱 → 급여 시스템 자동 연동',
    desc: '매월 수동으로 옮기던 근태 데이터 자동화',
    steps: [
      { title: '출퇴근 앱 API 확인', desc: '사용 중인 출퇴근 앱의 데이터 export API 또는 웹훅을 확인합니다' },
      { title: '급여 시스템 입력 방식 확인', desc: '급여 시스템의 근태 데이터 입력 API 또는 CSV 임포트 방식을 확인합니다' },
      { title: '근태 집계 로직 구현', desc: '정규시간/초과근무/지각/결근 자동 계산 로직을 구현합니다' },
      { title: '월말 자동 집계 스케줄', desc: '매월 25일 근태 데이터 자동 집계 → 급여 시스템 전송 스케줄을 구성합니다' },
      { title: '담당자 확인 알림', desc: '집계 완료 후 인사 담당자에게 검토 요청 알림을 발송합니다' },
    ],
  },
  {
    id: 'h2', domain: '인사', tCode: 'T5',
    title: '이메일 이력서 → ATS 자동 파싱',
    desc: '이메일로 받은 이력서를 채용 시스템에 자동 등록',
    steps: [
      { title: '이력서 수신 이메일 설정', desc: '채용 전용 이메일 계정의 웹훅을 n8n Gmail 노드에 연결합니다' },
      { title: 'AI 파싱 프롬프트 설계', desc: 'Claude로 이름/연락처/경력/학력을 추출하는 프롬프트를 설계합니다' },
      { title: 'ATS 시스템 연결', desc: '파싱 데이터를 ATS(Notion DB, Airtable 등)에 자동 등록합니다' },
      { title: '중복 지원자 감지', desc: '동일 이메일/이름 중복 지원 시 담당자에게 알림합니다' },
      { title: '지원자 자동 회신', desc: '이력서 수신 즉시 지원자에게 자동 확인 메일을 발송합니다' },
    ],
  },
  {
    id: 'h3', domain: '인사', tCode: 'T6',
    title: '휴가 신청 → 자동 승인 → 캘린더 반영',
    desc: '결재 대기 없는 자동화 휴가 프로세스',
    steps: [
      { title: '휴가 신청 폼 구성', desc: 'Google Forms 또는 Slack 모달로 휴가 신청 폼을 구성합니다' },
      { title: '자동 승인 조건 정의', desc: '사전 승인된 유형(연차/반차) 및 잔여 일수 조건을 정의합니다' },
      { title: '승인자 Slack 알림 구성', desc: '조건 미충족 시 승인자에게 Slack 버튼 승인 요청을 발송합니다' },
      { title: '캘린더 자동 등록', desc: '승인 완료 시 팀 Google Calendar에 자동 휴가 일정을 등록합니다' },
      { title: '인사 시스템 자동 차감', desc: '연차 잔여 일수를 HR 시스템에 자동 차감합니다' },
    ],
  },
  // ── IT ────────────────────────────────────────────────────────────────────
  {
    id: 'i1', domain: 'IT', tCode: 'T7',
    title: '개인 PC 설정 → 중앙 저장소 백업',
    desc: '퇴사 시 사라지는 개인 설정·데이터 자동 백업',
    steps: [
      { title: '백업 대상 데이터 목록화', desc: '개인 PC의 업무 관련 설정, 문서, 스크립트를 목록화합니다' },
      { title: '중앙 저장소 구조 설계', desc: 'Google Drive/S3/NAS에 팀원별 폴더 구조를 설계합니다' },
      { title: '자동 백업 스케줄 구성', desc: '매일 업무 종료 시 변경 파일을 중앙 저장소에 자동 동기화합니다' },
      { title: '접근 권한 설정', desc: '역할별 파일 접근 권한을 Google Drive 공유 설정으로 관리합니다' },
      { title: '백업 성공 여부 모니터링', desc: '백업 실패 시 IT 담당자에게 즉시 알림합니다' },
    ],
  },
  {
    id: 'i2', domain: 'IT', tCode: 'T4',
    title: '레거시↔신규 시스템 포맷 변환',
    desc: '구형·신형 시스템 간 데이터 형식 불일치 해소',
    steps: [
      { title: '포맷 불일치 항목 파악', desc: '레거시 시스템 출력 형식과 신규 시스템 입력 형식의 차이를 전수 파악합니다' },
      { title: '변환 규칙 정의', desc: '날짜/코드/인코딩 등 형식 변환 규칙을 문서화합니다' },
      { title: 'n8n 변환 파이프라인 구성', desc: 'Code 노드로 포맷 변환 로직을 구현합니다' },
      { title: '데이터 정합성 자동 검증', desc: '변환 전후 데이터 건수와 체크섬을 비교 검증합니다' },
      { title: '마이그레이션 완료 보고', desc: '이관 완료 건수와 오류 건수를 담당자에게 자동 리포트합니다' },
    ],
  },
  // ── 운영 ──────────────────────────────────────────────────────────────────
  {
    id: 'o1', domain: '운영', tCode: 'T5',
    title: '카카오 주문 → 주문 시스템 자동 입력',
    desc: '카카오 채널로 들어오는 주문을 자동으로 처리',
    steps: [
      { title: '카카오 채널 웹훅 설정', desc: '카카오 비즈니스 채널에서 메시지 수신 웹훅을 n8n에 연결합니다' },
      { title: '주문 정보 AI 파싱', desc: 'Claude로 주문 메시지에서 상품명/수량/배송지를 자동 추출합니다' },
      { title: '재고 확인 로직 추가', desc: '재고 시스템 API를 연동해 주문 가능 여부를 자동 확인합니다' },
      { title: '주문 시스템 자동 등록', desc: '파싱 결과를 ERP/주문 시스템에 자동 등록합니다' },
      { title: '고객 자동 확인 메시지 발송', desc: '주문 접수 확인 메시지를 카카오 채널로 자동 발송합니다' },
    ],
  },
  {
    id: 'o2', domain: '운영', tCode: 'T3',
    title: '캠페인 성과 실시간 Slack 보고',
    desc: '매일 아침 캠페인 KPI를 Slack으로 자동 전송',
    steps: [
      { title: '광고 플랫폼 API 연결', desc: 'Google Ads/Meta Ads API 인증 토큰을 n8n에 설정합니다' },
      { title: '핵심 KPI 정의', desc: '노출수/클릭수/전환수/ROAS 등 보고할 지표를 정의합니다' },
      { title: '일일 집계 스케줄 구성', desc: '매일 오전 8시 전날 성과 데이터를 자동 집계합니다' },
      { title: 'Slack 리포트 포맷 설계', desc: '이모지와 전날 대비 증감률을 포함한 가독성 높은 포맷을 설계합니다' },
      { title: '목표 미달 시 경보 설정', desc: 'ROAS 목표치 미달 시 마케팅 팀장에게 즉시 알림합니다' },
    ],
  },
  {
    id: 'o3', domain: '운영', tCode: 'T2',
    title: '팀별 KPI → 통합 CEO 대시보드',
    desc: '팀마다 따로 관리하던 KPI를 한 곳에 통합',
    steps: [
      { title: '팀별 KPI 데이터 소스 파악', desc: '영업/마케팅/운영 각 팀의 KPI 데이터 위치와 형식을 파악합니다' },
      { title: '통합 스키마 설계', desc: '팀별 KPI를 통합 비교할 수 있는 공통 데이터 구조를 설계합니다' },
      { title: '각 팀 데이터 커넥터 구성', desc: '팀별 시스템(Salesforce/HubSpot/스프레드시트)에 n8n 커넥터를 연결합니다' },
      { title: '주간 자동 집계 설정', desc: '매주 월요일 오전 9시 전주 KPI 자동 집계 스케줄을 구성합니다' },
      { title: 'CEO 대시보드 연결', desc: 'Google Data Studio 또는 Notion에 통합 KPI 대시보드를 연결합니다' },
    ],
  },
  // ── 법률 ──────────────────────────────────────────────────────────────────
  {
    id: 'l1', domain: '법률', tCode: 'T6',
    title: '계약서 검토 → 자동 서명 요청',
    desc: '계약서 검토 후 전자 서명 요청까지 자동화',
    steps: [
      { title: '계약서 수신 채널 설정', desc: '이메일/드라이브에서 계약서 파일 수신을 감지하는 트리거를 설정합니다' },
      { title: 'AI 계약서 1차 검토', desc: 'Claude로 계약서의 핵심 조항과 리스크 항목을 자동 요약합니다' },
      { title: '법무팀 검토 알림', desc: 'AI 요약본과 함께 법무팀에 Slack/이메일 검토 요청을 발송합니다' },
      { title: '전자 서명 자동 요청', desc: '검토 완료 승인 시 DocuSign/모두싸인으로 서명 요청을 자동 발송합니다' },
      { title: '계약 완료 통보 및 보관', desc: '서명 완료 후 관련 팀에 통보하고 계약서를 드라이브에 자동 보관합니다' },
    ],
  },
  {
    id: 'l2', domain: '법률', tCode: 'T7',
    title: '법적 문서 중앙화 & 접근 권한 관리',
    desc: '개인 PC에 흩어진 법적 문서를 중앙 관리',
    steps: [
      { title: '법적 문서 현황 파악', desc: '계약서/NDA/특허 등 법적 문서의 현재 보관 위치를 파악합니다' },
      { title: '중앙 저장소 구조 설계', desc: '문서 유형/계약 당사자/만료일 기준 분류 구조를 설계합니다' },
      { title: '이관 및 자동 분류', desc: '기존 문서를 중앙 저장소로 이관하고 AI로 자동 분류합니다' },
      { title: '만료일 알림 자동화', desc: '계약 만료 30일/7일 전 자동 갱신 알림을 담당자에게 발송합니다' },
      { title: '접근 권한 역할별 설정', desc: '문서 민감도에 따라 열람/편집 권한을 역할별로 설정합니다' },
    ],
  },
]

const DOMAINS = ['재무', '세무', '인사', 'IT', '운영', '법률']

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

  // 선택 상태
  const [selectedProcess, setSelectedProcess] = useState<AutoProcess | null>(null)
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set())
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set(['재무', '운영']))

  // 채팅 상태
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: '안녕하세요! 왼쪽에서 자동화할 업무를 선택하거나, 자동화하고 싶은 업무를 직접 설명해주세요.\n\nn8n 워크플로우 JSON을 생성해드립니다.' },
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

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')

    const userMsg: ChatMessage = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setStreaming(true)

    try {
      const systemPrompt = selectedProcess
        ? `당신은 n8n 자동화 전문가입니다. 솔로프리너의 업무 자동화를 도와주세요.
선택된 자동화 프로세스: ${selectedProcess.title} (${selectedProcess.domain} / ${selectedProcess.tCode})
설명: ${selectedProcess.desc}
요청을 분석하고 n8n 워크플로우 JSON을 포함해주세요. 응답은 한국어로 작성하세요.`
        : `당신은 n8n 자동화 전문가입니다. 솔로프리너의 업무 자동화를 도와주세요.
요청을 분석하고 적합한 자동화 유형(T1~T7)을 분류한 후 n8n 워크플로우 JSON을 포함해주세요. 응답은 한국어로 작성하세요.`

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
  }, [input, messages, streaming, selectedProcess, currentMissionId])

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

  const toggleDomain = (domain: string) => {
    setExpandedDomains(prev => {
      const next = new Set(prev)
      if (next.has(domain)) next.delete(domain); else next.add(domain)
      return next
    })
  }

  const selectProcess = (process: AutoProcess) => {
    setSelectedProcess(process)
    setCheckedSteps(new Set())
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-[#0d0d0f] text-white overflow-hidden">

      {/* ── 헤더 ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-[#1c1c20] px-5 py-3 flex items-center gap-3">
        <Workflow size={16} className="text-yellow-400" />
        <span className="text-sm font-semibold text-[#e4e4e7]">Ops Bot</span>
        <span className="text-[11px] text-[#52525b] bg-[#111113] border border-[#27272a] px-2 py-0.5 rounded-full">
          자동화 지원 센터
        </span>
        {selectedProcess && (
          <button
            onClick={() => { setSelectedProcess(null); setCheckedSteps(new Set()) }}
            className="ml-auto text-[11px] text-[#52525b] hover:text-[#a1a1aa] transition-colors"
          >
            ← 목록으로
          </button>
        )}
      </div>

      {/* ── 3-panel 본문 ──────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Left: 도메인별 프로세스 목록 ─────────────────────────────── */}
        <div className="w-[240px] shrink-0 border-r border-[#1c1c20] flex flex-col overflow-y-auto">
          <div className="px-3 py-2.5 border-b border-[#1c1c20] shrink-0">
            <p className="text-[10px] font-semibold text-[#52525b] uppercase tracking-widest">자동화 프로세스</p>
          </div>

          <div className="flex-1 overflow-y-auto py-1">
            {DOMAINS.map(domain => {
              const domainProcesses = PROCESSES.filter(p => p.domain === domain)
              const isExpanded = expandedDomains.has(domain)
              return (
                <div key={domain}>
                  {/* 도메인 헤더 */}
                  <button
                    onClick={() => toggleDomain(domain)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#111113] transition-colors group"
                  >
                    <span className="text-[11px] font-semibold text-[#a1a1aa] group-hover:text-[#e4e4e7] flex-1 text-left">
                      {domain}
                    </span>
                    <span className="text-[9px] text-[#52525b] mr-1">{domainProcesses.length}</span>
                    {isExpanded
                      ? <ChevronUp size={11} className="text-[#52525b] shrink-0" />
                      : <ChevronDown size={11} className="text-[#52525b] shrink-0" />}
                  </button>

                  {/* 프로세스 목록 */}
                  {isExpanded && (
                    <div className="pb-1">
                      {domainProcesses.map(process => {
                        const isSelected = selectedProcess?.id === process.id
                        const tColor = T_COLOR[process.tCode] ?? '#888'
                        return (
                          <button
                            key={process.id}
                            onClick={() => selectProcess(process)}
                            className={cn(
                              'w-full text-left px-3 py-2 border-l-2 transition-all group',
                              isSelected
                                ? 'border-l-yellow-500 bg-yellow-500/8'
                                : 'border-l-transparent hover:border-l-[#27272a] hover:bg-[#111113]'
                            )}
                          >
                            <div className="flex items-start gap-2">
                              <span
                                className="text-[9px] font-bold px-1 py-0.5 rounded shrink-0 mt-0.5"
                                style={{ color: tColor, background: `${tColor}20` }}
                              >
                                {process.tCode}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className={cn(
                                  'text-[11px] leading-snug',
                                  isSelected ? 'text-yellow-300 font-medium' : 'text-[#a1a1aa] group-hover:text-[#e4e4e7]'
                                )}>
                                  {process.title}
                                </p>
                                <p className="text-[9px] text-[#52525b] mt-0.5 leading-snug">{process.desc}</p>
                              </div>
                              {isSelected && <ChevronRight size={11} className="text-yellow-400 shrink-0 mt-1" />}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Center: 단계별 액션 카드 ─────────────────────────────────── */}
        <div className="flex-1 flex flex-col border-r border-[#1c1c20] min-w-0">
          {!selectedProcess ? (
            /* 빈 상태 */
            <div className="flex flex-col items-center justify-center h-full gap-4 text-[#3f3f46] p-8">
              <Workflow size={40} />
              <div className="text-center">
                <p className="text-sm text-[#71717a] mb-1">왼쪽에서 자동화 프로세스를 선택하세요</p>
                <p className="text-[11px] text-[#3f3f46]">도메인별로 대표적인 자동화 프로세스가 정리되어 있습니다</p>
              </div>
              {/* 빠른 시작 예시 */}
              <div className="mt-4 grid grid-cols-2 gap-2 w-full max-w-lg">
                {QUICK_PROMPTS.map(qp => (
                  <button
                    key={qp}
                    onClick={() => { setInput(qp); inputRef.current?.focus() }}
                    className="text-left text-[10px] text-[#52525b] bg-[#111113] border border-[#1c1c20] rounded-xl px-3 py-2.5 hover:border-indigo-500/40 hover:text-[#a1a1aa] transition-colors leading-relaxed"
                  >
                    {qp}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* 선택된 프로세스 단계 카드 */
            <div className="flex flex-col h-full">
              {/* 프로세스 헤더 */}
              <div className="px-5 py-3 border-b border-[#1c1c20] shrink-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={{ color: T_COLOR[selectedProcess.tCode], background: `${T_COLOR[selectedProcess.tCode]}20` }}
                  >
                    {selectedProcess.tCode}
                  </span>
                  <span className="text-[10px] text-[#52525b] bg-[#111113] border border-[#27272a] px-1.5 py-0.5 rounded">
                    {selectedProcess.domain}
                  </span>
                  <span className="ml-auto text-[10px] text-[#52525b]">
                    {checkedSteps.size}/{selectedProcess.steps.length} 완료
                  </span>
                </div>
                <p className="text-[14px] font-semibold text-[#e4e4e7]">{selectedProcess.title}</p>
                <p className="text-[11px] text-[#71717a] mt-0.5">{selectedProcess.desc}</p>
              </div>

              {/* 단계 카드 */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {selectedProcess.steps.map((step, idx) => {
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

                {checkedSteps.size === selectedProcess.steps.length && selectedProcess.steps.length > 0 && (
                  <div className="text-center py-4 text-green-400 text-sm font-medium border border-green-500/20 rounded-xl bg-green-500/5">
                    ✓ 모든 단계 완료! 오른쪽 AI 채팅에서 n8n JSON을 생성해보세요.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Right: AI 채팅 + n8n ─────────────────────────────────────── */}
        <div className="w-[300px] shrink-0 flex flex-col">
          <div className="px-4 py-2.5 border-b border-[#1c1c20] flex items-center gap-1.5 text-[10px] font-semibold text-[#52525b] uppercase tracking-widest shrink-0">
            <MessageSquare size={10} className="text-purple-400" />
            AI 자동화 설계
            {workflow && (
              <span className="ml-auto text-[10px] text-green-500 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded-full normal-case tracking-normal">
                JSON 생성됨
              </span>
            )}
          </div>

          {/* 빠른 시작 — 채팅 위에 */}
          {messages.length <= 2 && (
            <div className="px-3 pt-2 pb-1 shrink-0">
              <div className="text-[9px] text-[#52525b] mb-1 uppercase tracking-widest">빠른 시작</div>
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
                placeholder={selectedProcess
                  ? `"${selectedProcess.title}" 관련 질문이나 n8n JSON 생성을 요청하세요...`
                  : '자동화하고 싶은 업무를 설명하세요...'
                }
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
