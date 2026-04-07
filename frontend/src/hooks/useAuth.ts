import { useState, useEffect } from 'react'
import { auth, signOutUser, onAuthStateChanged, type User } from '../lib/firebase'

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

const BASE_URL = 'http://localhost:3001'

// Electron BrowserWindow + 백엔드 passport OAuth 흐름
export async function startGoogleOAuth(): Promise<string> {
  // Electron 환경: IPC로 OAuth 창 열기
  if (window.electronAPI?.startGoogleOAuth) {
    await window.electronAPI.startGoogleOAuth()
  } else {
    window.open(`${BASE_URL}/api/auth/google`, '_blank')
  }

  // 토큰 폴링 (최대 2분, 3초 간격)
  const MAX_ATTEMPTS = 40
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    await new Promise(r => setTimeout(r, 3000))
    try {
      const res = await fetch(`${BASE_URL}/api/auth/google/pending-token`)
      if (res.ok) {
        const data = await res.json() as { token?: string }
        if (data.token) {
          localStorage.setItem('oomni_token', data.token)
          return data.token
        }
      }
    } catch { /* 계속 폴링 */ }
  }
  throw new Error('Google 로그인 시간 초과. 다시 시도해주세요.')
}


export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        })
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const signIn = async (): Promise<void> => {
    setError(null)
    setLoading(true)
    try {
      // Electron BrowserWindow OAuth 흐름 사용
      await startGoogleOAuth()
      // 토큰이 저장됐으면 페이지 새로고침으로 AuthGuard가 처리
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '로그인에 실패했습니다'
      setError(msg)
      throw new Error(msg)
    } finally {
      setLoading(false)
    }
  }

  const signOut = async (): Promise<void> => {
    setError(null)
    try {
      await signOutUser()
      localStorage.removeItem('session_token')
      setUser(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '로그아웃에 실패했습니다'
      setError(msg)
    }
  }

  return { user, loading, signIn, signOut, error }
}
