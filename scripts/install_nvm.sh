#!/bin/bash

# Download and run the nvm installation script
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash

# Attempt to load nvm immediately
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Verify installation
if command -v nvm &> /dev/null; then
    echo "NVM installed successfully"
    exit 0
else
    echo "NVM installation failed"
    exit 1
fi 