#!/bin/bash
set -e
set -o pipefail

# Initial variables
NVM_VERSION="v0.39.1"
NODE_VERSION="23.3.0"
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'
NC='\033[0m'; BOLD='\033[1m'

# Global variables for process management
SERVER_PID=""
CLIENT_PID=""

# Set up interrupt handling
trap 'cleanup' EXIT INT TERM

# Basic functions first
install_gum() {
    if ! command -v gum &> /dev/null; then
        log_info "Installing gum for better UI..."
        if ! command -v brew &> /dev/null; then
            log_info "Installing Homebrew first..."
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        fi
        brew install gum
    fi
}

# After gum is installed, we can use it for logging
log_error() { gum style --foreground 1 "❌ ${1}"; }
log_success() { gum style --foreground 2 "✅ ${1}"; }
log_info() { gum style --foreground 4 "ℹ️  ${1}"; }
log_verbose() { 
    if [ "$VERBOSE" = true ]; then
        gum style --foreground 3 "🔍 ${1}"
    fi
}

# Rest of the functions remain identical to setup.sh
# ...

install_dependencies() {
    log_verbose "Starting system dependency installation..."
    if ! command -v brew &> /dev/null; then
        log_info "Installing Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi
    
    if [ "$VERBOSE" = true ]; then
        brew install git curl python3 ffmpeg
    else
        gum spin --spinner dot --title "Installing system dependencies..." -- \
            brew install git curl python3 ffmpeg
    fi
    log_success "Dependencies installed"
    if [ "$VERBOSE" = true ]; then
        log_verbose "Installed versions:"
        git --version
        curl --version | head -n 1
        python3 --version
        pip3 --version
        ffmpeg -version | head -n 1
    fi
}

# The rest of the script remains identical
# ... 