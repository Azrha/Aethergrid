$ErrorActionPreference = "Stop"

# Force UTF-8 for console output to avoid encoding grief
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "=== Antigravity WSL Fixer v2 ===" -ForegroundColor Cyan

# 1. Get raw list
Write-Host "Detecting WSL distributions..."
# wsl --list --quiet uses UCS-2 LE BOM. PowerShell usually handles it, but artifacts can remain.
$raw_output = wsl.exe --list --quiet

# Split and clean
# We match only non-empty lines.
$candidates = $raw_output -split "`r`n" | Where-Object { $_.Trim().Length -gt 0 }

if ($candidates.Count -eq 0) {
    Write-Host "No WSL distributions found. Please install one (e.g. 'wsl --install')." -ForegroundColor Red
    exit 1
}

# 2. Heuristic selection
# Clean up names first
$clean_candidates = $candidates | ForEach-Object { $_.Trim() -replace '\p{C}+', '' }

# Prioritize 'Ubuntu' (plain) as requested by user
if ($clean_candidates -contains "Ubuntu") {
    $distro = "Ubuntu"
}
elseif ($clean_candidates -contains "Ubuntu-22.04") {
    $distro = "Ubuntu-22.04"
}
else {
    $distro = $clean_candidates[0]
}

Write-Host "Detected Distro: '$distro'"

# 3. Validation
Write-Host "Validating connection to '$distro'..."
try {
    wsl.exe -d $distro true
    Write-Host "Connection OK." -ForegroundColor Green
}
catch {
    Write-Host "Could not connect to '$distro'. Trying default 'wsl' command..." -ForegroundColor Yellow
    # Change strategy: Don't specify -d, just use default
    $distro = ""
    try {
        wsl.exe true
        Write-Host "Default WSL connection OK." -ForegroundColor Green
    }
    catch {
        Write-Host "FATAL: Cannot run 'wsl.exe'. Please check your WSL installation." -ForegroundColor Red
        exit 1
    }
}

# 4. Construct scripts
# We use the discovered distro (or empty for default) to run commands.
function Run-WslCommand {
    param([string]$Cmd)
    if ($distro) {
        wsl.exe -d $distro bash -c $Cmd
    }
    else {
        wsl.exe bash -c $Cmd
    }
}

Write-Host "Setting up profile..."

# Use single-line command with printf to avoid CRLF/heredoc issues in Windows -> Linux handoff
$profileScript = 'mkdir -p ~/sh.bin; printf "# Non-interactive profile\nexport PATH=$PATH:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin\n" > ~/sh.bin/profile.sh; chmod +x ~/sh.bin/profile.sh'

Run-WslCommand $profileScript

Write-Host "Checking ~/.bashrc..."
$checkCmd = "grep -q 'ANTIGRAVITY_AGENT' ~/.bashrc"

# We must check exit code manually after execution because $ErrorActionPreference stops on PS errors, not external command non-zero exits usually
if ($distro) {
    wsl.exe -d $distro bash -c $checkCmd
}
else {
    wsl.exe bash -c $checkCmd
}
$grepExit = $LASTEXITCODE

if ($grepExit -ne 0) {
    Write-Host "Applying patch..."
    $fixContent = @'

# ANTIGRAVITY FIX START
if [[ -n "$ANTIGRAVITY_AGENT" ]]; then
    export PS1="$ "
    unset PROMPT_COMMAND
    if [ -f ~/sh.bin/profile.sh ]; then
        source ~/sh.bin/profile.sh
    fi
    return
fi
# ANTIGRAVITY FIX END
'@
    # Base64 encode to avoid escaping hell
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($fixContent)
    $b64 = [Convert]::ToBase64String($bytes)
    
    $applyCmd = "echo '$b64' | base64 -d >> ~/.bashrc"
    Run-WslCommand $applyCmd
    
    Write-Host "Patch applied!" -ForegroundColor Green
}
else {
    Write-Host "Patch already present." -ForegroundColor Yellow
}

Write-Host "`nSUCCESS. Please Restart VS Code / Reload Window now." -ForegroundColor Cyan

