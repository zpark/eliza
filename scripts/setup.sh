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

# Basic functions first - fallback logging before gum is installed
log_error() { 
    if command -v gum &> /dev/null; then
        gum style --foreground 1 "❌ ${1}"
    else
        echo -e "\033[0;31m❌ ${1}\033[0m"
    fi
}

log_success() {
    if command -v gum &> /dev/null; then
        gum style --foreground 2 "✅ ${1}"
    else
        echo -e "\033[0;32m✅ ${1}\033[0m"
    fi
}

log_info() {
    if command -v gum &> /dev/null; then
        gum style --foreground 4 "ℹ️  ${1}"
    else
        echo -e "\033[0;34mℹ️  ${1}\033[0m"
    fi
}

log_verbose() { 
    if [ "$VERBOSE" = true ]; then
        if command -v gum &> /dev/null; then
            gum style --foreground 3 "🔍 ${1}"
        else
            echo -e "\033[1;33m🔍 ${1}\033[0m"
        fi
    fi
}

# Cleanup function
cleanup() {
    log_verbose "Cleaning up..."
    [ -n "$SERVER_PID" ] && kill $SERVER_PID 2>/dev/null || true
    [ -n "$CLIENT_PID" ] && kill $CLIENT_PID 2>/dev/null || true
}

# Command line argument parsing
VERBOSE=false
SKIP_NVM=false
while [[ "$#" -gt 0 ]]; do
    case $1 in
        -v|--verbose) VERBOSE=true; shift ;;
        --skip-nvm) SKIP_NVM=true; shift ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
done

# Error handling
handle_error() { 
    log_error "Error occurred in: $1"
    log_error "Exit code: $2"
    if [ "$VERBOSE" = true ]; then
        log_error "Stack trace:"
        caller
    fi
    exit 1
}

# Move install_gum to be called before any other function that uses gum
install_gum() {
    if ! command -v gum &> /dev/null; then
        echo -e "\033[0;34mℹ️  Installing gum for better UI...\033[0m"
        sudo mkdir -p /etc/apt/keyrings
        curl -fsSL https://repo.charm.sh/apt/gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/charm.gpg
        echo "deb [signed-by=/etc/apt/keyrings/charm.gpg] https://repo.charm.sh/apt/ * *" | sudo tee /etc/apt/sources.list.d/charm.list
        sudo apt update && sudo apt install -y gum
    fi
}

show_welcome() {
    clear
    cat << "EOF"
 EEEEEE LL    IIII ZZZZZZZ  AAAA
 EE     LL     II      ZZ  AA  AA
 EEEE   LL     II    ZZZ   AAAAAA
 EE     LL     II   ZZ     AA  AA
 EEEEEE LLLLL IIII ZZZZZZZ AA  AA

Eliza is an open-source AI agent.
     Created by ai16z 2024.
     
EOF
}

