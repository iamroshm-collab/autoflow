const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

const prisma = new PrismaClient()

async function seedVehicleMakesModels() {
  try {
    console.log('Starting vehicle makes and models seeding...')

    // Read the seed data
    const seedDataPath = path.join(__dirname, '../database/vehicle-makes-models-seed.json')
    const seedData = JSON.parse(fs.readFileSync(seedDataPath, 'utf-8'))

    let totalCreated = 0
    let totalSkipped = 0

    for (const item of seedData) {
      const { make, models, category } = item

      console.log(`\nProcessing ${make} (${models.length} models)...`)

      for (const model of models) {
        try {
          // Check if already exists
          const existing = await prisma.vehicleMakeModel.findFirst({
            where: {
              make: {
                equals: make,
                mode: 'insensitive',
              },
              model: {
                equals: model,
                mode: 'insensitive',
              },
            },
          })

          if (existing) {
            totalSkipped++
            continue
          }

          // Create new entry
          await prisma.vehicleMakeModel.create({
            data: {
              make,
              model,
              category,
              isActive: true,
            },
          })

          totalCreated++
        } catch (error) {
          console.error(`Error creating ${make} ${model}:`, error.message)
        }
      }
    }

    console.log('\n✅ Seeding completed!')
    console.log(`📊 Total created: ${totalCreated}`)
    console.log(`⏭️  Total skipped: ${totalSkipped}`)

    // Show summary by category
    const summary = await prisma.vehicleMakeModel.groupBy({
      by: ['category'],
      _count: {
        id: true,
      },
    })

    console.log('\n📈 Summary by category:')
    summary.forEach((item) => {
      console.log(`   ${item.category}: ${item._count.id}`)
    })

    const totalMakes = await prisma.vehicleMakeModel.findMany({
      select: { make: true },
      distinct: ['make'],
    })
    console.log(`🚗 Total unique makes: ${totalMakes.length}`)

  } catch (error) {
    console.error('❌ Error seeding vehicle makes and models:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

seedVehicleMakesModels()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
