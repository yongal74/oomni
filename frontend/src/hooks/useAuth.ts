import { useState, useEffect } from 'react'
import { auth, signInWithGoogle, signOutUser, onAuthStateChanged, type User } from '../lib/firebase'
import axios from 'axios'

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

async function verifyWithBackend(idToken: string): Promise<string | null> {
  try {
    const res = await axios.post<{ session_token: string }>(
      `${BASE_URL}/api/auth/firebase/verify`,
      { idToken },
      { timeout: 10000 }
    )
    return res.data.session_token
  } catch {
    return null
  }
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
      const firebaseUser = await signInWithGoogle()
      const idToken = await firebaseUser.getIdToken()

      // Send token to backend to create session
      const sessionToken = await verifyWithBackend(idToken)
      if (sessionToken) {
        localStorage.setItem('session_token', sessionToken)
      }

      setUser({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
      })
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : '로그인에 실패했습니다'
      setError(msg)
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
