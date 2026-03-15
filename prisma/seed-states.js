// Seed script to add Indian states and state codes
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const states = [
  { stateName: 'Jammu And Kashmir', stateCode: '01' },
  { stateName: 'Himachal Pradesh', stateCode: '02' },
  { stateName: 'Punjab', stateCode: '03' },
  { stateName: 'Chandigarh', stateCode: '04' },
  { stateName: 'Uttarakhand', stateCode: '05' },
  { stateName: 'Haryana', stateCode: '06' },
  { stateName: 'Delhi', stateCode: '07' },
  { stateName: 'Rajasthan', stateCode: '08' },
  { stateName: 'Uttar Pradesh', stateCode: '09' },
  { stateName: 'Bihar', stateCode: '10' },
  { stateName: 'Sikkim', stateCode: '11' },
  { stateName: 'Arunachal Pradesh', stateCode: '12' },
  { stateName: 'Nagaland', stateCode: '13' },
  { stateName: 'Manipur', stateCode: '14' },
  { stateName: 'Mizoram', stateCode: '15' },
  { stateName: 'Tripura', stateCode: '16' },
  { stateName: 'Meghalaya', stateCode: '17' },
  { stateName: 'Assam', stateCode: '18' },
  { stateName: 'West Bengal', stateCode: '19' },
  { stateName: 'Jharkhand', stateCode: '20' },
  { stateName: 'Orissa', stateCode: '21' },
  { stateName: 'Chhattisgarh', stateCode: '22' },
  { stateName: 'Madhya Pradesh', stateCode: '23' },
  { stateName: 'Gujarat', stateCode: '24' },
  { stateName: 'Dadra And Nagar Haveli & Daman And Diu', stateCode: '26' },
  { stateName: 'Maharashtra', stateCode: '27' },
  { stateName: 'Karnataka', stateCode: '29' },
  { stateName: 'Goa', stateCode: '30' },
  { stateName: 'Lakshadweep', stateCode: '31' },
  { stateName: 'Kerala', stateCode: '32' },
  { stateName: 'Tamil Nadu', stateCode: '33' },
  { stateName: 'Puducherry', stateCode: '34' },
  { stateName: 'Andaman And Nicobar', stateCode: '35' },
  { stateName: 'Telangana', stateCode: '36' },
  { stateName: 'Andhra Pradesh', stateCode: '37' },
  { stateName: 'Ladakh', stateCode: '38' },
  { stateName: 'Other Territory', stateCode: '97' },
  { stateName: 'Other Country', stateCode: '99' },
]

async function seedStates() {
  try {
    console.log('Starting to seed states...')
    
    for (const state of states) {
      // Check if state already exists by name
      const existing = await prisma.state.findFirst({
        where: { stateName: state.stateName }
      })
      
      if (existing) {
        console.log(`State "${state.stateName}" already exists. Skipping...`)
        continue
      }
      
      // Create new state
      const createdState = await prisma.state.create({
        data: {
          stateName: state.stateName,
          stateCode: state.stateCode,
        }
      })
      
      console.log(`✓ Created state: ${createdState.stateName} (${createdState.stateCode})`)
    }
    
    console.log('✓ States seeding completed successfully!')
  } catch (error) {
    console.error('Error seeding states:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

seedStates()
