$ROOT = $PSScriptRoot
$LOG  = Join-Path $ROOT "build-release.log"
$ErrorActionPreference = "Continue"

function Log($msg) {
  $ts = (Get-Date).ToString("HH:mm:ss")
  "$ts $msg" | Tee-Object -FilePath $LOG -Append
}

Set-Location $ROOT
Log "=== OOMNI v4.2.0 build start ==="

# 1. Frontend build
Log "[1/6] Frontend Vite build..."
$r = & cmd /c "cd /d `"$ROOT\frontend`" && npm run build 2>&1"
$r | Out-File $LOG -Append
if ($LASTEXITCODE -ne 0) { Log "ERROR: frontend build failed (exit $LASTEXITCODE)" } else { Log "OK: frontend build done" }

# 2. Backend build
Log "[2/6] Backend tsc build..."
$r = & cmd /c "cd /d `"$ROOT\backend`" && npm run build 2>&1"
$r | Out-File $LOG -Append
if ($LASTEXITCODE -ne 0) { Log "ERROR: backend build failed (exit $LASTEXITCODE)" } else { Log "OK: backend build done" }

# 3. Rebuild native modules
Log "[3/6] Native rebuild (better-sqlite3)..."
$r = & cmd /c "cd /d `"$ROOT`" && npm run rebuild-native 2>&1"
$r | Out-File $LOG -Append
if ($LASTEXITCODE -ne 0) { Log "WARN: rebuild-native failed - continuing" } else { Log "OK: native rebuild done" }

# 4. Electron builder
Log "[4/6] electron-builder packaging..."
$r = & cmd /c "cd /d `"$ROOT`" && npx electron-builder 2>&1"
$r | Out-File $LOG -Append
if ($LASTEXITCODE -ne 0) { Log "ERROR: electron-builder failed (exit $LASTEXITCODE)" } else { Log "OK: packaging done" }

# 5. Git commit & push
Log "[5/6] Git commit & push..."
& git -C $ROOT add -A 2>&1 | Out-File $LOG -Append
& git -C $ROOT commit -m "feat: v4.2.0 - Build Bot 4-Track Harness (Architecture/Bootstrap/Review/Security) + Security Gate auto-scan" 2>&1 | Out-File $LOG -Append
$r = & git -C $ROOT push origin master 2>&1
$r | Out-File $LOG -Append
if ($LASTEXITCODE -ne 0) { Log "ERROR: git push failed" } else { Log "OK: git push done" }

# 6. GitHub Release
Log "[6/6] GitHub Release v4.2.0..."
$distDir = Join-Path $ROOT "dist-app"
$exePath = Get-ChildItem $distDir -Filter "*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
if ($exePath) {
  $notes = "v4.2.0: Build Bot Harness — 4-Track (Architecture/Bootstrap/Review/Security) + Security Gate auto-scan on every build. CRITICAL 보안 이슈 자동 차단."
  $r = & gh release create v4.2.0 "$exePath" --title "OOMNI v4.2.0" --notes $notes 2>&1
  $r | Out-File $LOG -Append
  if ($LASTEXITCODE -ne 0) { Log "ERROR: GitHub Release failed" } else { Log "OK: GitHub Release v4.2.0 done" }
} else {
  Log "WARN: no .exe in dist-app - skipping release"
}

Log "=== done ==="
