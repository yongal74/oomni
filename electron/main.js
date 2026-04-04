const { app, BrowserWindow, ipcMain, shell, session } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const http = require('http')
const isDev = process.env.NODE_ENV !== 'production'

let mainWindow = null
let backendProcess = null

// ── 보안: CSP 헤더 ──────────────────────────────────────
function setupCSP() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' http://localhost:3001 ws://localhost:3001"
        ],
      },
    })
  })
}

// ── 백엔드 헬스체크 폴링 ────────────────────────────────
function waitForBackend(retries = 30, intervalMs = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0
    const check = () => {
      http.get('http://localhost:3001/api/health', (res) => {
        if (res.statusCode === 200) {
          resolve()
        } else {
          retry()
        }
      }).on('error', () => retry())
    }
    const retry = () => {
      attempts++
      if (attempts >= retries) {
        reject(new Error('백엔드 서버 시작 타임아웃'))
      } else {
        setTimeout(check, intervalMs)
      }
    }
    check()
  })
}

// ── 백엔드 서버 시작 ────────────────────────────────────
function startBackend() {
  if (isDev) return // 개발 모드: 별도로 실행

  const backendPath = process.resourcesPath
    ? path.join(process.resourcesPath, 'backend')
    : path.join(__dirname, '..', 'backend')

  backendProcess = spawn('node', [path.join(backendPath, 'dist', 'index.js')], {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: '3001',
    },
    cwd: backendPath,
  })

  backendProcess.stdout?.on('data', (d) => console.log('[Backend]', d.toString()))
  backendProcess.stderr?.on('data', (d) => console.error('[Backend]', d.toString()))
  backendProcess.on('exit', (code) => console.log('[Backend] 종료 code=', code))
}

function createWindow() {
  setupCSP()

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0F0F10',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,      // 보안: renderer와 main 격리
      nodeIntegration: false,      // 보안: renderer에서 Node.js 비활성화
      sandbox: false,              // preload에서 일부 Node API 필요
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
    show: false,
  })

  // 로드 완료 후 표시 (흰 화면 방지)
  mainWindow.once('ready-to-show', () => mainWindow.show())

  // 외부 링크는 기본 브라우저에서 열기
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  const url = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../frontend/dist/index.html')}`
  mainWindow.loadURL(url)

  if (isDev) mainWindow.webContents.openDevTools()
}

app.whenReady().then(async () => {
  startBackend()

  // 프로덕션에서는 백엔드 준비 대기
  if (!isDev) {
    try {
      await waitForBackend()
      console.log('[Electron] 백엔드 준비 완료')
    } catch (err) {
      console.error('[Electron] 백엔드 시작 실패:', err.message)
    }
  }

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (backendProcess) backendProcess.kill()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  if (backendProcess) backendProcess.kill('SIGTERM')
})

// ── IPC 핸들러 ───────────────────────────────────────────
ipcMain.handle('get-internal-api-key', () => {
  return process.env.OOMNI_INTERNAL_API_KEY ?? 'dev-internal-key'
})

ipcMain.handle('open-external', (_event, url) => {
  // 허용된 도메인만 외부 브라우저로 열기
  const allowed = ['https://console.anthropic.com', 'https://openrouter.ai', 'https://n8n.io']
  if (allowed.some(a => url.startsWith(a))) {
    shell.openExternal(url)
  }
})

ipcMain.handle('get-app-version', () => app.getVersion())
