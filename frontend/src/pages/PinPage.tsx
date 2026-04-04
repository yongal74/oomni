import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '../lib/api'

export default function PinPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isSetup = searchParams.get('setup') === '1'

  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (pin.length < 4 || pin.length > 6) {
      setError('PIN은 4~6자리 숫자여야 합니다')
      return
    }
    if (!/^\d+$/.test(pin)) {
      setError('PIN은 숫자만 입력 가능합니다')
      return
    }

    if (isSetup) {
      if (pin !== confirmPin) {
        setError('PIN이 일치하지 않습니다')
        return
      }
      setLoading(true)
      try {
        await authApi.setPin(pin)
        // PIN 설정 후 바로 verify하여 세션 발급
        const result = await authApi.verifyPin(pin)
        localStorage.setItem('session_token', result.session_token)
        navigate('/dashboard', { replace: true })
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        setError(msg ?? 'PIN 설정에 실패했습니다')
      } finally {
        setLoading(false)
      }
    } else {
      setLoading(true)
      try {
        const result = await authApi.verifyPin(pin)
        localStorage.setItem('session_token', result.session_token)
        navigate('/dashboard', { replace: true })
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        setError(msg ?? 'PIN이 올바르지 않습니다')
        setPin('')
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <div className="text-center mb-8">
          <div className="text-3xl font-bold text-primary tracking-tight mb-2">OOMNI</div>
          <p className="text-muted text-sm">
            {isSetup ? 'PIN을 설정해주세요' : 'PIN을 입력해주세요'}
          </p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6">
          <h2 className="text-base font-semibold text-text mb-5 text-center">
            {isSetup ? 'PIN 설정' : '잠금 해제'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[12px] text-muted mb-1.5">
                {isSetup ? 'PIN (4~6자리 숫자)' : 'PIN'}
              </label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                autoFocus
                className="w-full px-3 py-2.5 bg-bg border border-border rounded-lg text-text text-center text-xl tracking-[0.5em] focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            {isSetup && (
              <div>
                <label className="block text-[12px] text-muted mb-1.5">PIN 확인</label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full px-3 py-2.5 bg-bg border border-border rounded-lg text-text text-center text-xl tracking-[0.5em] focus:outline-none focus:border-primary transition-colors"
                />
              </div>
            )}

            {error && (
              <div className="text-[12px] text-red-400 bg-red-900/20 border border-red-800/30 rounded-lg px-3 py-2 text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || pin.length < 4}
              className="w-full py-2.5 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-[#C5664A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  처리 중...
                </span>
              ) : isSetup ? 'PIN 설정' : '잠금 해제'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
