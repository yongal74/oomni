const { app, BrowserWindow, ipcMain, Notification, shell, session, Menu, MenuItem } = require('electron')
const path = require('path')
const http = require('http')
const fs = require('fs')
let autoUpdater = null
try {
  autoUpdater = require('electron-updater').autoUpdater
} catch {
  console.warn('[Updater] electron-updater를 찾을 수 없음 — 자동업데이트 비활성화')
}

// app.isPackaged: 패키징된 프로덕션 앱이면 true, 개발 모드면 false
// process.env.NODE_ENV 는 electron-builder가 자동 설정 안 함 → 사용하지 않음
const isDev = !app.isPackaged

let mainWindow = null

// ── 보안: CSP 헤더 ──────────────────────────────────────
function setupCSP() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    // 우리 앱 페이지(file:// 또는 localhost:5174)에만 CSP 적용
    // Firebase OAuth 팝업 페이지의 inline script 차단 방지
    const isAppPage = details.url.startsWith('file://') || details.url.startsWith(`http://localhost:${FRONTEND_PORT}`)
    if (!isAppPage) {
      return callback({ responseHeaders: details.responseHeaders })
    }
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          `default-src 'self' file: data: http://localhost:${FRONTEND_PORT}; script-src 'self' file: http://localhost:${FRONTEND_PORT} https://*.firebaseapp.com https://apis.google.com https://www.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https: file:; connect-src 'self' http://localhost:3001 http://localhost:${FRONTEND_PORT} ws://localhost:3001 https://*.googleapis.com https://securetoken.googleapis.com https://identitytoolkit.googleapis.com https://firebaseinstallations.googleapis.com https://www.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://apis.google.com https://firestore.googleapis.com; frame-src https://*.firebaseapp.com https://accounts.google.com https://apis.google.com https://www.google.com`
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

// ── 프론트엔드 정적 파일 HTTP 서버 (프로덕션) ──────────────
// file:// 대신 http://localhost:5174 서빙 → Firebase 도메인 인증(localhost) 통과
const FRONTEND_PORT = 5174
let frontendServer = null

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
}

function startFrontendServer(distPath) {
  return new Promise((resolve) => {
    frontendServer = http.createServer((req, res) => {
      let urlPath = req.url.split('?')[0]
      if (urlPath === '/' || !path.extname(urlPath)) {
        urlPath = '/index.html'
      }
      const filePath = path.join(distPath, urlPath)
      const ext = path.extname(filePath)
      fs.readFile(filePath, (err, data) => {
        if (err) {
          // SPA 폴백: 모든 경로를 index.html로
          fs.readFile(path.join(distPath, 'index.html'), (e2, html) => {
            if (e2) { res.writeHead(404); res.end('Not found'); return }
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
            res.end(html)
          })
        } else {
          res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] ?? 'application/octet-stream' })
          res.end(data)
        }
      })
    })
    frontendServer.listen(FRONTEND_PORT, '127.0.0.1', () => {
      console.log(`[Frontend] http://localhost:${FRONTEND_PORT} 서빙 시작`)
      resolve()
    })
    frontendServer.on('error', (err) => {
      console.warn('[Frontend] HTTP 서버 시작 실패, file:// 폴백:', err.message)
      resolve() // 실패해도 진행
    })
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
    testConn.setTimeout(500, () => {
      // destroy()가 'error' 이벤트를 발생시켜 launchBackend가 두 번 호출되는 레이스 방지
      testConn.removeAllListeners('error')
      testConn.destroy()
      launchBackend(backendPath, resolve)
    })
  })
}

function launchBackend(backendPath, done) {
  // 인-프로세스 모드 표시 — 백엔드가 process.exit() 호출하지 않도록
  process.env.OOMNI_IN_PROCESS = 'true'
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

  // Windows/Linux 기본 애플리케이션 메뉴 (File/Edit/View/Help) 제거
  Menu.setApplicationMenu(null)

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0F0F10',
    autoHideMenuBar: true,
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
  // 폴백: 10초 후에도 ready-to-show가 안오면 강제 표시
  setTimeout(() => { if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) mainWindow.show() }, 10000)

  // 렌더러 크래시 감지
  mainWindow.webContents.on('render-process-gone', (_, details) => {
    const { dialog } = require('electron')
    dialog.showErrorBox('OOMNI 렌더러 오류', `렌더러 프로세스 종료: ${details.reason}`)
  })
  mainWindow.webContents.on('did-fail-load', (_, errorCode, errorDesc) => {
    const { dialog } = require('electron')
    dialog.showErrorBox('OOMNI 로드 오류', `페이지 로드 실패: ${errorDesc} (${errorCode})`)
  })

  // 외부 링크는 기본 브라우저에서 열기
  // Firebase OAuth 팝업은 Electron 안에서 허용 (signInWithPopup 작동에 필요)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const isFirebaseAuth =
      url.includes('accounts.google.com') ||
      url.includes('firebaseapp.com/__/auth') ||
      url.includes('solo-factory-os.firebaseapp.com') ||
      url.includes('apis.google.com/o/oauth2')
    if (isFirebaseAuth) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 500,
          height: 650,
          webPreferences: {
            contextIsolation: false,     // window.opener.postMessage() 작동에 필요
            nodeIntegration: false,
            sandbox: false,
            webSecurity: false,          // Firebase opener.postMessage() 크로스오리진 허용
          },
        },
      }
    }
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    // http://localhost:5174 서빙 → Firebase authorized domain(localhost) 통과
    mainWindow.loadURL(`http://localhost:${FRONTEND_PORT}`)
  }

  if (isDev) mainWindow.webContents.openDevTools()
}

