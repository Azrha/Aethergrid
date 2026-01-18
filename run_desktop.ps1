param(
    [string]$Distro = $env:AETHER_WSL_DISTRO
)

$ErrorActionPreference = "Stop"

Write-Host "[INFO] Aethergrid WSL + Electron Launcher" -ForegroundColor Cyan

$repoRoot = $PSScriptRoot
if (-not $repoRoot) {
    Write-Host "[ERROR] Could not resolve repo root. Run this script from the repo folder." -ForegroundColor Red
    exit 1
}

# Pick a WSL distro (prefer a running one)
if (-not $Distro) {
    $list = wsl.exe -l -v 2>$null
    $running = $list | Select-String -Pattern "Running" | ForEach-Object {
        ($_ -split "\s{2,}")[0].Trim()
    } | Where-Object { $_ -and $_ -ne "NAME" }
    if ($running -and $running.Count -gt 0) {
        $Distro = $running[0]
    } else {
        $Distro = "Ubuntu"
    }
}

# Convert Windows path -> WSL path for backend/frontend
$wslRepo = (wsl.exe -d $Distro -e wslpath -a "$repoRoot" 2>$null).Trim()
$wslRepo = $wslRepo -replace "`r|`n", ""
$wslRepo = $wslRepo.Trim()
if (-not $wslRepo) {
    Write-Host "[ERROR] Failed to resolve WSL path for repo via distro '$Distro'." -ForegroundColor Red
    Write-Host "Set an explicit distro with: `$env:AETHER_WSL_DISTRO='Ubuntu'" -ForegroundColor Yellow
    exit 1
}

function Invoke-Wsl {
    param([string]$Cmd)
    wsl.exe -d $Distro -e bash -lc $Cmd | Out-Null
}

Write-Host "[INFO] Stopping existing dev servers (WSL)..." -ForegroundColor Yellow
$cleanupCmd = @"
cd "$wslRepo"
if command -v fuser >/dev/null 2>&1; then
  fuser -k 8000/tcp 5173/tcp || true
fi
pkill -f "uvicorn server.main:app" || true
pkill -f "vite" || true
"@
Invoke-Wsl $cleanupCmd

Write-Host "[INFO] Resolving WSL IP..." -ForegroundColor Yellow
$wslIp = (wsl.exe -d $Distro -e python3 "$wslRepo/tools/wsl_ip.py" 2>$null).Trim()
if (-not $wslIp) { $wslIp = "127.0.0.1" }

function Test-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($id)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

Write-Host "[INFO] Starting backend + frontend in WSL..." -ForegroundColor Green
$logOut = Join-Path $repoRoot "wsl_stack.out.log"
$logErr = Join-Path $repoRoot "wsl_stack.err.log"
if (Test-Path $logOut) { Remove-Item $logOut -Force }
if (Test-Path $logErr) { Remove-Item $logErr -Force }
$prepCmd = "cd '$wslRepo' && chmod +x ./run_stack.sh ./run_stack_detached.sh"
Invoke-Wsl $prepCmd
$apiHost = "127.0.0.1:18000"
$wslCmd = "cd '$wslRepo' && ./run_stack_detached.sh '$wslIp' '$apiHost'"
Invoke-Wsl $wslCmd

function Test-Port {
    param([string]$TargetHost, [int]$Port, [int]$TimeoutMs = 1500)
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $result = $client.BeginConnect($TargetHost, $Port, $null, $null)
        $success = $result.AsyncWaitHandle.WaitOne($TimeoutMs, $false)
        if ($success -and $client.Connected) {
            $client.Close()
            return $true
        }
        $client.Close()
        return $false
    } catch {
        return $false
    }
}

function Stop-PortProcess {
    param([int]$Port)
    try {
        $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
        foreach ($conn in $connections) {
            if ($conn.OwningProcess) {
                Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
            }
        }
    } catch {
        # Ignore failures on older Windows builds or insufficient permissions.
    }
}

function Stop-WinProxy {
    try {
        Get-CimInstance Win32_Process | Where-Object {
            $_.Name -eq "node.exe" -and $_.CommandLine -match "win_proxy.cjs"
        } | ForEach-Object {
            Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        }
    } catch {
        # Ignore failures; port cleanup below should still handle most cases.
    }
    Stop-PortProcess -Port 15173
    Stop-PortProcess -Port 18000
}

Write-Host "[INFO] Starting local Windows proxy (127.0.0.1:15173 -> WSL:5173, 127.0.0.1:18000 -> WSL:8000)..." -ForegroundColor Yellow
$null = Stop-WinProxy
$proxyScript = Join-Path $repoRoot "tools/win_proxy.cjs"
$proxyOut = Join-Path $repoRoot "win_proxy.out.log"
$proxyErr = Join-Path $repoRoot "win_proxy.err.log"
if (Test-Path $proxyOut) { Remove-Item $proxyOut -Force }
if (Test-Path $proxyErr) { Remove-Item $proxyErr -Force }
if (Get-Command node -ErrorAction SilentlyContinue) {
    Start-Process -FilePath "node" `
        -ArgumentList $proxyScript, $wslIp, "15173", "18000" `
        -RedirectStandardOutput $proxyOut `
        -RedirectStandardError $proxyErr `
        -WindowStyle Hidden | Out-Null
} else {
    "node not found on PATH" | Out-File $proxyErr -Encoding ascii
}

function Test-Http {
    param([string]$Url, [int]$TimeoutSec = 2)
    try {
        $handler = New-Object System.Net.Http.HttpClientHandler
        $client = New-Object System.Net.Http.HttpClient($handler)
        $client.Timeout = [TimeSpan]::FromSeconds($TimeoutSec)
        $resp = $client.GetAsync($Url).GetAwaiter().GetResult()
        return $resp.IsSuccessStatusCode
    } catch {
        return $false
    }
}

Write-Host "[INFO] Waiting briefly for frontend (http://127.0.0.1:15173)..." -ForegroundColor Yellow
$ready = $false
for ($i = 0; $i -lt 10; $i++) {
    if (Test-Http "http://127.0.0.1:15173" 1) { $ready = $true; break }
    Start-Sleep -Seconds 1
}
if (-not $ready) {
    Write-Host "[WARN] Frontend did not respond yet. Electron will still attempt to load." -ForegroundColor Yellow
    if (Test-Path $proxyOut) {
        Write-Host "[INFO] Proxy output:" -ForegroundColor Yellow
        Get-Content $proxyOut -Tail 40
    }
    if (Test-Path $proxyErr) {
        Write-Host "[INFO] Proxy errors:" -ForegroundColor Yellow
        Get-Content $proxyErr -Tail 40
    }
    if (Test-Path $logOut) {
        Write-Host "[INFO] Recent WSL output:" -ForegroundColor Yellow
        Get-Content $logOut -Tail 40
    }
    if (Test-Path $logErr) {
        Write-Host "[INFO] Recent WSL errors:" -ForegroundColor Yellow
        Get-Content $logErr -Tail 40
    } else {
        Write-Host "[WARN] No WSL logs found at $logOut / $logErr" -ForegroundColor Yellow
    }
}

Write-Host "[INFO] Starting Electron shell..." -ForegroundColor Green
Set-Location (Join-Path $repoRoot "desktop")
if (-not (Test-Path "node_modules")) {
    Write-Host "[INFO] Installing Electron dependencies..." -ForegroundColor Yellow
    npm install
}
$env:ELECTRON_START_URL = "http://127.0.0.1:15173"
Write-Host "[INFO] Electron URL: $env:ELECTRON_START_URL" -ForegroundColor Yellow
npm run dev