install_dependencies() {
    log_verbose "Starting system dependency installation..."
    if [ "$VERBOSE" = true ]; then
        sudo apt update && sudo apt install -y git curl python3 python3-pip make ffmpeg
    else
        gum spin --spinner dot --title "Installing system dependencies..." -- \
            sudo apt update && sudo apt install -y git curl python3 python3-pip make ffmpeg
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

install_nvm() {
    log_verbose "Checking NVM installation..."
    
    if [ -d "$HOME/.nvm" ]; then
        export NVM_DIR="$HOME/.nvm"
        # Try to load NVM if it exists
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
        
        if command -v nvm &> /dev/null; then
            log_success "NVM is already installed"
            [ "$VERBOSE" = true ] && log_verbose "NVM Version: $(nvm --version)"
            return 0
        fi
    fi

    log_verbose "Installing NVM..."

    # Install NVM directly
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh | PROFILE=/dev/null bash

    # Source NVM in the current shell
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    
    # Verify installation
    if command -v nvm &> /dev/null; then
        log_success "NVM installed successfully"
        [ "$VERBOSE" = true ] && log_verbose "NVM Version: $(nvm --version)"
        return 0
    fi

    # If we get here, installation failed
    log_error "NVM installation failed."
    log_error "Please try installing manually:"
    echo ""
    echo "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh | bash"
    echo ""
    echo "Then run: ./scripts/setup.sh --skip-nvm"
    exit 1
}

setup_node() {
    # Make sure NVM is loaded
    if ! command -v nvm &> /dev/null; then
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
        
        if ! command -v nvm &> /dev/null; then
            log_error "NVM is not properly installed. Please run the installation again."
            exit 1
        fi
    fi

    log_verbose "Installing Node.js ${NODE_VERSION}..."
    
    # Install Node.js
    if ! nvm install "${NODE_VERSION}"; then
        log_error "Failed to install Node.js ${NODE_VERSION}"
        exit 1
    fi

    # Set up aliases and use the installed version
    if ! nvm alias eliza "${NODE_VERSION}"; then
        log_error "Failed to create Node.js alias"
        exit 1
    fi

    if ! nvm use eliza; then
        log_error "Failed to switch to Node.js ${NODE_VERSION}"
        exit 1
    fi

    # Install pnpm
    if ! npm install -g pnpm; then
        log_error "Failed to install pnpm"
        exit 1
    fi

    log_success "Node.js and pnpm setup complete"
    
    if [ "$VERBOSE" = true ]; then
        log_verbose "Node version: $(node --version)"
        log_verbose "NPM version: $(npm --version)"
        log_verbose "PNPM version: $(pnpm --version)"
    fi
}

setup_environment() {
    log_verbose "Setting up environment..."
    if [ ! -f .env ]; then
        if [ ! -f .env.example ]; then
            log_error "No .env.example file found"
            exit 1
        fi
        if ! cp .env.example .env; then
            log_error "Failed to create .env file"
            exit 1
        fi
        log_success "Environment file created"
    else
        log_info "Environment file already exists"
    fi
}

select_character() {
    # Check if characters directory exists
    if [ ! -d "./characters" ]; then
        log_error "Characters directory not found"
        return 1
    fi

    # Get list of character files
    characters=()
    character_paths=()
    while IFS= read -r file; do
        # Store full path
        character_paths+=("$file")
        # Remove path and .character.json extension for display
        name=$(basename "$file" .character.json)
        characters+=("$name")
    done < <(find "./characters" -name "*.character.json" -type f | sort)

    while true; do
        # Instructions for user
        log_info "Select character(s):"
        log_info "(Use Ctrl+Space for multiple, Ctrl+A for all, Enter to confirm)"

        # Show initial menu options
        initial_choice=$(printf "Create New\nUse Existing" | gum choose --limit 1)
        
        case "$initial_choice" in
            "Create New")
                # Get new character name
                log_info "Enter name for new character (without spaces):"
                new_name=$(gum input --placeholder "character_name")
                
                if [ -z "$new_name" ]; then
                    log_error "No name provided"
                    continue
                fi

                # Create new character file
                new_file="./characters/${new_name}.character.json"
                if [ -f "$new_file" ]; then
                    log_error "Character file already exists"
                    continue
                fi

                # Copy template and replace name
                cat > "$new_file" << 'EOF'
                # ... (template JSON remains the same)
EOF
                # Open the new file for editing
                log_success "Created new character file. Opening for editing..."
                nano "$new_file"
                
                # Add to current list
                characters+=("$new_name")
                character_paths+=("$new_file")
                continue
                ;;
            "Use Existing")
                # Show character list for multi-select
                selected_names=$(printf "%s\n" "${characters[@]}" | gum choose --no-limit)
                
                # If no selection made, use the highlighted character
                if [ -z "$selected_names" ]; then
                    # Get the first visible character (highlighted one)
                    selected_names=$(printf "%s\n" "${characters[@]}" | head -n 1)
                    if [ -z "$selected_names" ]; then
                        log_error "No characters available"
                        continue
                    fi
                fi

                # Show action menu based on selection count
                char_count=$(echo "$selected_names" | wc -l)
                if [ "$char_count" -gt 1 ]; then
                    # Multiple characters - only show Run/Delete options
                    action=$(printf "Run\nDelete" | gum choose --limit 1)
                else
                    # Single character - show all options
                    action=$(printf "Run\nEdit\nDelete" | gum choose --limit 1)
                fi
                
                case "$action" in
                    "Delete")
                        if [ -n "$selected_names" ]; then
                            # Confirm deletion
                            log_info "Selected characters to delete:"
                            echo "$selected_names"
                            if gum confirm "Are you sure you want to delete these characters?"; then
                                # Delete each selected character
                                while IFS= read -r name; do
                                    if [ "$name" != "Create New" ]; then
                                        for i in "${!characters[@]}"; do
                                            if [ "${characters[$i]}" = "$name" ]; then
                                                log_info "Deleting character: $name"
                                                rm -f "${character_paths[$i]}"
                                                break
                                            fi
                                        done
                                    fi
                                done <<< "$selected_names"
                                
                                # Refresh character lists
                                characters=()
                                character_paths=()
                                while IFS= read -r file; do
                                    character_paths+=("$file")
                                    name=$(basename "$file" .character.json)
                                    characters+=("$name")
                                done < <(find "./characters" -name "*.character.json" -type f | sort)
                                
                                log_success "Characters deleted"
                            fi
                        else
                            log_error "No characters selected for deletion"
                        fi
                        continue
                        ;;
                    "Edit")
                        # Count selected characters
                        char_count=$(echo "$selected_names" | wc -l)
                        
                        if [ "$char_count" -gt 1 ]; then
                            # Edit each selected character
                            while IFS= read -r name; do
                                for i in "${!characters[@]}"; do
                                    if [ "${characters[$i]}" = "$name" ]; then
                                        log_info "Editing character: $name"
                                        nano "${character_paths[$i]}"
                                        break
                                    fi
                                done
                            done <<< "$selected_names"
                            log_success "Characters edited. Please select character(s) to continue:"
                        else
                            # Single character edit
                            for i in "${!characters[@]}"; do
                                if [ "${characters[$i]}" = "$selected_names" ]; then
                                    log_info "Editing character: $selected_names"
                                    nano "${character_paths[$i]}"
                                    log_success "Character edited. Please select character(s) to continue:"
                                    break
                                fi
                            done
                        fi
                        continue
                        ;;
                    "Run")
                        # Convert selected names to paths
                        selected_paths=""
                        first=true
                        while IFS= read -r name; do
                            for i in "${!characters[@]}"; do
                                if [ "${characters[$i]}" = "$name" ]; then
                                    if [ "$first" = true ]; then
                                        selected_paths="${character_paths[$i]}"
                                        first=false
                                    else
                                        selected_paths="$selected_paths,${character_paths[$i]}"
                                    fi
                                    break
                                fi
                            done
                        done <<< "$selected_names"

                        if [ -n "$selected_paths" ]; then
                            selected_character_path="$selected_paths"
                            log_success "Selected characters: $selected_names"
                            return 0
                        fi
                        ;;
                esac
                ;;
            *)
                log_error "Invalid choice"
                continue
                ;;
        esac
    done
}

