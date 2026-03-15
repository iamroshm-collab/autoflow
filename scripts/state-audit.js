const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const purchaseStates = await prisma.purchase.groupBy({ by: ['stateId'], _count: { _all: true } })
  const saleStates = await prisma.sale.groupBy({ by: ['stateCode'], _count: { _all: true } })
  const supplierStates = await prisma.supplier.groupBy({ by: ['stateCode'], _count: { _all: true } })
  console.log(JSON.stringify({ purchaseStates, saleStates, supplierStates }, null, 2))
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
