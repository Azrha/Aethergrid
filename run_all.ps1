param(
    [string]$Distro = "Ubuntu",
    [switch]$RestartWsl
)

$ErrorActionPreference = "Stop"

Write-Host "[INFO] Aethergrid WSL Fix + Launch" -ForegroundColor Cyan

$wslConfig = "[wsl2]`nlocalhostForwarding=true`n"
Set-Content -Path "$env:USERPROFILE\.wslconfig" -Value $wslConfig -Encoding ASCII

if ($RestartWsl) {
    Write-Host "[INFO] Restarting WSL..." -ForegroundColor Yellow
    wsl --shutdown
    Start-Sleep -Seconds 2
} else {
    Write-Host "[INFO] Skipping WSL restart to avoid closing terminals." -ForegroundColor Yellow
}

$env:AETHER_WSL_DISTRO = $Distro
Write-Host "[INFO] Using WSL distro: $Distro" -ForegroundColor Green

& "$PSScriptRoot\run_desktop.ps1"
