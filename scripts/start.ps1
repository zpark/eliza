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
function Write-CustomError {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        [string]$message
    )
    Write-Host "❌ $message" -ForegroundColor Red
}

function Write-CustomSuccess {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        [string]$message
    )
    Write-Host "✅ $message" -ForegroundColor Green
}

function Write-CustomInfo {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        [string]$message
    )
    Write-Host "ℹ️ $message" -ForegroundColor Blue
}

function Write-CustomVerbose {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        [string]$message
    )
    if ($VerbosePreference -eq "Continue") {
        Write-Host "🔍 $message" -ForegroundColor Yellow
    }
}

# Install Chocolatey if not present
if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
    Write-CustomInfo "Installing Chocolatey..."
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

# Install dependencies using Chocolatey
function Install-Dependencies {
    Write-CustomVerbose "Installing dependencies..."
    
    # Install required packages
    choco install -y git python3 ffmpeg make
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    
    Write-CustomSuccess "Dependencies installed"
    
    if ($VerbosePreference -eq "Continue") {
        Write-CustomVerbose "Installed versions:"
        git --version
        python --version
        ffmpeg -version | Select-Object -First 1
    }
}

# Install NVM for Windows
function Install-NVM {
    Write-CustomVerbose "Installing NVM for Windows..."
    
    if (-not (Get-Command nvm -ErrorAction SilentlyContinue)) {
        choco install -y nvm.portable
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    }
    
    Write-CustomSuccess "NVM installed"
}

# Setup Node.js
function Setup-Node {
    Write-CustomVerbose "Setting up Node.js..."
    
    # Ensure NVM is loaded
    $env:NVM_HOME = "$env:ProgramFiles\nvm"
    $env:NVM_SYMLINK = "$env:ProgramFiles\nodejs"
    
    # Install and use Node version
    nvm install $NODE_VERSION
    nvm use $NODE_VERSION
    
    # Install pnpm
    npm install -g pnpm
    
    Write-CustomSuccess "Node.js and pnpm setup complete"
    
    if ($VerbosePreference -eq "Continue") {
        Write-CustomVerbose "Node version: $(node -v)"
        Write-CustomVerbose "NPM version: $(npm -v)"
        Write-CustomVerbose "PNPM version: $(pnpm -v)"
    }
}

# Setup environment
function Setup-Environment {
    Write-CustomVerbose "Setting up environment..."
    
    if (-not (Test-Path .env)) {
        if (-not (Test-Path .env.example)) {
            Write-CustomError "No .env.example file found"
            exit 1
        }
        Copy-Item .env.example .env
        Write-CustomSuccess "Environment file created"
    } else {
        Write-CustomInfo "Environment file already exists"
    }
}

# Character selection and management functions
function Select-Character {
    if (-not (Test-Path "./characters")) {
        Write-CustomError "Characters directory not found"
        return $false
    }
    
    while ($true) {
        Write-CustomInfo "Select character(s):"
        Write-CustomInfo "(Use Space to select multiple, Enter to confirm)"
        
        $characters = Get-ChildItem "./characters" -Filter "*.character.json" | 
                     Select-Object -ExpandProperty Name | 
                     ForEach-Object { $_ -replace '\.character\.json$', '' }
        
        if (-not $characters) {
            Write-CustomError "No character files found"
            return $false
        }
        
        $options = @("Create New", "Use Existing")
        $choice = $options | Out-GridView -Title "Choose an option" -OutputMode Single
        
        if (-not $choice) {
            Write-CustomInfo "Operation cancelled"
            return $false
        }
        
        switch ($choice) {
            "Create New" {
                $newName = Read-Host "Enter name for new character (without spaces)"
                if ([string]::IsNullOrWhiteSpace($newName)) {
                    Write-CustomError "No name provided"
                    continue
                }
                
                $newFile = "./characters/$newName.character.json"
                if (Test-Path $newFile) {
                    Write-CustomError "Character file already exists"
                    continue
                }
                
                try {
                    # Create template file
                    $template = Get-Content "characters/eliza.character.json" | ConvertFrom-Json
                    $template.name = $newName
                    $template | ConvertTo-Json -Depth 100 | Set-Content $newFile
                    
                    Write-CustomSuccess "Created new character file. Opening for editing..."
                    Start-Process notepad $newFile -Wait
                } catch {
                    Write-CustomError "Failed to create character file: $_"
                    continue
                }
            }
            "Use Existing" {
                do {
                    $selectedChars = $characters | Out-GridView -Title "Select character(s) - Selection required" -OutputMode Multiple
                    
                    if (-not $selectedChars) {
                        Write-CustomInfo "Please select at least one character"
                        Start-Sleep -Seconds 1
                        continue
                    }
                    
                    $charPaths = $selectedChars | ForEach-Object { "./characters/$_.character.json" }
                    $script:selected_character_path = $charPaths -join ','
                    Write-CustomSuccess "Selected characters: $($selectedChars -join ', ')"
                    return $true
                    
                } while (-not $selectedChars)
            }
        }
    }
}

# Start Eliza
function Start-ElizaApp {
    Write-CustomInfo "Would you like to configure API secrets in .env?"
    $configureEnv = Read-Host "Edit .env file? (y/n)"
    if ($configureEnv -eq 'y') {
        if (-not (Test-Path ".env")) {
            Write-CustomError "No .env file found"
            return $false
        }
        Start-Process notepad .env -Wait
        Write-CustomSuccess "Environment configuration updated"
    }
    
    if (-not (Select-Character)) {
        Write-CustomError "Failed to select character"
        return $false
    }
    
    Write-CustomInfo "Starting Eliza..."
    
    try {
        # Start server
        $serverProcess = Start-Process pnpm -ArgumentList "start --characters=`"$selected_character_path`"" -PassThru -WindowStyle Hidden
        $script:SERVER_PID = $serverProcess.Id
        Start-Sleep -Seconds 2
        
        if ($serverProcess.HasExited) {
            throw "Server process failed to start"
        }
        
        # Start client
        $clientProcess = Start-Process pnpm -ArgumentList "start:client" -PassThru -WindowStyle Hidden
        $script:CLIENT_PID = $clientProcess.Id
        Start-Sleep -Seconds 3
        
        if ($clientProcess.HasExited) {
            throw "Client process failed to start"
        }
        
        # Open in browser
        Start-Process "http://localhost:5173"
        
        Write-CustomSuccess "Eliza is now running"
        Write-CustomInfo "Press Ctrl+C to stop Eliza"
        
        # Wait for processes
        Wait-Process -Id $SERVER_PID
        
    } catch {
        Write-CustomError "Failed to start Eliza: $_"
        if ($SERVER_PID) { Stop-Process -Id $SERVER_PID -ErrorAction SilentlyContinue }
        if ($CLIENT_PID) { Stop-Process -Id $CLIENT_PID -ErrorAction SilentlyContinue }
        return $false
    }
    
    return $true
}

# Main execution
try {
    if ($VerbosePreference -eq "Continue") {
        Write-CustomVerbose "Running in verbose mode"
    }
    
    Install-Dependencies
    Install-NVM
    Setup-Node
    Setup-Environment
    
    if (-not (Start-ElizaApp)) {
        exit 1
    }
    
} catch {
    Write-CustomError "An error occurred: $_"
    exit 1
} finally {
    if ($SERVER_PID) { Stop-Process -Id $SERVER_PID -ErrorAction SilentlyContinue }
    if ($CLIENT_PID) { Stop-Process -Id $CLIENT_PID -ErrorAction SilentlyContinue }
} 