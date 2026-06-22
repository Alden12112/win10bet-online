@echo off
title Win10bet Server
setlocal EnableExtensions

set "ADMIN_USER=win10bet-admin"
set "ADMIN_PASSWORD=W10b@Admin-728419"
set "PORT=4180"
set "NODE=C:\Users\alden\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
set "ROOT=%~dp0"
set "LOG=%~dp0win10bet-server.log"

echo.
echo ==========================================
echo   Win10bet API Server
echo ==========================================
echo.
echo Front: http://127.0.0.1:%PORT%/win10bet.html
echo Admin: http://127.0.0.1:%PORT%/admin.html
echo Admin user: %ADMIN_USER%
echo Admin password: %ADMIN_PASSWORD%
echo.

cd /d "%ROOT%" 2>nul
if errorlevel 1 (
  echo [ERROR] Project folder not found: %ROOT%
  pause
  exit /b 1
)

if not exist "win10bet-server.js" (
  echo [ERROR] Missing win10bet-server.js
  pause
  exit /b 1
)

if not exist "%NODE%" (
  echo [INFO] Bundled Node was not found. Trying system node...
  set "NODE=node"
)

if /I "%NODE%"=="node" (
  where node >nul 2>nul
  if errorlevel 1 (
    echo [ERROR] Node.js was not found.
    echo Install Node.js or edit NODE path in this bat file.
    pause
    exit /b 1
  )
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue; if($p){exit 0}else{exit 1}" >nul 2>nul
if not errorlevel 1 (
  echo [OK] Server is already running.
  echo.
  echo Open:
  echo http://127.0.0.1:%PORT%/win10bet.html
  echo http://127.0.0.1:%PORT%/admin.html
  echo.
  pause
  exit /b 0
)

echo Starting server...
echo Log file: %LOG%
echo.
echo Keep this window open. If you close it, the server stops.
echo.

"%NODE%" win10bet-server.js 1>>"%LOG%" 2>>&1

echo.
echo [STOPPED] Server stopped or failed to start.
echo Send me this log if there is an error:
echo ------------------------------------------
type "%LOG%"
echo ------------------------------------------
pause
