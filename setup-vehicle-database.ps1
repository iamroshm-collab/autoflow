# Vehicle Make/Model Database Setup - Quick Commands

# Step 1: Generate and run Prisma migration
Write-Host "Step 1: Creating database migration..." -ForegroundColor Cyan
npx prisma migrate dev --name add_vehicle_make_model_table

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Migration created successfully!" -ForegroundColor Green
    
    # Step 2: Seed the database
    Write-Host "`nStep 2: Seeding vehicle data (1000+ entries)..." -ForegroundColor Cyan
    node scripts/seed-vehicle-makes-models.js
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✅ Database seeded successfully!" -ForegroundColor Green
        Write-Host "`n📊 Your database now contains:" -ForegroundColor Yellow
        Write-Host "   - 70+ vehicle brands" -ForegroundColor White
        Write-Host "   - 1000+ vehicle models" -ForegroundColor White
        Write-Host "   - Cars, Trucks, Pickups, Bikes" -ForegroundColor White
        Write-Host "`n📖 Next Steps:" -ForegroundColor Yellow
        Write-Host "   1. Review VEHICLE_MAKE_MODEL_IMPLEMENTATION.md for form integration" -ForegroundColor White
        Write-Host "   2. Update your forms to use the new database system" -ForegroundColor White
        Write-Host "   3. Test the new make/model confirmation flow" -ForegroundColor White
    } else {
        Write-Host "❌ Seeding failed! Check the error above." -ForegroundColor Red
    }
} else {
    Write-Host "❌ Migration failed! Check the error above." -ForegroundColor Red
}
