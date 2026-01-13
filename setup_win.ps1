$ErrorActionPreference = "Stop"

Write-Host "== Aethergrid Windows Setup (Repair Mode) =="

# Helper to check pip
function Test-Pip {
    param($PyPath)
    if (-not (Test-Path $PyPath)) { return $false }
    & $PyPath -m pip --version 2>&1 | Out-Null
    return $LASTEXITCODE -eq 0
}

# 1. Python Setup
if (Test-Path ".venv") {
    Write-Host "[1/4] Checking existing .venv..."
    if (-not (Test-Pip ".venv\Scripts\python.exe")) {
        Write-Host "Pip missing or broken. Attempting repair via ensurepip..."
        try {
            & .venv\Scripts\python.exe -m ensurepip --default-pip
        } catch {
            Write-Host "Repair failed/Error ignored. Will try to re-install pip explicitly or recreate."
        }
        
        # Check again
        if (-not (Test-Pip ".venv\Scripts\python.exe")) {
             Write-Host "Still broken. Deleting corrupted .venv and recreating..."
             Remove-Item -Recurse -Force ".venv"
        }
    } else {
        Write-Host "Virtual environment looks healthy."
    }
}

if (-not (Test-Path ".venv")) {
    Write-Host "[1/4] Creating virtual environment (.venv)..."
    python -m venv .venv
    # Immediate bootstrap check
    if (-not (Test-Pip ".venv\Scripts\python.exe")) {
        Write-Host "Fresh venv missing pip. Bootstrapping..."
        & .venv\Scripts\python.exe -m ensurepip --default-pip
    }
}

# 2. Install Python Deps
Write-Host "[2/4] Installing Python requirements..."
# Force upgrade pip module first
& .venv\Scripts\python.exe -m pip install --upgrade pip
& .venv\Scripts\python.exe -m pip install -r requirements.txt
& .venv\Scripts\python.exe -m pip install -e .

# 3. Install Frontend Deps
Write-Host "[3/4] Installing Frontend dependencies..."
if (Test-Path "frontend") {
    Set-Location frontend
    if (-not (Test-Path "node_modules")) {
        try {
            npm install
        } catch {
            Write-Warning "npm install failed. Check nodejs installation."
        }
    } else {
        Write-Host "node_modules exists. Skipping npm install."
    }
    Set-Location ..
}

Write-Host "Setup Verification Complete!"
