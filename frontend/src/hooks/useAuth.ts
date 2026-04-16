// useAuth — v3.0 PIN 전용 (Firebase 제거)
import { useState, useEffect } from 'react'
import { authApi } from '../lib/api'

interface AuthUser {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
}

interface UseAuthReturn {
  user: AuthUser | null
  loading: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  error: string | null
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // PIN 기반 세션 복원: sessionStorage 토큰 확인
    const token = sessionStorage.getItem('session_token')
    if (token) {
      setUser({ uid: 'pin-user', email: null, displayName: null, photoURL: null })
    }
    setLoading(false)
  }, [])

  const signIn = async (): Promise<void> => {
    setError(null)
    // PIN 로그인은 LoginPage에서 직접 처리 — useAuth.signIn은 미사용
    throw new Error('PIN 로그인은 LoginPage에서 처리합니다.')
  }

  const signOut = async (): Promise<void> => {
    setError(null)
    try {
      sessionStorage.removeItem('session_token')
      setUser(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '로그아웃에 실패했습니다'
      setError(msg)
    }
  }

  // authApi를 참조해 unused import 경고 방지 (PIN 상태 확인에 사용 가능)
  void authApi

  return { user, loading, signIn, signOut, error }
}
