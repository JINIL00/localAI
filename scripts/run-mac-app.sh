#!/bin/bash

# LocalAI Chat - Mac App Runner
# This script helps you run and build the Mac app

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🚀 LocalAI Chat - Mac App"
echo "========================="
echo ""

# Check for Ollama
if ! command -v ollama &> /dev/null; then
    echo -e "${RED}Error: Ollama is not installed.${NC}"
    echo "Please install from https://ollama.ai"
    exit 1
fi

# Check for Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Error: Python 3 is not installed.${NC}"
    exit 1
fi

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed.${NC}"
    echo "Please install from https://nodejs.org"
    exit 1
fi

# Function to install dependencies
install_deps() {
    echo -e "${YELLOW}Installing dependencies...${NC}"

    # Backend
    echo "Installing backend dependencies..."
    cd "$PROJECT_ROOT/backend"
    pip3 install -r requirements.txt --quiet

    # Frontend
    echo "Installing frontend dependencies..."
    cd "$PROJECT_ROOT/frontend"
    npm install --silent

    # Electron
    echo "Installing Electron dependencies..."
    cd "$PROJECT_ROOT/electron"
    npm install --silent

    echo -e "${GREEN}Dependencies installed!${NC}"
}

# Function to build the app
build_app() {
    echo -e "${YELLOW}Building app...${NC}"

    # Build frontend
    echo "Building frontend..."
    cd "$PROJECT_ROOT/frontend"
    npm run build

    # Build Electron app
    echo "Building Electron app..."
    cd "$PROJECT_ROOT/electron"
    npm run build:mac

    echo -e "${GREEN}Build complete!${NC}"
    echo "App located at: $PROJECT_ROOT/electron/dist/"
}

# Function to run in dev mode
run_dev() {
    echo -e "${YELLOW}Starting in development mode...${NC}"

    # Start Ollama if not running
    if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo "Starting Ollama..."
        ollama serve &
        sleep 2
    fi

    cd "$PROJECT_ROOT/electron"
    npm run dev
}

# Parse command
case "${1:-dev}" in
    install)
        install_deps
        ;;
    build)
        install_deps
        build_app
        ;;
    dev)
        run_dev
        ;;
    *)
        echo "Usage: $0 {install|build|dev}"
        echo ""
        echo "Commands:"
        echo "  install  - Install all dependencies"
        echo "  build    - Build the Mac app for distribution"
        echo "  dev      - Run in development mode"
        exit 1
        ;;
esac