// ── electron-updater 설정 ────────────────────────────────
function setupAutoUpdater() {
  if (isDev || !autoUpdater) return // 개발 모드 또는 electron-updater 없으면 비활성화

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    console.log(`[Updater] 업데이트 발견: v${info.version}`)
    if (Notification.isSupported()) {
      new Notification({
        title: 'OOMNI 업데이트',
        body: `v${info.version} 업데이트가 있습니다. 다운로드 중...`,
        icon: path.join(__dirname, 'assets/icon.ico'),
      }).show()
    }
    mainWindow?.webContents.send('update-available', info)
  })

  autoUpdater.on('update-downloaded', (info) => {
    console.log(`[Updater] 다운로드 완료: v${info.version}`)
    if (Notification.isSupported()) {
      new Notification({
        title: 'OOMNI 업데이트 준비 완료',
        body: `v${info.version} 업데이트가 준비됐습니다. 앱 종료 시 자동 설치됩니다.`,
        icon: path.join(__dirname, 'assets/icon.ico'),
      }).show()
    }
    mainWindow?.webContents.send('update-downloaded', info)
  })

  autoUpdater.on('error', (err) => {
    console.error('[Updater] 업데이트 오류:', err.message)
  })

  // 앱 준비 후 업데이트 확인
  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    console.warn('[Updater] 업데이트 확인 실패 (네트워크 오류일 수 있음):', err.message)
  })
}

// ── 라이선스 검증 기초 구조 ──────────────────────────────
// OOMNI_DEV_MODE=true 시 라이선스 검증 우회
// role='admin' 사용자는 무제한 사용
// 향후 Toss Payments 연동 예정
async function checkLicense() {
  // 개발자 모드: 우회
  if (process.env.OOMNI_DEV_MODE === 'true') {
    console.log('[License] 개발자 모드 — 라이선스 검증 우회')
    return { valid: true, reason: 'dev_mode' }
  }

  try {
    // 백엔드 라이선스 상태 확인
    const result = await new Promise((resolve) => {
      http.get('http://localhost:3001/api/auth/license/status', (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          try { resolve(JSON.parse(data)) } catch { resolve({ valid: false }) }
        })
      }).on('error', () => resolve({ valid: false, reason: 'backend_unavailable' }))
    })
    return result
  } catch {
    return { valid: false, reason: 'check_failed' }
  }
}

// 未처리 예외/거부를 다이얼로그로 표시 (디버깅용)
process.on('uncaughtException', (err) => {
  const { dialog } = require('electron')
  console.error('[CRASH]', err)
  try {
    dialog.showErrorBox('OOMNI 오류', `오류가 발생했습니다:\n\n${err.message}\n\n${err.stack?.slice(0, 500) ?? ''}`)
  } catch {}
})
process.on('unhandledRejection', (reason) => {
  // 콘솔에만 로그 — Firebase SDK·HeartbeatScheduler 등의 내부 rejection으로 인한 다이얼로그 노이즈 방지
  console.error('[REJECTION]', reason)
})

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

    // 프론트엔드 HTTP 서버 시작 (Firebase localhost 도메인 인증 통과용)
    // asarUnpack된 경로: app.asar → app.asar.unpacked
    const distPath = path.join(__dirname, '../frontend/dist').replace('app.asar', 'app.asar.unpacked')
    await startFrontendServer(distPath)

    // 라이선스 확인 (비동기, 실패해도 앱 실행 차단 안 함)
    checkLicense().then((result) => {
      console.log('[License]', result)
    }).catch(() => {})

    // 자동 업데이트 초기화
    setupAutoUpdater()
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
  if (frontendServer) frontendServer.close()
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
    'https://www.antigravity.dev',
    'http://localhost:3001',
  ]
  if (allowed.some(a => url.startsWith(a))) {
    shell.openExternal(url)
  }
})

ipcMain.handle('get-app-version', () => app.getVersion())

// ── Google OAuth IPC 핸들러 ───────────────────────────────
ipcMain.handle('google-oauth-start', () => {
  return new Promise((resolve) => {
    const oauthWindow = new BrowserWindow({
      width: 500,
      height: 700,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: false },
      title: 'Google 로그인',
      autoHideMenuBar: true,
      parent: mainWindow,
      modal: false,
    })

    oauthWindow.loadURL('http://localhost:3001/api/auth/google')

    let callbackReached = false

    // did-navigate + did-redirect-navigation 모두 감지 (Google OAuth 리다이렉트 체인 대응)
    const onNavigate = (_event, url) => {
      if (!callbackReached && (url.includes('/api/auth/google/callback') || url.includes('google/callback'))) {
        callbackReached = true
        // 백엔드가 pendingGoogleToken 세팅할 시간 2초 확보 후 창 닫기
        setTimeout(() => { if (!oauthWindow.isDestroyed()) oauthWindow.close() }, 2000)
      }
    }

    oauthWindow.webContents.on('did-navigate', onNavigate)
    oauthWindow.webContents.on('did-redirect-navigation', onNavigate)

    // 창이 닫힐 때 (완료 or 사용자 수동 닫기) Promise 해결 → 프론트가 결과 확인 가능
    oauthWindow.on('closed', () => {
      resolve({ started: true, completed: callbackReached })
    })
  })
})

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
