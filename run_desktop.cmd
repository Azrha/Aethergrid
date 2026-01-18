@echo off
setlocal enabledelayedexpansion

echo [INFO] Aethergrid WSL + Electron Launcher (CMD)

for %%I in ("%~dp0.") do set "repoRoot=%%~fI"

set "Distro=%AETHER_WSL_DISTRO%"
if "%Distro%"=="" set "Distro=Ubuntu"

for /f "usebackq delims=" %%I in (`wsl.exe -d %Distro% -e wslpath -a "%repoRoot%" 2^>nul`) do set "wslRepo=%%I"
if "%wslRepo%"=="" (
  echo [ERROR] Failed to resolve WSL path for repo via distro "%Distro%".
  echo Set AETHER_WSL_DISTRO to a valid distro name.
  exit /b 1
)

for /f "usebackq delims=" %%I in (`wsl.exe -d %Distro% -e python3 "%wslRepo%/tools/wsl_ip.py" 2^>nul`) do set "wslIp=%%I"
if "%wslIp%"=="" set "wslIp=127.0.0.1"

echo [INFO] Stopping existing dev servers (WSL)...
wsl.exe -d %Distro% -e bash -lc "cd '%wslRepo%' && if command -v fuser >/dev/null 2>&1; then fuser -k 8000/tcp 5173/tcp || true; fi; pkill -f 'uvicorn server.main:app' || true; pkill -f 'vite' || true" >nul 2>&1

echo [INFO] Starting backend + frontend in WSL...
wsl.exe -d %Distro% -e bash -lc "cd '%wslRepo%' && chmod +x ./run_stack.sh ./run_stack_detached.sh && ./run_stack_detached.sh '%wslIp%' '127.0.0.1:18000'" >nul 2>&1

rem Clean up any previous Windows proxies on required ports.
for /f "tokens=5" %%p in ('netstat -aon ^| findstr /R /C:":15173 " ^| findstr /R /C:"LISTENING"') do taskkill /F /PID %%p >nul 2>&1
for /f "tokens=5" %%p in ('netstat -aon ^| findstr /R /C:":18000 " ^| findstr /R /C:"LISTENING"') do taskkill /F /PID %%p >nul 2>&1

echo [INFO] Starting local Windows proxy (127.0.0.1:15173 -> WSL:5173, 127.0.0.1:18000 -> WSL:8000)...
if exist "%repoRoot%\win_proxy.out.log" del /f /q "%repoRoot%\win_proxy.out.log"
if exist "%repoRoot%\win_proxy.err.log" del /f /q "%repoRoot%\win_proxy.err.log"
if exist "%repoRoot%\win_proxy.log" del /f /q "%repoRoot%\win_proxy.log"

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] node.exe not found on PATH.
  exit /b 1
)

start "Aethergrid Proxy" /B node "%repoRoot%\tools\win_proxy.cjs" %wslIp% 15173 18000 > "%repoRoot%\win_proxy.out.log" 2> "%repoRoot%\win_proxy.err.log"

timeout /t 2 /nobreak >nul

set "ELECTRON_START_URL=http://127.0.0.1:15173"
if not exist "%repoRoot%\desktop\package.json" (
  echo [ERROR] Missing desktop package.json at "%repoRoot%\desktop\package.json".
  exit /b 1
)
pushd "%repoRoot%\desktop"
if not exist node_modules (
  echo [INFO] Installing Electron dependencies...
  call npm install
)

echo [INFO] Electron URL: %ELECTRON_START_URL%
call npm run dev
popd
