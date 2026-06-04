@echo off
REM One-command launcher for the IMM Predictive Maintenance demo (Windows).
REM
REM   demo.bat              serve locally at http://localhost:%PORT% (default 8000)
REM   demo.bat --tunnel     also expose a temporary public Cloudflare URL
REM   set PORT=9000 ^&^& demo.bat   pick the local port
REM
REM Idempotent: first-run setup only happens when pieces are missing.
setlocal enableextensions
cd /d "%~dp0"

set "VENV=.venv"
set "PY=%VENV%\Scripts\python.exe"
if "%PORT%"=="" set "PORT=8000"
set "TUNNEL=0"
if /i "%~1"=="--tunnel" set "TUNNEL=1"

echo ==^> IMM Predictive Maintenance - demo launcher

REM 1. Python virtualenv + dependencies
if not exist "%PY%" (
  echo ==^> Creating virtualenv and installing dependencies ^(first run^)...
  python -m venv "%VENV%"
  "%VENV%\Scripts\python.exe" -m pip install --upgrade pip
  "%VENV%\Scripts\python.exe" -m pip install -e .
) else (
  echo ==^> Virtualenv present.
)

REM 2. Trained models
set "NEED_TRAIN="
if not exist "artifacts\models\quality.pkl" set "NEED_TRAIN=1"
if not exist "artifacts\models\rul.pkl" set "NEED_TRAIN=1"
if defined NEED_TRAIN (
  echo ==^> Training models ^(first run, a few minutes^)...
  "%PY%" scripts\generate_training_data.py
  "%PY%" scripts\retrain_models.py
) else (
  echo ==^> Models present.
)

REM 3. Platform frontend build (workbench\dist; run.py serves it by default)
if not exist "workbench\dist\index.html" (
  echo ==^> Building the Digital Twin Platform frontend ^(first run^)...
  where npm >nul 2>nul
  if errorlevel 1 (
    echo ERROR: npm is required to build the frontend. Install Node.js, then re-run demo.bat
    exit /b 1
  )
  pushd workbench
  call npm install
  call npm run build
  popd
) else (
  echo ==^> Platform build present.
)

REM 4. Serve
if "%TUNNEL%"=="1" (
  set "CFD=cloudflared"
  where cloudflared >nul 2>nul
  if errorlevel 1 (
    set "CFD=bin\cloudflared.exe"
    if not exist "bin\cloudflared.exe" (
      echo ==^> Downloading cloudflared ^(first run^)...
      if not exist "bin" mkdir bin
      curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -o "bin\cloudflared.exe"
    )
  )
  echo ==^> Starting server on :%PORT% in a new window...
  start "IMM server" /min "%PY%" run.py
  echo ==^> Opening Cloudflare quick tunnel ^(temporary public URL prints below^)...
  echo     Press Ctrl-C to stop the tunnel; then close the server window.
  REM --protocol http2 tunnels over TCP/443 instead of QUIC/UDP ^(often firewalled^).
  "%CFD%" tunnel --no-autoupdate --protocol http2 --url "http://localhost:%PORT%"
) else (
  echo.
  echo ==^> Starting server.  Open:  http://localhost:%PORT%
  echo     Press Ctrl-C to stop.
  echo.
  "%PY%" run.py
)
endlocal
