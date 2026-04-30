$LOG = "C:\Users\장우경\oomni\build-release.log"
$ErrorActionPreference = "Continue"

function Log($msg) {
  $ts = (Get-Date).ToString("HH:mm:ss")
  "$ts $msg" | Tee-Object -FilePath $LOG -Append
}

Set-Location "C:\Users\장우경\oomni"
Log "=== OOMNI v4.0.1 빌드 시작 ==="

# 1. Frontend build
Log "[1/6] Frontend Vite 빌드..."
$r = & cmd /c "cd /d C:\Users\장우경\oomni\frontend && npm run build 2>&1"
$r | Out-File $LOG -Append
if ($LASTEXITCODE -ne 0) { Log "ERROR: frontend 빌드 실패 (exit $LASTEXITCODE)" } else { Log "OK: frontend 빌드 완료" }

# 2. Backend build
Log "[2/6] Backend tsc 빌드..."
$r = & cmd /c "cd /d C:\Users\장우경\oomni\backend && npm run build 2>&1"
$r | Out-File $LOG -Append
if ($LASTEXITCODE -ne 0) { Log "ERROR: backend 빌드 실패 (exit $LASTEXITCODE)" } else { Log "OK: backend 빌드 완료" }

# 3. Rebuild native modules
Log "[3/6] Native 모듈 리빌드 (better-sqlite3)..."
$r = & cmd /c "cd /d C:\Users\장우경\oomni && npm run rebuild-native 2>&1"
$r | Out-File $LOG -Append
if ($LASTEXITCODE -ne 0) { Log "WARN: rebuild-native 실패 — 계속 진행" } else { Log "OK: native 리빌드 완료" }

# 4. Electron builder
Log "[4/6] electron-builder 패키징..."
$r = & cmd /c "cd /d C:\Users\장우경\oomni && npx electron-builder 2>&1"
$r | Out-File $LOG -Append
if ($LASTEXITCODE -ne 0) { Log "ERROR: electron-builder 실패 (exit $LASTEXITCODE)" } else { Log "OK: 패키징 완료" }

# 5. Git commit & push
Log "[5/6] Git 커밋 & 푸시..."
& git -C "C:\Users\장우경\oomni" add -A 2>&1 | Out-File $LOG -Append
& git -C "C:\Users\장우경\oomni" commit -m "feat: v4.0.1 — Design Bot gallery, 기술부채 제거, 코드 단순화" 2>&1 | Out-File $LOG -Append
$r = & git -C "C:\Users\장우경\oomni" push origin master 2>&1
$r | Out-File $LOG -Append
if ($LASTEXITCODE -ne 0) { Log "ERROR: git push 실패" } else { Log "OK: git push 완료" }

# 6. GitHub Release
Log "[6/6] GitHub Release v4.0.1 생성..."
$exePath = Get-ChildItem "C:\Users\장우경\oomni\dist-app" -Filter "*.exe" | Select-Object -First 1 -ExpandProperty FullName
if ($exePath) {
  $r = & gh release create v4.0.1 "$exePath" `
    --title "OOMNI v4.0.1" `
    --notes "## v4.0.1 변경사항`n- Design Bot 갤러리 (저장된 디자인 재로드)`n- ShortformVideoPanel 제거 (기술부채)`n- videoApi/cdpApi 스텁 제거`n- Agent 역할 타입 정리`n- 코드 단순화" 2>&1
  $r | Out-File $LOG -Append
  if ($LASTEXITCODE -ne 0) { Log "ERROR: GitHub Release 실패" } else { Log "OK: GitHub Release v4.0.1 완료" }
} else {
  Log "WARN: dist-app에서 .exe 파일을 찾지 못함 — Release 건너뜀"
}

Log "=== 완료 ==="
