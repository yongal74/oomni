// Electron in-process 백엔드는 항상 localhost:3001이지만
// 결제 콜백 URL 등 외부에서 접근하는 경우를 위해 환경변수로 오버라이드 가능
export const BACKEND_URL: string =
  (import.meta as unknown as { env: Record<string, string | undefined> }).env?.VITE_BACKEND_URL ??
  'http://localhost:3001'
