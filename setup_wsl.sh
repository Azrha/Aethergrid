#!/bin/bash 
set -e

echo "=== Aethergrid WSL Setup ==="

# 1. Dependency Checks
if ! command -v python3 &> /dev/null; then
    echo "ERROR: python3 could not be found."
    exit 1
fi
if ! command -v node &> /dev/null; then
    echo "ERROR: node could not be found. Please install it (e.g. 'sudo apt install nodejs npm')."
    exit 1
fi

# 2. Virtual Environment (Standard .venv)
VENV_DIR=".venv"

# If venv exists but looks broken or Windows-y (no bin/activate), nuke it
if [ -d "$VENV_DIR" ] && [ ! -f "$VENV_DIR/bin/activate" ]; then
    echo ">> Detected invalid/Windows venv. Recreating..."
    rm -rf "$VENV_DIR"
fi

if [ ! -d "$VENV_DIR" ]; then
    echo ">> Creating Python venv ($VENV_DIR)..."
    python3 -m venv "$VENV_DIR"
else
    echo ">> Using existing $VENV_DIR"
fi

source "$VENV_DIR/bin/activate"

echo ">> Installing/Updating Python requirements..."
pip install -v -r requirements.txt

# 3. Frontend Setup
echo ">> Setting up Frontend..."
cd frontend
if [ ! -d "node_modules" ]; then
    echo ">> Installing npm dependencies..."
    npm install
else
    echo ">> checks passed (node_modules exists)"
fi
cd ..

echo ""
echo "=== Setup Complete! ==="
echo "To run Aethergrid:"
echo "  ./run_stack.sh"
