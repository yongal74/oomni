const { app, BrowserWindow, ipcMain, shell, session } = require('electron')
const path = require('path')
const http = require('http')

// app.isPackaged: 패키징된 프로덕션 앱이면 true, 개발 모드면 false
// process.env.NODE_ENV 는 electron-builder가 자동 설정 안 함 → 사용하지 않음
const isDev = !app.isPackaged

let mainWindow = null

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

// ── 백엔드 서버 시작 (Electron 내장 Node.js로 인-프로세스 실행) ──
function startBackend() {
  if (isDev) return // 개발 모드: 별도로 실행

  const backendPath = process.resourcesPath
    ? path.join(process.resourcesPath, 'backend')
    : path.join(__dirname, '..', 'backend')

  // 환경변수 설정
  process.env.NODE_ENV = 'production'
  process.env.PORT = '3001'

  // Electron에 내장된 Node.js로 직접 실행 (별도 node 설치 불필요)
  try {
    require(path.join(backendPath, 'dist', 'index.js'))
    console.log('[Backend] 인-프로세스 시작 완료')
  } catch (err) {
    console.error('[Backend] 시작 실패:', err)
  }
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
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  // 인-프로세스 백엔드는 앱 종료 시 자동 정리됨
})

// ── IPC 핸들러 ───────────────────────────────────────────
ipcMain.handle('get-internal-api-key', () => {
  return process.env.OOMNI_INTERNAL_API_KEY ?? 'dev-internal-key'
})

ipcMain.handle('open-external', (_event, url) => {
  // 허용된 도메인만 외부 브라우저로 열기
  const allowed = [
    'https://console.anthropic.com',
    'https://openrouter.ai',
    'https://n8n.io',
    'http://localhost:3001',
  ]
  if (allowed.some(a => url.startsWith(a))) {
    shell.openExternal(url)
  }
})

ipcMain.handle('get-app-version', () => app.getVersion())
