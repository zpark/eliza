# Check if running as administrator
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "❌ Please run this script as Administrator!" -ForegroundColor Red
    Start-Process powershell.exe "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

# Check if WSL is installed
if (-not (Get-Command wsl -ErrorAction SilentlyContinue)) {
    Write-Host "ℹ️ Installing WSL 2..." -ForegroundColor Blue
    wsl --install
    Write-Host "✅ WSL 2 installation initiated. Your computer needs to restart." -ForegroundColor Green
    Write-Host "ℹ️ Please run this script again after restart." -ForegroundColor Blue
    Start-Sleep -Seconds 5
    Restart-Computer -Force
    exit
}

# Check if Ubuntu is installed
$ubuntuInstalled = wsl -l | Select-String "Ubuntu"
if (-not $ubuntuInstalled) {
    Write-Host "ℹ️ Installing Ubuntu on WSL..." -ForegroundColor Blue
    wsl --install -d Ubuntu
    Write-Host "✅ Ubuntu installation complete" -ForegroundColor Green
}

# Check if git is installed in WSL
$gitInstalled = wsl bash -c "command -v git" 2>$null
if (-not $gitInstalled) {
    Write-Host "ℹ️ Installing git in WSL..." -ForegroundColor Blue
    wsl bash -c "sudo apt-get update && sudo apt-get install -y git"
}

# Clone Eliza repository if not already present
if (-not (Test-Path "$HOME\eliza")) {
    Write-Host "ℹ️ Cloning Eliza repository..." -ForegroundColor Blue
    wsl bash -c "cd ~ && git clone https://github.com/elizaos/eliza.git"
}

# Run the start script in WSL
Write-Host "ℹ️ Starting Eliza in WSL..." -ForegroundColor Blue
wsl bash -c "cd ~/eliza && chmod +x scripts/start.sh && ./scripts/start.sh"

Write-Host "✅ Setup complete! Eliza is now running in WSL." -ForegroundColor Green
Write-Host "ℹ️ Open a new WSL terminal and run 'cd ~/eliza && pnpm start:client' to start the client." -ForegroundColor Blue 