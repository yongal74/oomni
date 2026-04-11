import { useState, useEffect } from 'react'
import { auth, signInWithGoogle, signOutUser, onAuthStateChanged, type User } from '../lib/firebase'

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

const isElectron = (): boolean => typeof window !== 'undefined' && !!window.electronAPI

/** Electron IPC 기반 Google OAuth — pending-token 폴링 (최대 120초) */
async function signInWithElectronOAuth(): Promise<AuthUser> {
  if (!window.electronAPI) throw new Error('Electron API를 사용할 수 없습니다')

  // OAuth 창이 닫힐 때까지 대기 (완료 or 사용자 취소 모두 resolve)
  const result = await window.electronAPI.startGoogleOAuth()

  // 사용자가 창을 그냥 닫은 경우 (콜백 미도달) → 즉시 중단
  if (!result.completed) {
    throw new Error('Google 로그인이 취소되었습니다.')
  }

  // 콜백 도달 확인 → pending-token 폴링 (1초 간격, 최대 30회)
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 1000))
    try {
      const res = await fetch('http://localhost:3001/api/auth/google/pending-token')
      if (res.ok) {
        const data = await res.json() as { token?: string; session_token?: string }
        const tok = data.token ?? data.session_token
        if (tok) {
          sessionStorage.setItem('session_token', tok)
          // 사용자 정보 조회
          const statusRes = await fetch('http://localhost:3001/api/auth/google/status')
          const status = await statusRes.json() as {
            google_user?: { email: string; name: string; picture: string }
          }
          const gUser = status.google_user
          return {
            uid: gUser?.email ?? 'google-user',
            email: gUser?.email ?? null,
            displayName: gUser?.name ?? null,
            photoURL: gUser?.picture ?? null,
          }
        }
      }
    } catch {
      // 네트워크 오류는 무시하고 계속 폴링
    }
  }
  throw new Error('Google 로그인 시간이 초과되었습니다. 다시 시도해주세요.')
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Electron에서는 Firebase onAuthStateChanged 대신 sessionStorage + 백엔드 status로 복원
    if (isElectron()) {
      const token = sessionStorage.getItem('session_token')
      if (token) {
        fetch('http://localhost:3001/api/auth/google/status')
          .then(r => r.json())
          .then((data: { google_user?: { email: string; name: string; picture: string } }) => {
            if (data.google_user) {
              setUser({
                uid: data.google_user.email,
                email: data.google_user.email,
                displayName: data.google_user.name,
                photoURL: data.google_user.picture,
              })
            }
          })
          .catch(() => {})
          .finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
      return
    }

    // 브라우저: Firebase onAuthStateChanged
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: User | null) => {
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
      if (isElectron()) {
        // Electron: IPC 기반 Google OAuth (file:// 도메인 제한 우회)
        const authUser = await signInWithElectronOAuth()
        setUser(authUser)
      } else {
        // 브라우저: Firebase signInWithPopup
        const firebaseUser = await signInWithGoogle()
        const idToken = await firebaseUser.getIdToken()
        const res = await fetch('http://localhost:3001/api/auth/firebase/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        })
        if (!res.ok) {
          const errData = await res.json() as { error?: string }
          throw new Error(errData.error ?? '서버 인증 실패')
        }
        const data = await res.json() as { session_token: string }
        sessionStorage.setItem('session_token', data.session_token)
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        })
      }
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
      if (!isElectron()) {
        await signOutUser()
      }
      sessionStorage.removeItem('session_token')
      setUser(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '로그아웃에 실패했습니다'
      setError(msg)
    }
  }

  return { user, loading, signIn, signOut, error }
}