# Add this new function for starting Eliza
start_eliza() {
    # Ask about editing environment configuration first
    log_info "Would you like to configure API secrets in .env?"
    if gum confirm "Edit .env file?"; then
        if [ ! -f ".env" ]; then
            log_error "No .env file found"
            return 1
        fi
        nano ".env"
        log_success "Environment configuration updated"
    fi

    # Add character selection before starting
    if ! select_character; then
        log_error "Failed to select character"
        return 1
    fi
    
    log_info "Starting Eliza..."
    
    # Start server with selected character(s)
    pnpm start --characters="$selected_character_path" &
    SERVER_PID=$!
    sleep 2
    
    # Check if server started successfully
    if ! kill -0 $SERVER_PID 2>/dev/null; then
        log_error "Failed to start Eliza server"
        return 1
    fi
    
    # Start client
    pnpm start:client &
    CLIENT_PID=$!
    sleep 3
    
    # Check if client started successfully
    if ! kill -0 $CLIENT_PID 2>/dev/null; then
        log_error "Failed to start Eliza client"
        kill $SERVER_PID 2>/dev/null
        return 1
    fi

    # Open in browser
    log_info "Opening Eliza in your browser..."
    if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "http://localhost:5173"
    elif command -v open >/dev/null 2>&1; then
        open "http://localhost:5173"
    else
        log_info "Please open http://localhost:5173 in your browser"
    fi

    log_success "Eliza is now running"
    log_info "Press Ctrl+C to stop Eliza"
    
    # Wait for both processes
    wait $SERVER_PID $CLIENT_PID
    return 0
}

