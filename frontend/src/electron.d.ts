/**
 * Electron preload에서 노출하는 API 타입 선언
 */
interface ElectronAPI {
  getInternalApiKey: () => Promise<string>
  openExternal: (url: string) => Promise<void>
  getAppVersion: () => Promise<string>
  platform: string
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
