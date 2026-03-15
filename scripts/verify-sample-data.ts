import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function verifyData() {
  try {
    const jobcards = await prisma.jobCard.findMany({
      where: { jobcardStatus: "Under Service" },
      include: {
        serviceDescriptions: true,
        sparePartsBills: true,
        employeeEarnings: true,
        financialTransactions: true,
        customer: true,
        vehicle: true,
      },
    })

    console.log("======================================================================")
    console.log(`📊 SAMPLE DATA VERIFICATION REPORT`)
    console.log("======================================================================")
    console.log(`\n✅ Total Under Service Jobcards: ${jobcards.length}\n`)

    let totalServices = 0
    let totalParts = 0
    let totalTechs = 0
    let totalTrans = 0

    jobcards.forEach((jc) => {
      const services = jc.serviceDescriptions.length
      const parts = jc.sparePartsBills.length
      const techs = jc.employeeEarnings.length
      const trans = jc.financialTransactions.length

      totalServices += services
      totalParts += parts
      totalTechs += techs
      totalTrans += trans

      console.log(`📋 ${jc.jobCardNumber} | Cust: ${jc.customer?.name || "N/A"} | Vehicle: ${jc.vehicle?.registrationNumber || "N/A"}`)
      console.log(`   ├─ 🔧 Services: ${services}`)
      console.log(`   ├─ 🛠️  Spare Parts: ${parts}`)
      console.log(`   ├─ 👨‍🔧 Technicians: ${techs}`)
      console.log(`   └─ 💰 Transactions: ${trans}`)
      console.log()
    })

    console.log("======================================================================")
    console.log(`📈 SUMMARY TOTALS:`)
    console.log("======================================================================")
    console.log(`Total Service Descriptions: ${totalServices}`)
    console.log(`Total Spare Parts Bills: ${totalParts}`)
    console.log(`Total Technician Allocations: ${totalTechs}`)
    console.log(`Total Financial Transactions: ${totalTrans}`)
    console.log()
    console.log(`✨ Sample data seed completed successfully!`)
  } catch (error) {
    console.error("Error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

verifyData()