# Simplify build_and_start to use the new function
build_and_start() {
    log_verbose "Starting build process..."
    
    # Check Node.js version
    REQUIRED_NODE_VERSION=22
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed or not in PATH"
        exit 1
    fi
    
    CURRENT_NODE_VERSION=$(node -v | cut -d'.' -f1 | sed 's/v//')
    if [ "$(expr "$CURRENT_NODE_VERSION" \< "$REQUIRED_NODE_VERSION")" -eq 1 ]; then
        log_error "Node.js version must be $REQUIRED_NODE_VERSION or higher. Current version is $CURRENT_NODE_VERSION."
        exit 1
    fi

    # Check for pnpm
    if ! command -v pnpm &> /dev/null; then
        log_error "pnpm is not installed. Please install pnpm before running the script."
        exit 1
    fi

    # Clean and install
    log_verbose "Cleaning project..."
    if ! pnpm clean; then
        log_error "Failed to clean project"
        exit 1
    fi
    log_success "Project cleaned"

    log_verbose "Installing dependencies..."
    if ! pnpm install --no-frozen-lockfile; then
        log_error "Failed to install dependencies"
        exit 1
    fi
    log_success "Dependencies installed"

    log_verbose "Building project..."
    if ! pnpm build; then
        log_error "Failed to build project"
        exit 1
    fi
    log_success "Project built successfully"

    start_eliza
}

# Simplify check_existing_installation to use the new function
check_existing_installation() {
    log_verbose "Checking for existing installation..."
    
    # Check for required files and dependencies
    if [ -f ".env" ] && [ -d "node_modules" ]; then
        # Load NVM if available
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
        
        # Check for required commands
        if command -v node &> /dev/null && command -v pnpm &> /dev/null; then
            # Verify Node.js version
            REQUIRED_NODE_VERSION=22
            CURRENT_NODE_VERSION=$(node -v | cut -d'.' -f1 | sed 's/v//')
            
            if [ "$(expr "$CURRENT_NODE_VERSION" '>=' "$REQUIRED_NODE_VERSION")" -eq 1 ]; then
                log_info "Existing installation detected"
                
                # Show options menu
                action=$(printf "Start\nUpdate\nReinstall" | gum choose --limit 1)

                case "$action" in
                    "Start")
                        start_eliza
                        exit 0
                        ;;
                    "Update")
                        log_info "Checking for updates..."
                        
                        # Fetch latest changes
                        if ! git fetch origin; then
                            log_error "Failed to fetch updates"
                            return 1
                        fi

                        # Check if we're behind origin
                        LOCAL=$(git rev-parse @)
                        REMOTE=$(git rev-parse @{u})

                        if [ "$LOCAL" = "$REMOTE" ]; then
                            log_success "Already up to date"
                            
                            # Ask to start
                            if gum confirm "Would you like to start Eliza now?"; then
                                start_eliza
                                exit 0
                            fi
                            exit 0  # Exit instead of return if user chooses not to start
                        fi
                        
                        # If we get here, there are updates
                        log_info "Updates available. Updating Eliza..."
                        
                        # Pull latest changes
                        if ! git pull; then
                            log_error "Failed to pull updates"
                            return 1
                        fi
                        
                        # Install any new dependencies
                        if ! pnpm install --no-frozen-lockfile; then
                            log_error "Failed to update dependencies"
                            return 1
                        fi
                        
                        # Rebuild
                        if ! pnpm build; then
                            log_error "Failed to rebuild after update"
                            return 1
                        fi
                        
                        log_success "Update completed"
                        
                        # Ask to start
                        if gum confirm "Would you like to start Eliza now?"; then
                            start_eliza
                            exit 0
                        fi
                        exit 0  # Exit instead of return if user chooses not to start
                        ;;
                    "Reinstall")
                        return 0  # Continue with fresh installation
                        ;;
                esac
            fi
        fi
    fi
    
    log_verbose "No valid installation found"
    return 0
}

main() {
    # Install gum first before any other operations
    install_gum
    
    show_welcome
    [ "$VERBOSE" = true ] && log_verbose "Running in verbose mode"

    # Add the installation check here
    check_existing_installation

    if ! gum confirm "Ready to install Eliza?"; then
        log_info "Installation cancelled"
        exit 0
    fi

    install_dependencies
    
    if [ "$SKIP_NVM" = false ]; then
        install_nvm
    fi

    setup_node
    setup_environment
    build_and_start

    # This will only be reached after Ctrl+C or error
    log_info "Eliza has been stopped"
}

# Call main function
main "$@"