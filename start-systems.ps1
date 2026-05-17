# 🚀 Start Both Systems - Windows PowerShell
# This script starts both the Fake DL System and Attendance System
# Run as: powershell -NoProfile -ExecutionPolicy Bypass -File start-systems.ps1

Write-Host "🚀 Starting Multi-System Architecture" -ForegroundColor Green
Write-Host "======================================"

# Check if Node.js is installed
$nodeCheck = node --version 2>$null
if (!$nodeCheck) {
    Write-Host "❌ Node.js is not installed. Please install Node.js first." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Node.js version: $nodeCheck"

# Check ports
Write-Host "🔍 Checking if ports are available..."

$port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
$port3001 = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue

if ($port3000) {
    Write-Host "⚠️  Port 3000 is already in use." -ForegroundColor Yellow
    exit 1
}

if ($port3001) {
    Write-Host "⚠️  Port 3001 is already in use." -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Ports 3000 and 3001 are available"

# Get script directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path

# Start Fake DL System
Write-Host "`n📦 Starting Fake DL System on port 3000..." -ForegroundColor Cyan
$fakedlPath = Join-Path $scriptPath "fakedl-sys"

Push-Location $fakedlPath

if (!(Test-Path "node_modules")) {
    Write-Host "📥 Installing dependencies for fakedl-sys..." -ForegroundColor Yellow
    npm install
}

# Start in new process
Start-Process -FilePath "cmd" -ArgumentList "/c npm start" -NoNewWindow
Write-Host "✅ Fake DL System started"

# Wait a moment
Start-Sleep -Seconds 2

# Start Attendance System
Write-Host "`n📦 Starting Attendance System on port 3001..." -ForegroundColor Cyan
$attendancePath = Join-Path $scriptPath "attendance-sys"

Pop-Location
Push-Location $attendancePath

if (!(Test-Path "node_modules")) {
    Write-Host "📥 Installing dependencies for attendance-sys..." -ForegroundColor Yellow
    npm install
}

# Start in new process
Start-Process -FilePath "cmd" -ArgumentList "/c npm start" -NoNewWindow
Write-Host "✅ Attendance System started"

Pop-Location

Write-Host "`n======================================"
Write-Host "✅ Both systems are running!" -ForegroundColor Green
Write-Host "======================================"
Write-Host ""
Write-Host "🌐 Access the systems:" -ForegroundColor Green
Write-Host "   Fake DL System:  http://localhost:3000"
Write-Host "   Attendance:      http://localhost:3001"
Write-Host ""
Write-Host "📋 API Endpoints:" -ForegroundColor Green
Write-Host "   Fake DL API:     http://localhost:3000/api/dl"
Write-Host "   Attendance API:  http://localhost:3001/api/attendance"
Write-Host ""
Write-Host "💡 Tip: Open the URLs above in your browser"
Write-Host ""
