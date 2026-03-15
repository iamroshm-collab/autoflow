import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// Sample data generators
const sampleCustomers = [
  { name: "Rajesh Kumar", mobileNo: "9876543201", email: "rajesh@example.com", city: "Bangalore", state: "Karnataka" },
  { name: "Priya Singh", mobileNo: "9876543202", email: "priya@example.com", city: "Delhi", state: "Delhi" },
  { name: "Amit Patel", mobileNo: "9876543203", email: "amit@example.com", city: "Mumbai", state: "Maharashtra" },
  { name: "Neha Gupta", mobileNo: "9876543204", email: "neha@example.com", city: "Pune", state: "Maharashtra" },
  { name: "Vikram Sharma", mobileNo: "9876543205", email: "vikram@example.com", city: "Chennai", state: "Tamil Nadu" },
  { name: "Anjali Verma", mobileNo: "9876543206", email: "anjali@example.com", city: "Hyderabad", state: "Telangana" },
  { name: "Arjun Nair", mobileNo: "9876543207", email: "arjun@example.com", city: "Kochi", state: "Kerala" },
  { name: "Sneha Desai", mobileNo: "9876543208", email: "sneha@example.com", city: "Ahmedabad", state: "Gujarat" },
  { name: "Rohan Joshi", mobileNo: "9876543209", email: "rohan@example.com", city: "Surat", state: "Gujarat" },
  { name: "Divya Thapar", mobileNo: "9876543210", email: "divya@example.com", city: "Gurgaon", state: "Haryana" },
]

const sampleVehicles = [
  { registrationNumber: "KA01AB1234", make: "Maruti", model: "Swift" },
  { registrationNumber: "DL01CD5678", make: "Hyundai", model: "i20" },
  { registrationNumber: "MH02EF9012", make: "Tata", model: "Nexon" },
  { registrationNumber: "TS03GH3456", make: "Mahindra", model: "XUV500" },
  { registrationNumber: "TN04IJ7890", make: "Honda", model: "City" },
  { registrationNumber: "KL05KL1234", make: "Toyota", model: "Innova" },
  { registrationNumber: "GJ06MN5678", make: "Skoda", model: "Rapid" },
  { registrationNumber: "MH07OP9012", make: "Kia", model: "Seltos" },
  { registrationNumber: "KA08QR3456", make: "Renault", model: "Duster" },
  { registrationNumber: "DL09ST7890", make: "Volkswagen", model: "Polo" },
]

const serviceDescriptions = [
  "Engine Oil Change",
  "Air Filter Replacement",
  "Brake Pad Replacement",
  "Battery Check & Cleaning",
  "Tire Rotation & Balancing",
  "Coolant Top-up",
  "Spark Plugs Replacement",
  "Transmission Fluid Change",
  "AC Gas Refilling",
  "Windshield Wiper Blade Replacement",
  "Headlight Bulb Replacement",
  "Suspension Check",
  "Wheel Alignment",
  "Radiator Flush",
  "Fuel Filter Replacement",
]

const spareParts = [
  { name: "Bosch Oil Filter", price: 450 },
  { name: "Mobil 1 Engine Oil 5L", price: 650 },
  { name: "Goodrich Air Filter", price: 350 },
  { name: "Brembo Brake Pads", price: 1200 },
  { name: "Exide Car Battery", price: 4500 },
  { name: "Michelin Tyres", price: 5000 },
  { name: "Castrol Coolant 1L", price: 280 },
  { name: "NGK Spark Plugs Set", price: 800 },
  { name: "Shell Transmission Oil", price: 1500 },
  { name: "AC Refrigerant (Gas)", price: 450 },
]

const technicianNames = [
  "Suresh Kumar",
  "Gautam Singh",
  "Ramesh Patel",
  "Vikram Reddy",
  "Harish Sharma",
]

const shopNames = [
  "Auto Care Parts",
  "Prime Automotive",
  "Tech Auto Spares",
  "Quality CarParts",
  "Express Auto Shop",
]

