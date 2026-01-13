# run_stack.ps1 - Native Windows Launch

Write-Host "[INFO] AETHERGRID WINDOWS LAUNCHER" -ForegroundColor Cyan

# 1. Check/Install Dependencies
Write-Host "[INFO] Checking Python Dependencies..." -ForegroundColor Yellow
if (Test-Path ".venv\Scripts\python.exe") {
    Write-Host "[INFO] Installing core requirements..."
    & .venv\Scripts\python.exe -m pip install -r requirements.txt
    
    Write-Host "[INFO] Installing GPU Acceleration (CuPy)..."
    & .venv\Scripts\python.exe -m pip install cupy-cuda12x
}
else {
    Write-Host "[ERROR] Virtual environment not found at .venv\Scripts\python.exe" -ForegroundColor Red
    Write-Host "Please create it: python -m venv .venv"
    exit 1
}

# 2. Set Env & Launch Backend
$env:CUPY_ACCELERATORS = "cuda"
Write-Host "[INFO] Starting Backend (0.0.0.0:8000)..." -ForegroundColor Green
Start-Process -FilePath ".venv\Scripts\python.exe" -ArgumentList "-m uvicorn server.main:app --host 0.0.0.0 --port 8000 --ws-ping-interval 60 --ws-ping-timeout 60" -NoNewWindow

# 3. Launch Frontend
Write-Host "[INFO] Starting Frontend..." -ForegroundColor Green
Set-Location frontend
npm run dev -- --host
