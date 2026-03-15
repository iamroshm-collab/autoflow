# ==========================================
# Technician System Setup Script (Windows)
# ==========================================
# 
# This script installs dependencies and sets up
# the technician job allocation system
#
# Usage: .\setup-technician-system.ps1
# Or run commands manually
# ==========================================

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Technician System Setup" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Install NPM packages
Write-Host "Step 1: Installing dependencies..." -ForegroundColor Yellow
npm install firebase-admin firebase

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Dependencies installed successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 2: Generate Prisma Client
Write-Host "Step 2: Generating Prisma Client..." -ForegroundColor Yellow
npx prisma generate

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Prisma Client generated successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to generate Prisma Client" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 3: Run Database Migration
Write-Host "Step 3: Running database migration..." -ForegroundColor Yellow
Write-Host "This will create the following tables:" -ForegroundColor White
Write-Host "  - Technicians" -ForegroundColor White
Write-Host "  - TechnicianAllocations" -ForegroundColor White
Write-Host "  - DeviceTokens" -ForegroundColor White
Write-Host ""

npx prisma migrate dev --name add_technician_allocation_system

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Database migration completed successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to run migration" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "✅ Setup Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Configure environment variables in .env" -ForegroundColor White
Write-Host "   - See .env.technician.example for reference" -ForegroundColor Gray
Write-Host "2. Setup Firebase project and add service account key" -ForegroundColor White
Write-Host "3. Start the development server: npm run dev" -ForegroundColor White
Write-Host "4. Test API endpoints (see TECHNICIAN_QUICK_START.md)" -ForegroundColor White
Write-Host ""
Write-Host "Documentation:" -ForegroundColor Yellow
Write-Host "  - TECHNICIAN_SYSTEM_GUIDE.md - Complete guide" -ForegroundColor White
Write-Host "  - TECHNICIAN_QUICK_START.md - Quick setup" -ForegroundColor White
Write-Host "  - TECHNICIAN_IMPLEMENTATION_COMPLETE.md - Summary" -ForegroundColor White
Write-Host ""
