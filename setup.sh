#!/bin/bash
set -e

echo "Installing Python dependencies..."
pipenv install

echo "Installing frontend dependencies..."
cd my-mail-app
npm install
cd ..

echo "Starting backend and frontend dev servers..."

# Run backend in background
pipenv run dev &

# Run frontend
cd my-mail-app
npm run dev
