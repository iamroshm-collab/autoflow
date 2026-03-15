#!/bin/bash

# ==========================================
# Technician System Setup Script
# ==========================================
# 
# This script installs dependencies and sets up
# the technician job allocation system
#
# Usage: ./setup-technician-system.sh
# Or run commands manually
# ==========================================

echo "=========================================="
echo "Technician System Setup"
echo "=========================================="
echo ""

# Step 1: Install NPM packages
echo "Step 1: Installing dependencies..."
npm install firebase-admin firebase

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo ""

# Step 2: Generate Prisma Client
echo "Step 2: Generating Prisma Client..."
npx prisma generate

if [ $? -eq 0 ]; then
    echo "✅ Prisma Client generated successfully"
else
    echo "❌ Failed to generate Prisma Client"
    exit 1
fi

echo ""

# Step 3: Run Database Migration
echo "Step 3: Running database migration..."
echo "This will create the following tables:"
echo "  - Technicians"
echo "  - TechnicianAllocations"
echo "  - DeviceTokens"
echo ""

npx prisma migrate dev --name add_technician_allocation_system

if [ $? -eq 0 ]; then
    echo "✅ Database migration completed successfully"
else
    echo "❌ Failed to run migration"
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Configure environment variables in .env"
echo "   - See .env.technician.example for reference"
echo "2. Setup Firebase project and add service account key"
echo "3. Start the development server: npm run dev"
echo "4. Test API endpoints (see TECHNICIAN_QUICK_START.md)"
echo ""
echo "Documentation:"
echo "  - TECHNICIAN_SYSTEM_GUIDE.md - Complete guide"
echo "  - TECHNICIAN_QUICK_START.md - Quick setup"
echo "  - TECHNICIAN_IMPLEMENTATION_COMPLETE.md - Summary"
echo ""
