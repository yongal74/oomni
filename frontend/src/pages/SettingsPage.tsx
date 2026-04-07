import { useState, useRef, useEffect } from 'react'
import {
  Download, Upload, AlertTriangle, CheckCircle, Loader2,
  User, CreditCard, Key, Database, ExternalLink, X
} from 'lucide-react'
import { backupApi, profileApi, paymentsApi, type Subscription } from '../lib/api'

interface MsgState {
  type: 'success' | 'error'
  text: string
}

// ── 섹션 구분 컴포넌트 ──────────────────────────────────────────────────────

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5 mb-4">
      {children}
    </div>
  )
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <span className="text-muted">{icon}</span>
      <h2 className="text-base font-semibold text-text">{title}</h2>
    </div>
  )
}

function MsgBox({ msg }: { msg: MsgState }) {
  return (
    <div
      className={
        'flex items-center gap-2 mt-4 p-3 rounded-lg text-[13px] ' +
        (msg.type === 'success'
          ? 'bg-green-900/20 border border-green-800/30 text-green-400'
          : 'bg-red-900/20 border border-red-800/30 text-red-400')
      }
    >
      {msg.type === 'success' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
      {msg.text}
    </div>
  )
}

// ── 플랜 정의 ────────────────────────────────────────────────────────────────

const PLANS: Record<string, { name: string; price: number; period: string; description: string }> = {
  free: { name: '무료', price: 0, period: '', description: '기본 기능 사용 가능' },
  personal: { name: '개인', price: 9900, period: '월', description: '모든 기능 + 우선 지원' },
  team: { name: '팀', price: 29000, period: '월', description: '팀 협업 + 고급 분석' },
}

// ── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export default function SettingsPage() {
  // 구독 정보
  const [sub, setSub] = useState<Subscription | null>(null)
  const [subLoading, setSubLoading] = useState(true)

  // 프로필
  const [displayName, setDisplayName] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState<MsgState | null>(null)

  // 구독 결제 모달
  const [payModal, setPayModal] = useState<{ plan: string } | null>(null)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [subMsg, setSubMsg] = useState<MsgState | null>(null)

  // 라이선스
  const [licenseKey, setLicenseKey] = useState('')
  const [licenseLoading, setLicenseLoading] = useState(false)
  const [licenseMsg, setLicenseMsg] = useState<MsgState | null>(null)

  // 데이터 관리
  const [exportLoading, setExportLoading] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [dataMsg, setDataMsg] = useState<MsgState | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingFile, setPendingFile] = useState<unknown>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── 구독 정보 로드 ──────────────────────────────────────────────────────

  useEffect(() => {
    setSubLoading(true)
    paymentsApi
      .subscription()
      .then((data) => {
        setSub(data)
        setDisplayName(data.display_name ?? '')
      })
      .catch(() => {
        setSub(null)
      })
      .finally(() => setSubLoading(false))
  }, [])

  // ── 프로필 저장 ──────────────────────────────────────────────────────────

  const handleProfileSave = async () => {
    if (!displayName.trim()) {
      setProfileMsg({ type: 'error', text: '이름을 입력해주세요.' })
      return
    }
    setProfileSaving(true)
    setProfileMsg(null)
    try {
      await profileApi.update({ display_name: displayName.trim() })
      setProfileMsg({ type: 'success', text: '프로필이 저장되었습니다.' })
      setSub((prev) => prev ? { ...prev, display_name: displayName.trim() } : prev)
    } catch {
      setProfileMsg({ type: 'error', text: '프로필 저장에 실패했습니다.' })
    } finally {
      setProfileSaving(false)
    }
  }

  // ── 결제 URL 열기 ─────────────────────────────────────────────────────────

  const handleOpenPayment = (plan: string) => {
    const orderId = `OOMNI-${Date.now()}-${plan.toUpperCase()}`
    const planInfo = PLANS[plan]
    const url =
      `https://pay.toss.im/payment?` +
      `orderId=${encodeURIComponent(orderId)}` +
      `&orderName=${encodeURIComponent(`OOMNI ${planInfo.name} 플랜`)}` +
      `&amount=${planInfo.price}`

    if ((window as { electronAPI?: { openExternal?: (u: string) => void } }).electronAPI?.openExternal) {
      (window as { electronAPI?: { openExternal?: (u: string) => void } }).electronAPI!.openExternal!(url)
    } else {
      window.open(url, '_blank')
    }
    setPayModal(null)
    setSubMsg({
      type: 'success',
      text: '결제 페이지가 외부 브라우저에서 열렸습니다. 결제 완료 후 앱을 재시작하면 구독이 활성화됩니다.',
    })
  }

  // ── 구독 취소 ────────────────────────────────────────────────────────────

  const handleCancelSub = async () => {
    setCancelLoading(true)
    setSubMsg(null)
    try {
      await paymentsApi.cancel()
      setSubMsg({ type: 'success', text: '구독이 취소되었습니다.' })
      setSub((prev) => prev ? { ...prev, status: 'cancelled' } : prev)
    } catch {
      setSubMsg({ type: 'error', text: '구독 취소에 실패했습니다.' })
    } finally {
      setCancelLoading(false)
    }
  }

  // ── 라이선스 활성화 ──────────────────────────────────────────────────────

  const handleActivateLicense = async () => {
    if (!licenseKey.trim()) {
      setLicenseMsg({ type: 'error', text: '라이선스 키를 입력해주세요.' })
      return
    }
    setLicenseLoading(true)
    setLicenseMsg(null)
    try {
      const result = await profileApi.activateLicense(licenseKey.trim()) as { data?: { license_valid_until?: string } }
      const until = result?.data?.license_valid_until
      setSub((prev) => prev ? { ...prev, license_valid_until: until } : prev)
      setLicenseMsg({ type: 'success', text: '라이선스가 활성화되었습니다.' })
      setLicenseKey('')
    } catch (err: unknown) {
      const errMsg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        '라이선스 활성화에 실패했습니다.'
      setLicenseMsg({ type: 'error', text: errMsg })
    } finally {
      setLicenseLoading(false)
    }
  }

  // ── 데이터 내보내기 ──────────────────────────────────────────────────────

  const handleExport = async () => {
    setDataMsg(null)
    setExportLoading(true)
    try {
      await backupApi.export()
      setDataMsg({ type: 'success', text: '데이터가 성공적으로 내보내졌습니다.' })
    } catch {
      setDataMsg({ type: 'error', text: '데이터 내보내기에 실패했습니다.' })
    } finally {
      setExportLoading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as unknown
        setPendingFile(data)
        setShowConfirm(true)
      } catch {
        setDataMsg({ type: 'error', text: 'JSON 파일을 읽을 수 없습니다.' })
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleImportConfirm = async () => {
    if (!pendingFile) return
    setShowConfirm(false)
    setImportLoading(true)
    setDataMsg(null)
    try {
      const result = await backupApi.import(pendingFile)
      setDataMsg({ type: 'success', text: result.message })
    } catch {
      setDataMsg({ type: 'error', text: '데이터 복원에 실패했습니다.' })
    } finally {
      setImportLoading(false)
      setPendingFile(null)
    }
  }

  // ── 헬퍼: 날짜 포맷 ──────────────────────────────────────────────────────

  const formatDate = (iso?: string) => {
    if (!iso) return '-'
    try {
      return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
    } catch {
      return iso
    }
  }

  const currentPlan = sub?.plan ?? 'free'
  const currentPlanInfo = PLANS[currentPlan] ?? PLANS.free
  const isActive = sub?.status === 'active'

  // ── 렌더 ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-semibold text-text mb-6">설정</h1>

      {/* ── 1. 프로필 섹션 ──────────────────────────────────────────── */}
      <SectionCard>
        <SectionTitle icon={<User size={16} />} title="프로필" />
        <p className="text-muted text-sm mb-5">이름과 계정 정보를 관리합니다.</p>

        {subLoading ? (
          <div className="flex items-center gap-2 text-muted text-sm">
            <Loader2 size={14} className="animate-spin" /> 불러오는 중...
          </div>
        ) : (
          <div className="space-y-4">
            {/* 이름 */}
            <div>
              <label className="block text-[12px] text-muted mb-1">이름</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="표시 이름 입력"
                  className="flex-1 px-3 py-2 bg-bg border border-border rounded-lg text-[13px] text-text placeholder:text-muted focus:outline-none focus:border-primary"
                />
                <button
                  onClick={handleProfileSave}
                  disabled={profileSaving}
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[13px] font-medium transition-colors disabled:opacity-50 shrink-0"
                >
                  {profileSaving ? <Loader2 size={13} className="animate-spin" /> : null}
                  저장
                </button>
              </div>
            </div>

            {/* 이메일 */}
            {sub?.email && (
              <div>
                <label className="block text-[12px] text-muted mb-1">이메일</label>
                <div className="px-3 py-2 bg-bg border border-border rounded-lg text-[13px] text-muted">
                  {sub.email}
                </div>
              </div>
            )}

            {/* 역할 배지 */}
            {sub && (
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-muted">역할</span>
                <span className="px-2 py-0.5 bg-primary/10 border border-primary/20 text-primary rounded-full text-[11px] font-medium">
                  {currentPlan === 'free' ? 'user' : currentPlan}
                </span>
              </div>
            )}
          </div>
        )}

        {profileMsg && <MsgBox msg={profileMsg} />}
      </SectionCard>

      {/* ── 2. 구독 섹션 ────────────────────────────────────────────── */}
      <SectionCard>
        <SectionTitle icon={<CreditCard size={16} />} title="구독" />
        <p className="text-muted text-sm mb-5">현재 플랜과 결제 정보를 관리합니다.</p>

        {subLoading ? (
          <div className="flex items-center gap-2 text-muted text-sm">
            <Loader2 size={14} className="animate-spin" /> 불러오는 중...
          </div>
        ) : (
          <div className="space-y-4">
            {/* 현재 플랜 표시 */}
            <div className="p-4 bg-bg border border-border rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[14px] font-medium text-text">
                  {currentPlanInfo.name} 플랜
                  {currentPlanInfo.price > 0 && (
                    <span className="ml-2 text-[12px] text-muted font-normal">
                      {currentPlanInfo.price.toLocaleString()}원/{currentPlanInfo.period}
                    </span>
                  )}
                </span>
                <span
                  className={
                    'px-2 py-0.5 rounded-full text-[11px] font-medium ' +
                    (isActive
                      ? 'bg-green-900/20 border border-green-800/30 text-green-400'
                      : 'bg-surface border border-border text-muted')
                  }
                >
                  {isActive ? '활성' : sub?.status === 'cancelled' ? '취소됨' : '무료'}
                </span>
              </div>
              <div className="text-[12px] text-muted">{currentPlanInfo.description}</div>
              {sub?.current_period_end && isActive && (
                <div className="mt-2 text-[12px] text-muted">
                  만료일: {formatDate(sub.current_period_end)}
                </div>
              )}
            </div>

            {/* 업그레이드 버튼들 */}
            {currentPlan === 'free' && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setPayModal({ plan: 'personal' })}
                  className="p-3 bg-primary/10 border border-primary/20 hover:bg-primary/20 rounded-lg text-left transition-colors"
                >
                  <div className="text-[13px] font-medium text-primary mb-0.5">개인 플랜</div>
                  <div className="text-[12px] text-muted">9,900원/월</div>
                </button>
                <button
                  onClick={() => setPayModal({ plan: 'team' })}
                  className="p-3 bg-primary/10 border border-primary/20 hover:bg-primary/20 rounded-lg text-left transition-colors"
                >
                  <div className="text-[13px] font-medium text-primary mb-0.5">팀 플랜</div>
                  <div className="text-[12px] text-muted">29,000원/월</div>
                </button>
              </div>
            )}

            {/* 구독 취소 버튼 */}
            {isActive && (
              <button
                onClick={handleCancelSub}
                disabled={cancelLoading}
                className="flex items-center gap-2 px-4 py-2 bg-red-900/20 border border-red-800/30 text-red-400 hover:bg-red-900/40 rounded-lg text-[13px] font-medium transition-colors disabled:opacity-50"
              >
                {cancelLoading ? <Loader2 size={13} className="animate-spin" /> : null}
                구독 취소
              </button>
            )}
          </div>
        )}

        {subMsg && <MsgBox msg={subMsg} />}
      </SectionCard>

      {/* ── 3. 라이선스 섹션 ────────────────────────────────────────── */}
      <SectionCard>
        <SectionTitle icon={<Key size={16} />} title="라이선스" />
        <p className="text-muted text-sm mb-5">
          라이선스 키를 직접 입력하여 활성화하세요. 형식: <code className="text-primary">OOMNI-XXXX-XXXX-XXXX</code>
        </p>

        {/* 현재 라이선스 만료일 */}
        {sub?.license_valid_until && (
          <div className="flex items-center gap-2 p-3 bg-bg border border-border rounded-lg mb-4">
            <CheckCircle size={14} className="text-green-400 shrink-0" />
            <span className="text-[13px] text-text">
              라이선스 유효: <span className="text-green-400 font-medium">{formatDate(sub.license_valid_until)}</span>까지
            </span>
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
            placeholder="OOMNI-XXXX-XXXX-XXXX"
            className="flex-1 px-3 py-2 bg-bg border border-border rounded-lg text-[13px] text-text placeholder:text-muted font-mono focus:outline-none focus:border-primary"
          />
          <button
            onClick={handleActivateLicense}
            disabled={licenseLoading}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[13px] font-medium transition-colors disabled:opacity-50 shrink-0"
          >
            {licenseLoading ? <Loader2 size={13} className="animate-spin" /> : null}
            활성화
          </button>
        </div>

        {licenseMsg && <MsgBox msg={licenseMsg} />}
      </SectionCard>

      {/* ── 4. 데이터 관리 섹션 (기존 유지) ────────────────────────── */}
      <SectionCard>
        <SectionTitle icon={<Database size={16} />} title="데이터 관리" />
        <p className="text-muted text-sm mb-5">
          OOMNI 데이터를 JSON 파일로 내보내거나, 파일에서 복원합니다.
        </p>

        <div className="space-y-3">
          {/* 내보내기 */}
          <div className="flex items-center justify-between p-4 bg-bg rounded-lg border border-border">
            <div>
              <div className="text-[14px] font-medium text-text mb-0.5">데이터 내보내기</div>
              <div className="text-[12px] text-muted">미션, 봇, 이슈, 리서치 등 모든 데이터를 JSON으로 저장</div>
            </div>
            <button
              onClick={handleExport}
              disabled={exportLoading}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[13px] font-medium transition-colors disabled:opacity-50 shrink-0"
            >
              {exportLoading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              내보내기
            </button>
          </div>

          {/* 가져오기 */}
          <div className="flex items-center justify-between p-4 bg-bg rounded-lg border border-border">
            <div>
              <div className="text-[14px] font-medium text-text mb-0.5">데이터 가져오기</div>
              <div className="text-[12px] text-muted">백업 JSON 파일에서 데이터를 복원합니다</div>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importLoading}
              className="flex items-center gap-2 px-4 py-2 bg-surface hover:bg-border border border-border text-text rounded-lg text-[13px] font-medium transition-colors disabled:opacity-50 shrink-0"
            >
              {importLoading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              가져오기
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>

        {dataMsg && <MsgBox msg={dataMsg} />}
      </SectionCard>

      {/* ── 결제 안내 모달 ──────────────────────────────────────────── */}
      {payModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-xl p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-text">
                {PLANS[payModal.plan]?.name} 플랜 구독
              </h3>
              <button
                onClick={() => setPayModal(null)}
                className="text-muted hover:text-text transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 bg-bg border border-border rounded-lg mb-4">
              <div className="text-[14px] font-medium text-text mb-1">
                {PLANS[payModal.plan]?.name} 플랜
              </div>
              <div className="text-[13px] text-muted mb-2">
                {PLANS[payModal.plan]?.description}
              </div>
              <div className="text-[20px] font-bold text-primary">
                {PLANS[payModal.plan]?.price.toLocaleString()}원
                <span className="text-[13px] font-normal text-muted">/{PLANS[payModal.plan]?.period}</span>
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 bg-amber-900/10 border border-amber-800/20 rounded-lg mb-5 text-[12px] text-amber-400">
              <AlertTriangle size={13} className="shrink-0 mt-0.5" />
              결제 페이지는 외부 브라우저에서 열립니다. 결제 완료 후 앱을 재시작하면 구독이 활성화됩니다.
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setPayModal(null)}
                className="flex-1 py-2 border border-border rounded-lg text-[13px] text-muted hover:text-text transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => handleOpenPayment(payModal.plan)}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[13px] font-medium transition-colors"
              >
                <ExternalLink size={13} />
                결제 페이지 열기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 데이터 복원 확인 모달 ──────────────────────────────────── */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle size={20} className="text-amber-400 shrink-0" />
              <h3 className="text-base font-semibold text-text">데이터 복원 확인</h3>
            </div>
            <p className="text-muted text-sm mb-5">
              기존 데이터가{' '}
              <span className="text-amber-400 font-medium">완전히 덮어씌워집니다</span>.{' '}
              이 작업은 되돌릴 수 없습니다. 계속하시겠습니까?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowConfirm(false); setPendingFile(null) }}
                className="flex-1 py-2 border border-border rounded-lg text-[13px] text-muted hover:text-text transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleImportConfirm}
                className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[13px] font-medium transition-colors"
              >
                덮어쓰기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
