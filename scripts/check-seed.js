const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const suppliers = await prisma.supplier.findMany({ where: { supplierName: { startsWith: 'Seed Supplier' } }, orderBy: { supplierId: 'asc' } })
  console.log(`Found ${suppliers.length} Seed Suppliers`)
  for (const s of suppliers) {
    const count = await prisma.product.count({ where: { supplierId: s.supplierId } })
    console.log(`${s.supplierName} (id ${s.supplierId}) -> products: ${count}`)
  }
}

main().catch(e => { console.error(e); process.exit(1) }).finally(async () => { await prisma.$disconnect() })
