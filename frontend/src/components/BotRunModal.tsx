import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Play, Loader2 } from 'lucide-react'
import { type Agent } from '../lib/api'

const BOT_EMOJI: Record<string, string> = {
  research: '🔬', build: '🔨', design: '🎨', content: '✍️',
  growth: '📈', ops: '⚙️', integration: '🔗', n8n: '⚡', ceo: '👔',
}

const EXAMPLE_PROMPTS: Record<string, string[]> = {
  research: [
    'AI/블록체인/테크 분야 이번 주 주요 트렌드 수집 및 1차 필터링',
    '경쟁 서비스 분석 리포트 작성',
    '새로운 비즈니스 모델 기회 조사 (자동화/AI 관련)',
    '글로벌 VC 투자 트렌드 분석',
    '타겟 키워드 SEO 경쟁도 분석',
  ],
  build: [
    '현재 PRD 기반으로 프론트엔드 컴포넌트 구현',
    '백엔드 API 엔드포인트 TDD 방식으로 개발',
    '버그 수정 및 성능 최적화',
    'GitHub PR 생성 및 코드 리뷰 요청',
    '결제 모듈 (Polar/토스페이먼츠) 연동',
  ],
  design: [
    'PRD 기반으로 Pencil.dev에서 UI 화면 설계',
    '디자인 시스템 컴포넌트 생성',
    '모바일/웹 반응형 레이아웃 설계',
    'UX 플로우 다이어그램 작성',
    '랜딩페이지 디자인 초안',
  ],
  content: [
    '리서치 결과를 SEO 블로그 포스트로 변환',
    '숏폼 영상 스크립트 작성 (훅+본문+CTA)',
    '뉴스레터 초안 작성',
    'SNS 콘텐츠 캘린더 1주치 생성',
    'YouTube 영상 기획안 + 제목/썸네일 아이디어',
  ],
  growth: [
    '랜딩페이지 카피라이팅 A/B 테스트안 생성',
    'Meta/Google 광고 카피 5종 작성',
    '이메일 온보딩 시퀀스 설계',
    'SEO 키워드 전략 수립',
    '제품 출시 마케팅 플랜 작성',
  ],
  ops: [
    '이번 달 비용 분석 리포트 생성',
    '고객 피드백 데이터 분석 및 개선사항 도출',
    '분기별 세무 체크리스트 확인',
    '운영 이슈 우선순위 정리',
    'SaaS KPI 대시보드 업데이트',
  ],
  integration: [
    '외부 API 연동 상태 점검 및 오류 수정',
    'Webhook 설정 및 데이터 동기화',
    '신규 서비스 연동 구현',
    '데이터 마이그레이션 스크립트 작성',
    'API Rate Limit 최적화',
  ],
  n8n: [
    '리서치 수집 자동화 워크플로우 생성',
    '콘텐츠 발행 자동화 파이프라인 구성',
    '고객 알림 자동화 세팅',
    '데이터 백업 자동화 워크플로우',
    'Telegram 봇 알림 연동',
  ],
  ceo: [
    '이번 주 전체 봇 활동 종합 보고서 생성',
    '분기별 사업 현황 요약 및 다음 분기 전략',
    'KPI 달성률 분석 및 개선 방향 제시',
    '투자자 업데이트 문서 초안',
    '팀(봇) 성과 평가 리포트',
  ],
}

interface BotRunModalProps {
  agent: Agent
  onClose: () => void
  onSuccess?: () => void
}

export function BotRunModal({ agent, onClose, onSuccess }: BotRunModalProps) {
  const [task, setTask] = useState('')
  const navigate = useNavigate()

  const examples = EXAMPLE_PROMPTS[agent.role] ?? []
  const emoji = BOT_EMOJI[agent.role] ?? '🤖'

  // 봇 상세 페이지로 이동하며 task를 URL 파라미터로 전달 → 자동 실행
  const handleSubmit = async () => {
    if (!task.trim()) return
    onClose()
    navigate(`/dashboard/bots/${agent.id}?autorun=${encodeURIComponent(task.trim())}`)
    onSuccess?.()
  }

  // 예시 프롬프트 클릭 시 바로 이동
  const handleExampleClick = (prompt: string) => {
    onClose()
    navigate(`/dashboard/bots/${agent.id}?autorun=${encodeURIComponent(prompt)}`)
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-border rounded-xl w-full max-w-lg shadow-2xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{emoji}</span>
            <div>
              <h2 className="text-base font-semibold text-text">{agent.name}</h2>
              <p className="text-[12px] text-muted mt-0.5">{agent.role}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-text transition-colors"
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-5 space-y-4">
          {/* 작업 입력 */}
          <div>
            <textarea
              value={task}
              onChange={e => setTask(e.target.value)}
              placeholder="어떤 작업을 실행할까요?"
              rows={4}
              className="w-full bg-bg border border-border rounded-lg px-4 py-3 text-[13px] text-text placeholder-muted focus:outline-none focus:border-primary resize-none"
            />
          </div>

          {/* 예시 프롬프트 */}
          {examples.length > 0 && (
            <div>
              <p className="text-[11px] text-muted uppercase tracking-widest mb-2">예시 프롬프트</p>
              <div className="flex flex-wrap gap-2">
                {examples.map(prompt => (
                  <button
                    key={prompt}
                    onClick={() => handleExampleClick(prompt)}
                    className="text-[12px] px-3 py-1.5 rounded-full bg-bg border border-border text-muted hover:border-primary hover:text-text transition-colors text-left"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 액션 버튼 */}
        <div className="flex items-center justify-end gap-3 px-5 pb-5">
          <button
            onClick={onClose}
            disabled={false}
            className="px-4 py-2 text-[13px] text-muted hover:text-text border border-border rounded-lg transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={false}
            className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-lg text-[13px] hover:bg-[#C5664A] disabled:opacity-50 transition-colors"
          >
            {false ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                실행 중
              </>
            ) : (
              <>
                <Play size={13} />
                실행
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
