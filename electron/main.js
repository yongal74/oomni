const { app, BrowserWindow, ipcMain, Notification, shell, session, Menu, MenuItem } = require('electron')
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
          "default-src 'self' file: data:; script-src 'self' 'unsafe-inline' file:; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: file:; connect-src 'self' http://localhost:3001 ws://localhost:3001"
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

  // 포트 이미 사용 중인지 먼저 확인
  return new Promise((resolve) => {
    const testConn = http.get('http://localhost:3001/api/health', (res) => {
      if (res.statusCode === 200) {
        console.log('[Backend] 이미 실행 중 — 재사용')
        resolve()
      } else {
        launchBackend(backendPath, resolve)
      }
    })
    testConn.on('error', () => launchBackend(backendPath, resolve))
    testConn.setTimeout(500, () => { testConn.destroy(); launchBackend(backendPath, resolve) })
  })
}

function launchBackend(backendPath, done) {
  try {
    require(path.join(backendPath, 'dist', 'index.js'))
    console.log('[Backend] 인-프로세스 시작 완료')
  } catch (err) {
    console.error('[Backend] 시작 실패:', err)
  }
  done()
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

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'))
  }

  if (isDev) mainWindow.webContents.openDevTools()
}

app.whenReady().then(async () => {
  await startBackend()

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

// ── 우클릭 컨텍스트 메뉴 (복사/붙여넣기) ─────────────────
app.on('web-contents-created', (_, wc) => {
  wc.on('context-menu', (_, params) => {
    const menu = new Menu()
    if (params.selectionText) {
      menu.append(new MenuItem({ role: 'copy', label: '복사' }))
    }
    if (params.isEditable) {
      menu.append(new MenuItem({ role: 'cut', label: '잘라내기' }))
      menu.append(new MenuItem({ role: 'paste', label: '붙여넣기' }))
      menu.append(new MenuItem({ role: 'selectAll', label: '전체 선택' }))
    }
    if (menu.items.length > 0) menu.popup()
  })
})

app.on('before-quit', () => {
  // 인-프로세스 백엔드는 앱 종료 시 자동 정리됨
})

// ── IPC 핸들러 ───────────────────────────────────────────
ipcMain.handle('get-internal-api-key', () => {
  return process.env.OOMNI_INTERNAL_API_KEY ?? 'oomni-internal-dev-key-change-me!'
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

// ── 알림 IPC 핸들러 ──────────────────────────────────────
// Frontend usage:
// window.electronAPI.showNotification({ title: '승인 대기', body: '봇이 승인을 요청했습니다' })
// window.electronAPI.showNotification({ title: '봇 실행 완료', body: '에이전트가 작업을 완료했습니다', urgency: 'normal' })
ipcMain.handle('show-notification', (_event, { title, body, urgency }) => {
  if (Notification.isSupported()) {
    const n = new Notification({
      title: title ?? 'OOMNI',
      body: body ?? '',
      icon: path.join(__dirname, 'assets/icon.ico'),
      urgency: urgency ?? 'normal',  // 'normal' | 'critical' | 'low'
    })
    n.on('click', () => {
      mainWindow?.focus()
      mainWindow?.show()
    })
    n.show()
    return true
  }
  return false
})
