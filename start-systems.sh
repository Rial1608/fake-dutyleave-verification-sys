#!/bin/bash
# 🚀 Start Both Systems - Linux/Mac/WSL
# This script starts both the Fake DL System and Attendance System

echo "🚀 Starting Multi-System Architecture"
echo "======================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if processes are already running
echo "🔍 Checking for already running processes..."

if lsof -i :3000 &> /dev/null; then
    echo "⚠️  Port 3000 is already in use. Please stop that process first."
    exit 1
fi

if lsof -i :3001 &> /dev/null; then
    echo "⚠️  Port 3001 is already in use. Please stop that process first."
    exit 1
fi

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Start Fake DL System
echo "📦 Starting Fake DL System on port 3000..."
cd "$SCRIPT_DIR/fakedl-sys"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📥 Installing dependencies for fakedl-sys..."
    npm install
fi

npm start &
FAKE_DL_PID=$!
echo "✅ Fake DL System started (PID: $FAKE_DL_PID)"

# Wait a moment for first system to start
sleep 2

# Start Attendance System
echo "📦 Starting Attendance System on port 3001..."
cd "$SCRIPT_DIR/attendance-sys"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📥 Installing dependencies for attendance-sys..."
    npm install
fi

npm start &
ATTENDANCE_PID=$!
echo "✅ Attendance System started (PID: $ATTENDANCE_PID)"

echo ""
echo "======================================"
echo "✅ Both systems are running!"
echo "======================================"
echo ""
echo "🌐 Access the systems:"
echo "   Fake DL System:  http://localhost:3000"
echo "   Attendance:      http://localhost:3001"
echo ""
echo "📋 API Endpoints:"
echo "   Fake DL API:     http://localhost:3000/api/dl"
echo "   Attendance API:  http://localhost:3001/api/attendance"
echo ""
echo "🛑 To stop all systems:"
echo "   Press Ctrl+C or run: kill $FAKE_DL_PID $ATTENDANCE_PID"
echo ""

# Wait for all background processes
wait
