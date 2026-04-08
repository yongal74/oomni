import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '../lib/api'
import { useAuth } from '../hooks/useAuth'

export default function PinPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isSetup = searchParams.get('setup') === '1'

  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googlePolling, setGooglePolling] = useState(false)
  const [firebaseLoading, setFirebaseLoading] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { signIn: firebaseSignIn, error: firebaseError } = useAuth()

  // Google 로그인 설정 여부 확인
  // 컴포넌트 언마운트 시 폴링 정리
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [])

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
        sessionStorage.setItem('session_token', result.session_token)
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
        sessionStorage.setItem('session_token', result.session_token)
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

  const handleGoogleLogin = () => {
    // Electron IPC로 Google OAuth 시작
    if (window.electronAPI?.startGoogleOAuth) {
      window.electronAPI.startGoogleOAuth()
    } else {
      window.open('http://localhost:3001/api/auth/google', '_blank')
    }

    // 1초마다 pending-token 폴링
    setGooglePolling(true)
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch('http://localhost:3001/api/auth/google/pending-token')
        const data = await res.json() as { token: string | null }
        if (data.token) {
          if (pollingRef.current) clearInterval(pollingRef.current)
          setGooglePolling(false)
          sessionStorage.setItem('session_token', data.token)
          navigate('/dashboard', { replace: true })
        }
      } catch {
        // 폴링 중 오류 무시
      }
    }, 1000)
  }

  const handleFirebaseSignIn = async () => {
    setFirebaseLoading(true)
    setError('')
    try {
      await firebaseSignIn()
      navigate('/dashboard', { replace: true })
    } catch {
      setError(firebaseError ?? 'Google 로그인에 실패했습니다')
    } finally {
      setFirebaseLoading(false)
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

          {/* Google / Firebase 로그인 버튼 — PIN 설정/로그인 모두 표시 */}
          <>
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[11px] text-muted">또는</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Firebase Google Sign-In (primary) */}
              <button
                type="button"
                onClick={handleFirebaseSignIn}
                disabled={firebaseLoading || googlePolling}
                className="w-full py-2.5 bg-white text-gray-800 border border-gray-200 rounded-lg text-[13px] font-medium hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-50 flex items-center justify-center gap-2.5 shadow-sm"
              >
                {firebaseLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    <span>Google 로그인 중...</span>
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    <span>Google 계정으로 로그인</span>
                  </>
                )}
              </button>

              {/* Google OAuth (IPC 기반) — always visible */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={googlePolling || firebaseLoading}
                className="w-full mt-2 py-2 bg-surface border border-border rounded-lg text-[12px] text-muted hover:border-[#444] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {googlePolling ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-muted border-t-transparent rounded-full animate-spin" />
                    대기 중...
                  </>
                ) : 'Google OAuth로 로그인'}
              </button>
          </>
        </div>
      </div>
    </div>
  )
}
