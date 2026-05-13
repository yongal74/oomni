/**
 * OpsCenter.tsx — 자동화 지원 센터 v5.12.0
 * Top: 도메인 드롭다운 + 빠른실행 → Right 채팅에 프롬프트 주입
 * Left: AI 생성 프로세스 카드 (기본 빈 상태)
 * Center: 선택된 카드 상세 (실행순서·FIELD·주의사항·가이드)
 * Right: AI 채팅 + n8n JSON 생성 + n8n 직접 전송
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Workflow, Zap, Check,
  MessageSquare, Send, RefreshCw,
  ChevronDown, Copy, CheckCheck, Download,
  AlertTriangle, Info, Layers, Upload, ExternalLink,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useAppStore } from '../store/app.store'

// ─── 자동화 프로세스 데이터 ────────────────────────────────────────────────────

interface AutoProcess {
  id: string; title: string; desc: string; tCode: string; domain: string
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

const QUICK_PROMPTS = [
  '카카오 주문을 구글 시트에 자동 기록하고 싶어요',
  '매일 아침 매출 현황을 Slack으로 받고 싶어요',
  '이메일 이력서를 노션 DB에 자동 정리하고 싶어요',
  '지출 결의 Slack 승인 자동화를 만들어주세요',
]

// ─── n8n JSON 파서 ────────────────────────────────────────────────────────────

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

// ─── AI 생성 프로세스 카드 타입 ────────────────────────────────────────────────

interface AiProcessCard {
  id: string
  title: string
  role: string
  steps: string[]
  fields: Array<{ name: string; value: string; note?: string }>
  warnings: string[]
  guide: string
}

function parseAiProcessCards(text: string): AiProcessCard[] {
  try {
    const m = text.match(/```process-cards\s*([\s\S]*?)```/)
    if (!m) return []
    const arr = JSON.parse(m[1])
    if (!Array.isArray(arr)) return []
    return arr.map((p, i) => ({
      id: `card-${Date.now()}-${i}`,
      title: p.title ?? '프로세스',
      role: p.role ?? '',
      steps: Array.isArray(p.steps) ? p.steps : [],
      fields: Array.isArray(p.fields) ? p.fields : [],
      warnings: Array.isArray(p.warnings) ? p.warnings : [],
      guide: p.guide ?? '',
    }))
  } catch {
    return []
  }
}

// ─── 헬퍼 컴포넌트 ────────────────────────────────────────────────────────────

interface ChatMessage { role: 'user' | 'assistant'; content: string }

function CopyFieldBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="flex items-center gap-1 text-[9px] text-muted hover:text-sky-400 transition-colors px-1.5 py-0.5 rounded border border-transparent hover:border-sky-500/20"
    >
      {copied ? <><Check size={9} className="text-emerald-400" />복사됨</> : <><Copy size={9} />복사</>}
    </button>
  )
}

function parseGuideCards(guide: string): { title: string; body: string }[] {
  const sections: { title: string; body: string }[] = []
  let currentTitle = ''
  let currentLines: string[] = []
  for (const line of guide.split('\n')) {
    if (line.startsWith('## ')) {
      if (currentTitle || currentLines.some(l => l.trim())) {
        sections.push({ title: currentTitle, body: currentLines.join('\n').trim() })
      }
      currentTitle = line.slice(3).trim()
      currentLines = []
    } else {
      currentLines.push(line)
    }
  }
  if (currentTitle || currentLines.some(l => l.trim())) {
    sections.push({ title: currentTitle, body: currentLines.join('\n').trim() })
  }
  return sections.length > 0 ? sections : [{ title: '', body: guide }]
}

function GuideMd({ text }: { text: string }) {
  return (
    <div className="space-y-1.5 text-xs text-text leading-relaxed">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### ')) return <div key={i} className="font-semibold text-text mt-2">{line.slice(4)}</div>
        if (line.startsWith('## '))  return <div key={i} className="font-bold text-white mt-3">{line.slice(3)}</div>
        if (line.startsWith('# '))   return <div key={i} className="font-bold text-white text-sm mt-3">{line.slice(2)}</div>
        if (line.startsWith('- ') || line.startsWith('* '))
          return <div key={i} className="flex gap-1.5"><span className="text-primary shrink-0">·</span><span>{line.slice(2)}</span></div>
        if (/^\d+\./.test(line)) {
          const num = line.match(/^(\d+)\./)?.[1]
          return <div key={i} className="flex gap-1.5"><span className="text-primary shrink-0 w-4">{num}.</span><span>{line.replace(/^\d+\.\s*/, '')}</span></div>
        }
        if (line.startsWith('```')) return null
        if (!line.trim()) return <div key={i} className="h-1" />
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
        'flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-[13px] font-bold',
        isUser ? 'bg-primary/30 text-primary' : 'bg-orange-600/20 text-orange-300',
      )}>
        {isUser ? 'U' : 'AI'}
      </div>
      <div className={cn(
        'max-w-[82%] rounded-xl px-3 py-2 text-xs leading-relaxed',
        isUser
          ? 'bg-primary/15 border border-primary/30 text-text'
          : 'bg-surface border border-border-muted text-text',
      )}>
        <GuideMd text={message.content} />
      </div>
    </div>
  )
}

// API 전송 전 process-cards/json 블록 제거 (토큰 절약 + 연속 요청 오류 방지)
function stripCodeBlocks(content: string): string {
  return content.replace(/```(process-cards|json)[\s\S]*?```/g, '[이전 자동화 결과 생략]').trim()
}

// ─── OpsCenter ────────────────────────────────────────────────────────────────

