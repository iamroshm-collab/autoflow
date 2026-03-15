const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const gstStates = [
  { stateCode: '01', stateName: 'Jammu And Kashmir' },
  { stateCode: '02', stateName: 'Himachal Pradesh' },
  { stateCode: '03', stateName: 'Punjab' },
  { stateCode: '04', stateName: 'Chandigarh' },
  { stateCode: '05', stateName: 'Uttarakhand' },
  { stateCode: '06', stateName: 'Haryana' },
  { stateCode: '07', stateName: 'Delhi' },
  { stateCode: '08', stateName: 'Rajasthan' },
  { stateCode: '09', stateName: 'Uttar Pradesh' },
  { stateCode: '10', stateName: 'Bihar' },
  { stateCode: '11', stateName: 'Sikkim' },
  { stateCode: '12', stateName: 'Arunachal Pradesh' },
  { stateCode: '13', stateName: 'Nagaland' },
  { stateCode: '14', stateName: 'Manipur' },
  { stateCode: '15', stateName: 'Mizoram' },
  { stateCode: '16', stateName: 'Tripura' },
  { stateCode: '17', stateName: 'Meghalaya' },
  { stateCode: '18', stateName: 'Assam' },
  { stateCode: '19', stateName: 'West Bengal' },
  { stateCode: '20', stateName: 'Jharkhand' },
  { stateCode: '21', stateName: 'Orissa' },
  { stateCode: '22', stateName: 'Chhattisgarh' },
  { stateCode: '23', stateName: 'Madhya Pradesh' },
  { stateCode: '24', stateName: 'Gujarat' },
  { stateCode: '26', stateName: 'Dadra And Nagar Haveli & Daman And Diu' },
  { stateCode: '27', stateName: 'Maharashtra' },
  { stateCode: '29', stateName: 'Karnataka' },
  { stateCode: '30', stateName: 'Goa' },
  { stateCode: '31', stateName: 'Lakshadweep' },
  { stateCode: '32', stateName: 'Kerala' },
  { stateCode: '33', stateName: 'Tamil Nadu' },
  { stateCode: '34', stateName: 'Puducherry' },
  { stateCode: '35', stateName: 'Andaman And Nicobar' },
  { stateCode: '36', stateName: 'Telangana' },
  { stateCode: '37', stateName: 'Andhra Pradesh' },
  { stateCode: '38', stateName: 'Ladakh' },
  { stateCode: '97', stateName: 'Other Territory' },
  { stateCode: '99', stateName: 'Other Country' },
];

async function main() {
  console.log('Starting to add GST states...');

  for (const state of gstStates) {
    try {
      // Check if state already exists by stateCode
      const existing = await prisma.state.findFirst({
        where: { stateCode: state.stateCode }
      });

      if (existing) {
        console.log(`State ${state.stateName} (${state.stateCode}) already exists. Skipping.`);
        continue;
      }

      // Create the state
      const created = await prisma.state.create({
        data: {
          stateName: state.stateName,
          stateCode: state.stateCode,
        }
      });

      console.log(`✓ Added: ${created.stateName} (Code: ${created.stateCode}, ID: ${created.stateId})`);
    } catch (error) {
      console.error(`✗ Error adding ${state.stateName}:`, error.message);
    }
  }

  console.log('\nFinished adding GST states.');
  
  // Display summary
  const totalStates = await prisma.state.count();
  console.log(`\nTotal states in database: ${totalStates}`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
