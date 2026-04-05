import { initializeApp } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
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

// Electron-compatible: force popup (not redirect) for embedded browser
googleProvider.setCustomParameters({ prompt: 'select_account' })

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider)
  return result.user
}

export async function signOutUser(): Promise<void> {
  await signOut(auth)
}

export { onAuthStateChanged, type User }