export default function OpsCenter() {
  const { currentMission } = useAppStore()
  const currentMissionId = currentMission?.id

  // 상단 바 도메인 드롭다운
  const [openDomain, setOpenDomain] = useState<string | null>(null)

  // 좌측 AI 프로세스 카드
  const [processCards, setProcessCards] = useState<AiProcessCard[]>([])
  const [selectedCard, setSelectedCard] = useState<AiProcessCard | null>(null)
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set())

  // 우측 AI 채팅
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: '자동화하고 싶은 업무를 설명해주세요.\n\n위 도메인 버튼이나 빠른 실행을 클릭하면 프롬프트가 자동으로 입력됩니다.\n\nn8n 워크플로우 JSON과 함께 왼쪽에 프로세스 카드를 생성해드립니다.',
    },
  ])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [workflow, setWorkflow] = useState<{ name: string; json: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [n8nPushStatus, setN8nPushStatus] = useState<'idle' | 'pushing' | 'success' | 'error'>('idle')
  const [n8nPushMsg, setN8nPushMsg] = useState('')
  const [n8nTab, setN8nTab] = useState<'roles' | 'methods' | 'cases' | 'mistakes'>('roles')
  const [n8nCase, setN8nCase] = useState<number | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const topBarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  useEffect(() => {
    if (!openDomain) return
    const handler = (e: MouseEvent) => {
      if (topBarRef.current && !topBarRef.current.contains(e.target as Node)) {
        setOpenDomain(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openDomain])

  const injectPrompt = (text: string) => {
    setInput(text)
    setOpenDomain(null)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const abortRef = useRef<AbortController | null>(null)

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')

    // 이전 스트림이 진행 중이면 강제 중단
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null }
    const controller = new AbortController()
    abortRef.current = controller

    const userMsg: ChatMessage = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setStreaming(true)

    try {
      const systemPrompt = `당신은 n8n 자동화 전문가입니다. 솔로프리너의 업무 자동화를 도와주세요.
응답은 한국어로 작성하세요.

응답 형식 (이 순서를 반드시 지키세요):

1. 먼저 아래 process-cards 블록을 출력하세요 (필수, 생략 금지):
\`\`\`process-cards
[
  {
    "title": "프로세스 이름",
    "role": "이 프로세스가 자동화하는 역할 설명 (1-2문장)",
    "steps": ["단계 1", "단계 2", "단계 3"],
    "fields": [
      {"name": "필드명", "value": "실제 복사 가능한 설정값 (예: https://hooks.n8n.io/webhook/xxx)", "note": "어디서 얻는지 설명"}
    ],
    "warnings": ["주의사항 (구체적으로)"],
    "guide": "각 노드 설정 상세 가이드. 실제 클릭 순서, 입력값, API 엔드포인트, 환경변수명을 모두 포함해서 복사해서 바로 쓸 수 있게 작성"
  }
]
\`\`\`

2. 그 다음 n8n 워크플로우 JSON을 출력하세요:
\`\`\`json
{"name": "워크플로우명", "nodes": [...], "connections": [...]}
\`\`\`

3. 마지막으로 구현 단계별 한국어 가이드를 작성하세요.`

      const BASE_URL = 'http://localhost:3001'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const internalKey = await (window as any).electronAPI?.getInternalApiKey?.() ?? ''
      if (!internalKey) throw new Error('내부 API 키를 가져올 수 없습니다')

      // 최근 10개 메시지만 전송 + 어시스턴트 메시지에서 코드 블록 제거
      const historyToSend = newMessages.slice(-10).map(m => ({
        role: m.role,
        content: m.role === 'assistant' ? stripCodeBlocks(m.content) : m.content,
      }))

      const resp = await fetch(`${BASE_URL}/api/ops/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${internalKey}` },
        signal: controller.signal,
        body: JSON.stringify({
          messages: historyToSend,
          system: systemPrompt,
          mission_id: currentMissionId,
        }),
      })

      if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`)

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''
      let cardsSet = false

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
            } else if (eventName === 'done') {
              if (parsed.text) fullText = parsed.text
              setMessages(prev => { const c = [...prev]; c[c.length - 1] = { role: 'assistant', content: fullText }; return c })
              const wf = parseWorkflowFromText(fullText)
              if (wf) setWorkflow(wf)
              const cards = parseAiProcessCards(fullText)
              if (cards.length > 0) { cardsSet = true; setProcessCards(cards); setSelectedCard(null); setCheckedSteps(new Set()) }
            } else if (eventName === 'error') {
              throw new Error((parsed as { message?: string }).message ?? 'streaming error')
            }
          } catch { /* noop */ }
        }
      }
      // done 이벤트 누락 대비: 누적 fullText에서 카드 재파싱
      if (!cardsSet && fullText) {
        const wf = parseWorkflowFromText(fullText)
        if (wf) setWorkflow(wf)
        const cards = parseAiProcessCards(fullText)
        if (cards.length > 0) { setProcessCards(cards); setSelectedCard(null); setCheckedSteps(new Set()) }
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return // 의도적 중단 — 에러 표시 불필요
      const errMsg = '⚠️ 연결 오류. 잠시 후 다시 시도해주세요.'
      setMessages(prev => {
        const c = [...prev]
        if (c[c.length - 1]?.content === '') c[c.length - 1] = { role: 'assistant', content: errMsg }
        else c.push({ role: 'assistant', content: errMsg })
        return c
      })
    } finally {
      abortRef.current = null
      setStreaming(false)
    }
  }, [input, messages, streaming, currentMissionId])

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

  const pushToN8n = useCallback(async () => {
    if (!workflow?.json || n8nPushStatus === 'pushing') return
    setN8nPushStatus('pushing')
    setN8nPushMsg('')
    try {
      // n8n REST API — POST /rest/workflows (로컬 기본 포트 5678)
      const resp = await fetch('http://localhost:5678/rest/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: workflow.json,
      })
      if (resp.ok) {
        const data = await resp.json() as { id?: string; name?: string }
        setN8nPushStatus('success')
        setN8nPushMsg(`전송 완료${data.id ? ` (ID: ${data.id})` : ''}`)
        setTimeout(() => setN8nPushStatus('idle'), 4000)
      } else {
        const err = await resp.json().catch(() => ({})) as { message?: string }
        setN8nPushStatus('error')
        setN8nPushMsg(err.message ?? `HTTP ${resp.status}`)
        setTimeout(() => setN8nPushStatus('idle'), 5000)
      }
    } catch {
      setN8nPushStatus('error')
      setN8nPushMsg('n8n 연결 실패 — localhost:5678에서 n8n을 먼저 실행하세요')
      setTimeout(() => setN8nPushStatus('idle'), 6000)
    }
  }, [workflow, n8nPushStatus])

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-bg text-white overflow-hidden">

      {/* ── 헤더 ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-border-muted px-5 py-3 flex items-center gap-3 flex-wrap">
        <Workflow size={18} className="text-yellow-400" />
        <span className="text-sm font-semibold text-text">Ops Bot</span>
        <span className="text-[14px] text-muted bg-surface border border-border px-2 py-0.5 rounded-full">
          자동화 지원 센터
        </span>
        {/* n8n 빠른 접속 링크 */}
        <div className="flex items-center gap-1.5 ml-auto">
          <a
            href="http://localhost:5678"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[13px] text-muted border border-border hover:text-orange-400 hover:border-orange-500/30 transition-colors"
            title="n8n 로컬 접속"
          >
            <ExternalLink size={9} /> n8n 로컬
          </a>
          <a
            href="https://app.n8n.cloud"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[13px] text-muted border border-border hover:text-orange-400 hover:border-orange-500/30 transition-colors"
            title="n8n 클라우드"
          >
            <ExternalLink size={9} /> n8n 클라우드
          </a>
        </div>
        {processCards.length > 0 && (
          <button
            onClick={() => { setProcessCards([]); setSelectedCard(null); setWorkflow(null) }}
            className="text-[14px] text-muted hover:text-dim transition-colors"
          >
            초기화
          </button>
        )}
      </div>

      {/* ── 상단 바: 도메인 드롭다운 + 빠른 실행 ─────────────────────────── */}
      <div ref={topBarRef} className="shrink-0 border-b border-border-muted bg-bg px-4 py-2.5 flex items-center gap-3 flex-wrap">
        {/* 도메인 드롭다운 */}
        <span className="text-[13px] text-[#3f3f46] uppercase tracking-widest shrink-0">도메인</span>
        {DOMAINS.map(domain => {
          const domainProcesses = PROCESSES.filter(p => p.domain === domain)
          const isOpen = openDomain === domain
          return (
            <div key={domain} className="relative">
              <button
                onClick={() => setOpenDomain(isOpen ? null : domain)}
                className={cn(
                  'flex items-center gap-1 text-[13px] px-2.5 py-1 rounded-lg border transition-all',
                  isOpen
                    ? 'bg-primary/15 border-primary/40 text-primary'
                    : 'bg-white/3 border-white/10 text-muted hover:text-dim hover:border-white/20',
                )}
              >
                {domain}
                <ChevronDown size={12} className={cn('transition-transform duration-200', isOpen && 'rotate-180')} />
              </button>
              {isOpen && (
                <div className="absolute top-full left-0 mt-1 z-50 w-[220px] bg-bg border border-border rounded-xl shadow-xl overflow-hidden">
                  {domainProcesses.map(p => {
                    const tColor = T_COLOR[p.tCode] ?? '#888'
                    return (
                      <button
                        key={p.id}
                        onClick={() => injectPrompt(`"${p.title}" 자동화를 구현해주세요.\n${p.desc}`)}
                        className="w-full text-left px-3 py-2.5 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 group"
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                            style={{ color: tColor, background: `${tColor}20` }}>
                            {p.tCode}
                          </span>
                          <span className="text-[14px] font-medium text-dim group-hover:text-white transition-colors">{p.title}</span>
                        </div>
                        <p className="text-[13px] text-muted leading-snug pl-6">{p.desc}</p>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {/* 구분선 */}
        <div className="w-px h-3.5 bg-[#27272a] shrink-0" />

        {/* 빠른 실행 */}
        <span className="text-[13px] text-[#3f3f46] uppercase tracking-widest shrink-0">빠른 실행</span>
        {QUICK_PROMPTS.map(qp => (
          <button
            key={qp}
            onClick={() => injectPrompt(qp)}
            className="text-[13px] text-muted bg-surface border border-border-muted rounded-lg px-2.5 py-1 hover:border-amber-500/30 hover:text-dim transition-colors whitespace-nowrap"
          >
            {qp.length > 18 ? qp.slice(0, 18) + '…' : qp}
          </button>
        ))}
      </div>

      {/* ── 3-panel 본문 ──────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Left: AI 프로세스 카드 (기본 빈 상태) ────────────────────── */}
        <aside className="w-[220px] lg:w-[260px] xl:w-[290px] 2xl:w-[320px] flex-shrink-0 border-r border-border-muted bg-bg flex flex-col overflow-hidden">
          <div className="px-3 pt-3 pb-2 border-b border-white/5 shrink-0 flex items-center justify-between">
            <p className="text-[13px] font-bold text-[#3f3f46] uppercase tracking-widest">자동화 프로세스</p>
            {processCards.length > 0 && (
              <span className="text-[9px] text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full">
                {processCards.length}개
              </span>
            )}
          </div>

          {processCards.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-white/3 border border-white/8 flex items-center justify-center">
                <Layers size={22} className="text-[#3f3f46]" />
              </div>
              <div>
                <p className="text-[15px] text-muted mb-1.5">아직 프로세스가 없어요</p>
                <p className="text-[14px] text-[#3f3f46] leading-relaxed">
                  오른쪽 채팅에서 자동화를<br />요청하면 여기에 카드가 생성됩니다
                </p>
              </div>
            </div>
          ) : (
            /* ── 플로우차트: 박스 + 화살표 ── */
            <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col items-center">
              {processCards.map((card, idx) => {
                const isSelected = selectedCard?.id === card.id
                return (
                  <div key={card.id} className="w-full flex flex-col items-center">
                    {/* 프로세스 박스 */}
                    <button
                      onClick={() => { setSelectedCard(isSelected ? null : card); setCheckedSteps(new Set()) }}
                      className={cn(
                        'w-full text-left rounded-xl border-2 px-3 py-3 transition-all relative',
                        isSelected
                          ? 'bg-primary/10 border-primary/50 shadow-lg shadow-primary/15'
                          : 'bg-surface border-border hover:bg-white/4 hover:border-white/20',
                      )}
                    >
                      {/* 단계 번호 뱃지 */}
                      <span className={cn(
                        'absolute -top-2.5 left-3 text-[9px] font-black px-2 py-0.5 rounded-full border',
                        isSelected ? 'bg-primary text-white border-primary/70' : 'bg-surface-3 text-muted border-border',
                      )}>
                        STEP {idx + 1}
                      </span>
                      <p className={cn('font-bold text-[15px] leading-tight mt-1 mb-1.5', isSelected ? 'text-white' : 'text-[#d4d4d8]')}>
                        {card.title}
                      </p>
                      <p className={cn('text-[13px] leading-relaxed', isSelected ? 'text-orange-200/80' : 'text-muted')}>
                        {card.role}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={cn('text-[9px] px-1.5 py-0.5 rounded border', isSelected ? 'text-primary border-primary/30 bg-primary/10' : 'text-muted border-border bg-white/3')}>
                          {card.steps.length}단계
                        </span>
                        {card.fields?.length > 0 && (
                          <span className={cn('text-[9px] px-1.5 py-0.5 rounded border', isSelected ? 'text-sky-400 border-sky-500/30 bg-sky-500/10' : 'text-muted border-border bg-white/3')}>
                            {card.fields.length} FIELDS
                          </span>
                        )}
                        {card.warnings?.length > 0 && (
                          <span className="text-[9px] text-amber-400/70">⚠ {card.warnings.length}</span>
                        )}
                      </div>
                    </button>
                    {/* 화살표 (마지막 카드 제외) */}
                    {idx < processCards.length - 1 && (
                      <div className="flex flex-col items-center my-1">
                        <div className="w-px h-3 bg-[#27272a]" />
                        <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
                          <path d="M5 6L0 0h10L5 6z" fill="#3f3f46" />
                        </svg>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </aside>

        {/* ── Center: 선택된 프로세스 상세 ─────────────────────────────── */}
        <div className="flex-1 flex flex-col border-r border-border-muted min-w-0 overflow-hidden">
          {!selectedCard ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* n8n 가이드 헤더 + 탭 */}
              <div className="px-4 pt-4 pb-0 shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <Workflow size={16} className="text-primary" />
                  <span className="text-[15px] font-bold text-white">n8n 연동 가이드</span>
                  <span className="text-[14px] text-primary/60 bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">초보자용</span>
                </div>
                <div className="flex gap-1 border-b border-border-muted pb-0">
                  {(['roles','methods','cases','mistakes'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => { setN8nTab(tab); setN8nCase(null) }}
                      className={cn(
                        'px-3 py-2 text-[13px] font-medium rounded-t-lg transition-colors border-b-2 -mb-px',
                        n8nTab === tab
                          ? 'text-primary border-primary bg-primary/5'
                          : 'text-muted border-transparent hover:text-dim'
                      )}
                    >
                      {tab === 'roles' ? '노드 역할' : tab === 'methods' ? '연결 방식' : tab === 'cases' ? '케이스 가이드' : 'TOP 7 실수'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 탭 콘텐츠 */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">

                {/* ── 탭 1: 노드 역할 ── */}
                {n8nTab === 'roles' && (
                  <div className="space-y-3">
                    <p className="text-[13px] text-muted">n8n의 모든 노드는 3가지 역할 중 하나를 담당합니다</p>
                    {[
                      {
                        color: 'blue', label: 'Trigger', sub: '시작 노드',
                        desc: '워크플로우를 자동으로 시작합니다. 외부 이벤트가 발생하거나 예약 시간이 되면 실행됩니다.',
                        examples: ['Webhook', 'Schedule / Cron', 'Gmail Trigger', 'Form Trigger', 'Chat Trigger'],
                        tip: '워크플로우당 Trigger는 1개. 시작점입니다.',
                      },
                      {
                        color: 'amber', label: 'Transform', sub: '변환 노드',
                        desc: '데이터를 조건에 따라 분기하거나 가공·변환합니다. 로직의 핵심입니다.',
                        examples: ['IF (조건 분기)', 'Set (값 설정)', 'Code (JS 커스텀)', 'Merge (합치기)', 'Filter'],
                        tip: 'IF → True/False 두 갈래로 나뉩니다. 각각에 다음 노드를 연결하세요.',
                      },
                      {
                        color: 'emerald', label: 'Action', sub: '실행 노드',
                        desc: '외부 서비스에 실제로 작업을 실행합니다. 최종 결과물을 만드는 단계입니다.',
                        examples: ['Gmail (이메일 발송)', 'Slack (메시지)', 'Google Sheets (기록)', 'HTTP Request', 'Notion'],
                        tip: '대부분 Action 노드는 Credentials(인증) 설정이 필요합니다.',
                      },
                    ].map(r => (
                      <div key={r.label} className={cn(
                        'rounded-xl border p-4',
                        r.color === 'blue' ? 'border-blue-700/30 bg-blue-900/10' :
                        r.color === 'amber' ? 'border-amber-700/30 bg-amber-900/10' :
                        'border-emerald-700/30 bg-emerald-900/10'
                      )}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={cn('text-[14px] font-black', r.color === 'blue' ? 'text-blue-400' : r.color === 'amber' ? 'text-amber-400' : 'text-emerald-400')}>{r.label}</span>
                          <span className="text-[14px] text-muted">{r.sub}</span>
                        </div>
                        <p className="text-[13px] text-dim mb-2">{r.desc}</p>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {r.examples.map(e => (
                            <span key={e} className="text-[14px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-muted">{e}</span>
                          ))}
                        </div>
                        <div className="flex items-start gap-1.5 px-2 py-1.5 bg-white/3 rounded-lg">
                          <Info size={11} className="text-primary/60 shrink-0 mt-0.5" />
                          <span className="text-[14px] text-primary/70">{r.tip}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── 탭 2: 연결 방식 ── */}
                {n8nTab === 'methods' && (
                  <div className="space-y-3">
                    <p className="text-[13px] text-muted">n8n이 외부 서비스와 연결하는 5가지 방식</p>
                    {[
                      {
                        no: '01', label: 'Webhook 수신',
                        desc: '외부 서비스가 n8n URL로 데이터를 밀어넣는 방식 (Push)',
                        when: 'Typeform, Stripe, GitHub, 카카오 알림 등 웹훅 지원 서비스',
                        steps: ['n8n Webhook 노드 추가 → URL 복사', '외부 서비스 웹훅 설정에 URL 붙여넣기', 'Test URL로 수신 확인 → Production URL 전환'],
                        warn: '로컬 n8n은 외부 수신 불가 → ngrok 터널 또는 n8n Cloud 필요',
                      },
                      {
                        no: '02', label: 'HTTP Request (API 호출)',
                        desc: 'n8n이 외부 API를 직접 호출하는 방식 (Pull)',
                        when: 'REST API가 있는 모든 서비스 (인증 방식에 따라 헤더 설정 필요)',
                        steps: ['HTTP Request 노드 추가', 'Method / URL / Headers 설정', 'Body: JSON 또는 Form-data 선택', '응답 데이터를 다음 노드로 연결'],
                        warn: 'API Key는 Header: Authorization: Bearer {key} 또는 x-api-key로 설정',
                      },
                      {
                        no: '03', label: 'Schedule / Polling',
                        desc: '일정 주기로 실행하거나 외부 서비스를 주기적으로 확인하는 방식',
                        when: '매일/매시간 배치 작업, RSS 피드, 이메일 수신 확인 등',
                        steps: ['Schedule Trigger 추가 → Cron 표현식 설정 (예: 0 9 * * 1-5)', '이후 HTTP Request로 데이터 가져오기', 'IF 노드로 변경된 항목만 처리'],
                        warn: '너무 짧은 간격(30초 미만) → n8n 부하 증가, 최소 1분 권장',
                      },
                      {
                        no: '04', label: '내장 Credential (API Key / OAuth)',
                        desc: 'n8n에 인증 정보를 저장하고 노드가 자동으로 사용하는 방식',
                        when: 'Gmail, Slack, Google Sheets, HubSpot 등 공식 통합 노드',
                        steps: ['노드 추가 → Credential 드롭다운 → "Create New" 클릭', 'API Key 또는 OAuth 로그인 완료', '이후 해당 credential을 같은 서비스 노드에서 재사용'],
                        warn: 'OAuth 토큰은 만료됨 → n8n이 자동 갱신. API Key는 만료 없음',
                      },
                      {
                        no: '05', label: 'Community Node (NPM 설치)',
                        desc: '공식 노드가 없는 서비스를 NPM 커뮤니티 노드로 연결',
                        when: '카카오, 네이버, 국내 서비스, 전문 SaaS 등 공식 노드 미지원',
                        steps: ['Settings → Community Nodes → Install', 'NPM 패키지명 입력 (예: n8n-nodes-kakao)', '설치 후 노드 검색에서 찾아 사용'],
                        warn: '커뮤니티 노드는 비공식 → 업데이트·보안 직접 확인 필요',
                      },
                    ].map(m => (
                      <div key={m.no} className="rounded-xl border border-border-muted bg-bg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[14px] font-mono text-primary/50">{m.no}</span>
                          <span className="text-[14px] font-bold text-white">{m.label}</span>
                        </div>
                        <p className="text-[13px] text-dim mb-2">{m.desc}</p>
                        <p className="text-[14px] text-muted mb-3">→ {m.when}</p>
                        <div className="space-y-1 mb-3">
                          {m.steps.map((s, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <span className="text-[13px] font-bold text-primary/60 shrink-0 mt-0.5">{i+1}.</span>
                              <span className="text-[13px] text-muted">{s}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-start gap-1.5 px-2 py-1.5 bg-amber-500/5 border border-amber-500/15 rounded-lg">
                          <AlertTriangle size={11} className="text-amber-400/70 shrink-0 mt-0.5" />
                          <span className="text-[14px] text-amber-400/70">{m.warn}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── 탭 3: 케이스 가이드 ── */}
                {n8nTab === 'cases' && (
                  <div className="space-y-2">
                    <p className="text-[13px] text-muted mb-3">실전 케이스별 단계별 설정 가이드</p>
                    {[
                      { title: '웹훅 → Google Sheets 자동 기록', tag: 'Webhook', steps: ['Webhook Trigger 추가 → Test URL 복사 → 외부 서비스에 등록', 'Google Sheets 노드 추가 → Credential(OAuth) 설정', 'Operation: Append Row → Spreadsheet ID 입력', 'Webhook 데이터 필드를 시트 열에 매핑', 'Test → Production URL 전환'] },
                      { title: '이메일 수신 → Slack 자동 알림', tag: 'Schedule', steps: ['Gmail Trigger 추가 → Credential 설정 → Filters(발신자/제목) 지정', 'IF 노드: 중요 키워드 포함 여부 분기', 'Slack 노드 → Credential 설정 → 채널 선택', 'Message에 {{$json.subject}} {{$json.from}} 삽입', '5분 폴링 or 즉시 수신(Gmail Trigger)'] },
                      { title: '스케줄 → API 폴링 → 조건 알림', tag: 'Schedule', steps: ['Schedule Trigger: Cron "0 */1 * * *" (매시간)', 'HTTP Request: GET https://api.example.com/data', 'IF 노드: response.status === "critical" 조건', 'True → Slack 알림 / False → NoOp(종료)', '실패 시 Error Workflow 연결'] },
                      { title: '폼 제출 → CRM 자동 등록', tag: 'Webhook', steps: ['n8n Form Trigger 또는 Typeform Webhook 수신', 'Set 노드: 필드명을 CRM 스키마에 맞게 변환', 'HubSpot / Notion 노드 → Create Contact', '성공 시 확인 이메일 발송 (Gmail)', '실패 시 Slack으로 수동 처리 알림'] },
                      { title: 'Claude AI → 결과 자동 저장', tag: 'HTTP Request', steps: ['Trigger(Webhook/Schedule) → 입력 데이터 수집', 'HTTP Request: POST https://api.anthropic.com/v1/messages', 'Headers: x-api-key, anthropic-version 설정', 'Body: model, messages 배열 JSON 작성', 'JSON Parse → Google Sheets 또는 Notion에 저장'] },
                      { title: 'Slack 명령어 → 외부 서비스 실행', tag: 'Webhook', steps: ['Slack App 생성 → Slash Command 설정 → n8n Webhook URL 등록', 'Webhook Trigger: text, user_id 추출', 'Switch 노드: 명령어별 분기 (/report, /deploy 등)', '각 분기에 해당 서비스 API 호출', 'Slack에 결과 응답 (HTTP Request → response_url)'] },
                      { title: '파일 → OCR/AI → 정형화 저장', tag: 'HTTP Request', steps: ['이메일 첨부파일 or Drive Trigger로 파일 수신', 'Read Binary 노드 → Base64 인코딩', 'HTTP Request: Claude Vision API로 텍스트 추출', 'Set 노드: 추출 결과를 구조화된 JSON으로 변환', 'Google Sheets 또는 DB에 저장'] },
                      { title: '에러 핸들링 + 재시도 패턴', tag: 'Pattern', steps: ['워크플로우 Settings → Error Workflow 설정', '별도 Error Workflow 생성: error.message 수신', 'Slack/이메일로 에러 내용 + 실행 URL 알림', '재시도 필요 시: Wait 노드(30초) → Loop 재실행', '최대 3회 시도 후 수동 처리 티켓 생성'] },
                      { title: 'n8n → 외부 REST API 인증 연동', tag: 'HTTP Request', steps: ['API Key 방식: Header에 Authorization: Bearer {key}', 'OAuth2 방식: Credential → Generic OAuth2 설정', 'Basic Auth: Header에 Authorization: Basic base64(user:pass)', '테스트: 200 응답 확인 후 실제 데이터 처리', 'Credential을 n8n에 저장해 재사용 (평문 노출 방지)'] },
                    ].map((c, i) => (
                      <div key={i} className="rounded-xl border border-border-muted overflow-hidden">
                        <button
                          onClick={() => setN8nCase(n8nCase === i ? null : i)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/3 transition-colors text-left"
                        >
                          <span className="text-[14px] font-mono text-primary/50 shrink-0">CASE {String(i+1).padStart(2,'0')}</span>
                          <span className="text-[14px] text-dim flex-1">{c.title}</span>
                          <span className="text-[13px] text-sky-400/60 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-full shrink-0">{c.tag}</span>
                          <ChevronDown size={13} className={cn('text-muted transition-transform shrink-0', n8nCase === i && 'rotate-180')} />
                        </button>
                        {n8nCase === i && (
                          <div className="px-4 pb-4 bg-bg border-t border-border-muted">
                            <div className="pt-3 space-y-2">
                              {c.steps.map((s, si) => (
                                <div key={si} className="flex items-start gap-2">
                                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center">
                                    <span className="text-[13px] text-primary font-bold">{si+1}</span>
                                  </span>
                                  <span className="text-[13px] text-dim leading-relaxed">{s}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* ── 탭 4: TOP 7 실수 ── */}
                {n8nTab === 'mistakes' && (
                  <div className="space-y-3">
                    <p className="text-[13px] text-muted">초보자가 반드시 겪는 7가지 실수와 해결법</p>
                    {[
                      { no: '01', title: 'Webhook URL 외부 수신 불가', desc: '로컬 n8n(localhost)은 인터넷에서 접근 불가. 외부 서비스가 웹훅을 보내도 수신 안 됨.', fix: 'ngrok으로 터널 생성 (무료) 또는 n8n Cloud / VPS 사용', color: 'red' },
                      { no: '02', title: 'Credentials 미설정 → 401 오류', desc: 'API 키 없이 노드 실행 → Authentication failed. 자격 증명을 노드에 연결해야 함.', fix: 'Credentials → Create New → API Key / OAuth 인증 완료 후 노드에 연결', color: 'red' },
                      { no: '03', title: 'Array vs Object 데이터 혼동', desc: 'n8n은 items[]로 데이터를 전달. items[0].json.field 접근인데 items.field로 쓰면 undefined.', fix: '표현식: {{ $json.field }} (현재 아이템) / {{ $items()[0].json.field }} (특정 인덱스)', color: 'amber' },
                      { no: '04', title: 'Binary 데이터 처리 미설정', desc: '파일·이미지를 다룰 때 Binary Data 모드를 켜지 않으면 텍스트로 처리되어 깨짐.', fix: 'HTTP Request → Response Format: File 선택 / Read Binary File 노드 사용', color: 'amber' },
                      { no: '05', title: '무한 루프 / 실행 한도 미설정', desc: 'Loop 노드 종료 조건 미설정 → 무한 실행 → 크레딧/서버 폭발.', fix: 'Loop 노드에 maxItems 또는 종료 조건 IF 반드시 설정', color: 'red' },
                      { no: '06', title: '테스트 모드에서 실제 데이터 처리', desc: '"Test Workflow" 클릭 시에도 실제 API가 호출됨. Slack 메시지 발송, DB 삽입이 실제로 실행.', fix: '개발 시 별도 테스트 채널/시트 사용 or IF 노드로 test flag 분기', color: 'amber' },
                      { no: '07', title: 'Error Workflow 미연결 → 무음 실패', desc: '노드 실패 시 워크플로우가 그냥 멈춤. 담당자가 모르는 채 누락 발생.', fix: 'Settings → Error Workflow 설정 → 실패 시 Slack/Email 알림 워크플로우 연결', color: 'red' },
                    ].map(m => (
                      <div key={m.no} className={cn(
                        'rounded-xl border p-4',
                        m.color === 'red' ? 'border-red-700/25 bg-red-900/8' : 'border-amber-700/25 bg-amber-900/8'
                      )}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[14px] font-mono text-muted">#{m.no}</span>
                          <span className={cn('text-[14px] font-bold', m.color === 'red' ? 'text-red-400' : 'text-amber-400')}>{m.title}</span>
                        </div>
                        <p className="text-[13px] text-muted mb-2">{m.desc}</p>
                        <div className="flex items-start gap-1.5 px-2 py-1.5 bg-emerald-500/8 border border-emerald-500/20 rounded-lg">
                          <Check size={11} className="text-emerald-400 shrink-0 mt-0.5" />
                          <span className="text-[13px] text-emerald-300/80">{m.fix}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-5">
              {/* 카드 헤더 */}
              <div className="flex items-start gap-3 mb-5 pb-4 border-b border-border-muted">
                <div className="h-9 w-9 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-primary uppercase tracking-widest mb-1">프로세스 상세</p>
                  <p className="text-base font-bold text-white mb-1">{selectedCard.title}</p>
                  <p className="text-[15px] text-muted leading-snug">{selectedCard.role}</p>
                </div>
              </div>

              {/* 실행 순서 */}
              {selectedCard.steps.length > 0 && (
                <div className="mb-5">
                  <p className="text-[13px] font-bold text-muted uppercase tracking-widest mb-3">실행 순서</p>
                  <div className="space-y-2">
                    {selectedCard.steps.map((step, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCheckedSteps(prev => {
                          const next = new Set(prev)
                          if (next.has(idx)) next.delete(idx); else next.add(idx)
                          return next
                        })}
                        className={cn(
                          'w-full flex items-center gap-3 text-left rounded-xl px-3.5 py-3 transition-all border-2',
                          checkedSteps.has(idx)
                            ? 'bg-emerald-500/8 border-emerald-500/25'
                            : 'bg-white/2 border-white/8 hover:bg-white/5 hover:border-primary/25',
                        )}
                      >
                        <div className={cn(
                          'flex-shrink-0 h-6 w-6 rounded-full border-2 flex items-center justify-center',
                          checkedSteps.has(idx) ? 'bg-emerald-500 border-emerald-500' : 'border-primary/40 bg-primary/10',
                        )}>
                          {checkedSteps.has(idx)
                            ? <Check className="h-3 w-3 text-white" />
                            : <span className="text-[9px] text-primary font-black">{idx + 1}</span>}
                        </div>
                        <span className={cn('text-xs', checkedSteps.has(idx) ? 'text-slate-500 line-through' : 'text-slate-200')}>
                          {step}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 상세 구현 가이드 — 노드별 카드 */}
              {selectedCard.guide && (
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-3">
                    <p className="text-[13px] font-bold text-muted uppercase tracking-widest">상세 구현 가이드</p>
                    <span className="text-[9px] text-emerald-400/60 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">노드별 클릭 경로</span>
                  </div>
                  <div className="space-y-2">
                    {parseGuideCards(selectedCard.guide).map((card, i) => (
                      <div key={i} className="rounded-xl border border-border-muted bg-bg overflow-hidden">
                        {card.title && (
                          <div className="flex items-center gap-2 px-3 py-2 bg-surface border-b border-border-muted">
                            <span className="text-[11px] font-mono text-primary/50">{String(i + 1).padStart(2, '0')}</span>
                            <span className="text-[14px] font-semibold text-emerald-300">{card.title}</span>
                          </div>
                        )}
                        <div className="px-3 py-3">
                          <GuideMd text={card.body} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* FIELD / 설정값 — 복사 가능 */}
              {selectedCard.fields?.length > 0 && (
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-3">
                    <p className="text-[13px] font-bold text-muted uppercase tracking-widest">FIELD / 설정값</p>
                    <span className="text-[9px] text-sky-400/60 bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 rounded-full">복사해서 바로 사용</span>
                  </div>
                  <div className="space-y-2">
                    {selectedCard.fields.map((field, idx) => (
                      <div key={idx} className="rounded-lg border border-border-muted bg-bg overflow-hidden">
                        {/* 필드명 행 */}
                        <div className="flex items-center justify-between px-3 py-1.5 bg-surface border-b border-border-muted">
                          <span className="text-[13px] font-mono font-bold text-amber-300/80 uppercase tracking-wide">{field.name}</span>
                          <CopyFieldBtn value={field.value} />
                        </div>
                        {/* 값 행 */}
                        <div className="px-3 py-2">
                          <code className="text-[15px] text-sky-300 font-mono break-all leading-relaxed">{field.value}</code>
                        </div>
                        {field.note && (
                          <div className="px-3 pb-2 flex items-start gap-1">
                            <Info size={9} className="text-blue-400/50 shrink-0 mt-0.5" />
                            <p className="text-[13px] text-muted leading-relaxed">{field.note}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 주의사항 */}
              {selectedCard.warnings?.length > 0 && (
                <div className="mb-5">
                  <p className="text-[13px] font-bold text-muted uppercase tracking-widest mb-3">주의사항</p>
                  <div className="space-y-1.5">
                    {selectedCard.warnings.map((w, idx) => (
                      <div key={idx} className="flex items-start gap-2 px-3 py-2 bg-amber-500/5 border border-amber-500/15 rounded-lg">
                        <AlertTriangle size={13} className="text-amber-400/70 shrink-0 mt-0.5" />
                        <span className="text-[14px] text-dim leading-relaxed">{w}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

        {/* ── Right: AI 채팅 ────────────────────────────────────────────── */}
        <div className="w-[270px] lg:w-[300px] xl:w-[330px] 2xl:w-[360px] shrink-0 flex flex-col bg-bg">
          <div className="px-4 py-2.5 border-b border-border-muted flex items-center gap-1.5 shrink-0">
            <MessageSquare size={14} className="text-primary" />
            <span className="text-[13px] font-semibold text-muted uppercase tracking-widest">AI 자동화 설계</span>
            {workflow && (
              <span className="ml-auto text-[13px] text-green-500 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded-full normal-case tracking-normal">
                JSON 생성됨
              </span>
            )}
            {streaming && (
              <div className={cn('flex items-center gap-1 text-[13px] text-primary', workflow ? 'ml-1' : 'ml-auto')}>
                <RefreshCw size={12} className="animate-spin" />
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.map((m, i) => <ChatBubble key={i} message={m} />)}
            {streaming && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/20 shrink-0 flex items-center justify-center">
                  <Zap size={13} className="text-primary" />
                </div>
                <div className="bg-surface border border-border-muted rounded-xl px-3 py-2">
                  <span className="flex gap-1">
                    <span className="animate-bounce text-slate-400 [animation-delay:0ms]">·</span>
                    <span className="animate-bounce text-slate-400 [animation-delay:150ms]">·</span>
                    <span className="animate-bounce text-slate-400 [animation-delay:300ms]">·</span>
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {workflow && (
            <div className="px-3 pb-2 shrink-0 border-t border-border-muted pt-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[13px] text-green-400 font-semibold truncate max-w-[140px]">n8n — {workflow.name}</span>
                <div className="flex gap-1">
                  <button onClick={copyJson} className="p-1 text-muted hover:text-slate-300 transition-colors" title="JSON 복사">
                    {copied ? <CheckCheck size={14} className="text-green-400" /> : <Copy size={14} />}
                  </button>
                  <button onClick={downloadJson} className="p-1 text-muted hover:text-slate-300 transition-colors" title="JSON 다운로드">
                    <Download size={14} />
                  </button>
                </div>
              </div>
              {/* n8n 직접 전송 버튼 */}
              <button
                onClick={pushToN8n}
                disabled={n8nPushStatus === 'pushing'}
                className={cn(
                  'w-full flex items-center justify-center gap-1.5 mb-1.5 px-3 py-1.5 rounded-lg text-[14px] font-semibold border transition-colors',
                  n8nPushStatus === 'success'
                    ? 'bg-green-500/15 border-green-500/30 text-green-400'
                    : n8nPushStatus === 'error'
                    ? 'bg-red-500/10 border-red-500/20 text-red-400'
                    : n8nPushStatus === 'pushing'
                    ? 'bg-orange-500/10 border-orange-500/20 text-orange-400'
                    : 'bg-orange-500/15 border-orange-500/30 text-orange-400 hover:bg-orange-500/25',
                )}
              >
                {n8nPushStatus === 'pushing'
                  ? <><RefreshCw size={13} className="animate-spin" /> 전송 중...</>
                  : n8nPushStatus === 'success'
                  ? <><CheckCheck size={13} /> {n8nPushMsg}</>
                  : n8nPushStatus === 'error'
                  ? <><AlertTriangle size={13} /> 오류</>
                  : <><Upload size={13} /> n8n에 바로 전송</>}
              </button>
              {n8nPushStatus === 'error' && n8nPushMsg && (
                <p className="text-[9px] text-red-400/80 mb-1.5 leading-relaxed">{n8nPushMsg}</p>
              )}
              <div className="bg-surface border border-green-500/20 rounded-lg px-2 py-1.5 max-h-16 overflow-y-auto">
                <pre className="text-[9px] text-green-400/70 leading-relaxed whitespace-pre-wrap break-all">
                  {workflow.json.slice(0, 200)}…
                </pre>
              </div>
            </div>
          )}

          <div className="p-3 border-t border-border-muted shrink-0">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                placeholder="자동화하고 싶은 업무를 설명하세요..."
                rows={3}
                className="flex-1 resize-none bg-surface border border-border-muted rounded-lg px-3 py-2 text-xs text-text placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || streaming}
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0',
                  input.trim() && !streaming
                    ? 'bg-primary hover:bg-primary-hover text-white'
                    : 'bg-surface-3 text-muted',
                )}
              >
                {streaming ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}
              </button>
            </div>
            <p className="mt-1.5 text-[9px] text-[#3f3f46]">Enter 전송 · Shift+Enter 줄바꿈</p>
          </div>
        </div>
      </div>
    </div>
  )
}
