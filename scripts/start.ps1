# Logging functions
function global:Write-CustomError {
    param([string]$message)
    Write-Host "❌ $message" -ForegroundColor Red
}

function global:Write-CustomSuccess {
    param([string]$message)
    Write-Host "✅ $message" -ForegroundColor Green
}

function global:Write-CustomInfo {
    param([string]$message)
    Write-Host "ℹ️ $message" -ForegroundColor Blue
}

function global:Write-CustomVerbose {
    param([string]$message)
    if ($VerbosePreference -eq "Continue") {
        Write-Host "🔍 $message" -ForegroundColor Yellow
    }
}

# Check if running as administrator
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-CustomError "Please run this script as Administrator!"
    Start-Process powershell.exe "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

# Check if WSL is installed
if (-not (Get-Command wsl -ErrorAction SilentlyContinue)) {
    Write-CustomInfo "Installing WSL 2..."
    wsl --install
    Write-CustomSuccess "WSL 2 installation initiated. Your computer needs to restart."
    Write-CustomInfo "Please run this script again after restart."
    Start-Sleep -Seconds 5
    Restart-Computer -Force
    exit
}

# Check if Ubuntu is installed
$ubuntuInstalled = wsl -l | Select-String "Ubuntu"
if (-not $ubuntuInstalled) {
    Write-CustomInfo "Installing Ubuntu on WSL..."
    wsl --install -d Ubuntu
    Write-CustomSuccess "Ubuntu installation complete"
}

# Check if git is installed in WSL
$gitInstalled = wsl bash -c "command -v git" 2>$null
if (-not $gitInstalled) {
    Write-CustomInfo "Installing git in WSL..."
    wsl bash -c "sudo apt-get update && sudo apt-get install -y git"
}

# Clone Eliza repository if not already present
if (-not (Test-Path "$HOME\eliza")) {
    Write-CustomInfo "Cloning Eliza repository..."
    wsl bash -c "cd ~ && git clone https://github.com/elizaos/eliza.git"
}

# Run the start script in WSL
Write-CustomInfo "Starting Eliza in WSL..."
wsl bash -c "cd ~/eliza && chmod +x scripts/start.sh && ./scripts/start.sh"

Write-CustomSuccess "Setup complete! Eliza is now running in WSL."
Write-CustomInfo "Open a new WSL terminal and run 'cd ~/eliza && pnpm start:client' to start the client." 