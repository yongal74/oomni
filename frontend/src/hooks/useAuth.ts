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

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
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
      // 1. Firebase signInWithPopup → Google 계정 선택 팝업
      const firebaseUser = await signInWithGoogle()
      // 2. Firebase ID Token 획득
      const idToken = await firebaseUser.getIdToken()
      // 3. 백엔드에서 세션 토큰 발급
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
      localStorage.setItem('session_token', data.session_token)
      setUser({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
      })
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
