/**
 * Electron preload에서 노출하는 API 타입 선언
 */
interface ElectronAPI {
  getInternalApiKey: () => Promise<string>
  openExternal: (url: string) => Promise<void>
  getAppVersion: () => Promise<string>
  showNotification: (opts: { title: string; body: string; urgency?: string }) => Promise<void>
  startGoogleOAuth: () => Promise<{ started: boolean; completed: boolean }>
  platform: string
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
