# Ensure script is running with admin privileges
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Warning "Please run this script as Administrator!"
    Start-Process powershell.exe "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

# Initial variables
$NVM_VERSION = "v0.39.1"
$NODE_VERSION = "23.3.0"
$SERVER_PID = $null
$CLIENT_PID = $null

# Logging functions
function Write-Error($message) {
    Write-Host "❌ $message" -ForegroundColor Red
}

function Write-Success($message) {
    Write-Host "✅ $message" -ForegroundColor Green
}

function Write-Info($message) {
    Write-Host "ℹ️ $message" -ForegroundColor Blue
}

function Write-Verbose($message) {
    if ($VerbosePreference -eq "Continue") {
        Write-Host "🔍 $message" -ForegroundColor Yellow
    }
}

# Install Chocolatey if not present
if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
    Write-Info "Installing Chocolatey..."
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))
    refreshenv
}

# Install dependencies using Chocolatey
function Install-Dependencies {
    Write-Verbose "Installing dependencies..."
    
    # Install required packages
    choco install -y git python3 ffmpeg make
    refreshenv
    
    Write-Success "Dependencies installed"
    
    if ($VerbosePreference -eq "Continue") {
        Write-Verbose "Installed versions:"
        git --version
        python --version
        ffmpeg -version | Select-Object -First 1
    }
}

# Install NVM for Windows
function Install-NVM {
    Write-Verbose "Installing NVM for Windows..."
    
    if (-not (Get-Command nvm -ErrorAction SilentlyContinue)) {
        choco install -y nvm
        refreshenv
    }
    
    Write-Success "NVM installed"
}

# Setup Node.js
function Setup-Node {
    Write-Verbose "Setting up Node.js..."
    
    nvm install $NODE_VERSION
    nvm use $NODE_VERSION
    
    # Install pnpm
    npm install -g pnpm
    
    Write-Success "Node.js and pnpm setup complete"
    
    if ($VerbosePreference -eq "Continue") {
        Write-Verbose "Node version: $(node -v)"
        Write-Verbose "NPM version: $(npm -v)"
        Write-Verbose "PNPM version: $(pnpm -v)"
    }
}

# Setup environment
function Setup-Environment {
    Write-Verbose "Setting up environment..."
    
    if (-not (Test-Path .env)) {
        if (-not (Test-Path .env.example)) {
            Write-Error "No .env.example file found"
            exit 1
        }
        Copy-Item .env.example .env
        Write-Success "Environment file created"
    } else {
        Write-Info "Environment file already exists"
    }
}

# Character selection and management functions
function Select-Character {
    if (-not (Test-Path "./characters")) {
        Write-Error "Characters directory not found"
        return $false
    }
    
    while ($true) {
        Write-Info "Select character(s):"
        Write-Info "(Use Space to select multiple, Enter to confirm)"
        
        $characters = Get-ChildItem "./characters" -Filter "*.character.json" | 
                     Select-Object -ExpandProperty Name | 
                     ForEach-Object { $_ -replace '\.character\.json$', '' }
        
        $options = @("Create New", "Use Existing")
        $choice = $options | Out-GridView -Title "Choose an option" -OutputMode Single
        
        switch ($choice) {
            "Create New" {
                $newName = Read-Host "Enter name for new character (without spaces)"
                if ([string]::IsNullOrWhiteSpace($newName)) {
                    Write-Error "No name provided"
                    continue
                }
                
                $newFile = "./characters/$newName.character.json"
                if (Test-Path $newFile) {
                    Write-Error "Character file already exists"
                    continue
                }
                
                # Create template file
                $template = Get-Content "characters/eliza.character.json" | ConvertFrom-Json
                $template.name = $newName
                $template | ConvertTo-Json -Depth 100 | Set-Content $newFile
                
                Write-Success "Created new character file. Opening for editing..."
                Start-Process notepad $newFile -Wait
                continue
            }
            "Use Existing" {
                do {
                    $selectedChars = $characters | Out-GridView -Title "Select character(s) - Selection required" -OutputMode Multiple
                    
                    if (-not $selectedChars) {
                        Write-Info "Please select at least one character"
                        Start-Sleep -Seconds 1  # Brief pause before showing dialog again
                        continue
                    }
                    
                    $charPaths = $selectedChars | ForEach-Object { "./characters/$_.character.json" }
                    $global:selected_character_path = $charPaths -join ','
                    Write-Success "Selected characters: $($selectedChars -join ', ')"
                    return $true
                    
                } while (-not $selectedChars)
            }
        }
    }
}

# Start Eliza
function Start-ElizaApp {
    Write-Info "Would you like to configure API secrets in .env?"
    $configureEnv = Read-Host "Edit .env file? (y/n)"
    if ($configureEnv -eq 'y') {
        if (-not (Test-Path ".env")) {
            Write-Error "No .env file found"
            return $false
        }
        Start-Process notepad .env -Wait
        Write-Success "Environment configuration updated"
    }
    
    if (-not (Select-Character)) {
        Write-Error "Failed to select character"
        return $false
    }
    
    Write-Info "Starting Eliza..."
    
    # Start server
    $serverProcess = Start-Process pnpm -ArgumentList "start --characters=`"$selected_character_path`"" -PassThru
    $global:SERVER_PID = $serverProcess.Id
    Start-Sleep -Seconds 2
    
    # Start client
    $clientProcess = Start-Process pnpm -ArgumentList "start:client" -PassThru
    $global:CLIENT_PID = $clientProcess.Id
    Start-Sleep -Seconds 3
    
    # Open in browser
    Start-Process "http://localhost:5173"
    
    Write-Success "Eliza is now running"
    Write-Info "Press Ctrl+C to stop Eliza"
    
    try {
        Wait-Process -Id $SERVER_PID
    } catch {
        # Cleanup on exit
        if ($SERVER_PID) { Stop-Process -Id $SERVER_PID -ErrorAction SilentlyContinue }
        if ($CLIENT_PID) { Stop-Process -Id $CLIENT_PID -ErrorAction SilentlyContinue }
    }
}

# Main execution
try {
    if ($VerbosePreference -eq "Continue") {
        Write-Verbose "Running in verbose mode"
    }
    
    Install-Dependencies
    Install-NVM
    Setup-Node
    Setup-Environment
    Start-ElizaApp
} catch {
    Write-Error "An error occurred: $_"
    exit 1
} finally {
    if ($SERVER_PID) { Stop-Process -Id $SERVER_PID -ErrorAction SilentlyContinue }
    if ($CLIENT_PID) { Stop-Process -Id $CLIENT_PID -ErrorAction SilentlyContinue }
} 