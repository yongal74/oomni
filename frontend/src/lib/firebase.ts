import { initializeApp } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
  type AuthError,
} from 'firebase/auth'

const firebaseConfig = {
  apiKey: 'AIzaSyACPjiAE-qly9WXSropc4fddTE_MttUSgg',
  authDomain: 'solo-factory-os.firebaseapp.com',
  projectId: 'solo-factory-os',
  storageBucket: 'solo-factory-os.firebasestorage.app',
  messagingSenderId: '372325235713',
  appId: '1:372325235713:web:089986a89121f4029a5400',
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()

// Electron-compatible: force account selection on every login
googleProvider.setCustomParameters({ prompt: 'select_account' })
googleProvider.addScope('email')
googleProvider.addScope('profile')

// Popup 차단 여부를 나타내는 에러 코드 목록
const POPUP_BLOCKED_CODES = [
  'auth/popup-blocked',
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  'auth/operation-not-supported-in-this-environment',
  'auth/unauthorized-domain',
]

function isPopupError(err: unknown): boolean {
  const code = (err as AuthError)?.code ?? ''
  return POPUP_BLOCKED_CODES.includes(code)
}

export async function signInWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider)
    return result.user
  } catch (err: unknown) {
    if (isPopupError(err)) {
      // Popup이 차단됐거나 닫힌 경우 사용자 친화적 에러 메시지로 재throw
      const code = (err as AuthError)?.code ?? ''
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        throw new Error('로그인 창이 닫혔습니다. 다시 시도해주세요.')
      }
      throw new Error(
        'Google 로그인 팝업이 차단되었습니다. ' +
        '브라우저 팝업 차단을 해제하거나 잠시 후 다시 시도해주세요.'
      )
    }
    // 네트워크 오류 등 기타 에러
    const firebaseCode = (err as AuthError)?.code ?? ''
    if (firebaseCode === 'auth/network-request-failed') {
      throw new Error('네트워크 연결을 확인해주세요.')
    }
    throw err
  }
}

export async function signOutUser(): Promise<void> {
  await signOut(auth)
}

export { onAuthStateChanged, type User }
