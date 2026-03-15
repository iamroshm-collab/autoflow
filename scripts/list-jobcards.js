const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function listJobcards() {
  try {
    const rows = await prisma.jobCard.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        customer: { select: { name: true, mobileNo: true } },
        vehicle: { select: { registrationNumber: true, make: true, model: true } },
      },
    })

    console.log('Latest jobcards:')
    rows.forEach((r, i) => {
      console.log(`${i + 1}. ${r.jobCardNumber} | status: ${r.jobcardStatus} | reg: ${r.vehicle?.registrationNumber || '-'} | make/model: ${r.vehicle?.make || '-'} ${r.vehicle?.model || '-'} | customer: ${r.customer?.name || '-'} | createdAt: ${r.createdAt.toISOString()}`)
    })

    console.log(`\nTotal listed: ${rows.length}`)
  } catch (err) {
    console.error('Error listing jobcards:', err)
  } finally {
    await prisma.$disconnect()
  }
}

listJobcards()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