async function seedSampleJobCards() {
  try {
    console.log("🌱 Starting sample jobcards seed...")

    // Create customers
    console.log("📝 Creating customers...")
    const customers = await Promise.all(
      sampleCustomers.map((customer) =>
        prisma.customer.upsert({
          where: { mobileNo: customer.mobileNo },
          update: {},
          create: {
            ...customer,
            stateId: "1",
            state: customer.state,
            gstin: `29${Math.random().toString().slice(2, 12)}`,
          },
        })
      )
    )
    console.log(`✅ Created ${customers.length} customers`)

    // Create vehicles
    console.log("🚗 Creating vehicles...")
    const vehicles = await Promise.all(
      sampleVehicles.map((vehicle) =>
        prisma.vehicle.upsert({
          where: { registrationNumber: vehicle.registrationNumber },
          update: {},
          create: {
            ...vehicle,
            year: 2022 + Math.floor(Math.random() * 3),
            color: ["White", "Black", "Silver", "Red", "Blue"][Math.floor(Math.random() * 5)],
            lastCustomerId: customers[Math.floor(Math.random() * customers.length)].id,
          },
        })
      )
    )
    console.log(`✅ Created ${vehicles.length} vehicles`)

    // Create jobcards with related data
    console.log("🔧 Creating jobcards with related data...")
    let jobCardNumber = 1001

    for (let i = 0; i < 10; i++) {
      const customerId = customers[i].id
      const vehicleId = vehicles[i].id
      const jobCardNum = `JC-${jobCardNumber++}`

      // Create jobcard
      const jobCard = await prisma.jobCard.create({
        data: {
          jobCardNumber: jobCardNum,
          customerId,
          vehicleId,
          serviceDate: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Within last 7 days
          jobcardStatus: "Under Service",
          deliveryDate: null,
          vehicleStatus: "In Workshop",
          maintenanceType: ["Regular", "Scheduled", "Periodic"][Math.floor(Math.random() * 3)],
          fileNo: `FILE-${2000 + i}`,
          kmDriven: 50000 + Math.floor(Math.random() * 100000),
          nextServiceKM: 55000 + Math.floor(Math.random() * 100000),
          nextServiceDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          paidAmount: 0,
          advancePayment: Math.random() > 0.5 ? Math.floor(Math.random() * 5000) : 0,
          taxable: true,
          electrical: Math.random() > 0.5,
          ac: Math.random() > 0.4,
          mechanical: Math.random() > 0.3,
          others: Math.random() > 0.6,
        },
      })

      // Create service descriptions (5-10 items)
      const serviceCount = 5 + Math.floor(Math.random() * 6)
      const serviceDescs = []
      let totalServiceAmount = 0

      for (let j = 0; j < serviceCount; j++) {
        const description = serviceDescriptions[Math.floor(Math.random() * serviceDescriptions.length)]
        const amount = 500 + Math.floor(Math.random() * 2000)
        totalServiceAmount += amount

        serviceDescs.push(
          prisma.serviceDescription.create({
            data: {
              jobCardId: jobCard.id,
              sl: j + 1,
              description,
              qnty: 1,
              unit: "Job",
              amount,
              salePrice: amount,
              totalAmount: amount,
              taxableAmount: amount,
              igstRate: 18,
              igstAmount: (amount * 18) / 100,
              cgstRate: 0,
              sgstRate: 0,
              stateId: "1",
            },
          })
        )
      }

      await Promise.all(serviceDescs)

      // Create spare parts bills (5 items)
      const sparePartsBills = []
      let totalSpareParts = 0

      for (let j = 0; j < 5; j++) {
        const sparePart = spareParts[Math.floor(Math.random() * spareParts.length)]
        const quantity = 1 + Math.floor(Math.random() * 3)
        const amount = sparePart.price * quantity
        totalSpareParts += amount

        sparePartsBills.push(
          prisma.sparePartsBill.create({
            data: {
              jobCardId: jobCard.id,
              sl: j + 1,
              shopName: shopNames[Math.floor(Math.random() * shopNames.length)],
              vehicleMake: vehicles[i].make,
              vehicleModel: vehicles[i].model,
              registrationNumber: vehicles[i].registrationNumber,
              billDate: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
              billNumber: `BILL-${Math.floor(Math.random() * 10000)}`,
              itemDescription: `${sparePart.name} (Qty: ${quantity})`,
              amount,
              paid: amount,
              paidDate: new Date(),
              billReturned: false,
              returnAmount: 0,
            },
          })
        )
      }

      await Promise.all(sparePartsBills)

      // Create technician allocations (3-5 records)
      const technicianCount = 3 + Math.floor(Math.random() * 3)
      const technicianAllocations = []
      let totalTechAmount = 0

      for (let j = 0; j < technicianCount; j++) {
        const allocationAmount = 500 + Math.floor(Math.random() * 1500)
        totalTechAmount += allocationAmount
        const employeeName = technicianNames[Math.floor(Math.random() * technicianNames.length)]

        technicianAllocations.push(
          prisma.employeeEarning.create({
            data: {
              jobCardId: jobCard.id,
              sl: j + 1,
              transactionDate: new Date(),
              vehicleModel: vehicles[i].model,
              vehicleMake: vehicles[i].make,
              registrationNumber: vehicles[i].registrationNumber,
              employee: employeeName,
              employeeID: `EMP-${1000 + Math.floor(Math.random() * 900)}`,
              workType: ["Mechanical", "Electrical", "Welding", "Painting"][Math.floor(Math.random() * 4)],
              amount: allocationAmount,
            },
          })
        )
      }

      await Promise.all(technicianAllocations)

      // Create financial transactions (2-4 records)
      const finTransCount = 2 + Math.floor(Math.random() * 3)
      const totalBill = totalServiceAmount + (totalServiceAmount * 18) / 100 + totalSpareParts + totalTechAmount
      const advanceUsed = jobCard.advancePayment
      let remainingAmount = totalBill - advanceUsed
      let paymentMade = 0

      const financialTransactions = []

      for (let j = 0; j < finTransCount && remainingAmount > 0; j++) {
        const paymentAmount = j === finTransCount - 1 ? remainingAmount : Math.floor(remainingAmount / 2)
        paymentMade += paymentAmount

        financialTransactions.push(
          prisma.financialTransaction.create({
            data: {
              jobCardId: jobCard.id,
              vehicleId: vehicleId,
              transactionType: ["Service", "Parts", "Labour", "Tax"][j % 4],
              transactionDate: new Date(),
              description: `Payment for job card ${jobCardNum}`,
              paymentType: ["Cash", "UPI", "Card", "Cheque"][Math.floor(Math.random() * 4)],
              transactionAmount: paymentAmount,
            },
          })
        )

        remainingAmount -= paymentAmount
      }

      await Promise.all(financialTransactions)

      // Update jobcard with totals
      await prisma.jobCard.update({
        where: { id: jobCard.id },
        data: {
          total: totalBill,
          paidAmount: Math.min(paymentMade + advanceUsed, totalBill),
          balance: Math.max(0, totalBill - paymentMade - advanceUsed),
        },
      })

      console.log(`✅ Created jobcard ${jobCardNum} with 5 spare parts, ${serviceCount} services, ${technicianCount} technicians, ${finTransCount} transactions`)
    }

    console.log("🎉 Sample data seeding completed successfully!")
  } catch (error) {
    console.error("❌ Error seeding data:", error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

seedSampleJobCards()
