const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('Adding 5 suppliers, each with 5 products')

  // ensure at least one state exists
  let state = await prisma.state.findFirst()
  if (!state) {
    state = await prisma.state.create({ data: { stateName: 'Default State', stateCode: 'DS' } })
  }

  // ensure at least one category exists
  let category = await prisma.category.findFirst()
  if (!category) {
    category = await prisma.category.create({ data: { categoryName: 'General', description: 'General category' } })
  }

  for (let s = 1; s <= 5; s++) {
    const supplierName = `Seed Supplier ${s}`
    const supplier = await prisma.supplier.create({
      data: {
        supplierName,
        address: `${s} Seed Street, City`,
        mobileNo: `90000000${String(10 + s).padStart(2,'0')}`,
        stateId: state.stateId,
        gstin: `GSTIN-SEED-${s.toString().padStart(3,'0')}`,
        pan: `PAN-SEED-${s.toString().padStart(3,'0')}`,
      },
    })

    const productsData = []
    for (let p = 1; p <= 5; p++) {
      productsData.push({
        supplierId: supplier.supplierId,
        categoryId: category.categoryId,
        productName: `${supplierName} Product ${p}`,
        unit: p % 2 === 0 ? 'Litre' : 'Piece',
        mrp: 100 + s * 10 + p * 5,
        purchasePrice: 70 + s * 8 + p * 3,
        salePrice: 85 + s * 9 + p * 4,
        balanceStock: 50 + p * 10,
      })
    }

    await prisma.product.createMany({ data: productsData })
    console.log(`Created ${supplierName} and ${productsData.length} products`)
  }

  const supplierCount = await prisma.supplier.count({ where: { supplierName: { startsWith: 'Seed Supplier' } } })
  const productCount = await prisma.product.count({ where: { productName: { contains: 'Seed Supplier Product' } } })
  console.log(`Done. Suppliers added: ${supplierCount}, Products added: ${productCount}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
